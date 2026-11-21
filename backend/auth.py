from database import db_cursor, fetch_one, is_duplicate_key
import settings
from security import clear_login_failures, login_allowed, record_login_failure, uses_seed_password
from utils import check_password, hash_password, public_user, valid_email, validate_password


def register_user(data):
    first_name = (data.get("first_name") or data.get("name") or "").strip()
    last_name = (data.get("last_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    password_confirm = data.get("password_confirm") or password
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    if not all([first_name, last_name, email, password]):
        return None, "Completa todos los campos obligatorios.", 400
    if not valid_email(email):
        return None, "Correo electronico invalido.", 400
    # Longitudes de database/schema.sql.
    if len(email) > 150 or len(first_name) > 100 or len(last_name) > 100 or len(address) > 200:
        return None, "Algun campo supera la longitud permitida.", 400
    if phone and (len(phone) > 10 or not phone.isdigit()):
        return None, "El telefono debe tener maximo 10 numeros.", 400
    if password != password_confirm:
        return None, "Las contrasenas no coinciden.", 400
    ok, message = validate_password(password)
    if not ok:
        return None, message, 400
    if fetch_one("SELECT id FROM users WHERE LOWER(email) = LOWER(%s)", (email,)):
        return None, "Ya existe una cuenta con ese correo.", 400
    with db_cursor() as (connection, cursor):
        try:
            cursor.execute(
                """INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (email, email, hash_password(password), first_name, last_name, phone, address),
            )
        except Exception as exc:
            # Dos registros simultaneos pueden pasar la comprobacion previa.
            if is_duplicate_key(exc):
                connection.rollback()
                return None, "Ya existe una cuenta con ese correo.", 400
            raise
        user_id = cursor.lastrowid
        # Saldo inicial configurable por el superadministrador.
        initial_balance = settings.get("pitcoins.opening_balance", cursor)
        cursor.execute("UPDATE users SET coins = %s WHERE id = %s", (initial_balance, user_id))
        cursor.execute(
            """INSERT INTO pitcoin_movements (user_id, amount, balance_after, kind, reference)
               VALUES (%s, %s, %s, 'OPENING_BALANCE', %s)""",
            (user_id, initial_balance, initial_balance, f"opening:{user_id}"),
        )
        connection.commit()
    user = fetch_one(
        "SELECT id, username, email, first_name, last_name, phone, address, is_staff, coins, created_at FROM users WHERE id = %s",
        (user_id,),
    )
    return {"success": True, "user": user}, None, 201


LOGIN_BLOCKED = "Demasiados intentos. Espera 15 minutos."


def login_user(data, client_ip=""):
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not login_allowed(email, client_ip):
        return None, LOGIN_BLOCKED, 429
    user = fetch_one("SELECT * FROM users WHERE LOWER(email) = LOWER(%s) AND is_active = TRUE", (email,))
    if not user or not check_password(password, user["password_hash"]):
        record_login_failure(email, client_ip)
        return None, "Correo o contrasena incorrectos.", 401
    clear_login_failures(email, client_ip)
    payload = public_user(user)
    if uses_seed_password(user["password_hash"]):
        # Puede entrar a la tienda, pero sin permisos de staff hasta cambiarla.
        payload["is_staff"] = False
        payload["is_superadmin"] = False
        payload["password_change_required"] = True
    return {"success": True, "user": payload}, None, 200


def change_password(data):
    user_id = data.get("user_id")
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    password_confirm = data.get("password_confirm") or new_password
    user = fetch_one("SELECT * FROM users WHERE id = %s", (user_id,))
    if not user:
        return None, "Usuario no encontrado.", 404
    if not check_password(current_password, user["password_hash"]):
        return None, "La contrasena actual no es correcta.", 401
    if new_password != password_confirm:
        return None, "Las contrasenas no coinciden.", 400
    ok, message = validate_password(new_password)
    if not ok:
        return None, message, 400
    with db_cursor() as (connection, cursor):
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(new_password), user_id))
        cursor.execute("DELETE FROM auth_sessions WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id,))
        connection.commit()
    return {"success": True, "message": "Contraseña actualizada. Inicia sesión de nuevo."}, None, 200
