"""Consulta de usuarios y gestion de roles; nunca devuelve password_hash.

Roles (columnas de users):
  CUSTOMER    cliente                 is_staff = FALSE
  STAFF       administrador           is_staff = TRUE,  is_superadmin = FALSE
  SUPERADMIN  superadministrador      is_staff = TRUE,  is_superadmin = TRUE
Solo un superadministrador cambia roles o activa/desactiva cuentas (server.py lo
exige y change_access lo vuelve a comprobar bajo bloqueo).
"""

from admin_common import ConflictError, NotFoundError, ValidationError, ensure_version, like_pattern, parse_int, record_version, require_version
from admin_dashboard import SALE
from audit import record
from database import db_cursor
import progression

VERSION_FIELDS = ("id", "is_staff", "is_superadmin", "is_active", "first_name", "last_name", "email", "updated_at")
PER_PAGE = 25
ROLES = ("CUSTOMER", "STAFF", "SUPERADMIN")
# Ordenamientos permitidos del listado (nunca se concatena texto del cliente).
SORTS = {
    "recent": "id DESC",
    "oldest": "id ASC",
    "name": "first_name ASC, last_name ASC, id ASC",
    "coins_desc": "coins DESC, id DESC",
    "coins_asc": "coins ASC, id ASC",
}


def role_of(row):
    if not row["is_staff"]:
        return "CUSTOMER"
    return "SUPERADMIN" if row["is_superadmin"] else "STAFF"


def _version(row):
    row["version"] = record_version(row, VERSION_FIELDS)
    row["role"] = role_of(row)
    return row


