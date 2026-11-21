"""Utilidades compartidas por los modulos de gestion del panel (A3 productos,
A4 equipos y pilotos): errores con su codigo HTTP, lectura validada de campos y
control de ediciones simultaneas. Sin estado ni acceso a la base de datos."""

import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from decimal import Decimal

from database import is_duplicate_key

SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
HEX_COLOR = re.compile(r"#[0-9A-Fa-f]{6}")
VERSION_PATTERN = re.compile(r"[0-9a-f]{32}")
MAX_ID = 2_147_483_647


class ValidationError(ValueError):
    """400: errores por campo para mostrarlos junto a cada input."""

    def __init__(self, fields, message="Revisa los campos marcados."):
        super().__init__(message)
        self.fields = fields
        self.message = message


class ConflictError(ValueError):
    """409: el dato cambio mientras se editaba o choco con otro administrador."""


class NotFoundError(LookupError):
    """404."""


def text_field(data, key, errors, max_length, required=False, label="Este campo"):
    value = data.get(key)
    if value is None:
        value = ""
    if not isinstance(value, str):
        errors[key] = f"{label} debe ser texto."
        return ""
    value = value.strip()
    if required and not value:
        errors[key] = f"{label} es obligatorio."
    elif len(value) > max_length:
        errors[key] = f"{label} admite maximo {max_length} caracteres."
    return value


def clean_name(value):
    """Recorta y une espacios repetidos: 'Max   Verstappen ' -> 'Max Verstappen'."""
    return re.sub(r"\s+", " ", value or "").strip()


def parse_int(value, minimum, maximum, message):
    if isinstance(value, bool):
        raise ValueError(message)
    if isinstance(value, str) and re.fullmatch(r"-?\d+", value.strip()):
        value = int(value.strip())
    if not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(message)
    return value


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if value in (0, 1, "0", "1", "true", "false"):
        return value in (1, "1", "true")
    raise ValueError("Valor de si/no invalido.")


def parse_ids(value, key, errors, label):
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 50:
        errors[key] = f"{label}: lista invalida."
        return []
    ids = []
    for item in value:
        try:
            number = parse_int(item, 1, MAX_ID, "x")
        except ValueError:
            errors[key] = f"{label}: identificador invalido."
            return []
        if number not in ids:
            ids.append(number)
    return ids


def optional_id(value):
    if value in (None, "", 0, "0"):
        return None
    return parse_int(value, 1, MAX_ID, "Identificador invalido.")


def parse_hex_color(value, key, errors, label):
    if value in (None, ""):
        return None
    if not isinstance(value, str) or not HEX_COLOR.fullmatch(value.strip()):
        errors[key] = f"{label}: usa el formato #RRGGBB."
        return None
    return value.strip().upper()


def parse_utc_datetime(value, key, errors, label="La fecha"):
    """Fecha ISO con zona horaria (la envia el navegador con toISOString) -> DATETIME UTC sin zona."""
    if value in (None, ""):
        return None
    try:
        if not isinstance(value, str):
            raise ValueError
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        errors[key] = f"{label}: usa una fecha y hora válidas."
        return None


def slugify(text, max_length=170, fallback="producto"):
    ascii_text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")[:max_length].strip("-")
    return slug or fallback


def like_pattern(term):
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def record_version(row, keys):
    """Huella del contenido editable de un registro (y de su updated_at). Cambia
    con cualquier modificacion, aunque ocurra en el mismo segundo: DATETIME no
    tiene mas precision, asi que comparar solo updated_at no basta."""
    parts = [[key, comparable(row.get(key))] for key in keys]
    text = json.dumps(parts, default=str, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def require_version(data):
    """La version es obligatoria al editar: sin ella no hay forma de saber si se
    sobrescribiria el trabajo de otro administrador."""
    version = data.get("version")
    if not isinstance(version, str) or not VERSION_PATTERN.fullmatch(version):
        raise ValidationError({"version": "Falta la version del registro."}, "Recarga la pagina antes de guardar los cambios.")
    return version


def ensure_version(current, expected, what):
    """Edicion simultanea: se compara bajo FOR UPDATE con lo que el formulario cargo."""
    if current != expected:
        raise ConflictError(f"Otro administrador modifico {what}. Recarga para ver los cambios.")


def comparable(value):
    """MySQL devuelve 1/0 para BOOLEAN y Decimal para precios: se normaliza para
    que la auditoria solo liste campos realmente modificados."""
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, Decimal):
        return str(value.quantize(Decimal("0.01")))
    return "" if value is None else value


def changed_fields(current, new, keys):
    return [key for key in keys if comparable(current.get(key)) != comparable(new.get(key))]


def raise_if_duplicate(exc, message="Otro administrador uso el mismo dato al mismo tiempo. Intentalo de nuevo."):
    """Convierte un duplicado de MySQL (incluso envuelto por db_cursor) en conflicto;
    cualquier otro error se relanza tal cual."""
    if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
        raise exc
    if is_duplicate_key(exc) or is_duplicate_key(exc.__cause__):
        raise ConflictError(message) from exc
    raise exc
