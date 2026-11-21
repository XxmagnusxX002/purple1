"""Carreras y liquidacion de pronosticos desde el panel (fase A5).

Requiere 006 (auditoria) y 007 (catalogo de pilotos). No agrega esquema.

Reglas:
- Estados: Programada -> Abierta -> Cerrada -> Liquidada, con Cancelada desde
  cualquiera de las tres primeras. Abrir exige al menos dos participantes y una
  hora de inicio futura; una carrera abierta solo vuelve a Programada si nadie ha
  pronosticado. Liquidada y Cancelada son definitivas.
- Con pronosticos registrados (o con la carrera cerrada) la fecha, la hora y la
  zona horaria ya no cambian: si se aplaza, se cancela y se devuelven los
  PitCoins. Nombre, circuito, pais e imagen siempre se pueden corregir.
- Participantes: se agregan desde drivers (A4) guardando en race_options el
  nombre, el equipo y la foto de ese momento. Solo se quita un participante sin
  pronosticos y antes de cerrar.
- Liquidacion: el ganador lo elige el staff. La vista previa usa las mismas
  funciones que la liquidacion (bets.compute_payouts, bets.bet_result y
  progression.preview_bet_xp) sin escribir ni bloquear. Confirmar exige escribir
  el nombre de la carrera y la huella de la vista previa: si los pronosticos o
  el XP cambiaron desde entonces, se rechaza (409) y hay que revisar de nuevo.
  La liquidacion la escribe bets.apply_settlement en la misma transaccion que su
  registro de auditoria.
- Concurrencia: toda accion bloquea primero la fila de la carrera (FOR UPDATE).
  Un segundo administrador que liquida a la vez espera y recibe 409.
"""

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import bets
import progression
from admin_common import (ConflictError, NotFoundError, ValidationError, changed_fields, clean_name, ensure_version,
                          like_pattern, parse_ids, parse_int, raise_if_duplicate, record_version, require_version, text_field)
from audit import record
from database import db_cursor
from uploads import valid_image_path

STATUSES = ("SCHEDULED", "OPEN", "LOCKED", "FINISHED", "CANCELLED")
LABELS = {"SCHEDULED": "programada", "OPEN": "abierta", "LOCKED": "cerrada", "FINISHED": "liquidada", "CANCELLED": "cancelada"}
TRANSITIONS = {"SCHEDULED": ("OPEN", "CANCELLED"), "OPEN": ("LOCKED", "SCHEDULED", "CANCELLED"), "LOCKED": ("OPEN", "CANCELLED")}
STATUS_ACTIONS = {"OPEN": "RACE_OPENED", "LOCKED": "RACE_LOCKED", "SCHEDULED": "RACE_UNPUBLISHED", "CANCELLED": "RACE_CANCELLED"}
ROSTER_STATUSES = ("SCHEDULED", "OPEN")
MIN_PARTICIPANTS = 2
MAX_PARTICIPANTS = 40
LIST_LIMIT = 200
BETS_LIMIT = 300
MAX_ID = 2_147_483_647
TZ_PATTERN = re.compile(r"[A-Za-z]+(?:/[A-Za-z0-9_+\-]+){0,2}")
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
TIME_PATTERN = re.compile(r"\d{2}:\d{2}")

RACE_FIELDS = ("name", "circuit", "country", "image_path", "race_date_utc", "circuit_timezone")
RACE_VERSION = RACE_FIELDS + ("status", "updated_at")
RACE_COLUMNS = ("r.id, r.name, r.circuit, r.country, r.race_date, r.race_date_utc, r.circuit_timezone, r.image_path, "
                "r.status, r.winner_option_id, r.updated_at")
RACE_COUNTS = """
    (SELECT COUNT(*) FROM race_options ro WHERE ro.race_id = r.id) AS participants,
    (SELECT COUNT(*) FROM bets b WHERE b.race_id = r.id) AS bets,
    (SELECT COUNT(*) FROM bets b WHERE b.race_id = r.id AND b.status = 'PENDING') AS pending_bets,
    (SELECT COALESCE(SUM(b.amount), 0) FROM bets b WHERE b.race_id = r.id AND b.status = 'PENDING') AS pending_pool,
    (SELECT COALESCE(SUM(b.amount), 0) FROM bets b WHERE b.race_id = r.id AND b.status <> 'REFUNDED') AS pool,
    (SELECT ro.driver_name FROM race_options ro WHERE ro.id = r.winner_option_id) AS winner_name
"""
COUNT_KEYS = ("participants", "bets", "pending_bets", "pending_pool", "pool")


