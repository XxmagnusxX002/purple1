"""Catalogo administrable: categorias y subcategorias, tipos de producto (con sus
etiquetas sugeridas), tallas y colores.

Reglas, iguales al resto del panel:
- Nada se borra: se desactiva (productos, variantes y pedidos los referencian).
- Nombres y URL unicos; las ediciones exigen la version del registro.
- Una categoria no puede ser su propia madre ni colgar de una descendiente.
- Un tipo no deja de usar talla o color si ya tiene variantes que lo usan.
- Cada cambio queda en admin_audit_log dentro de su transaccion.
"""

from admin_common import (ConflictError, NotFoundError, SLUG_PATTERN, ValidationError, changed_fields, ensure_version,
                          optional_id, parse_bool, parse_hex_color, parse_int, raise_if_duplicate, record_version,
                          require_version, slugify, text_field)
from audit import record
from database import db_cursor
from uploads import valid_image_path

MAX_TEMPLATES = 15


def _bool_rows(rows, *keys):
    for row in rows:
        for key in keys:
            row[key] = bool(row[key])
    return rows


def _flag(data, key, errors, default=True):
    try:
        return parse_bool(data.get(key), default=default)
    except ValueError as exc:
        errors[key] = str(exc)
        return default


def _order(data, key, errors):
    try:
        return parse_int(data.get(key) if data.get(key) not in (None, "") else 0, 0, 100000, "Orden inválido (0 a 100000).")
    except ValueError as exc:
        errors[key] = str(exc)
        return 0


# ================================================================ categorias

CATEGORY_FIELDS = ("name", "slug", "parent_id", "description", "image_path", "display_order", "is_active", "updated_at")


def list_categories():
    with db_cursor() as (_, cursor):
        cursor.execute(
            """SELECT c.id, c.name, c.slug, c.parent_id, c.description, c.image_path, c.display_order, c.is_active, c.updated_at,
                      (SELECT COUNT(*) FROM product_categories pc WHERE pc.category_id = c.id) AS products,
                      (SELECT COUNT(*) FROM categories ch WHERE ch.parent_id = c.id) AS children
               FROM categories c ORDER BY c.display_order, c.name"""
        )
        rows = _bool_rows(cursor.fetchall(), "is_active")
    by_parent = {}
    for row in rows:
        row["version"] = record_version(row, CATEGORY_FIELDS)
        by_parent.setdefault(row["parent_id"], []).append(row)
    ordered = []

    def walk(parent_id, depth):
        for row in by_parent.get(parent_id, []):
            row["depth"] = depth
            ordered.append(row)
            walk(row["id"], depth + 1)

    walk(None, 0)
    return ordered


def _validate_category(data):
    errors = {}
    clean = {
        "name": text_field(data, "name", errors, 100, required=True, label="El nombre"),
        "slug": text_field(data, "slug", errors, 120, label="La URL"),
        "description": text_field(data, "description", errors, 200, label="La descripción"),
        "display_order": _order(data, "display_order", errors),
        "is_active": _flag(data, "is_active", errors),
    }
    try:
        clean["parent_id"] = optional_id(data.get("parent_id"))
    except ValueError as exc:
        errors["parent_id"] = str(exc)
    if clean["slug"] and not SLUG_PATTERN.fullmatch(clean["slug"]):
        errors["slug"] = "Usa solo minúsculas, números y guiones."
    image = data.get("image_path") or None
    if image and not valid_image_path(image):
        errors["image_path"] = "Elige una imagen existente de frontend/img."
    clean["image_path"] = image
    if errors:
        raise ValidationError(errors)
    clean["slug"] = clean["slug"] or slugify(clean["name"], 120, "categoria")
    return clean


def _check_parent(cursor, category_id, parent_id):
    if parent_id is None:
        return
    cursor.execute("SELECT id, parent_id FROM categories")
    parents = {row["id"]: row["parent_id"] for row in cursor.fetchall()}
    if parent_id not in parents:
        raise ValidationError({"parent_id": "La categoría principal no existe."})
    node = parent_id
    while node is not None:  # subir por los ancestros de la nueva madre
        if node == category_id:
            raise ValidationError({"parent_id": "Una categoría no puede depender de sí misma ni de una de sus subcategorías."})
        node = parents.get(node)