def list_users(params):
    term = (params.get("q", [""])[0] or "").strip()[:100]
    state = (params.get("status", ["all"])[0] or "all").lower()
    role = (params.get("role", ["all"])[0] or "all").lower()
    sort = (params.get("sort", ["recent"])[0] or "recent").lower()
    if sort not in SORTS:
        raise ValidationError({}, "Orden de usuarios inválido.")
    if state not in ("all", "active", "inactive") or role not in ("all", "staff", "superadmin", "customer"):
        raise ValidationError({}, "Filtro de usuarios inválido.")
    try:
        page = parse_int(params.get("page", ["1"])[0], 1, 10000, "Página inválida.")
    except ValueError as exc:
        raise ValidationError({"page": str(exc)}) from exc
    where, values = [], []
    if term:
        where.append("(username LIKE %s OR email LIKE %s OR first_name LIKE %s OR last_name LIKE %s)")
        values.extend([like_pattern(term)] * 4)
    if state != "all":
        where.append("is_active = %s")
        values.append(state == "active")
    if role == "superadmin":
        where.append("is_superadmin = TRUE")
    elif role != "all":
        where.append("is_staff = %s")
        values.append(role == "staff")
    clause = " AND ".join(where) or "TRUE"
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS total FROM users WHERE {clause}", tuple(values))
        total = int(cursor.fetchone()["total"])
        page = min(page, max(1, -(-total // PER_PAGE)))
        cursor.execute(f"""SELECT id, username, email, first_name, last_name, is_staff, is_superadmin, is_active, coins,
                               created_at, updated_at FROM users WHERE {clause}
                           ORDER BY {SORTS[sort]} LIMIT %s OFFSET %s""", (*values, PER_PAGE, (page - 1) * PER_PAGE))
        users = [_version(row) for row in cursor.fetchall()]
    return {"users": users, "total": total, "page": page, "pages": max(1, -(-total // PER_PAGE))}


def get_user_detail(user_id):
    with db_cursor() as (_, cursor):
        cursor.execute("""SELECT id, username, email, first_name, last_name, phone, address, is_staff, is_superadmin, is_active,
                              coins, created_at, updated_at FROM users WHERE id = %s""", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise NotFoundError("Usuario no encontrado.")
        cursor.execute(f"""SELECT COUNT(*) AS total, COALESCE(SUM(o.total), 0) AS spent
                           FROM orders o WHERE o.user_id = %s AND {SALE}""", (user_id,))
        user["purchases"] = cursor.fetchone()
        cursor.execute("""SELECT COUNT(*) AS total, COALESCE(SUM(status = 'WON'), 0) AS won
                          FROM bets WHERE user_id = %s""", (user_id,))
        user["predictions"] = cursor.fetchone()
        if progression.XP_ENABLED:
            cursor.execute("SELECT xp_total FROM users WHERE id = %s", (user_id,))
            user["xp_total"] = cursor.fetchone()["xp_total"]
            level = progression.progress(int(user["xp_total"]))
            user["level"], user["rank"] = level["level"], level["rank"]["name"]
        else:
            user["xp_total"] = user["level"] = user["rank"] = None
    return _version(user)


def _lock_staff_and_target(cursor, user_id, actor_id):
    # Bloquear todo el conjunto de staff primero serializa dos cambios simultaneos.
    cursor.execute("SELECT id, is_active, is_superadmin FROM users WHERE is_staff = TRUE ORDER BY id FOR UPDATE")
    staff = cursor.fetchall()
    cursor.execute("SELECT * FROM users WHERE id = %s FOR UPDATE", (user_id,))
    target = cursor.fetchone()
    if not target:
        raise NotFoundError("Usuario no encontrado.")
    cursor.execute("SELECT id, is_staff, is_superadmin, is_active FROM users WHERE id = %s", (actor_id,))
    actor = cursor.fetchone()
    if not actor or not actor["is_staff"] or not actor["is_superadmin"] or not actor["is_active"]:
        raise ConflictError("Solo un superadministrador activo puede cambiar roles. Vuelve a iniciar sesión.")
    active_staff = sum(1 for row in staff if row["is_active"])
    active_superadmins = sum(1 for row in staff if row["is_active"] and row["is_superadmin"])
    return target, active_staff, active_superadmins


def change_access(user_id, data, actor_id):
    """Cambia el rol (CUSTOMER, STAFF o SUPERADMIN) y el estado de una cuenta."""
    expected = require_version(data)
    new_role = str(data.get("role") or "").strip().upper()
    if new_role not in ROLES or not isinstance(data.get("is_active"), bool):
        raise ValidationError({}, "Indica el rol (cliente, administrador o superadministrador) y el estado de la cuenta.")
    new_active = data["is_active"]
    new_staff, new_super = new_role != "CUSTOMER", new_role == "SUPERADMIN"
    with db_cursor() as (connection, cursor):
        target, active_staff, active_superadmins = _lock_staff_and_target(cursor, user_id, actor_id)
        ensure_version(record_version(target, VERSION_FIELDS), expected, "este usuario")
        old_role = role_of(target)
        if user_id == actor_id and (new_role != old_role or not new_active):
            raise ConflictError("No puedes cambiar tu propio rol ni desactivar tu cuenta.")
        loses_staff = target["is_staff"] and target["is_active"] and (not new_staff or not new_active)
        if loses_staff and active_staff <= 1:
            raise ConflictError("Debe quedar al menos un administrador activo.")
        loses_super = target["is_superadmin"] and target["is_active"] and (not new_super or not new_active)
        if loses_super and active_superadmins <= 1:
            raise ConflictError("Debe quedar al menos un superadministrador activo.")
        if new_role != old_role or bool(target["is_active"]) != new_active:
            cursor.execute("UPDATE users SET is_staff = %s, is_superadmin = %s, is_active = %s WHERE id = %s",
                           (new_staff, new_super, new_active, user_id))
            record(cursor, actor_id, "USER_ACCESS_CHANGED", "user", user_id,
                   {"role_from": old_role, "role_to": new_role,
                    "active_from": bool(target["is_active"]), "active_to": new_active})
        connection.commit()
    return get_user_detail(user_id)


def deactivate_legacy(user_id, actor_id, version=None):
    """Conserva DELETE /api/users/id, aplicando la misma protección del último staff."""
    with db_cursor() as (connection, cursor):
        cursor.execute("SELECT id, is_active, is_superadmin FROM users WHERE is_staff = TRUE ORDER BY id FOR UPDATE")
        staff = {row["id"]: row for row in cursor.fetchall()}
        cursor.execute("SELECT * FROM users WHERE id = %s FOR UPDATE", (user_id,))
        target = cursor.fetchone()
        if not target:
            return False
        if target["is_staff"]:
            if user_id == actor_id or sum(1 for row in staff.values() if row["is_active"]) <= 1:
                raise ConflictError("No puedes desactivar tu propio acceso ni al último administrador.")
            if target["is_superadmin"] and sum(1 for row in staff.values() if row["is_active"] and row["is_superadmin"]) <= 1:
                raise ConflictError("No puedes desactivar al último superadministrador.")
        if actor_id in staff and user_id != actor_id:
            expected = require_version({"version": version})
            ensure_version(record_version(target, VERSION_FIELDS), expected, "este usuario")
        if target["is_active"]:
            cursor.execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
            if actor_id in staff:
                record(cursor, actor_id, "USER_DEACTIVATED", "user", user_id)
        connection.commit()
    return True