def _utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _fold(text):
    """Comparacion de nombres sin mayusculas, acentos ni espacios repetidos."""
    return unicodedata.normalize("NFKD", clean_name(text)).encode("ascii", "ignore").decode("ascii").casefold()


# ------------------------------------------------------------------ validacion

def _zone(name):
    if not TZ_PATTERN.fullmatch(name):
        return None
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return None


def _schedule(data, errors):
    """Fecha y hora locales del circuito + zona IANA -> (UTC sin zona, zona)."""
    date_text = text_field(data, "date", errors, 10, required=True, label="La fecha")
    time_text = text_field(data, "time", errors, 5, required=True, label="La hora")
    zone_name = text_field(data, "timezone", errors, 64, required=True, label="La zona horaria")
    if errors.keys() & {"date", "time", "timezone"}:
        return None, zone_name
    zone = _zone(zone_name)
    if not zone:
        errors["timezone"] = "Zona horaria desconocida. Usa el formato Continente/Ciudad, por ejemplo Europe/Monaco."
    try:
        if not DATE_PATTERN.fullmatch(date_text):
            raise ValueError
        local = datetime.strptime(date_text, "%Y-%m-%d")
    except ValueError:
        errors["date"] = "Fecha invalida (AAAA-MM-DD)."
        return None, zone_name
    try:
        if not TIME_PATTERN.fullmatch(time_text):
            raise ValueError
        clock = datetime.strptime(time_text, "%H:%M")
    except ValueError:
        errors["time"] = "Hora invalida (HH:MM)."
        return None, zone_name
    if not zone:
        return None, zone_name
    local = local.replace(hour=clock.hour, minute=clock.minute)
    first, second = local.replace(tzinfo=zone, fold=0), local.replace(tzinfo=zone, fold=1)
    # Una hora que no existe por el cambio de horario no vuelve igual.
    if first.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != local:
        errors["time"] = "Esa hora no existe en la zona elegida (cambio de horario)."
        return None, zone_name
    chosen = first
    if first.utcoffset() != second.utcoffset():
        # Hora repetida al atrasar el reloj: el administrador elige cual de las dos es.
        fold = data.get("fold")
        if fold not in (0, 1, "0", "1"):
            errors["fold"] = (f"Esa hora ocurre dos veces ese dia en {zone_name} por el cambio de horario. Elige si es la primera "
                              f"(UTC{_offset(first)}) o la segunda (UTC{_offset(second)}).")
            return None, zone_name
        chosen = second if str(fold) == "1" else first
    return chosen.astimezone(timezone.utc).replace(tzinfo=None), zone_name


