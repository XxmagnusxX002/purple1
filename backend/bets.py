from datetime import datetime, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

import settings
import progression
from coins import apply_movement
from database import db_cursor, fetch_all, fetch_one
from security import uses_seed_password
from utils import image_path

VALID_STATUSES = {"SCHEDULED", "OPEN", "LOCKED", "CANCELLED"}


def _prepare_race(race):
    race["betting_closed"] = bool(race.get("race_date_utc") and race["race_date_utc"] <= datetime.now(timezone.utc).replace(tzinfo=None))
    if race.get("race_date_utc") and race.get("circuit_timezone"):
        utc = race["race_date_utc"].replace(tzinfo=timezone.utc)
        local = utc.astimezone(ZoneInfo(race["circuit_timezone"]))
        race["race_local_display"] = local.strftime("%d/%m/%Y %H:%M") + " " + race["circuit_timezone"]
        race["race_date"] = utc.isoformat()
    race["image_path"] = image_path(race.get("image_path"))  # None: la tienda muestra la bandera del pais
    return race


def _race_pool_map(race_id):
    rows = fetch_all(
        "SELECT option_id, SUM(amount) AS total FROM bets WHERE race_id = %s AND status != 'REFUNDED' GROUP BY option_id",
        (race_id,),
    )
    return {row["option_id"]: int(row["total"]) for row in rows}


def _race_totals(race):
    """Cifras de la carrera desde MySQL. En una carrera liquidada el bote ya no
    esta 'en juego': se informa lo apostado, lo repartido y los pronosticos por piloto."""
    stats = fetch_one(
        """SELECT COUNT(*) AS bets, COUNT(DISTINCT user_id) AS participants, COALESCE(SUM(amount), 0) AS staked,
                  COALESCE(SUM(CASE WHEN status IN ('WON', 'REFUNDED') THEN payout ELSE 0 END), 0) AS paid_out,
                  COALESCE(SUM(status = 'WON'), 0) AS winners, COALESCE(SUM(status = 'REFUNDED'), 0) AS refunded
           FROM bets WHERE race_id = %s""", (race["id"],))
    counts = {row["option_id"]: int(row["c"]) for row in fetch_all(
        "SELECT option_id, COUNT(*) AS c FROM bets WHERE race_id = %s GROUP BY option_id", (race["id"],))}
    for option in race["options"]:
        option["bets"] = counts.get(option["id"], 0)
    race["participants"] = int(stats["participants"])
    race["bets_count"] = int(stats["bets"])
    race["total_staked"] = int(stats["staked"])
    race["paid_out"] = int(stats["paid_out"])
    race["winners_count"] = int(stats["winners"])
    race["refunded_count"] = int(stats["refunded"])
    winner = next((o for o in race["options"] if o["id"] == race.get("winner_option_id")), None)
    race["winner_name"] = winner["driver_name"] if winner else None


def _decorate_options(race_id, options, user_bet=None):
    """Cuotas tipo 'pool' (parimutuel): se calculan en vivo repartiendo el bote total
    entre los PitCoins puestos en cada piloto, igual que en un mercado de prediccion.
    Nadie fija una cuota arbitraria: sube o baja segun a quien elija la gente."""
    pools = _race_pool_map(race_id)
    total_pool = sum(pools.values())
    for option in options:
        option["image_path"] = image_path(option.get("image_path") or option.get("team_logo"))
        pool = pools.get(option["id"], 0)
        option["pool"] = pool
        option["odds"] = round(total_pool / pool, 2) if pool > 0 else None
        option["is_user_pick"] = bool(user_bet and user_bet["option_id"] == option["id"])
    return options, total_pool


def _load_options(race_id):
    return fetch_all(
        """
        SELECT ro.id, ro.race_id, ro.driver_name, ro.team_id, ro.image_path,
               t.name AS team_name, t.logo_path AS team_logo
        FROM race_options ro
        LEFT JOIN teams t ON t.id = ro.team_id
        WHERE ro.race_id = %s
        ORDER BY ro.id
        """,
        (race_id,),
    )


