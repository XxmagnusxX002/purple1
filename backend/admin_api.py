"""Acceso al panel administrativo (/admin/). El rol es users.is_staff.

El servidor valida el rol en cada peticion (server.require_staff); este modulo
solo implementa el login propio del panel y el perfil de la sesion.
"""

from audit import record
from database import db_cursor, fetch_one
from security import SEED_SALTS, clear_login_failures, login_allowed, record_login_failure, uses_seed_password  # noqa: F401
from utils import check_password

# Mismo mensaje para correo inexistente, contrasena incorrecta, cuenta sin
# permisos o cuenta con la contrasena publica del seed: la respuesta no permite
# distinguir que cuentas existen ni cuales son administrativas.
ADMIN_LOGIN_FAILED = "Credenciales invalidas o sin acceso administrativo."
ADMIN_LOGIN_BLOCKED = "Demasiados intentos. Espera 15 minutos."

def admin_login(data, client_ip=""):
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email or not password:
        return None, ADMIN_LOGIN_FAILED, 401
    if not login_allowed(email, client_ip):
        return None, ADMIN_LOGIN_BLOCKED, 429
    user = fetch_one(
        "SELECT id, email, first_name, last_name, password_hash, is_staff FROM users WHERE LOWER(email) = LOWER(%s) AND is_active = TRUE",
        (email,),
    )
    valid = bool(user) and check_password(password, user["password_hash"])
    if not valid or not user["is_staff"] or uses_seed_password(user["password_hash"]):
        # Un cliente con contrasena correcta cuenta como fallo en este acceso.
        record_login_failure(email, client_ip)
        return None, ADMIN_LOGIN_FAILED, 401
    clear_login_failures(email, client_ip)
    with db_cursor() as (connection, cursor):
        record(cursor, int(user["id"]), "ADMIN_LOGIN", "session", user["id"])
        connection.commit()
    return {"success": True, "user": session_profile(user)}, None, 200


def session_profile(user):
    return {
        "id": user["id"],
        "email": user["email"],
        "first_name": user.get("first_name") or "",
        "last_name": user.get("last_name") or "",
    }


def get_session_profile(user_id):
    user = fetch_one(
        "SELECT id, email, first_name, last_name FROM users WHERE id = %s AND is_active = TRUE AND is_staff = TRUE",
        (user_id,),
    )
    return session_profile(user) if user else None