def save_category(category_id, data, actor_id):
    clean = _validate_category(data)
    expected = require_version(data) if category_id else None
    try:
        with db_cursor() as (connection, cursor):
            if category_id:
                cursor.execute("SELECT * FROM categories WHERE id = %s FOR UPDATE", (category_id,))
                current = cursor.fetchone()
                if not current:
                    raise NotFoundError("Categoría no encontrada.")
                ensure_version(record_version(current, CATEGORY_FIELDS), expected, "esta categoría")
            _check_parent(cursor, category_id, clean["parent_id"])
            values = (clean["name"], clean["slug"], clean["parent_id"], clean["description"] or None, clean["image_path"],
                      clean["display_order"], clean["is_active"])
            if category_id:
                cursor.execute("""UPDATE categories SET name = %s, slug = %s, parent_id = %s, description = %s, image_path = %s,
                                  display_order = %s, is_active = %s WHERE id = %s""", (*values, category_id))
                record(cursor, actor_id, "CATEGORY_UPDATED", "category", category_id,
                       {"fields": changed_fields(current, clean, ("name", "slug", "parent_id", "description", "image_path", "display_order", "is_active"))})
            else:
                cursor.execute("""INSERT INTO categories (name, slug, parent_id, description, image_path, display_order, is_active)
                                  VALUES (%s, %s, %s, %s, %s, %s, %s)""", values)
                category_id = cursor.lastrowid
                record(cursor, actor_id, "CATEGORY_CREATED", "category", category_id, {"name": clean["name"]})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        raise_if_duplicate(exc, "Ya existe una categoría con ese nombre o esa URL.")
        raise
    return next(row for row in list_categories() if row["id"] == category_id)


# ========================================================= tipos de producto

TYPE_FIELDS = ("name", "uses_size", "uses_color", "is_active", "updated_at", "templates")


def list_product_types():
    with db_cursor() as (_, cursor):
        cursor.execute(
            """SELECT t.id, t.name, t.uses_size, t.uses_color, t.is_active, t.updated_at,
                      (SELECT COUNT(*) FROM products p WHERE p.product_type_id = t.id) AS products
               FROM product_types t ORDER BY t.name"""
        )
        rows = _bool_rows(cursor.fetchall(), "uses_size", "uses_color", "is_active")
        cursor.execute("SELECT product_type_id, label FROM product_type_spec_templates ORDER BY product_type_id, display_order, label")
        templates = {}
        for row in cursor.fetchall():
            templates.setdefault(row["product_type_id"], []).append(row["label"])
    for row in rows:
        row["templates"] = templates.get(row["id"], [])
        row["version"] = record_version(row, TYPE_FIELDS)
    return rows


def _validate_type(data):
    errors = {}
    clean = {
        "name": text_field(data, "name", errors, 50, required=True, label="El nombre"),
        "uses_size": _flag(data, "uses_size", errors, False),
        "uses_color": _flag(data, "uses_color", errors, False),
        "is_active": _flag(data, "is_active", errors),
    }
    raw = data.get("templates") or []
    if not isinstance(raw, list) or len(raw) > MAX_TEMPLATES:
        errors["templates"] = f"Hasta {MAX_TEMPLATES} etiquetas sugeridas."
        raw = []
    labels, seen = [], set()
    for item in raw:
        label = str(item or "").strip()
        if not label:
            continue
        if len(label) > 80:
            errors["templates"] = "Cada etiqueta admite 80 caracteres."
        elif label.lower() not in seen:
            seen.add(label.lower())
            labels.append(label)
    clean["templates"] = labels
    if errors:
        raise ValidationError(errors)
    return clean


def save_product_type(type_id, data, actor_id):
    clean = _validate_type(data)
    expected = require_version(data) if type_id else None
    try:
        with db_cursor() as (connection, cursor):
            if type_id:
                cursor.execute("SELECT * FROM product_types WHERE id = %s FOR UPDATE", (type_id,))
                current = cursor.fetchone()
                if not current:
                    raise NotFoundError("Tipo de producto no encontrado.")
                cursor.execute("SELECT label FROM product_type_spec_templates WHERE product_type_id = %s ORDER BY display_order, label", (type_id,))
                current["templates"] = [row["label"] for row in cursor.fetchall()]
                ensure_version(record_version({**current, **{k: bool(current[k]) for k in ("uses_size", "uses_color", "is_active")}}, TYPE_FIELDS),
                               expected, "este tipo de producto")
                for key, column, label in (("uses_size", "size_id", "talla"), ("uses_color", "color_id", "color")):
                    if current[key] and not clean[key]:
                        cursor.execute(f"""SELECT COUNT(*) AS c FROM inventory i JOIN products p ON p.id = i.product_id
                                           WHERE p.product_type_id = %s AND i.{column} IS NOT NULL""", (type_id,))
                        if cursor.fetchone()["c"]:
                            raise ValidationError({key: f"Hay variantes de este tipo con {label}: no se puede dejar de usar."})
                cursor.execute("UPDATE product_types SET name = %s, uses_size = %s, uses_color = %s, is_active = %s WHERE id = %s",
                               (clean["name"], clean["uses_size"], clean["uses_color"], clean["is_active"], type_id))
                action, details = "PRODUCT_TYPE_UPDATED", {"fields": changed_fields(current, clean, ("name", "uses_size", "uses_color", "is_active", "templates"))}
            else:
                cursor.execute("INSERT INTO product_types (name, uses_size, uses_color, is_active) VALUES (%s, %s, %s, %s)",
                               (clean["name"], clean["uses_size"], clean["uses_color"], clean["is_active"]))
                type_id = cursor.lastrowid
                action, details = "PRODUCT_TYPE_CREATED", {"name": clean["name"]}
            cursor.execute("DELETE FROM product_type_spec_templates WHERE product_type_id = %s", (type_id,))
            for index, label in enumerate(clean["templates"], start=1):
                cursor.execute("INSERT INTO product_type_spec_templates (product_type_id, label, display_order) VALUES (%s, %s, %s)",
                               (type_id, label, index))
            record(cursor, actor_id, action, "product_type", type_id, details)
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        raise_if_duplicate(exc, "Ya existe un tipo de producto con ese nombre.")
        raise
    return next(row for row in list_product_types() if row["id"] == type_id)


