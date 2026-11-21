"""Imagenes del catalogo (fase A3): subida validada y galeria de frontend/img.

Las imagenes de producto son publicas (las sirve el servidor estatico). Solo se
aceptan PNG, JPEG y WebP comprobados por su contenido, nunca SVG ni otros tipos.
"""

import os
import secrets
from pathlib import Path

from audit import record
from database import db_cursor

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
IMAGE_DIR = FRONTEND_DIR / "img"
UPLOAD_DIR = IMAGE_DIR / "uploads"
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
CONTENT_TYPES = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


class UploadError(ValueError):
    pass


def detect_format(data):
    """Formato real segun la firma del archivo; None si no es una imagen admitida."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def save_upload(data, content_type, actor_user_id):
    kind = CONTENT_TYPES.get((content_type or "").split(";")[0].strip().lower())
    if not kind:
        raise UploadError("Solo se admiten imagenes PNG, JPEG o WebP.")
    if not data:
        raise UploadError("El archivo esta vacio.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadError("La imagen supera el maximo de 2 MB.")
    if detect_format(data) != kind:
        raise UploadError("El contenido del archivo no corresponde a una imagen valida.")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(16)}.{kind}"
    target = UPLOAD_DIR / name
    temporary = UPLOAD_DIR / f".{name}.tmp"
    temporary.write_bytes(data)
    os.replace(temporary, target)
    image_path = f"img/uploads/{name}"
    try:
        with db_cursor() as (connection, cursor):
            record(cursor, actor_user_id, "IMAGE_UPLOADED", "image", name, {"bytes": len(data), "format": kind})
            connection.commit()
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return {"image_path": image_path}


def list_images():
    """Imagenes disponibles en frontend/img (incluidas las subidas)."""
    images = []
    if not IMAGE_DIR.is_dir():
        return images
    for file in sorted(IMAGE_DIR.rglob("*")):
        if not file.is_file() or file.suffix.lower() not in ALLOWED_EXTENSIONS or file.name.startswith("."):
            continue
        relative = file.relative_to(FRONTEND_DIR).as_posix()
        images.append({
            "image_path": relative,
            "name": file.name,
            "uploaded": file.parent == UPLOAD_DIR,
            "bytes": file.stat().st_size,
        })
    return images


def valid_image_path(path):
    """True si la ruta apunta a una imagen existente dentro de frontend/img."""
    if not isinstance(path, str) or not path.startswith("img/") or "\\" in path or ".." in path.split("/"):
        return False
    if len(path) > 255 or Path(path).suffix.lower() not in ALLOWED_EXTENSIONS:
        return False
    resolved = (FRONTEND_DIR / path).resolve()
    try:
        resolved.relative_to(IMAGE_DIR.resolve())
    except ValueError:
        return False
    return resolved.is_file()
