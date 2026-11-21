"""Progresion del piloto: XP, niveles, rangos y recompensas por subir de nivel.

El XP es independiente de los PitCoins: se guarda en users.xp_total (cache) y en
xp_events (historial con referencia unica). Nunca depende del monto apostado y
gastar PitCoins no lo reduce. El nivel no se guarda: se calcula desde xp_total.

Activo por defecto (se desactiva con PURPLE1_XP_ENABLED=0). Con el XP activo,
bets.settle_race otorga XP y recompensas dentro de la misma transaccion que
reparte los PitCoins, y el servidor se niega a arrancar si faltan las tablas
de progresion (missing_schema). Desactivado, la liquidacion no consulta
ninguna tabla de progresion.
"""

import os

import settings
from coins import apply_movement
from database import fetch_all, fetch_one

XP_ENABLED = os.getenv("PURPLE1_XP_ENABLED", "1").strip() != "0"

# XP por pronostico: parametros xp.* de app_settings (settings.py).

# XP para pasar del nivel n al n+1: CURVE_BASE + CURVE_STEP * (n - 1).
CURVE_BASE = 50
CURVE_STEP = 12

# Nivel minimo de cada rango y PitCoins por cada nivel alcanzado dentro de el.
RANKS = (
    {"min_level": 1, "code": "NOVATO", "name": "Novato", "level_reward": 50},
    {"min_level": 6, "code": "AMATEUR", "name": "Amateur", "level_reward": 75},
    {"min_level": 11, "code": "PROFESIONAL", "name": "Profesional", "level_reward": 100},
    {"min_level": 21, "code": "LEYENDA", "name": "Leyenda", "level_reward": 150},
)


def _check_level(level):
    if not isinstance(level, int) or isinstance(level, bool) or level < 1:
        raise ValueError("El nivel debe ser un entero mayor o igual a 1.")


def xp_for_next(level):
    """XP necesario para pasar de `level` a `level + 1`."""
    _check_level(level)
    return CURVE_BASE + CURVE_STEP * (level - 1)


def total_xp_for(level):
    """XP acumulado necesario para alcanzar `level` (nivel 1 = 0 XP)."""
    _check_level(level)
    steps = level - 1
    return CURVE_BASE * steps + CURVE_STEP * steps * (steps - 1) // 2


def level_for(xp_total):
    if not isinstance(xp_total, int) or isinstance(xp_total, bool) or xp_total < 0:
        raise ValueError("El XP debe ser un entero no negativo.")
    level = 1
    while total_xp_for(level + 1) <= xp_total:
        level += 1
    return level


def rank_for(level):
    _check_level(level)
    current = RANKS[0]
    for rank in RANKS:
        if level >= rank["min_level"]:
            current = rank
    return current


def level_reward(level):
    """PitCoins por alcanzar `level`; el nivel inicial no tiene recompensa."""
    _check_level(level)
    return 0 if level == 1 else rank_for(level)["level_reward"]


def progress(xp_total):
    level = level_for(xp_total)
    start = total_xp_for(level)
    following = total_xp_for(level + 1)
    rank = rank_for(level)
    next_rank = next((r for r in RANKS if r["min_level"] > level), None)
    return {
        "xp_total": xp_total,
        "level": level,
        "rank": {"code": rank["code"], "name": rank["name"]},
        "level_start_xp": start,
        "next_level_xp": following,
        "xp_into_level": xp_total - start,
        "xp_for_next_level": following - start,
        "xp_remaining": following - xp_total,
        "percent": (xp_total - start) * 100 // (following - start),
        "next_level_reward": level_reward(level + 1),
        "next_rank": None if next_rank is None else {
            "code": next_rank["code"], "name": next_rank["name"], "level": next_rank["min_level"],
        },
    }


def _unpaid_levels(cursor, user_id, old_total, new_total):
    """Niveles cruzados entre old_total y new_total cuya recompensa aun no se pago."""
    for level in range(level_for(old_total) + 1, level_for(new_total) + 1):
        reference = f"level:{user_id}:{level}"
        cursor.execute("SELECT id FROM pitcoin_movements WHERE reference = %s", (reference,))
        if not cursor.fetchone():
            yield level, reference


def grant_level_rewards(cursor, user_id, old_total, new_total):
    """Una recompensa por cada nivel cruzado. La referencia level:{usuario}:{nivel}
    es unica en pitcoin_movements, asi que cada nivel paga una sola vez."""
    granted = []
    for level, reference in _unpaid_levels(cursor, user_id, old_total, new_total):
        apply_movement(cursor, user_id, level_reward(level), "LEVEL_REWARD", reference)
        granted.append(level)
    return granted


def _bet_xp_events(user_id, bet_id, correct, first_pending):
    """Eventos de XP de una apuesta liquidada: (tipo, XP, referencia unica)."""
    events = [("RACE_PARTICIPATION", settings.get("xp.participation"), f"xp:bet:{bet_id}:participation")]
    if correct:
        events.append(("RACE_CORRECT", settings.get("xp.correct"), f"xp:bet:{bet_id}:correct"))
    if first_pending:
        events.append(("FIRST_SETTLED_PREDICTION", settings.get("xp.first_settled"), f"xp:user:{user_id}:first-settled"))
    return events


