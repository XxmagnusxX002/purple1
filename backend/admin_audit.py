"""Consulta del registro de auditoria (admin_audit_log). Solo lectura y solo
para el superadministrador (server.py lo exige en cada peticion)."""

import json
import re
from datetime import date, timedelta

from admin_common import ValidationError, parse_int
from database import db_cursor

PER_PAGE = 30
ACTION_PATTERN = re.compile(r"[A-Z][A-Z0-9_]{0,59}")
ENTITY_PATTERN = re.compile(r"[a-z][a-z0-9_]{0,39}")


def _date(value, field):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError({field: "Fecha invalida (AAAA-MM-DD)."}) from exc


def list_audit(params):
    get = lambda name: (params.get(name, [""])[0] or "").strip()
    action, entity, actor, entity_id = get("action").upper(), get("entity").lower(), get("actor"), get("entity_id")
    try:
        page = parse_int(get("page") or "1", 1, 100000, "Pagina invalida.")
        actor_id = parse_int(actor, 1, 2_147_483_647, "Administrador invalido.") if actor else None
    except ValueError as exc:
        raise ValidationError({}, str(exc)) from exc
    if action and not ACTION_PATTERN.fullmatch(action):
        raise ValidationError({"action": "Accion invalida."})
    if entity and not ENTITY_PATTERN.fullmatch(entity):
        raise ValidationError({"entity": "Entidad invalida."})
    start, end = _date(get("from"), "from"), _date(get("to"), "to")

    where, values = [], []
    if action:
        where.append("a.action = %s")
        values.append(action)
    if entity:
        where.append("a.entity = %s")
        values.append(entity)
    if entity_id:
        where.append("a.entity_id = %s")
        values.append(entity_id[:64])
    if actor_id:
        where.append("a.actor_user_id = %s")
        values.append(actor_id)
    if start:
        where.append("a.created_at >= %s")
        values.append(start)
    if end:
        where.append("a.created_at < %s")
        values.append(end + timedelta(days=1))
    clause = " AND ".join(where) or "TRUE"

    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS total FROM admin_audit_log a WHERE {clause}", tuple(values))
        total = int(cursor.fetchone()["total"])
        pages = max(1, -(-total // PER_PAGE))
        page = min(page, pages)
        cursor.execute(
            f"""SELECT a.id, a.created_at, a.action, a.entity, a.entity_id, a.details,
                       a.actor_user_id, u.email AS actor_email, u.first_name AS actor_first_name, u.last_name AS actor_last_name
                FROM admin_audit_log a JOIN users u ON u.id = a.actor_user_id
                WHERE {clause} ORDER BY a.id DESC LIMIT %s OFFSET %s""",
            (*values, PER_PAGE, (page - 1) * PER_PAGE),
        )
        rows = cursor.fetchall()
        # Opciones de los filtros: solo lo que existe en el registro.
        cursor.execute("SELECT DISTINCT action FROM admin_audit_log ORDER BY action")
        actions = [row["action"] for row in cursor.fetchall()]
        cursor.execute("SELECT DISTINCT entity FROM admin_audit_log ORDER BY entity")
        entities = [row["entity"] for row in cursor.fetchall()]
        cursor.execute("""SELECT DISTINCT u.id, u.email, u.first_name, u.last_name FROM admin_audit_log a
                          JOIN users u ON u.id = a.actor_user_id ORDER BY u.first_name, u.email""")
        actors = cursor.fetchall()
    for row in rows:
        try:
            row["details"] = json.loads(row["details"]) if row["details"] else None
        except ValueError:
            pass  # se muestra el texto tal cual
    return {"entries": rows, "total": total, "page": page, "pages": pages,
            "filters": {"actions": actions, "entities": entities, "actors": actors}}
