"""Server-owned sessions and one-use password recovery tokens."""

import hashlib
import os
import secrets
import smtplib
import time
from email.message import EmailMessage
from http.cookies import SimpleCookie
from urllib.parse import quote

from database import db_cursor, fetch_one
from utils import hash_password, validate_password

# Salts de las cuentas de ejemplo de database/seed.sql: su contrasena es publica.
SEED_SALTS = {"demo_salt", "admin_salt"}

COOKIE_NAME = "purple1_session"
SESSION_DAYS = 7
RESET_MINUTES = 30


def _digest(value):
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def uses_seed_password(password_hash):
    """True si la cuenta conserva la contrasena publica de seed.sql. Se reconoce
    por el salt (sin recalcular PBKDF2), asi que es barato en cada peticion."""
    parts = str(password_hash or "").split("$")
    return len(parts) == 4 and parts[2] in SEED_SALTS


def read_session(cookie_header):
    cookies = SimpleCookie()
    try:
        cookies.load(cookie_header or "")
        raw = cookies[COOKIE_NAME].value if COOKIE_NAME in cookies else ""
    except Exception:
        return None
    if len(raw) != 64:
        return None
    try:
        int(raw, 16)
    except ValueError:
        return None
    user = fetch_one(
        """SELECT u.id, u.email, u.is_staff, u.is_superadmin, u.password_hash FROM auth_sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = %s AND s.expires_at > UTC_TIMESTAMP()
             AND u.is_active = TRUE""",
        (_digest(raw),),
    )
    if not user:
        return None
    # Unico punto que decide los permisos de una sesion, venga del login que
    # venga: una cuenta con la contrasena publica de seed.sql no actua como staff
    # hasta cambiarla (puede seguir usando la tienda y cambiar su contrasena).
    seed = uses_seed_password(user.pop("password_hash"))
    user["is_staff"] = bool(user["is_staff"]) and not seed
    # Superadministrador: rol adicional que solo vale si la cuenta es staff efectivo.
    user["is_superadmin"] = bool(user["is_superadmin"]) and user["is_staff"]
    user["password_change_required"] = seed
    return user


def create_session(user_id):
    token = secrets.token_hex(32)
    with db_cursor() as (connection, cursor):
        cursor.execute(
            "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (%s, %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 DAY))",
            (user_id, _digest(token)),
        )
        connection.commit()
    return token


def revoke_session(cookie_header):
    cookies = SimpleCookie()
    try:
        cookies.load(cookie_header or "")
        raw = cookies[COOKIE_NAME].value if COOKIE_NAME in cookies else ""
        if len(raw) != 64:
            return
        int(raw, 16)
    except (ValueError, KeyError):
        return
    with db_cursor() as (connection, cursor):
        cursor.execute("DELETE FROM auth_sessions WHERE token_hash = %s", (_digest(raw),))
        connection.commit()


def session_cookie(token):
    secure = "; Secure" if os.getenv("PURPLE1_COOKIE_SECURE", "0") == "1" else ""
    return f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_DAYS * 86400}{secure}"


def clear_cookie():
    secure = "; Secure" if os.getenv("PURPLE1_COOKIE_SECURE", "0") == "1" else ""
    return f"{COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{secure}"


# Bloqueo de login sin cambiar el esquema: cada clave es una fila de
# auth_login_attempts identificada solo por un hash (no guarda IP ni correo).
# - cuenta: IP + correo. 5 fallos bloquean esa cuenta desde esa IP; desde otra
#   IP la cuenta sigue disponible, asi que nadie puede bloquear al staff a distancia.
# - IP: fallos de esa IP con cualquier correo, contados por ventana de 15 minutos.
#   Al llegar a 20 se bloquea la IP completa durante 15 minutos.
LOGIN_ACCOUNT_LIMIT = 5
LOGIN_IP_LIMIT = 20
LOGIN_WINDOW_SECONDS = 15 * 60


def _key(*parts):
    return _digest("|".join(parts).encode("utf-8").hex())


def _throttle_keys(identifier, client_ip, now=None):
    window = int(time.time() if now is None else now) // LOGIN_WINDOW_SECONDS
    ip = client_ip or "-"
    return {
        "account": _key("account", ip, identifier),
        "ip_window": _key("ip-window", ip, str(window)),
        "ip_previous_window": _key("ip-window", ip, str(window - 1)),
        "ip_block": _key("ip-block", ip),
    }


def login_allowed(identifier, client_ip=""):
    keys = _throttle_keys(identifier, client_ip)
    row = fetch_one(
        "SELECT COUNT(*) AS blocked FROM auth_login_attempts WHERE identifier_hash IN (%s, %s) AND blocked_until > UTC_TIMESTAMP()",
        (keys["account"], keys["ip_block"]),
    )
    return not (row and row["blocked"])


def _count_failure(cursor, key, limit):
    cursor.execute("INSERT IGNORE INTO auth_login_attempts (identifier_hash, failures) VALUES (%s, 0)", (key,))
    cursor.execute("SELECT failures, blocked_until, blocked_until <= UTC_TIMESTAMP() AS expired FROM auth_login_attempts WHERE identifier_hash = %s FOR UPDATE", (key,))
    row = cursor.fetchone()
    failures = 1 if row["expired"] else row["failures"] + 1
    blocks = limit is not None and failures >= limit
    cursor.execute(
        "UPDATE auth_login_attempts SET failures = %s, blocked_until = CASE WHEN %s THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) ELSE NULL END WHERE identifier_hash = %s",
        (failures, blocks, key),
    )
    return failures


