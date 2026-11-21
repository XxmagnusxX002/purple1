"""Equipos y pilotos desde el panel (fase A4). Requiere 007_teams_drivers.sql.

Reglas:
- Nada se borra: equipos y pilotos se desactivan. Los equipos inactivos ya no
  salen en la tienda (categories.get_teams filtra is_active) pero conservan sus
  productos, pilotos y carreras.
- Un piloto es un registro propio (drivers). Cambiarlo de equipo solo cambia
  drivers.team_id: cada carrera guarda en race_options el nombre y el equipo que
  tenia entonces, y esos datos historicos nunca se modifican desde aqui.
- Nombres de equipo y piloto unicos (sin distinguir mayusculas ni acentos, por la
  collation utf8mb4_unicode_ci); dorsal unico entre pilotos activos.
- Cambios simultaneos: la version (record_version) es obligatoria y se compara
  bajo FOR UPDATE.
Todo cambio queda en admin_audit_log dentro de su transaccion.
"""

from admin_common import (NotFoundError, SLUG_PATTERN, ValidationError, changed_fields, clean_name,
                          ensure_version, like_pattern, optional_id, parse_bool, parse_hex_color, parse_int,
                          raise_if_duplicate, record_version, require_version, slugify, text_field)
from audit import record
from database import db_cursor
from uploads import valid_image_path

TEAM_FIELDS = ("name", "slug", "description", "country", "primary_color", "secondary_color", "logo_path", "image_path", "is_active")
DRIVER_FIELDS = ("name", "number", "nationality", "team_id", "image_path", "is_active")
TEAM_VERSION = TEAM_FIELDS + ("updated_at",)
DRIVER_VERSION = DRIVER_FIELDS + ("updated_at",)
LIST_LIMIT = 200


def _image(data, key, errors, label):
    value = data.get(key)
    if value in (None, ""):
        return None
    if not valid_image_path(value):
        errors[key] = f"{label}: elige una imagen existente de frontend/img."
        return None
    return value


def _status_filter(params, alias):
    status = (params.get("status", ["all"])[0] or "all").strip()
    if status == "active":
        return f"{alias}.is_active = TRUE"
    if status == "inactive":
        return f"{alias}.is_active = FALSE"
    if status != "all":
        raise ValidationError({"status": "Estado invalido."})
    return "TRUE"


# ------------------------------------------------------------------ equipos

def validate_team(data):
    errors = {}
    clean = {
        "name": clean_name(text_field(data, "name", errors, 100, required=True, label="El nombre")),
        "slug": text_field(data, "slug", errors, 120, label="La URL"),
        "description": text_field(data, "description", errors, 200, label="La descripcion"),
        "country": clean_name(text_field(data, "country", errors, 100, label="El pais")),
        "primary_color": parse_hex_color(data.get("primary_color"), "primary_color", errors, "Color principal"),
        "secondary_color": parse_hex_color(data.get("secondary_color"), "secondary_color", errors, "Color secundario"),
        "logo_path": _image(data, "logo_path", errors, "Logo"),
        "image_path": _image(data, "image_path", errors, "Imagen"),
    }
    if clean["slug"] and not SLUG_PATTERN.fullmatch(clean["slug"]):
        errors["slug"] = "Usa solo minusculas, numeros y guiones."
    try:
        clean["is_active"] = parse_bool(data.get("is_active"), default=True)
    except ValueError as exc:
        errors["is_active"] = str(exc)
    if errors:
        raise ValidationError(errors)
    return clean


TEAM_COUNTS = """
    (SELECT COUNT(*) FROM product_teams pt WHERE pt.team_id = t.id) AS products,
    (SELECT COUNT(*) FROM product_teams pt JOIN products p ON p.id = pt.product_id WHERE pt.team_id = t.id AND p.is_active = TRUE) AS active_products,
    (SELECT COUNT(*) FROM drivers d WHERE d.team_id = t.id AND d.is_active = TRUE) AS active_drivers,
    (SELECT COUNT(DISTINCT ro.race_id) FROM race_options ro WHERE ro.team_id = t.id) AS races
"""
TEAM_COLUMNS = "t.id, t.name, t.slug, t.description, t.country, t.primary_color, t.secondary_color, t.logo_path, t.image_path, t.is_active, t.updated_at"


def _team_row(row):
    row["is_active"] = bool(row["is_active"])
    for key in ("products", "active_products", "active_drivers", "races"):
        if key in row:
            row[key] = int(row[key] or 0)
    return row


def list_teams(params):
    where, values = [_status_filter(params, "t")], []
    term = (params.get("q", [""])[0] or "").strip()[:100]
    if term:
        where.append("(t.name LIKE %s OR t.country LIKE %s)")
        values += [like_pattern(term)] * 2
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT {TEAM_COLUMNS}, {TEAM_COUNTS} FROM teams t WHERE {' AND '.join(where)} ORDER BY t.is_active DESC, t.name LIMIT %s",
                       (*values, LIST_LIMIT))
        return {"teams": [_team_row(row) for row in cursor.fetchall()]}