def list_races(params=None):
    params = params or {}
    status = (params.get("status", [None])[0] or "").upper()
    user_id = int(params.get("user_id", [0])[0] or 0)
    where, args = "", ()
    if status:
        where, args = "WHERE status = %s", (status,)
    races = fetch_all(f"SELECT * FROM races {where} ORDER BY race_date ASC", args)
    for race in races:
        _prepare_race(race)
        user_bet = fetch_one("SELECT * FROM bets WHERE race_id = %s AND user_id = %s", (race["id"], user_id)) if user_id else None
        options, total_pool = _decorate_options(race["id"], _load_options(race["id"]), user_bet)
        race["options"] = options
        race["total_pool"] = total_pool
        race["user_bet"] = user_bet
        _race_totals(race)
    return races


def get_race_detail(race_id, user_id=0):
    race = fetch_one("SELECT * FROM races WHERE id = %s", (race_id,))
    if not race:
        return None
    _prepare_race(race)
    user_bet = fetch_one("SELECT * FROM bets WHERE race_id = %s AND user_id = %s", (race_id, user_id)) if user_id else None
    options, total_pool = _decorate_options(race_id, _load_options(race_id), user_bet)
    race["options"] = options
    race["total_pool"] = total_pool
    race["user_bet"] = user_bet
    _race_totals(race)
    return race


def place_bet(race_id, data):
    user_id = int(data.get("user_id") or 0)
    option_id = int(data.get("option_id") or 0)
    try:
        amount = int(data.get("amount") or 0)
    except (TypeError, ValueError):
        amount = 0

    if not user_id or not option_id:
        return None, "user_id y option_id son obligatorios.", 400
    min_bet = settings.get("pitcoins.min_bet")
    if amount < min_bet:
        return None, f"El pronóstico mínimo es de {min_bet} PitCoins.", 400

    error, status = None, 400
    with db_cursor(dictionary=True) as (connection, cursor):
        cursor.execute("SELECT id, status, race_date_utc, (race_date_utc <= UTC_TIMESTAMP()) AS cutoff FROM races WHERE id = %s FOR UPDATE", (race_id,))
        race = cursor.fetchone()
        if not race:
            error, status = "Carrera no encontrada.", 404
        elif race["status"] != "OPEN" or race["cutoff"]:
            error = "Los pronosticos para esta carrera no estan abiertos."
        else:
            cursor.execute("SELECT id FROM race_options WHERE id = %s AND race_id = %s", (option_id, race_id))
            if not cursor.fetchone():
                error, status = "Piloto no encontrado en esta carrera.", 404
            else:
                cursor.execute("SELECT id, coins FROM users WHERE id = %s AND is_active = TRUE FOR UPDATE", (user_id,))
                user_row = cursor.fetchone()
                if not user_row:
                    error, status = "Usuario no encontrado.", 404
                else:
                    cursor.execute("SELECT id, amount FROM bets WHERE race_id = %s AND user_id = %s FOR UPDATE", (race_id, user_id))
                    existing = cursor.fetchone()
                    old_amount = existing["amount"] if existing else 0
                    delta = old_amount - amount
                    if user_row["coins"] + delta < 0:
                        error = "No tienes suficientes PitCoins para este pronostico."
                    else:
                        if existing:
                            cursor.execute("UPDATE bets SET option_id = %s, amount = %s WHERE id = %s", (option_id, amount, existing["id"]))
                            bet_id = existing["id"]
                        else:
                            cursor.execute("INSERT INTO bets (user_id, race_id, option_id, amount) VALUES (%s, %s, %s, %s)", (user_id, race_id, option_id, amount))
                            bet_id = cursor.lastrowid
                        if delta:
                            kind = "BET_STAKE" if delta < 0 else "BET_ADJUSTMENT"
                            apply_movement(cursor, user_id, delta, kind, f"bet:{bet_id}:{uuid4().hex}")
        connection.rollback() if error else connection.commit()

    if error:
        return None, error, status
    user = fetch_one("SELECT id, username, coins FROM users WHERE id = %s", (user_id,))
    return {"success": True, "race": get_race_detail(race_id, user_id), "user": user}, None, 200