def _offset(moment):
    minutes = int(moment.utcoffset().total_seconds() // 60)
    sign = "+" if minutes >= 0 else "-"
    return f"{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}"


def validate_race(data, with_schedule=True):
    errors = {}
    clean = {
        "name": clean_name(text_field(data, "name", errors, 150, required=True, label="El nombre")),
        "circuit": clean_name(text_field(data, "circuit", errors, 150, required=True, label="El circuito")),
        "country": clean_name(text_field(data, "country", errors, 100, label="El pais")),
        "image_path": None,
    }
    if clean["name"] and len(clean["name"]) < 3:
        errors["name"] = "El nombre es demasiado corto."
    image = data.get("image_path")
    if image not in (None, ""):
        if valid_image_path(image):
            clean["image_path"] = image
        else:
            errors["image_path"] = "Elige una imagen existente de frontend/img."
    if with_schedule:
        clean["race_date_utc"], clean["circuit_timezone"] = _schedule(data, errors)
    if errors:
        raise ValidationError(errors)
    return clean


def _check_future(utc):
    if utc <= _utc_now():
        raise ValidationError({"date": "La hora de inicio debe ser futura."})


def _check_confirmation(data, name):
    typed = data.get("confirm_name")
    if not isinstance(typed, str) or clean_name(typed) != clean_name(name):
        raise ValidationError({"confirm_name": "Escribe el nombre exacto de la carrera para confirmar."},
                              "El nombre escrito no coincide con el de la carrera.")


def _rule_error(exc):
    """RaceRuleError de bets -> error del panel."""
    if exc.kind == "not_found":
        return NotFoundError(exc.message)
    if exc.kind == "winner":
        return ValidationError({"winner_option_id": "Elige un piloto que participe en esta carrera."}, exc.message)
    return ConflictError(exc.message)


# ------------------------------------------------------------------ lectura

def _decorate(row):
    for key in COUNT_KEYS:
        if key in row:
            row[key] = int(row[key] or 0)
    utc, zone_name = row.get("race_date_utc"), row.get("circuit_timezone")
    zone = _zone(zone_name) if zone_name else None
    if utc and zone:
        aware = utc.replace(tzinfo=timezone.utc)
        local = aware.astimezone(zone)
        wall = local.replace(tzinfo=None)
        ambiguous = wall.replace(tzinfo=zone, fold=0).utcoffset() != wall.replace(tzinfo=zone, fold=1).utcoffset()
        row.update(legacy=False, starts_at=aware.isoformat(), local_date=local.strftime("%Y-%m-%d"),
                   local_time=local.strftime("%H:%M"), local_offset=_offset(local), started=utc <= _utc_now(),
                   time_ambiguous=ambiguous, fold=local.fold if ambiguous else None)
    else:
        # Carrera anterior a 003: fecha original sin zona verificada.
        original = row.get("race_date")
        row.update(legacy=True, starts_at=None, local_date=original.strftime("%Y-%m-%d") if original else "",
                   local_time=original.strftime("%H:%M") if original else "", started=None)
    status = row["status"]
    row["transitions"] = list(TRANSITIONS.get(status, ()))
    row["editable"] = status in TRANSITIONS
    row["roster_editable"] = status in ROSTER_STATUSES
    row["schedule_locked"] = status not in ROSTER_STATUSES or row.get("bets", 0) > 0
    row["can_settle"] = status == "LOCKED" and (row["legacy"] or row["started"])
    return row


def list_races(params):
    status = (params.get("status", ["all"])[0] or "all").strip().upper()
    where, values = [], []
    if status != "ALL":
        if status not in STATUSES:
            raise ValidationError({"status": "Estado invalido."})
        where.append("r.status = %s")
        values.append(status)
    term = (params.get("q", [""])[0] or "").strip()[:100]
    if term:
        where.append("(r.name LIKE %s OR r.circuit LIKE %s OR r.country LIKE %s)")
        values += [like_pattern(term)] * 3
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""SELECT {RACE_COLUMNS}, {RACE_COUNTS} FROM races r WHERE {' AND '.join(where) or 'TRUE'}
                ORDER BY COALESCE(r.race_date_utc, r.race_date) DESC, r.id DESC LIMIT %s""",
            (*values, LIST_LIMIT),
        )
        races = [_decorate(row) for row in cursor.fetchall()]
        cursor.execute("SELECT status, COUNT(*) AS total FROM races GROUP BY status")
        counts = {row["status"]: int(row["total"]) for row in cursor.fetchall()}
    return {"races": races, "counts": {key: counts.get(key, 0) for key in STATUSES}}


def _options(cursor, race_id):
    cursor.execute(
        """SELECT ro.id, ro.driver_id, ro.driver_name, ro.team_id, ro.image_path, t.name AS team_name, d.number, d.is_active AS driver_active,
                  ro.finish_position, ro.finish_order,
                  (SELECT COUNT(*) FROM bets b WHERE b.option_id = ro.id) AS bets,
                  (SELECT COALESCE(SUM(b.amount), 0) FROM bets b WHERE b.option_id = ro.id AND b.status <> 'REFUNDED') AS pool
           FROM race_options ro LEFT JOIN teams t ON t.id = ro.team_id LEFT JOIN drivers d ON d.id = ro.driver_id
           WHERE ro.race_id = %s ORDER BY COALESCE(ro.finish_order, 255), ro.id""",
        (race_id,),
    )
    options = cursor.fetchall()
    total = sum(int(option["pool"] or 0) for option in options)
    for option in options:
        option["bets"] = int(option["bets"] or 0)
        option["pool"] = int(option["pool"] or 0)
        option["odds"] = round(total / option["pool"], 2) if option["pool"] else None
        option["driver_active"] = None if option.get("driver_active") is None else bool(option["driver_active"])
    return options


def _activity(cursor, race_id):
    cursor.execute(
        """SELECT a.id, a.action, a.details, a.created_at, u.username, u.first_name, u.last_name
           FROM admin_audit_log a JOIN users u ON u.id = a.actor_user_id
           WHERE a.entity = 'race' AND a.entity_id = %s ORDER BY a.id DESC LIMIT 20""",
        (str(race_id),),
    )
    rows = cursor.fetchall()
    for row in rows:
        try:
            row["details"] = json.loads(row["details"]) if row.get("details") else None
        except (TypeError, ValueError):
            row["details"] = None
        row["actor"] = " ".join(part for part in (row.pop("first_name"), row.pop("last_name")) if part) or row["username"]
    return rows


def _load_race(cursor, race_id):
    cursor.execute(f"SELECT {RACE_COLUMNS}, {RACE_COUNTS} FROM races r WHERE r.id = %s", (race_id,))
    race = cursor.fetchone()
    if not race:
        return None
    _decorate(race)
    race["version"] = record_version(race, RACE_VERSION)
    race["options"] = _options(cursor, race_id)
    cursor.execute(
        """SELECT b.id, b.user_id, u.username, u.email, u.first_name, u.last_name, b.option_id, ro.driver_name, b.amount, b.status,
                  b.payout, b.created_at, (SELECT COALESCE(SUM(x.amount), 0) FROM xp_events x WHERE x.bet_id = b.id) AS xp_gained
           FROM bets b JOIN users u ON u.id = b.user_id JOIN race_options ro ON ro.id = b.option_id
           WHERE b.race_id = %s ORDER BY FIELD(b.status, 'WON', 'PENDING', 'REFUNDED', 'LOST'), b.payout DESC, b.created_at DESC, b.id DESC LIMIT %s""",
        (race_id, BETS_LIMIT),
    )
    race["bets_list"] = cursor.fetchall()
    for bet in race["bets_list"]:
        bet["xp_gained"] = int(bet["xp_gained"] or 0)
        bet["net"] = None if bet["status"] == "PENDING" else int(bet["payout"]) - int(bet["amount"])
        # Cuota definitiva obtenida por quien acertó: lo recibido / lo apostado.
        bet["odds"] = round(int(bet["payout"]) / int(bet["amount"]), 2) if bet["status"] == "WON" and bet["amount"] else None
    cursor.execute(
        "SELECT status, COUNT(*) AS total, COALESCE(SUM(amount), 0) AS amount, COALESCE(SUM(payout), 0) AS payout FROM bets WHERE race_id = %s GROUP BY status",
        (race_id,),
    )
    race["bets_by_status"] = {row["status"]: {"count": int(row["total"]), "amount": int(row["amount"]), "payout": int(row["payout"])}
                              for row in cursor.fetchall()}
    race["activity"] = _activity(cursor, race_id)
    settled = next((item for item in race["activity"] if item["action"] == "RACE_SETTLED"), None)
    race["settlement"] = None if not settled else {"at": settled["created_at"], "by": settled["actor"], "details": settled["details"]}
    race["xp_enabled"] = progression.XP_ENABLED
    return race


def get_race(race_id):
    with db_cursor() as (_, cursor):
        return _load_race(cursor, race_id)


def _lock_race(cursor, race_id):
    cursor.execute(
        """SELECT id, name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status, updated_at
           FROM races WHERE id = %s FOR UPDATE""",
        (race_id,),
    )
    race = cursor.fetchone()
    if not race:
        raise NotFoundError("Carrera no encontrada.")
    return race


def _count(cursor, sql, value):
    cursor.execute(sql, (value,))
    row = cursor.fetchone()
    return int(row["total"] or 0) if row else 0


BET_STATUSES = ("PENDING", "WON", "LOST", "REFUNDED")
BETS_PER_PAGE = 25


def list_bets(params):
    """Pronosticos de todas las carreras (solo lectura) con filtros y paginacion."""
    def param(key, default=""):
        return (params.get(key, [default])[0] or default).strip()

    where, values, errors = [], [], {}
    status = param("status", "all").upper()
    if status != "ALL":
        if status not in BET_STATUSES:
            errors["status"] = "Estado invalido."
        where.append("b.status = %s")
        values.append(status)
    race = param("race")
    if race:
        try:
            values.append(parse_int(race, 1, MAX_ID, "x"))
            where.append("b.race_id = %s")
        except ValueError:
            errors["race"] = "Carrera invalida."
    term = param("q")[:100]
    if term:
        where.append("(u.username LIKE %s OR ro.driver_name LIKE %s OR r.name LIKE %s)")
        values += [like_pattern(term)] * 3
    try:
        page = parse_int(param("page", "1"), 1, 10_000, "x")
    except ValueError:
        errors["page"] = "Pagina invalida."
        page = 1
    if errors:
        raise ValidationError(errors)
    base = f"""FROM bets b JOIN users u ON u.id = b.user_id JOIN races r ON r.id = b.race_id JOIN race_options ro ON ro.id = b.option_id
               WHERE {' AND '.join(where) or 'TRUE'}"""
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT b.status, COUNT(*) AS total, COALESCE(SUM(b.amount), 0) AS amount, COALESCE(SUM(b.payout), 0) AS payout {base} GROUP BY b.status",
                       tuple(values))
        by_status = {key: {"count": 0, "amount": 0, "payout": 0} for key in BET_STATUSES}
        for row in cursor.fetchall():
            by_status[row["status"]] = {"count": int(row["total"]), "amount": int(row["amount"]), "payout": int(row["payout"])}
        total = sum(item["count"] for item in by_status.values())
        pages = max(1, -(-total // BETS_PER_PAGE))
        page = min(page, pages)
        cursor.execute(
            f"""SELECT b.id, b.amount, b.status, b.payout, b.created_at, u.username, b.race_id, r.name AS race_name, r.status AS race_status,
                       ro.driver_name {base} ORDER BY b.created_at DESC, b.id DESC LIMIT %s OFFSET %s""",
            (*values, BETS_PER_PAGE, (page - 1) * BETS_PER_PAGE),
        )
        bets_rows = cursor.fetchall()
        cursor.execute("SELECT id, name, status FROM races ORDER BY COALESCE(race_date_utc, race_date) DESC, id DESC LIMIT %s", (LIST_LIMIT,))
        races = cursor.fetchall()
    return {"bets": bets_rows, "by_status": by_status, "total": total, "page": page, "pages": pages,
            "per_page": BETS_PER_PAGE, "races": races, "unit": "PitCoins"}


# ------------------------------------------------------------------ crear y editar

def create_race(data, actor_id):
    clean = validate_race(data)
    _check_future(clean["race_date_utc"])
    with db_cursor() as (connection, cursor):
        cursor.execute(
            """INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'SCHEDULED')""",
            (clean["name"], clean["circuit"], clean["country"] or None, clean["race_date_utc"], clean["race_date_utc"],
             clean["circuit_timezone"], clean["image_path"]),
        )
        race_id = cursor.lastrowid
        record(cursor, actor_id, "RACE_CREATED", "race", race_id,
               {"name": clean["name"], "starts_at_utc": clean["race_date_utc"], "timezone": clean["circuit_timezone"]})
        connection.commit()
    return get_race(race_id)


def update_race(race_id, data, actor_id):
    expected = require_version(data)
    with_schedule = any(key in data for key in ("date", "time", "timezone"))
    clean = validate_race(data, with_schedule)
    with db_cursor() as (connection, cursor):
        current = _lock_race(cursor, race_id)
        if current["status"] not in TRANSITIONS:
            raise ConflictError(f"La carrera esta {LABELS[current['status']]}: ya no se puede editar.")
        ensure_version(record_version(current, RACE_VERSION), expected, "esta carrera")
        if not with_schedule:
            clean["race_date_utc"], clean["circuit_timezone"] = current["race_date_utc"], current["circuit_timezone"]
        moved = (clean["race_date_utc"], clean["circuit_timezone"]) != (current["race_date_utc"], current["circuit_timezone"])
        if moved:
            if current["status"] not in ROSTER_STATUSES:
                raise ValidationError({"date": "Con los pronosticos cerrados la fecha ya no se puede cambiar."})
            if _count(cursor, "SELECT COUNT(*) AS total FROM bets WHERE race_id = %s", race_id):
                raise ValidationError({"date": "Ya hay pronosticos registrados: la fecha no se puede cambiar. "
                                               "Si la carrera se aplaza, cancelala para devolver los PitCoins y crea una nueva."})
            _check_future(clean["race_date_utc"])
        race_date = clean["race_date_utc"] if moved else current["race_date"]
        cursor.execute(
            """UPDATE races SET name = %s, circuit = %s, country = %s, image_path = %s, race_date = %s, race_date_utc = %s,
                      circuit_timezone = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s""",
            (clean["name"], clean["circuit"], clean["country"] or None, clean["image_path"], race_date, clean["race_date_utc"],
             clean["circuit_timezone"], race_id),
        )
        record(cursor, actor_id, "RACE_UPDATED", "race", race_id,
               {"fields": changed_fields(current, {**clean, "country": clean["country"] or None}, RACE_FIELDS)})
        connection.commit()
    return get_race(race_id)


# ------------------------------------------------------------------ estados

def set_race_status(race_id, data, actor_id):
    target = str(data.get("status") or "").strip().upper()
    if target not in STATUS_ACTIONS:
        raise ValidationError({"status": "Estado invalido."})
    with db_cursor() as (connection, cursor):
        current = _lock_race(cursor, race_id)
        source = current["status"]
        if target not in TRANSITIONS.get(source, ()):
            raise ConflictError(f"La carrera esta {LABELS[source]}: no puede pasar a {LABELS[target]}. Recarga para ver su estado actual.")
        if target == "OPEN":
            if current["race_date_utc"] is None:
                raise ValidationError({"date": "Define fecha, hora y zona horaria antes de abrir los pronosticos."},
                                      "La carrera no tiene hora de inicio con zona horaria.")
            participants = _count(cursor, "SELECT COUNT(*) AS total FROM race_options WHERE race_id = %s", race_id)
            if participants < MIN_PARTICIPANTS:
                raise ValidationError({}, f"Agrega al menos {MIN_PARTICIPANTS} pilotos antes de abrir los pronosticos.")
        if target == "SCHEDULED" and _count(cursor, "SELECT COUNT(*) AS total FROM bets WHERE race_id = %s", race_id):
            raise ValidationError({}, "Ya hay pronosticos: la carrera no puede volver a programada. Cierrala o cancelala.")
        if target == "CANCELLED":
            _check_confirmation(data, current["name"])
        try:
            refunds = bets.change_race_status(cursor, race_id, target)
        except bets.RaceRuleError as exc:
            raise _rule_error(exc) from exc
        action = "RACE_REOPENED" if source == "LOCKED" and target == "OPEN" else STATUS_ACTIONS[target]
        details = {"from": source, "to": target}
        if target == "CANCELLED":
            details.update(refunds)
        record(cursor, actor_id, action, "race", race_id, details)
        connection.commit()
    return get_race(race_id)


# ------------------------------------------------------------------ participantes

def add_participants(race_id, data, actor_id):
    errors = {}
    driver_ids = parse_ids(data.get("driver_ids"), "driver_ids", errors, "Pilotos")
    if errors or not driver_ids:
        raise ValidationError({"driver_ids": errors.get("driver_ids") or "Elige al menos un piloto."})
    try:
        with db_cursor() as (connection, cursor):
            race = _lock_race(cursor, race_id)
            if race["status"] not in ROSTER_STATUSES:
                raise ConflictError("Los participantes solo se cambian antes de cerrar los pronosticos.")
            cursor.execute("SELECT driver_id, driver_name FROM race_options WHERE race_id = %s", (race_id,))
            current = cursor.fetchall()
            if len(current) + len(driver_ids) > MAX_PARTICIPANTS:
                raise ValidationError({"driver_ids": f"Una carrera admite maximo {MAX_PARTICIPANTS} participantes."})
            cursor.execute(f"SELECT id, name, team_id, image_path, is_active FROM drivers WHERE id IN ({', '.join(['%s'] * len(driver_ids))})",
                           tuple(driver_ids))
            found = {row["id"]: row for row in cursor.fetchall()}
            taken_ids = {row["driver_id"] for row in current if row["driver_id"]}
            taken_names = {_fold(row["driver_name"]) for row in current}
            problems = []
            for driver_id in driver_ids:
                driver = found.get(driver_id)
                if not driver:
                    problems.append(f"el piloto {driver_id} no existe")
                elif not driver["is_active"]:
                    problems.append(f"{driver['name']} esta inactivo")
                elif driver_id in taken_ids or _fold(driver["name"]) in taken_names:
                    problems.append(f"{driver['name']} ya participa")
            if problems:
                raise ValidationError({"driver_ids": "No se agrego ningun piloto: " + "; ".join(problems) + "."})
            added = []
            for driver_id in driver_ids:
                driver = found[driver_id]
                # Foto y equipo de hoy: quedan fijos en la carrera aunque el piloto cambie despues.
                cursor.execute(
                    "INSERT INTO race_options (race_id, driver_name, team_id, image_path, driver_id) VALUES (%s, %s, %s, %s, %s)",
                    (race_id, driver["name"], driver["team_id"], driver["image_path"], driver_id),
                )
                added.append({"driver_id": driver_id, "option_id": cursor.lastrowid})
            record(cursor, actor_id, "RACE_PARTICIPANTS_ADDED", "race", race_id, {"drivers": added})
            connection.commit()
    except Exception as exc:  # noqa: BLE001 - raise_if_duplicate relanza lo que no es duplicado
        raise_if_duplicate(exc, "Otro administrador agrego el mismo piloto al mismo tiempo. Recarga la carrera.")
    return get_race(race_id)


def remove_participant(race_id, option_id, actor_id):
    with db_cursor() as (connection, cursor):
        race = _lock_race(cursor, race_id)
        if race["status"] not in ROSTER_STATUSES:
            raise ConflictError("Los participantes solo se cambian antes de cerrar los pronosticos.")
        cursor.execute("SELECT id, driver_id, driver_name FROM race_options WHERE id = %s AND race_id = %s", (option_id, race_id))
        option = cursor.fetchone()
        if not option:
            raise NotFoundError("Ese piloto no participa en esta carrera.")
        predictions = _count(cursor, "SELECT COUNT(*) AS total FROM bets WHERE option_id = %s", option_id)
        if predictions:
            raise ConflictError(f"{option['driver_name']} ya tiene {predictions} pronosticos: no se puede quitar. "
                                "Para anularlos, cancela la carrera y se devolveran los PitCoins.")
        if race["status"] == "OPEN" and _count(cursor, "SELECT COUNT(*) AS total FROM race_options WHERE race_id = %s", race_id) <= MIN_PARTICIPANTS:
            raise ConflictError(f"Una carrera abierta necesita al menos {MIN_PARTICIPANTS} pilotos.")
        # Fila sin pronosticos: no hay historial que conservar.
        cursor.execute("DELETE FROM race_options WHERE id = %s AND race_id = %s", (option_id, race_id))
        record(cursor, actor_id, "RACE_PARTICIPANT_REMOVED", "race", race_id,
               {"option_id": option_id, "driver_id": option["driver_id"], "driver_name": option["driver_name"]})
        connection.commit()
    return get_race(race_id)


# ------------------------------------------------------------------ liquidacion

def _winner_id(value):
    try:
        return parse_int(value, 1, MAX_ID, "x")
    except ValueError as exc:
        raise ValidationError({"winner_option_id": "Elige el piloto ganador."}) from exc


def _fingerprint(race_id, winner_option_id, award_xp, pending, xp_rows):
    payload = {
        "race": race_id, "winner": winner_option_id, "xp_enabled": award_xp,
        "bets": [[b["id"], b["user_id"], b["option_id"], b["amount"]] for b in pending],
        "xp": [[x["user_id"], x["xp_before"], x["xp_gained"], x["levels_rewarded"]] for x in xp_rows],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _build_preview(cursor, race, winner_option_id, pending, award_xp):
    """Reparto que produciria bets.apply_settlement con estas apuestas. Solo lee."""
    cursor.execute(
        "SELECT ro.id, ro.driver_name, ro.driver_id, t.name AS team_name FROM race_options ro LEFT JOIN teams t ON t.id = ro.team_id WHERE ro.race_id = %s ORDER BY ro.id",
        (race["id"],),
    )
    options = {row["id"]: row for row in cursor.fetchall()}
    usernames = {}
    user_ids = sorted({bet["user_id"] for bet in pending})
    if user_ids:
        cursor.execute(f"SELECT id, username FROM users WHERE id IN ({', '.join(['%s'] * len(user_ids))})", tuple(user_ids))
        usernames = {row["id"]: row["username"] for row in cursor.fetchall()}

    plan = bets.compute_payouts(pending, winner_option_id)
    rows, xp_rows = [], []
    for bet in pending:
        status, payout, correct = bets.bet_result(bet, winner_option_id, plan)
        xp = progression.preview_bet_xp(cursor, bet, correct) if award_xp else None
        if xp:
            xp_rows.append(xp)
        rows.append({
            "bet_id": bet["id"], "user_id": bet["user_id"], "username": usernames.get(bet["user_id"], f"usuario {bet['user_id']}"),
            "option_id": bet["option_id"], "driver_name": options.get(bet["option_id"], {}).get("driver_name"),
            "amount": bet["amount"], "result": status, "payout": payout, "net": payout - bet["amount"],
            "xp_gained": xp["xp_gained"] if xp else 0, "levels_rewarded": xp["levels_rewarded"] if xp else [],
            "level_reward_pitcoins": xp["level_reward_pitcoins"] if xp else 0,
        })
    rows.sort(key=lambda row: ({"WON": 0, "REFUNDED": 1, "LOST": 2}[row["result"]], -row["payout"], row["bet_id"]))
    winner = options.get(winner_option_id, {})
    outcome = "NO_BETS" if not pending else ("REFUND_ALL" if plan["winning_pool"] == 0 else "PRIZES")
    return {
        "race": {"id": race["id"], "name": race["name"], "status": race["status"]},
        "winner": {"option_id": winner_option_id, "driver_name": winner.get("driver_name"), "driver_id": winner.get("driver_id"),
                   "team_name": winner.get("team_name")},
        "outcome": outcome,
        "xp_enabled": award_xp,
        "summary": {
            "bets": len(rows),
            "total_pool": plan["total_pool"],
            "winning_pool": plan["winning_pool"],
            "winners": sum(1 for row in rows if row["result"] == "WON"),
            "losers": sum(1 for row in rows if row["result"] == "LOST"),
            "refunded": sum(1 for row in rows if row["result"] == "REFUNDED"),
            "paid_out": sum(row["payout"] for row in rows if row["result"] == "WON"),
            "refunded_pitcoins": sum(row["payout"] for row in rows if row["result"] == "REFUNDED"),
            "xp_total": sum(row["xp_gained"] for row in rows),
            "level_reward_pitcoins": sum(row["level_reward_pitcoins"] for row in rows),
        },
        "bets": rows,
        "fingerprint": _fingerprint(race["id"], winner_option_id, award_xp, pending, xp_rows),
    }


def _race_head(cursor, race_id, lock):
    cursor.execute("SELECT id, name, status FROM races WHERE id = %s" + (" FOR UPDATE" if lock else ""), (race_id,))
    race = cursor.fetchone()
    if not race:
        raise NotFoundError("Carrera no encontrada.")
    return race


def preview_settlement(race_id, params):
    """Vista previa del reparto: no escribe, no bloquea y termina con rollback."""
    winner_option_id = _winner_id((params.get("winner", [""])[0] or "").strip())
    award_xp = progression.XP_ENABLED
    with db_cursor() as (connection, cursor):
        race = _race_head(cursor, race_id, lock=False)
        try:
            pending = bets.load_settlement(cursor, race_id, winner_option_id, lock=False)
        except bets.RaceRuleError as exc:
            raise _rule_error(exc) from exc
        preview = _build_preview(cursor, race, winner_option_id, pending, award_xp)
        connection.rollback()
    return preview


def settle_race(race_id, data, actor_id):
    """Liquidacion definitiva con el ganador elegido por el staff."""
    winner_option_id = _winner_id(data.get("winner_option_id"))
    fingerprint = data.get("fingerprint")
    if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        raise ValidationError({}, "Genera la vista previa del reparto antes de confirmar.")
    # Un solo modo durante toda la liquidacion, como en bets.settle_race.
    award_xp = progression.XP_ENABLED
    with db_cursor() as (connection, cursor):
        race = _race_head(cursor, race_id, lock=True)
        if race["status"] == "FINISHED":
            raise ConflictError("Esta carrera ya fue liquidada (quizas por otro administrador). El ganador no se puede cambiar.")
        _check_confirmation(data, race["name"])
        try:
            pending = bets.load_settlement(cursor, race_id, winner_option_id, lock=True)
        except bets.RaceRuleError as exc:
            raise _rule_error(exc) from exc
        if award_xp and pending:
            # Con el XP activo se bloquea a los participantes (en orden de id) antes de
            # recalcular: hasta el commit nadie mas puede cambiar su XP ni sus niveles.
            user_ids = sorted({bet["user_id"] for bet in pending})
            cursor.execute(f"SELECT id FROM users WHERE id IN ({', '.join(['%s'] * len(user_ids))}) ORDER BY id FOR UPDATE", tuple(user_ids))
            cursor.fetchall()
        preview = _build_preview(cursor, race, winner_option_id, pending, award_xp)
        if preview["fingerprint"] != fingerprint:
            raise ConflictError("Los pronosticos o el XP cambiaron desde la vista previa. Revisa el nuevo reparto antes de confirmar.")
        awarded = bets.apply_settlement(cursor, race_id, winner_option_id, pending, award_xp)
        if award_xp:
            expected = {row["bet_id"]: (row["xp_gained"], row["levels_rewarded"]) for row in preview["bets"]}
            actual = {bet_id: (result["xp_gained"], result["levels_rewarded"]) for bet_id, result in awarded.items()}
            if actual != expected:
                # Salvaguarda final: se deshace todo (PitCoins, XP y estado) antes del commit.
                raise ConflictError("El XP cambio durante la liquidacion. No se aplico nada: genera una nueva vista previa.")
        summary = preview["summary"]
        record(cursor, actor_id, "RACE_SETTLED", "race", race_id, {
            "winner_option_id": winner_option_id, "winner": preview["winner"]["driver_name"], "driver_id": preview["winner"]["driver_id"],
            "outcome": preview["outcome"], "xp_enabled": award_xp, "fingerprint": fingerprint,
            **{key: summary[key] for key in ("bets", "total_pool", "winning_pool", "winners", "paid_out", "refunded_pitcoins",
                                             "xp_total", "level_reward_pitcoins")},
        })
        connection.commit()
    return {"race": get_race(race_id), "result": {**preview, "bets": preview["bets"][:BETS_LIMIT]}}
