"""Banners de portada. Las fechas se guardan como DATETIME UTC."""

from datetime import datetime, timezone

from admin_common import ConflictError, NotFoundError, ValidationError, ensure_version, record_version, require_version, text_field
from audit import record
from database import db_cursor, fetch_all
from uploads import valid_image_path

FIELDS = ("title", "description", "image_path", "link_url", "display_order", "starts_at", "ends_at", "is_active", "updated_at")


def _version(row):
    row["version"] = record_version(row, FIELDS)
    return row


def _date(value, key, errors):
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        errors[key] = "Fecha inválida."
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    except ValueError:
        errors[key] = "Usa una fecha y hora con zona horaria."
        return None


def validate(data):
    errors = {}
    title = text_field(data, "title", errors, 150, required=True, label="El título")
    description = text_field(data, "description", errors, 500)
    image = text_field(data, "image_path", errors, 255, required=True, label="La imagen")
    if image and not valid_image_path(image):
        errors["image_path"] = "Elige una imagen existente de la galería."
    link = text_field(data, "link_url", errors, 500)
    if link and not ((link.startswith("/") and not link.startswith("//") and "\\" not in link)
                     or link.startswith("https://")):
        errors["link_url"] = "Usa una ruta interna o un enlace HTTPS."
    try:
        order = int(data.get("display_order", 0))
        if isinstance(data.get("display_order"), bool) or not 0 <= order <= 100000:
            raise ValueError
    except (ValueError, TypeError):
        errors["display_order"] = "El orden debe ser un entero entre 0 y 100000."
        order = 0
    active = data.get("is_active", True)
    if not isinstance(active, bool):
        errors["is_active"] = "Estado inválido."
    start = _date(data.get("starts_at"), "starts_at", errors)
    end = _date(data.get("ends_at"), "ends_at", errors)
    if start and end and start >= end:
        errors["ends_at"] = "El fin debe ser posterior al inicio."
    if errors:
        raise ValidationError(errors)
    return {"title": title, "description": description or None, "image_path": image,
            "link_url": link or None, "display_order": order, "starts_at": start,
            "ends_at": end, "is_active": active}


def public_banners():
    return fetch_all("""SELECT id, title, description, image_path, link_url FROM banners
                      WHERE is_active = TRUE AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
                        AND (ends_at IS NULL OR ends_at > UTC_TIMESTAMP())
                      ORDER BY display_order, id""")


def list_banners():
    with db_cursor() as (_, cursor):
        cursor.execute("""SELECT id, title, description, image_path, link_url, display_order, starts_at, ends_at,
                              is_active, created_at, updated_at FROM banners ORDER BY display_order, id""")
        return [_version(row) for row in cursor.fetchall()]


def get_banner(banner_id):
    with db_cursor() as (_, cursor):
        cursor.execute("""SELECT id, title, description, image_path, link_url, display_order, starts_at, ends_at,
                              is_active, created_at, updated_at FROM banners WHERE id = %s""", (banner_id,))
        row = cursor.fetchone()
        return _version(row) if row else None


def create_banner(data, actor_id):
    clean = validate(data)
    with db_cursor() as (connection, cursor):
        cursor.execute("""INSERT INTO banners (title, description, image_path, link_url, display_order, starts_at, ends_at, is_active)
                          VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""", tuple(clean.values()))
        banner_id = cursor.lastrowid
        record(cursor, actor_id, "BANNER_CREATED", "banner", banner_id, {"title": clean["title"]})
        connection.commit()
    return get_banner(banner_id)


def update_banner(banner_id, data, actor_id):
    expected = require_version(data)
    clean = validate(data)
    with db_cursor() as (connection, cursor):
        cursor.execute("SELECT * FROM banners WHERE id = %s FOR UPDATE", (banner_id,))
        current = cursor.fetchone()
        if not current:
            raise NotFoundError("Banner no encontrado.")
        ensure_version(record_version(current, FIELDS), expected, "este banner")
        cursor.execute("""UPDATE banners SET title = %s, description = %s, image_path = %s, link_url = %s,
                       display_order = %s, starts_at = %s, ends_at = %s, is_active = %s,
                       updated_at = CURRENT_TIMESTAMP WHERE id = %s""", (*clean.values(), banner_id))
        record(cursor, actor_id, "BANNER_UPDATED", "banner", banner_id, {"title": clean["title"]})
        connection.commit()
    return get_banner(banner_id)


def set_banner_active(banner_id, data, actor_id):
    expected = require_version(data)
    active = data.get("is_active")
    if not isinstance(active, bool):
        raise ValidationError({"is_active": "Indica el estado del banner."})
    with db_cursor() as (connection, cursor):
        cursor.execute("SELECT * FROM banners WHERE id = %s FOR UPDATE", (banner_id,))
        current = cursor.fetchone()
        if not current:
            raise NotFoundError("Banner no encontrado.")
        ensure_version(record_version(current, FIELDS), expected, "este banner")
        cursor.execute("UPDATE banners SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (active, banner_id))
        record(cursor, actor_id, "BANNER_ACTIVATED" if active else "BANNER_DEACTIVATED", "banner", banner_id)
        connection.commit()
    return get_banner(banner_id)