def get_user_bets(user_id):
    return fetch_all(
        """
        SELECT b.id, b.race_id, b.option_id, b.amount, b.status, b.payout, b.created_at,
               r.name AS race_name, r.race_date, r.status AS race_status, r.winner_option_id,
               ro.driver_name
        FROM bets b
        JOIN races r ON r.id = b.race_id
        JOIN race_options ro ON ro.id = b.option_id
        WHERE b.user_id = %s
        ORDER BY b.created_at DESC
        """,
        (user_id,),
    )


def get_leaderboard(limit=10):
    """Ranking publico de PitCoins (solo clientes: el equipo no compite). Solo
    devuelve un nombre visible (nombre e inicial del apellido) y el saldo."""
    rows = fetch_all(
        f"""
        SELECT first_name, last_name, coins
        FROM users WHERE is_active = TRUE AND is_staff = FALSE AND is_superadmin = FALSE
        ORDER BY coins DESC, id ASC LIMIT {int(limit)}
        """
    )
    for row in rows:
        initial = (row.pop("last_name") or "").strip()[:1]
        row["display_name"] = f"{(row.pop('first_name') or 'Piloto').strip()} {initial + '.' if initial else ''}".strip()
    return rows


def _require_staff(user_id):
    staff = fetch_one("SELECT is_staff, password_hash FROM users WHERE id = %s", (user_id,))
    return bool(staff and staff["is_staff"]) and not uses_seed_password(staff.get("password_hash"))


class RaceRuleError(Exception):
    """Regla de carrera incumplida. `kind`: not_found, state o winner, para que el
    panel elija el codigo HTTP; los endpoints de la tienda responden 404 o 400."""

    def __init__(self, message, kind="state"):
        super().__init__(message)
        self.message = message
        self.kind = kind

    @property
    def status(self):
        return 404 if self.kind == "not_found" else 400


def change_race_status(cursor, race_id, new_status):
    """Cambia el estado dentro de la transaccion de quien llama. Al cancelar
    devuelve los PitCoins de cada pronostico pendiente. Devuelve el resumen de
    devoluciones; ante una regla incumplida lanza RaceRuleError sin escribir."""
    cursor.execute("SELECT status, race_date_utc, (race_date_utc <= UTC_TIMESTAMP()) AS cutoff FROM races WHERE id = %s FOR UPDATE", (race_id,))
    race = cursor.fetchone()
    if not race:
        raise RaceRuleError("Carrera no encontrada.", "not_found")
    if race["status"] in ("FINISHED", "CANCELLED"):
        raise RaceRuleError("No puedes modificar una carrera finalizada o cancelada.")
    if new_status == "OPEN" and race["cutoff"]:
        raise RaceRuleError("La fecha límite de esta carrera ya pasó.")
    refunds = {"refunded_bets": 0, "refunded_pitcoins": 0}
    if new_status == "CANCELLED":
        cursor.execute("SELECT id, user_id, amount FROM bets WHERE race_id = %s AND status = 'PENDING' ORDER BY user_id, id FOR UPDATE", (race_id,))
        for bet in cursor.fetchall():
            cursor.execute("UPDATE bets SET status = 'REFUNDED', payout = %s WHERE id = %s AND status = 'PENDING'", (bet["amount"], bet["id"]))
            if cursor.rowcount != 1:
                raise RuntimeError("La apuesta cambió durante la cancelación.")
            apply_movement(cursor, bet["user_id"], bet["amount"], "BET_REFUND", f"race:{race_id}:bet:{bet['id']}:refund")
            refunds["refunded_bets"] += 1
            refunds["refunded_pitcoins"] += bet["amount"]
    cursor.execute("UPDATE races SET status = %s WHERE id = %s", (new_status, race_id))
    return refunds