def preview_bet_xp(cursor, bet, correct):
    """Lo que award_bet_xp otorgaria ahora mismo, sin escribir ni bloquear nada:
    mismas reglas (_bet_xp_events y _unpaid_levels) para la vista previa del panel."""
    user_id, bet_id = bet["user_id"], bet["id"]
    cursor.execute("SELECT xp_total FROM users WHERE id = %s", (user_id,))
    row = cursor.fetchone()
    if not row:
        raise RuntimeError("Usuario no encontrado al calcular el XP.")
    old_total = int(row["xp_total"])
    cursor.execute("SELECT id FROM xp_events WHERE reference = %s", (f"xp:user:{user_id}:first-settled",))
    events = _bet_xp_events(user_id, bet_id, correct, not cursor.fetchone())
    new_total = old_total + sum(amount for _, amount, _ in events)
    levels = [level for level, _ in _unpaid_levels(cursor, user_id, old_total, new_total)]
    return {
        "user_id": user_id,
        "xp_before": old_total,
        "xp_gained": new_total - old_total,
        "xp_total": new_total,
        "events": [kind for kind, _, _ in events],
        "level": level_for(new_total),
        "levels_rewarded": levels,
        "level_reward_pitcoins": sum(level_reward(level) for level in levels),
    }


def award_bet_xp(cursor, bet, correct):
    """Otorga el XP de una apuesta liquidada. Debe llamarse dentro de la
    transaccion de la liquidacion, despues de pasar la apuesta de PENDING a su
    estado final. Las referencias unicas de xp_events impiden repetir el XP."""
    user_id, bet_id = bet["user_id"], bet["id"]
    # Bloquear al usuario antes de revisar el bono: dos liquidaciones simultaneas
    # de carreras distintas no pueden concederle el primer pronostico dos veces.
    cursor.execute("SELECT xp_total FROM users WHERE id = %s FOR UPDATE", (user_id,))
    row = cursor.fetchone()
    if not row:
        raise RuntimeError("Usuario no encontrado al otorgar XP.")
    old_total = int(row["xp_total"])

    cursor.execute("SELECT id FROM xp_events WHERE reference = %s", (f"xp:user:{user_id}:first-settled",))
    events = _bet_xp_events(user_id, bet_id, correct, not cursor.fetchone())

    gained = sum(amount for _, amount, _ in events)
    cursor.execute("UPDATE users SET xp_total = xp_total + %s WHERE id = %s", (gained, user_id))
    if cursor.rowcount != 1:
        raise RuntimeError("No fue posible actualizar el XP del usuario.")
    running = old_total
    for kind, amount, reference in events:
        running += amount
        cursor.execute(
            """INSERT INTO xp_events (user_id, bet_id, amount, xp_after, kind, reference)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (user_id, bet_id, amount, running, kind, reference),
        )
    new_total = old_total + gained
    return {
        "user_id": user_id,
        "xp_gained": gained,
        "xp_total": new_total,
        "level": level_for(new_total),
        "levels_rewarded": grant_level_rewards(cursor, user_id, old_total, new_total),
    }


def missing_schema():
    """Lo que falta de 005_progression.sql en la base conectada; vacio si el XP
    puede activarse."""
    missing = []
    table = fetch_one(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'xp_events'"
    )
    if not table or not table["c"]:
        missing.append("tabla xp_events")
    column = fetch_one(
        "SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'xp_total'"
    )
    if not column or not column["c"]:
        missing.append("columna users.xp_total")
    kind = fetch_one(
        "SELECT column_type AS ty FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'pitcoin_movements' AND column_name = 'kind'"
    )
    kind_type = kind["ty"] if kind else ""
    if isinstance(kind_type, (bytes, bytearray)):
        kind_type = kind_type.decode()
    if "'LEVEL_REWARD'" not in (kind_type or ""):
        missing.append("tipo LEVEL_REWARD en pitcoin_movements.kind")
    return missing


def get_progress(user_id, limit=50):
    user = fetch_one("SELECT xp_total FROM users WHERE id = %s", (user_id,))
    if not user:
        return None
    events = fetch_all(
        """SELECT e.id, e.kind, e.amount, e.xp_after, e.created_at, b.race_id, r.name AS race_name
           FROM xp_events e
           JOIN bets b ON b.id = e.bet_id
           JOIN races r ON r.id = b.race_id
           WHERE e.user_id = %s
           ORDER BY e.id DESC
           LIMIT %s""",
        (user_id, int(limit)),
    )
    total = fetch_one("SELECT COUNT(*) AS total FROM xp_events WHERE user_id = %s", (user_id,))["total"]
    return {**progress(int(user["xp_total"])), "events": events, "events_total": int(total)}