def _load_team(cursor, team_id):
    cursor.execute(f"SELECT {TEAM_COLUMNS}, {TEAM_COUNTS} FROM teams t WHERE t.id = %s", (team_id,))
    team = cursor.fetchone()
    if not team:
        return None
    _team_row(team)
    team["version"] = record_version(team, TEAM_VERSION)
    cursor.execute("SELECT id, name, number, nationality, image_path, is_active FROM drivers WHERE team_id = %s ORDER BY is_active DESC, name", (team_id,))
    team["drivers"] = [{**row, "is_active": bool(row["is_active"])} for row in cursor.fetchall()]
    cursor.execute(
        """SELECT p.id, p.name, p.is_active,
                  (SELECT pi.image_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.display_order, pi.id LIMIT 1) AS main_image
           FROM product_teams pt JOIN products p ON p.id = pt.product_id
           WHERE pt.team_id = %s ORDER BY p.is_active DESC, p.name LIMIT 50""",
        (team_id,),
    )
    team["products_list"] = [{**row, "is_active": bool(row["is_active"])} for row in cursor.fetchall()]
    return team


def get_team(team_id):
    with db_cursor() as (_, cursor):
        return _load_team(cursor, team_id)


def _check_team_unique(cursor, clean, team_id=None):
    cursor.execute("SELECT id FROM teams WHERE name = %s AND id <> %s", (clean["name"], team_id or 0))
    if cursor.fetchone():
        raise ValidationError({"name": "Ya existe un equipo con ese nombre."})


def _unique_team_slug(cursor, wanted, team_id=None):
    base = wanted[:110]
    candidate, suffix = base, 2
    while True:
        cursor.execute("SELECT id FROM teams WHERE slug = %s", (candidate,))
        row = cursor.fetchone()
        if not row or row["id"] == team_id:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def _team_values(clean, slug):
    return (clean["name"], slug, clean["description"] or None, clean["country"] or None, clean["primary_color"],
            clean["secondary_color"], clean["logo_path"], clean["image_path"], clean["is_active"])