# set_race_status y settle_race no tienen ruta HTTP: el panel usa
# change_race_status, load_settlement y apply_settlement dentro de sus propias
# transacciones con auditoria (admin_races). Se conservan como funciones
# transaccionales del dominio, cubiertas por las pruebas de liquidacion y XP.
def set_race_status(race_id, data):
    staff_id = int(data.get("user_id") or 0)
    new_status = (data.get("status") or "").upper()
    if not _require_staff(staff_id):
        return None, "Solo el staff puede administrar carreras.", 403
    if new_status not in VALID_STATUSES:
        return None, "Estado invalido.", 400
    with db_cursor(dictionary=True) as (connection, cursor):
        try:
            change_race_status(cursor, race_id, new_status)
        except RaceRuleError as exc:
            connection.rollback()
            return None, exc.message, exc.status
        connection.commit()
    return {"success": True, "race": get_race_detail(race_id)}, None, 200


def compute_payouts(bets, winner_option_id):
    """Reparto parimutuel del bote entre quienes acertaron, en proporcion a lo que
    pusieron. Los PitCoins que sobran por redondeo van, de uno en uno, a quienes
    tienen mayor resto (y a igualdad, al pronostico mas antiguo). Si nadie acerto,
    winning_pool es 0 y cada uno recupera lo suyo.

    Funcion pura: la usan la liquidacion y la vista previa del panel, de modo que
    ambas calculan exactamente el mismo reparto."""
    total_pool = sum(b["amount"] for b in bets)
    winning_pool = sum(b["amount"] for b in bets if b["option_id"] == winner_option_id)
    payouts = {b["id"]: b["amount"] * total_pool // winning_pool for b in bets if b["option_id"] == winner_option_id} if winning_pool else {}
    remainder = total_pool - sum(payouts.values()) if winning_pool else 0
    winners = sorted((b for b in bets if b["option_id"] == winner_option_id), key=lambda b: (-(b["amount"] * total_pool % winning_pool), b["id"])) if winning_pool else []
    for bet in winners[:remainder]:
        payouts[bet["id"]] += 1
    return {"total_pool": total_pool, "winning_pool": winning_pool, "payouts": payouts}


def bet_result(bet, winner_option_id, plan):
    """(estado final, PitCoins que recibe, acerto) de una apuesta segun el reparto."""
    if plan["winning_pool"] == 0:
        return "REFUNDED", bet["amount"], False
    if bet["option_id"] == winner_option_id:
        return "WON", plan["payouts"][bet["id"]], True
    return "LOST", 0, False


def load_settlement(cursor, race_id, winner_option_id, lock=True):
    """Comprueba que la carrera pueda liquidarse con ese ganador y devuelve sus
    apuestas pendientes. lock=True bloquea carrera y apuestas (liquidacion);
    lock=False solo lee (vista previa del panel). Lanza RaceRuleError."""
    suffix = " FOR UPDATE" if lock else ""
    cursor.execute(
        "SELECT status, race_date_utc, (race_date_utc <= UTC_TIMESTAMP()) AS started FROM races WHERE id = %s" + suffix,
        (race_id,),
    )
    race = cursor.fetchone()
    if not race:
        raise RaceRuleError("Carrera no encontrada.", "not_found")
    if race["status"] in ("FINISHED", "CANCELLED"):
        raise RaceRuleError("Esta carrera ya fue liquidada o cancelada.")
    if race["status"] != "LOCKED":
        raise RaceRuleError("Cierra los pronosticos antes de liquidar la carrera.")
    # Las carreras anteriores a la migracion 003 no tienen hora UTC: solo se exige LOCKED.
    if race["race_date_utc"] is not None and not race["started"]:
        raise RaceRuleError("La carrera aun no ha comenzado.")
    cursor.execute("SELECT id FROM race_options WHERE id = %s AND race_id = %s", (winner_option_id, race_id))
    if not cursor.fetchone():
        raise RaceRuleError("Piloto ganador invalido.", "winner")
    cursor.execute("SELECT id, user_id, option_id, amount FROM bets WHERE race_id = %s AND status = 'PENDING' ORDER BY user_id, id" + suffix, (race_id,))
    return cursor.fetchall()


def apply_settlement(cursor, race_id, winner_option_id, bets, award_xp):
    """Escribe la liquidacion dentro de la transaccion de quien llama, sobre las
    apuestas que devolvio load_settlement(lock=True). Devuelve el XP otorgado
    por apuesta (vacio con el XP inactivo)."""
    plan = compute_payouts(bets, winner_option_id)
    xp_results = {}
    for bet in bets:
        status, payout, correct = bet_result(bet, winner_option_id, plan)
        if status == "REFUNDED":
            cursor.execute("UPDATE bets SET status = 'REFUNDED', payout = %s WHERE id = %s AND status = 'PENDING'", (bet["amount"], bet["id"]))
            if cursor.rowcount != 1:
                raise RuntimeError("La apuesta cambió durante la liquidación.")
            apply_movement(cursor, bet["user_id"], bet["amount"], "BET_REFUND", f"race:{race_id}:bet:{bet['id']}:refund")
        elif status == "WON":
            cursor.execute("UPDATE bets SET status = 'WON', payout = %s WHERE id = %s AND status = 'PENDING'", (payout, bet["id"]))
            if cursor.rowcount != 1:
                raise RuntimeError("La apuesta cambió durante la liquidación.")
            apply_movement(cursor, bet["user_id"], payout, "BET_PRIZE", f"race:{race_id}:bet:{bet['id']}:prize")
        else:
            cursor.execute("UPDATE bets SET status = 'LOST', payout = 0 WHERE id = %s AND status = 'PENDING'", (bet["id"],))
            if cursor.rowcount != 1:
                raise RuntimeError("La apuesta cambió durante la liquidación.")
        # Participar en una carrera liquidada da XP aunque nadie acierte. Solo
        # se llega aqui con la apuesta recien pasada de PENDING a su estado final.
        if award_xp:
            xp_results[bet["id"]] = progression.award_bet_xp(cursor, bet, correct)
    cursor.execute(
        "UPDATE races SET status = 'FINISHED', winner_option_id = %s WHERE id = %s",
        (winner_option_id, race_id),
    )
    return xp_results


def settle_race(race_id, data):
    """Liquida la carrera: reparte todo el bote entre quienes acertaron el ganador,
    en proporcion a los PitCoins que pusieron (parimutuel). Si nadie acerto, cada
    quien recupera lo suyo.

    Con el XP activo (progression.XP_ENABLED), cada participante recibe su XP y
    las recompensas por nivel en esta misma transaccion: si algo falla, no se
    confirma ni el reparto de PitCoins ni el XP. Con el XP inactivo no se
    consulta ninguna tabla de progresion."""
    staff_id = int(data.get("user_id") or 0)
    winner_option_id = int(data.get("winner_option_id") or 0)
    if not _require_staff(staff_id):
        return None, "Solo el staff puede cerrar una carrera.", 403
    # Se lee una sola vez: toda la liquidacion usa el mismo modo.
    award_xp = progression.XP_ENABLED
    with db_cursor(dictionary=True) as (connection, cursor):
        try:
            pending = load_settlement(cursor, race_id, winner_option_id)
        except RaceRuleError as exc:
            connection.rollback()
            return None, exc.message, exc.status
        apply_settlement(cursor, race_id, winner_option_id, pending, award_xp)
        connection.commit()

    return {"success": True, "race": get_race_detail(race_id)}, None, 200
