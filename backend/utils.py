from datetime import date, datetime
from decimal import Decimal
import hashlib
import hmac
import re
import secrets


def json_default(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def hash_password(password, salt=None, iterations=600000):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def check_password(password, encoded):
    try:
        algorithm, iterations, salt, digest = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        candidate = hash_password(password, salt, int(iterations)).split("$", 3)[3]
        return hmac.compare_digest(candidate, digest)
    except Exception:
        return False


def valid_email(email):
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email or ""))


def validate_password(password):
    if not password or len(password) < 8:
        return False, "La contrasena debe tener minimo 8 caracteres."
    return True, ""


def public_user(user):
    if not user:
        return None
    data = dict(user)
    data.pop("password_hash", None)
    return data


PLACEHOLDER_IMAGE = re.compile(r"(?:^|/)[^/]*placeholder[^/]*\.(?:png|jpe?g|webp|gif|svg)$", re.IGNORECASE)


def is_placeholder(path):
    """True si la ruta apunta a una imagen provisional (archivos *placeholder*)."""
    return bool(path and PLACEHOLDER_IMAGE.search(str(path).replace("\\", "/")))


def image_path(path):
    """Ruta publica de una imagen real, o None si no hay imagen. Nunca devuelve
    un placeholder: el frontend muestra un icono neutro (productos) o la
    bandera del pais (carreras) cuando falta la imagen."""
    if not path or is_placeholder(path):
        return None
    text = str(path).replace("\\", "/")
    if text.startswith(("img/", "http://", "https://", "/")):
        return text
    return f"img/{text}"