# ============================================================ tallas y colores

ATTRIBUTES = {
    "sizes": {"table": "sizes", "column": "size_id", "entity": "size", "label": "talla",
              "fields": ("name", "visual_order", "is_active", "updated_at")},
    "colors": {"table": "colors", "column": "color_id", "entity": "color", "label": "color",
               "fields": ("name", "hex_code", "is_active", "updated_at")},
}


def list_attribute(kind):
    spec = ATTRIBUTES[kind]
    extra = "visual_order" if kind == "sizes" else "hex_code"
    order = "visual_order, name" if kind == "sizes" else "name"
    with db_cursor() as (_, cursor):
        cursor.execute(f"""SELECT a.id, a.name, a.{extra}, a.is_active, a.updated_at,
                                  (SELECT COUNT(*) FROM inventory i WHERE i.{spec['column']} = a.id) AS variants
                           FROM {spec['table']} a ORDER BY {order}""")
        rows = _bool_rows(cursor.fetchall(), "is_active")
    for row in rows:
        row["version"] = record_version(row, spec["fields"])
    return rows


def save_attribute(kind, item_id, data, actor_id):
    spec = ATTRIBUTES[kind]
    errors = {}
    clean = {
        "name": text_field(data, "name", errors, 20 if kind == "sizes" else 50, required=True, label="El nombre"),
        "is_active": _flag(data, "is_active", errors),
    }
    if kind == "sizes":
        clean["visual_order"] = _order(data, "visual_order", errors)
    else:
        clean["hex_code"] = parse_hex_color(data.get("hex_code"), "hex_code", errors, "El color")
    if errors:
        raise ValidationError(errors)
    extra = "visual_order" if kind == "sizes" else "hex_code"
    expected = require_version(data) if item_id else None
    try:
        with db_cursor() as (connection, cursor):
            if item_id:
                cursor.execute(f"SELECT * FROM {spec['table']} WHERE id = %s FOR UPDATE", (item_id,))
                current = cursor.fetchone()
                if not current:
                    raise NotFoundError(f"No se encontró la {spec['label']}." if kind == "sizes" else "No se encontró el color.")
                ensure_version(record_version({**current, "is_active": bool(current["is_active"])}, spec["fields"]), expected, f"este registro de {spec['label']}")
                cursor.execute(f"UPDATE {spec['table']} SET name = %s, {extra} = %s, is_active = %s WHERE id = %s",
                               (clean["name"], clean[extra], clean["is_active"], item_id))
                record(cursor, actor_id, f"{spec['entity'].upper()}_UPDATED", spec["entity"], item_id,
                       {"fields": changed_fields(current, clean, ("name", extra, "is_active"))})
            else:
                cursor.execute(f"INSERT INTO {spec['table']} (name, {extra}, is_active) VALUES (%s, %s, %s)",
                               (clean["name"], clean[extra], clean["is_active"]))
                item_id = cursor.lastrowid
                record(cursor, actor_id, f"{spec['entity'].upper()}_CREATED", spec["entity"], item_id, {"name": clean["name"]})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        raise_if_duplicate(exc, f"Ya existe una {spec['label']} con ese nombre." if kind == "sizes" else "Ya existe un color con ese nombre.")
        raise
    return next(row for row in list_attribute(kind) if row["id"] == item_id)