def record_login_failure(identifier, client_ip=""):
    keys = _throttle_keys(identifier, client_ip)
    with db_cursor() as (connection, cursor):
        _count_failure(cursor, keys["account"], LOGIN_ACCOUNT_LIMIT)
        ip_failures = _count_failure(cursor, keys["ip_window"], None)
        if ip_failures >= LOGIN_IP_LIMIT:
            cursor.execute(
                """INSERT INTO auth_login_attempts (identifier_hash, failures, blocked_until)
                   VALUES (%s, %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))
                   ON DUPLICATE KEY UPDATE failures = VALUES(failures), blocked_until = VALUES(blocked_until)""",
                (keys["ip_block"], ip_failures),
            )
        # La ventana anterior ya no cuenta: se elimina para no acumular filas.
        cursor.execute("DELETE FROM auth_login_attempts WHERE identifier_hash = %s", (keys["ip_previous_window"],))
        connection.commit()


def clear_login_failures(identifier, client_ip=""):
    """Un acceso correcto limpia solo la clave de la cuenta. Los fallos de la IP
    siguen contando: alternar accesos validos no debe permitir probar otras cuentas."""
    with db_cursor() as (connection, cursor):
        cursor.execute("DELETE FROM auth_login_attempts WHERE identifier_hash = %s", (_throttle_keys(identifier, client_ip)["account"],))
        connection.commit()


def _send_reset_email(recipient, token):
    host = os.getenv("PURPLE1_SMTP_HOST", "")
    sender = os.getenv("PURPLE1_SMTP_FROM", "")
    base = os.getenv("PURPLE1_RESET_BASE_URL", "")
    if not host or not sender or not base:
        raise RuntimeError("Configura PURPLE1_SMTP_HOST, PURPLE1_SMTP_FROM y PURPLE1_RESET_BASE_URL.")
    if not (base.startswith("https://") or base.startswith("http://127.0.0.1:") or base.startswith("http://localhost:")):
        raise RuntimeError("La URL de recuperación debe usar HTTPS fuera del entorno local.")
    link = base.rstrip("/") + "/reset_password.html?token=" + quote(token)
    message = EmailMessage()
    message["Subject"] = "Recupera tu acceso a Purple One"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(f"Abre este enlace para cambiar tu contraseña. Caduca en {RESET_MINUTES} minutos:\n{link}\nSi no lo solicitaste, ignora este mensaje.")
    port = int(os.getenv("PURPLE1_SMTP_PORT", "1025"))
    mode = os.getenv("PURPLE1_SMTP_SECURITY", "none").lower()
    if mode not in {"none", "starttls", "ssl"}:
        raise RuntimeError("PURPLE1_SMTP_SECURITY debe ser none, starttls o ssl.")
    client_type = smtplib.SMTP_SSL if mode == "ssl" else smtplib.SMTP
    with client_type(host, port, timeout=10) as smtp:
        if mode == "starttls":
            smtp.starttls()
        username = os.getenv("PURPLE1_SMTP_USER", "")
        if username:
            smtp.login(username, os.getenv("PURPLE1_SMTP_PASSWORD", ""))
        smtp.send_message(message)


def request_reset(data):
    identifier = str(data.get("identifier") or data.get("email") or "").strip().lower()
    if not identifier:
        return None, "Indica tu correo electrónico.", 400
    if not all(os.getenv(name) for name in ("PURPLE1_SMTP_HOST", "PURPLE1_SMTP_FROM", "PURPLE1_RESET_BASE_URL")):
        return None, "La recuperación por correo aún no está configurada.", 503
    generic = {"success": True, "message": "Si existe la cuenta, recibirás un enlace de recuperación."}
    user = fetch_one("SELECT id, email FROM users WHERE LOWER(email) = %s AND is_active = TRUE", (identifier,))
    if not user:
        return generic, None, 200
    token = secrets.token_hex(32)
    with db_cursor() as (connection, cursor):
        cursor.execute("SELECT id FROM users WHERE id = %s AND is_active = TRUE FOR UPDATE", (user["id"],))
        if not cursor.fetchone():
            connection.rollback()
            return generic, None, 200
        cursor.execute("SELECT created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE) AS recent FROM password_reset_tokens WHERE user_id = %s ORDER BY id DESC LIMIT 1 FOR UPDATE", (user["id"],))
        recent = cursor.fetchone()
        if recent and recent["recent"]:
            connection.rollback()
            return generic, None, 200
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user["id"],))
        cursor.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE))",
            (user["id"], _digest(token)),
        )
        try:
            _send_reset_email(user["email"], token)
        except (OSError, smtplib.SMTPException, RuntimeError):
            connection.rollback()
            print("No fue posible entregar un enlace de recuperación por SMTP.")
            return generic, None, 200
        connection.commit()
    return generic, None, 200


def complete_reset(data):
    token = str(data.get("token") or "")
    password = str(data.get("new_password") or "")
    if len(token) != 64 or password != data.get("password_confirm"):
        return None, "Enlace o confirmación inválidos.", 400
    try:
        int(token, 16)
    except ValueError:
        return None, "Enlace inválido.", 400
    ok, message = validate_password(password)
    if not ok:
        return None, message, 400
    with db_cursor() as (connection, cursor):
        cursor.execute(
            "SELECT user_id FROM password_reset_tokens WHERE token_hash = %s AND expires_at > UTC_TIMESTAMP() FOR UPDATE",
            (_digest(token),),
        )
        row = cursor.fetchone()
        if not row:
            connection.rollback()
            return None, "El enlace venció o ya fue utilizado.", 400
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s AND is_active = TRUE", (hash_password(password), row["user_id"]))
        if cursor.rowcount != 1:
            connection.rollback()
            return None, "Cuenta no disponible.", 400
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (row["user_id"],))
        cursor.execute("DELETE FROM auth_sessions WHERE user_id = %s", (row["user_id"],))
        connection.commit()
    return {"success": True, "message": "Contraseña actualizada."}, None, 200