def create_team(data, actor_id):
    clean = validate_team(data)
    try:
        with db_cursor() as (connection, cursor):
            _check_team_unique(cursor, clean)
            slug = _unique_team_slug(cursor, clean["slug"] or slugify(clean["name"], 110, "equipo"))
            cursor.execute(
                """INSERT INTO teams (name, slug, description, country, primary_color, secondary_color, logo_path, image_path, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                _team_values(clean, slug),
            )
            team_id = cursor.lastrowid
            record(cursor, actor_id, "TEAM_CREATED", "team", team_id, {"name": clean["name"], "is_active": clean["is_active"]})
            connection.commit()
    except Exception as exc:  # noqa: BLE001 - raise_if_duplicate relanza lo que no es duplicado
        raise_if_duplicate(exc, "Otro administrador creo un equipo con el mismo nombre o URL. Intentalo de nuevo.")
    return get_team(team_id)


def _lock_team(cursor, team_id):
    cursor.execute(f"SELECT {TEAM_COLUMNS} FROM teams t WHERE t.id = %s FOR UPDATE", (team_id,))
    team = cursor.fetchone()
    if not team:
        raise NotFoundError("Equipo no encontrado.")
    return team


def update_team(team_id, data, actor_id):
    clean = validate_team(data)
    expected = require_version(data)
    try:
        with db_cursor() as (connection, cursor):
            current = _lock_team(cursor, team_id)
            ensure_version(record_version(current, TEAM_VERSION), expected, "este equipo")
            _check_team_unique(cursor, clean, team_id)
            slug = _unique_team_slug(cursor, clean["slug"] or current["slug"], team_id)
            cursor.execute(
                """UPDATE teams SET name = %s, slug = %s, description = %s, country = %s, primary_color = %s, secondary_color = %s,
                          logo_path = %s, image_path = %s, is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s""",
                (*_team_values(clean, slug), team_id),
            )
            record(cursor, actor_id, "TEAM_UPDATED", "team", team_id, {"fields": changed_fields(current, {**clean, "slug": slug}, TEAM_FIELDS)})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        raise_if_duplicate(exc, "Otro administrador uso el mismo nombre o URL de equipo. Intentalo de nuevo.")
    return get_team(team_id)


def set_team_active(team_id, data, actor_id):
    if "is_active" not in data:
        raise ValidationError({"is_active": "Indica si el equipo queda activo."})
    try:
        active = parse_bool(data.get("is_active"))
    except ValueError as exc:
        raise ValidationError({"is_active": str(exc)}) from exc
    with db_cursor() as (connection, cursor):
        _lock_team(cursor, team_id)
        cursor.execute("UPDATE teams SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (active, team_id))
        record(cursor, actor_id, "TEAM_ACTIVATED" if active else "TEAM_DEACTIVATED", "team", team_id)
        connection.commit()
    return get_team(team_id)


# ------------------------------------------------------------------ pilotos

def validate_driver(data):
    errors = {}
    clean = {
        "name": clean_name(text_field(data, "name", errors, 100, required=True, label="El nombre")),
        "nationality": clean_name(text_field(data, "nationality", errors, 100, label="La nacionalidad")),
        "image_path": _image(data, "image_path", errors, "Imagen"),
    }
    if clean["name"] and len(clean["name"]) < 2:
        errors["name"] = "El nombre es demasiado corto."
    try:
        clean["number"] = None if data.get("number") in (None, "") else parse_int(data.get("number"), 1, 99, "El dorsal debe estar entre 1 y 99.")
    except ValueError as exc:
        errors["number"] = str(exc)
    try:
        clean["team_id"] = optional_id(data.get("team_id"))
    except ValueError:
        errors["team_id"] = "Equipo invalido."
    try:
        clean["is_active"] = parse_bool(data.get("is_active"), default=True)
    except ValueError as exc:
        errors["is_active"] = str(exc)
    if errors:
        raise ValidationError(errors)
    return clean


DRIVER_COLUMNS = """d.id, d.name, d.number, d.nationality, d.team_id, d.image_path, d.is_active, d.updated_at,
    t.name AS team_name, t.is_active AS team_active,
    (SELECT COUNT(*) FROM race_options ro WHERE ro.driver_id = d.id) AS races,
    (SELECT COUNT(*) FROM bets b JOIN race_options ro ON ro.id = b.option_id WHERE ro.driver_id = d.id) AS predictions"""


def _driver_row(row):
    row["is_active"] = bool(row["is_active"])
    row["team_active"] = None if row.get("team_active") is None else bool(row["team_active"])
    for key in ("races", "predictions"):
        if key in row:
            row[key] = int(row[key] or 0)
    return row


def list_drivers(params):
    where, values = [_status_filter(params, "d")], []
    term = (params.get("q", [""])[0] or "").strip()[:100]
    if term:
        where.append("(d.name LIKE %s OR d.nationality LIKE %s)")
        values += [like_pattern(term)] * 2
    team = (params.get("team", [""])[0] or "").strip()
    if team == "none":
        where.append("d.team_id IS NULL")
    elif team:
        try:
            values.append(parse_int(team, 1, 2_147_483_647, "x"))
        except ValueError as exc:
            raise ValidationError({"team": "Filtro invalido."}) from exc
        where.append("d.team_id = %s")
    sorts = {"name": "d.name", "number": "d.number IS NULL, d.number, d.name", "team": "t.name IS NULL, t.name, d.name"}
    sort = (params.get("sort", ["name"])[0] or "name").strip()
    if sort not in sorts:
        raise ValidationError({"sort": "Orden invalido."})
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""SELECT {DRIVER_COLUMNS} FROM drivers d LEFT JOIN teams t ON t.id = d.team_id
                WHERE {' AND '.join(where)} ORDER BY d.is_active DESC, {sorts[sort]} LIMIT %s""",
            (*values, LIST_LIMIT),
        )
        return {"drivers": [_driver_row(row) for row in cursor.fetchall()]}


def _load_driver(cursor, driver_id):
    cursor.execute(f"SELECT {DRIVER_COLUMNS} FROM drivers d LEFT JOIN teams t ON t.id = d.team_id WHERE d.id = %s", (driver_id,))
    driver = cursor.fetchone()
    if not driver:
        return None
    _driver_row(driver)
    driver["version"] = record_version(driver, DRIVER_VERSION)
    # Historial tal como quedo registrado en cada carrera (nombre y equipo de entonces).
    cursor.execute(
        """SELECT r.id AS race_id, r.name AS race_name, r.race_date, r.status, ro.driver_name, ro.team_id, t.name AS team_name,
                  (SELECT COUNT(*) FROM bets b WHERE b.option_id = ro.id) AS predictions
           FROM race_options ro JOIN races r ON r.id = ro.race_id LEFT JOIN teams t ON t.id = ro.team_id
           WHERE ro.driver_id = %s ORDER BY r.race_date DESC, r.id DESC LIMIT 30""",
        (driver_id,),
    )
    driver["history"] = [{**row, "predictions": int(row["predictions"] or 0)} for row in cursor.fetchall()]
    return driver


def get_driver(driver_id):
    with db_cursor() as (_, cursor):
        return _load_driver(cursor, driver_id)


