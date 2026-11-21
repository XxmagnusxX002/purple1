"""PitCoin balance changes; callers own the surrounding transaction."""

import re

from admin_common import parse_int
from audit import record
from database import db_cursor, fetch_all, is_duplicate_key


def apply_movement(cursor, user_id, delta, kind, reference, actor_user_id=None, reason=None):
    if not isinstance(delta, int) or delta == 0:
        raise ValueError("El movimiento debe tener un importe entero distinto de cero.")
    cursor.execute(
        "UPDATE users SET coins = coins + %s WHERE id = %s AND coins + %s >= 0",
        (delta, user_id, delta),
    )
    if cursor.rowcount != 1:
        raise ValueError("Saldo insuficiente o usuario inexistente.")
    cursor.execute("SELECT coins FROM users WHERE id = %s", (user_id,))
    balance = cursor.fetchone()["coins"]
    cursor.execute(
        """INSERT INTO pitcoin_movements (user_id, amount, balance_after, kind, reference, actor_user_id, reason)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (user_id, delta, balance, kind, reference, actor_user_id, reason),
    )
    return balance


def get_movements(user_id, limit=100):
    """Movimientos propios, del mas reciente al mas antiguo (como maximo 500).
    Cada uno incluye una descripcion legible derivada de su referencia."""
    limit = max(1, min(int(limit), 500))
    rows = fetch_all(
        """SELECT id, amount, balance_after, kind, reference, actor_user_id, reason, created_at
           FROM pitcoin_movements WHERE user_id = %s ORDER BY id DESC LIMIT %s""",
        (user_id, limit),
    )
    total = fetch_all("SELECT COUNT(*) AS total FROM pitcoin_movements WHERE user_id = %s", (user_id,))[0]["total"]
    _describe(rows)
    return rows, int(total)


def _describe(rows):
    """Texto corto para cada movimiento a partir de su referencia:
    bet:<id>:..., race:<id>:bet:..., avatar:<usuario>:<prenda>, level:<usuario>:<nivel>."""
    from avatar import ITEMS_BY_ID  # import local: avatar importa este modulo

    bet_ids, race_ids = set(), set()
    for row in rows:
        parts = str(row["reference"]).split(":")
        if parts[0] == "bet" and len(parts) > 1 and parts[1].isdigit():
            bet_ids.add(int(parts[1]))
        elif parts[0] == "race" and len(parts) > 1 and parts[1].isdigit():
            race_ids.add(int(parts[1]))
    race_by_bet, race_names = {}, {}
    if bet_ids:
        marks = ", ".join(["%s"] * len(bet_ids))
        for row in fetch_all(f"SELECT b.id, r.name FROM bets b JOIN races r ON r.id = b.race_id WHERE b.id IN ({marks})", tuple(bet_ids)):
            race_by_bet[row["id"]] = row["name"]
    if race_ids:
        marks = ", ".join(["%s"] * len(race_ids))
        for row in fetch_all(f"SELECT id, name FROM races WHERE id IN ({marks})", tuple(race_ids)):
            race_names[row["id"]] = row["name"]
    for row in rows:
        parts = str(row["reference"]).split(":")
        kind = row["kind"]
        if kind == "OPENING_BALANCE":
            text = "Saldo de bienvenida"
        elif kind == "LEVEL_REWARD" and len(parts) == 3:
            text = f"Nivel {parts[2]} alcanzado"
        elif kind == "AVATAR_PURCHASE" and len(parts) == 3:
            item = ITEMS_BY_ID.get(parts[2])
            text = f"Prenda: {item['name']}" if item else "Prenda del avatar"
        elif kind == "DISCOUNT_REDEMPTION":
            text = row.get("reason") or "Descuento canjeado en la tienda"
        elif kind == "STAFF_ADJUSTMENT":
            text = row.get("reason") or "Ajuste del equipo de Purple One"
        elif parts[0] == "bet" and len(parts) > 1 and parts[1].isdigit():
            text = race_by_bet.get(int(parts[1]), "Pronóstico")
        elif parts[0] == "race" and len(parts) > 1 and parts[1].isdigit():
            text = race_names.get(int(parts[1]), "Carrera")
        else:
            text = ""
        row["description"] = text


def adjust_balance(data, actor_user_id):
    if data.get("confirm") is not True:
        return None, "Confirma el ajuste de PitCoins.", 400
    try:
        user_id = parse_int(data.get("target_user_id"), 1, 2147483647, "Usuario inválido.")
        amount = parse_int(data.get("amount"), -2147483647, 2147483647, "Importe inválido.")
    except ValueError:
        return None, "Usuario o importe inválido.", 400
    reference = str(data.get("reference") or "").strip()
    reason = str(data.get("reason") or "").strip()
    if not user_id or not amount or not re.fullmatch(r"[A-Za-z0-9._:-]{1,100}", reference) or not reason or len(reason) > 255:
        return None, "Indica usuario, importe, referencia única y motivo.", 400
    full_reference = "adjust:" + reference
    try:
        with db_cursor() as (connection, cursor):
            cursor.execute("SELECT id FROM users WHERE id = %s AND is_active = TRUE FOR UPDATE", (user_id,))
            if not cursor.fetchone():
                connection.rollback()
                return None, "Usuario no encontrado.", 404
            cursor.execute("SELECT id FROM pitcoin_movements WHERE reference = %s", (full_reference,))
            if cursor.fetchone():
                connection.rollback()
                return None, "La referencia ya fue utilizada.", 409
            cursor.execute("SELECT id FROM users WHERE id = %s AND is_active = TRUE AND is_staff = TRUE", (actor_user_id,))
            if not cursor.fetchone():
                connection.rollback()
                return None, "Operador no disponible.", 403
            try:
                balance = apply_movement(cursor, user_id, amount, "STAFF_ADJUSTMENT", full_reference, actor_user_id, reason)
            except ValueError as exc:
                connection.rollback()
                return None, str(exc), 400
            record(cursor, actor_user_id, "PITCOIN_ADJUSTED", "user", user_id,
                   {"amount": amount, "reason": reason, "reference": full_reference, "balance_after": balance})
            connection.commit()
    except Exception as exc:
        if is_duplicate_key(exc) or is_duplicate_key(exc.__cause__):
            return None, "La referencia ya fue utilizada.", 409
        raise
    return {"success": True, "coins": balance, "reference": full_reference}, None, 200