def _check_driver(cursor, clean, current=None):
    driver_id = current["id"] if current else 0
    cursor.execute("SELECT id FROM drivers WHERE name = %s AND id <> %s", (clean["name"], driver_id))
    if cursor.fetchone():
        raise ValidationError({"name": "Ya existe un piloto con ese nombre."})
    if clean["number"] is not None and clean["is_active"]:
        cursor.execute("SELECT name FROM drivers WHERE number = %s AND is_active = TRUE AND id <> %s", (clean["number"], driver_id))
        other = cursor.fetchone()
        if other:
            raise ValidationError({"number": f"El dorsal {clean['number']} ya lo usa {other['name']}."})
    if clean["team_id"]:
        cursor.execute("SELECT is_active FROM teams WHERE id = %s", (clean["team_id"],))
        team = cursor.fetchone()
        if not team:
            raise ValidationError({"team_id": "El equipo no existe."})
        # Se puede conservar un equipo ya inactivo, pero no asignarlo de nuevo.
        if not team["is_active"] and (not current or current["team_id"] != clean["team_id"]):
            raise ValidationError({"team_id": "Ese equipo esta inactivo; activalo antes de asignarle pilotos."})


def _driver_values(clean):
    return (clean["name"], clean["number"], clean["nationality"] or None, clean["team_id"], clean["image_path"], clean["is_active"])


def create_driver(data, actor_id):
    clean = validate_driver(data)
    try:
        with db_cursor() as (connection, cursor):
            _check_driver(cursor, clean)
            cursor.execute(
                "INSERT INTO drivers (name, number, nationality, team_id, image_path, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
                _driver_values(clean),
            )
            driver_id = cursor.lastrowid
            record(cursor, actor_id, "DRIVER_CREATED", "driver", driver_id, {"name": clean["name"], "team_id": clean["team_id"]})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        raise_if_duplicate(exc, "Otro administrador registro el mismo piloto o dorsal al mismo tiempo. Intentalo de nuevo.")
    return get_driver(driver_id)


def _lock_driver(cursor, driver_id):
    cursor.execute("SELECT id, name, number, nationality, team_id, image_path, is_active, updated_at FROM drivers WHERE id = %s FOR UPDATE", (driver_id,))
    driver = cursor.fetchone()
    if not driver:
        raise NotFoundError("Piloto no encontrado.")
    return driver


def update_driver(driver_id, data, actor_id):
    clean = validate_driver(data)
    expected = require_version(data)
    try:
        with db_cursor() as (connection, cursor):
            current = _lock_driver(cursor, driver_id)
            ensure_version(record_version(current, DRIVER_VERSION), expected, "este piloto")
            _check_driver(cursor, clean, current)
            # Solo la ficha del piloto: race_options (historial) no se toca.
            cursor.execute(
                """UPDATE drivers SET name = %s, number = %s, nationality = %s, team_id = %s, image_path = %s, is_active = %s,
                          updated_at = CURRENT_TIMESTAMP WHERE id = %s""",
                (*_driver_values(clean), driver_id),
            )
            details = {"fields": changed_fields(current, clean, DRIVER_FIELDS)}
            if current["team_id"] != clean["team_id"]:
                details["team"] = {"from": current["team_id"], "to": clean["team_id"]}
            record(cursor, actor_id, "DRIVER_UPDATED", "driver", driver_id, details)
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        raise_if_duplicate(exc, "Otro administrador uso el mismo nombre o dorsal. Intentalo de nuevo.")
    return get_driver(driver_id)


def set_driver_active(driver_id, data, actor_id):
    if "is_active" not in data:
        raise ValidationError({"is_active": "Indica si el piloto queda activo."})
    try:
        active = parse_bool(data.get("is_active"))
    except ValueError as exc:
        raise ValidationError({"is_active": str(exc)}) from exc
    try:
        with db_cursor() as (connection, cursor):
            current = _lock_driver(cursor, driver_id)
            if active and current["number"] is not None:
                cursor.execute("SELECT name FROM drivers WHERE number = %s AND is_active = TRUE AND id <> %s", (current["number"], driver_id))
                other = cursor.fetchone()
                if other:
                    raise ValidationError({"number": f"No se puede activar: el dorsal {current['number']} lo usa {other['name']}."})
            cursor.execute("UPDATE drivers SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (active, driver_id))
            record(cursor, actor_id, "DRIVER_ACTIVATED" if active else "DRIVER_DEACTIVATED", "driver", driver_id)
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        raise_if_duplicate(exc, "Otro piloto activo ya usa ese dorsal.")
    return get_driver(driver_id)


def team_options():
    """Equipos para los selectores del panel (incluye inactivos marcados)."""
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT id, name, is_active FROM teams ORDER BY is_active DESC, name")
        return [{**row, "is_active": bool(row["is_active"])} for row in cursor.fetchall()]

