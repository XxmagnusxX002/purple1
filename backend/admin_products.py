"""Gestion de productos e inventario desde el panel (fase A3).

Tablas: products (con su promocion), product_types, product_categories,
product_teams, product_images, product_specs, inventory, sizes y colors.
Reglas que conserva de la tienda:
- Nada se borra: productos y variantes se desactivan (carritos y pedidos
  referencian inventory con ON DELETE RESTRICT).
- Las variantes llevan talla o color solo si su tipo de producto los usa, y no
  se repite la misma combinacion dentro de un producto (como en seed.sql).
- El stock se ajusta con UPDATE condicional sobre la fila de inventory, el mismo
  recurso que bloquea el checkout: un ajuste nunca pisa una venta simultanea.
Cada cambio queda en admin_audit_log dentro de su transaccion.
"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation

from admin_common import (ConflictError, NotFoundError, SLUG_PATTERN, ValidationError, comparable, ensure_version,
                          like_pattern, optional_id, parse_bool, parse_ids, parse_int, parse_utc_datetime, raise_if_duplicate, record_version,
                          require_version, slugify, text_field)
from admin_dashboard import LOW_STOCK_THRESHOLD, SALE
from audit import record
from database import db_cursor
from pricing import PROMO_PERCENT_SQL
from uploads import valid_image_path

MAX_SPECS = 40          # caracteristicas + especificaciones por producto
MAX_PROMO_PERCENT = 90  # tambien lo limita un CHECK en MySQL

# Nombres internos que usa este modulo (definidos en admin_common).
_text = text_field
_like = like_pattern
_comparable = comparable
_duplicate_as_conflict = raise_if_duplicate

MAX_PRICE = Decimal("99999999.99")
MAX_STOCK = 1_000_000
MAX_IMAGES = 10
MAX_DESCRIPTION = 5000
PAGE_SIZES = (10, 20, 50)
SORTS = {
    "recent": "p.created_at DESC, p.id DESC",
    "name": "p.name ASC, p.id ASC",
    "price_asc": "p.base_price ASC, p.id ASC",
    "price_desc": "p.base_price DESC, p.id ASC",
    "stock": "total_stock ASC, p.id ASC",
    "sold": "units_sold DESC, p.id ASC",
}
SKU_PATTERN = re.compile(r"[A-Z0-9][A-Z0-9-]{0,59}")


# ---------------------------------------------------------------- validacion


def parse_price(value, required=True):
    """Decimal con 2 decimales entre 0,01 y 99.999.999,99; None si es opcional y vacio."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError("Indica un precio.")
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise ValueError("Precio invalido.")
    text = str(value).strip().replace(",", ".")
    if not re.fullmatch(r"\d{1,8}(\.\d{1,2})?", text):
        raise ValueError("Usa un numero con hasta 2 decimales, por ejemplo 89.90.")
    try:
        price = Decimal(text).quantize(Decimal("0.01"))
    except InvalidOperation as exc:
        raise ValueError("Precio invalido.") from exc
    if price <= 0 or price > MAX_PRICE:
        raise ValueError("El precio debe ser mayor que 0.")
    return price


def sku_base(*parts):
    ascii_text = unicodedata.normalize("NFKD", "-".join(p for p in parts if p)).encode("ascii", "ignore").decode("ascii").upper()
    sku = re.sub(r"[^A-Z0-9]+", "-", ascii_text).strip("-")[:52].strip("-")
    return sku or "SKU"


def validate_product(data):
    """Devuelve los datos limpios del producto o lanza ValidationError."""
    errors = {}
    clean = {
        "name": _text(data, "name", errors, 150, required=True, label="El nombre"),
        "description": _text(data, "description", errors, MAX_DESCRIPTION, label="La descripcion"),
        "slug": _text(data, "slug", errors, 180, label="La URL"),
    }
    if clean["slug"] and not SLUG_PATTERN.fullmatch(clean["slug"]):
        errors["slug"] = "Usa solo minusculas, numeros y guiones."
    try:
        clean["product_type_id"] = parse_int(data.get("product_type_id"), 1, 2_147_483_647, "Elige un tipo de producto.")
    except ValueError as exc:
        errors["product_type_id"] = str(exc)
    try:
        clean["base_price"] = parse_price(data.get("base_price"))
    except ValueError as exc:
        errors["base_price"] = str(exc)
    for key in ("is_active", "is_featured"):
        try:
            clean[key] = parse_bool(data.get(key), default=key == "is_active")
        except ValueError as exc:
            errors[key] = str(exc)
    clean["category_ids"] = parse_ids(data.get("category_ids"), "category_ids", errors, "Categorias")
    clean["team_ids"] = parse_ids(data.get("team_ids"), "team_ids", errors, "Equipos")
    clean["images"] = validate_images(data.get("images"), errors)
    clean.update(validate_promo(data, errors))
    clean["specs"] = validate_specs(data.get("specs"), errors)
    if errors:
        raise ValidationError(errors)
    return clean


def validate_promo(data, errors):
    """Promocion real: porcentaje (1-90) y vigencia opcional. Sin porcentaje no hay promocion."""
    raw = data.get("promo_percent")
    if raw in (None, ""):
        return {"promo_percent": None, "promo_starts_at": None, "promo_ends_at": None}
    try:
        percent = parse_int(raw, 1, MAX_PROMO_PERCENT, f"El descuento debe estar entre 1 y {MAX_PROMO_PERCENT} %.")
    except ValueError as exc:
        errors["promo_percent"] = str(exc)
        percent = None
    starts = parse_utc_datetime(data.get("promo_starts_at"), "promo_starts_at", errors, "El inicio")
    ends = parse_utc_datetime(data.get("promo_ends_at"), "promo_ends_at", errors, "El fin")
    if starts and ends and starts >= ends:
        errors["promo_ends_at"] = "El fin de la promoción debe ser posterior al inicio."
    return {"promo_percent": percent, "promo_starts_at": starts, "promo_ends_at": ends}


def validate_specs(value, errors):
    """Lista de {kind: FEATURE|SPEC, label, value}. Ninguna es obligatoria."""
    if value in (None, ""):
        return []
    if not isinstance(value, list) or len(value) > MAX_SPECS:
        errors["specs"] = f"Puedes registrar hasta {MAX_SPECS} características y especificaciones."
        return []
    specs, seen = [], set()
    for item in value:
        if not isinstance(item, dict) or item.get("kind") not in ("FEATURE", "SPEC"):
            errors["specs"] = "Característica inválida."
            return []
        text = str(item.get("value") or "").strip()
        label = str(item.get("label") or "").strip()
        if not text:
            continue  # filas vacias del formulario: se ignoran
        if len(text) > 255 or len(label) > 80:
            errors["specs"] = "Cada valor admite 255 caracteres y cada etiqueta 80."
            return []
        if item["kind"] == "SPEC" and not label:
            errors["specs"] = f"La especificación «{text[:40]}» necesita una etiqueta (por ejemplo, Material)."
            return []
        key = (item["kind"], label.lower() if item["kind"] == "SPEC" else text.lower())
        if key in seen:
            errors["specs"] = "Hay características o especificaciones repetidas."
            return []
        seen.add(key)
        specs.append({"kind": item["kind"], "label": label if item["kind"] == "SPEC" else None, "value": text})
    return specs


def validate_images(value, errors):
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > MAX_IMAGES:
        errors["images"] = f"Puedes asignar hasta {MAX_IMAGES} imagenes."
        return []
    images, seen = [], set()
    for item in value:
        if not isinstance(item, dict):
            errors["images"] = "Imagen invalida."
            return []
        path = item.get("image_path")
        if not valid_image_path(path):
            errors["images"] = "Alguna imagen no existe en frontend/img."
            return []
        if path in seen:
            errors["images"] = "La misma imagen esta repetida."
            return []
        seen.add(path)
        alt = item.get("alt_text") or ""
        if not isinstance(alt, str) or len(alt.strip()) > 150:
            errors["images"] = "El texto alternativo admite maximo 150 caracteres."
            return []
        images.append({"image_path": path, "alt_text": alt.strip(), "is_main": bool(item.get("is_main"))})
    if images and sum(image["is_main"] for image in images) != 1:
        # Exactamente una principal: si no se indica, la primera.
        for index, image in enumerate(images):
            image["is_main"] = index == 0
    return images


def validate_variant(data, creating):
    errors, clean = {}, {}
    for key in ("size_id", "color_id"):
        try:
            clean[key] = optional_id(data.get(key))
        except ValueError as exc:
            errors[key] = str(exc)
    sku = data.get("sku") or ""
    if not isinstance(sku, str):
        errors["sku"] = "SKU invalido."
    else:
        sku = sku.strip().upper()
        if sku and not SKU_PATTERN.fullmatch(sku):
            errors["sku"] = "Usa mayusculas, numeros y guiones (maximo 60)."
    clean["sku"] = sku if isinstance(sku, str) else ""
    try:
        clean["price_override"] = parse_price(data.get("price_override"), required=False)
    except ValueError as exc:
        errors["price_override"] = str(exc)
    try:
        clean["is_active"] = parse_bool(data.get("is_active"), default=True)
    except ValueError as exc:
        errors["is_active"] = str(exc)
    if creating:
        try:
            clean["stock"] = parse_int(data.get("stock", 0), 0, MAX_STOCK, f"El stock debe ser un entero entre 0 y {MAX_STOCK}.")
        except ValueError as exc:
            errors["stock"] = str(exc)
    if errors:
        raise ValidationError(errors)
    return clean


# ------------------------------------------------------------- consultas

def get_catalog():
    with db_cursor() as (_, cursor):
        cursor.execute("SELECT id, name, uses_size, uses_color, is_active FROM product_types ORDER BY name")
        types = cursor.fetchall()
        cursor.execute("SELECT product_type_id, label FROM product_type_spec_templates ORDER BY product_type_id, display_order, label")
        templates = {}
        for row in cursor.fetchall():
            templates.setdefault(row["product_type_id"], []).append(row["label"])
        cursor.execute("SELECT id, name, slug, parent_id, is_active, display_order FROM categories ORDER BY display_order, name")
        categories = cursor.fetchall()
        cursor.execute("SELECT id, name, is_active FROM teams ORDER BY name")
        teams = cursor.fetchall()
        cursor.execute("SELECT id, name, is_active FROM sizes ORDER BY visual_order, name")
        sizes = cursor.fetchall()
        cursor.execute("SELECT id, name, hex_code, is_active FROM colors ORDER BY name")
        colors = cursor.fetchall()
    return {
        "product_types": [{**t, "uses_size": bool(t["uses_size"]), "uses_color": bool(t["uses_color"]),
                           "is_active": bool(t["is_active"]), "spec_templates": templates.get(t["id"], [])} for t in types],
        "categories": order_categories(categories),
        "teams": [{**t, "is_active": bool(t["is_active"])} for t in teams],
        "sizes": sizes,
        "colors": colors,
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    }


def order_categories(rows):
    """Categorias en orden de arbol (padre antes que hijas) con su profundidad."""
    children = {}
    for row in rows:
        children.setdefault(row["parent_id"], []).append(row)
    ordered, seen = [], set()

    def walk(parent_id, depth):
        for row in children.get(parent_id, []):
            if row["id"] in seen:
                continue
            seen.add(row["id"])
            ordered.append({**row, "is_active": bool(row["is_active"]), "depth": depth})
            walk(row["id"], depth + 1)
    walk(None, 0)
    for row in rows:  # huerfanas (padre inexistente): al final, sin perderlas
        if row["id"] not in seen:
            seen.add(row["id"])
            ordered.append({**row, "is_active": bool(row["is_active"]), "depth": 0})
    return ordered


def with_ancestors(category_ids, parents):
    """Agrega las categorias padre, como en seed.sql, para que el producto
    aparezca tambien al filtrar por la categoria principal en la tienda."""
    result = []
    for category_id in category_ids:
        current, guard = category_id, 0
        while current is not None and guard < 20:
            if current not in result:
                result.append(current)
            current = parents.get(current)
            guard += 1
    return result


def build_product_filters(params):
    get = lambda key, default="": (params.get(key, [default])[0] or default).strip()
    where, values = [], []
    term = get("q")[:100]
    if term:
        like = _like(term)
        where.append("(p.name LIKE %s OR p.slug LIKE %s OR EXISTS (SELECT 1 FROM inventory si WHERE si.product_id = p.id AND si.sku LIKE %s))")
        values += [like, like, like]
    status = get("status", "all")
    if status == "active":
        where.append("p.is_active = TRUE")
    elif status == "inactive":
        where.append("p.is_active = FALSE")
    elif status != "all":
        raise ValidationError({"status": "Estado invalido."})
    if get("featured") == "1":
        where.append("p.is_featured = TRUE")
    for key, sql in (("category", "EXISTS (SELECT 1 FROM product_categories fc WHERE fc.product_id = p.id AND fc.category_id = %s)"),
                     ("team", "EXISTS (SELECT 1 FROM product_teams ft WHERE ft.product_id = p.id AND ft.team_id = %s)")):
        if get(key):
            try:
                values.append(parse_int(get(key), 1, 2_147_483_647, "x"))
            except ValueError as exc:
                raise ValidationError({key: "Filtro invalido."}) from exc
            where.append(sql)
    stock = get("stock")
    if stock == "low":
        where.append("EXISTS (SELECT 1 FROM inventory li WHERE li.product_id = p.id AND li.is_active = TRUE AND li.stock <= %s)")
        values.append(LOW_STOCK_THRESHOLD)
    elif stock == "out":
        where.append("NOT EXISTS (SELECT 1 FROM inventory oi2 WHERE oi2.product_id = p.id AND oi2.is_active = TRUE AND oi2.stock > 0)")
    elif stock:
        raise ValidationError({"stock": "Filtro de stock invalido."})
    sort = get("sort", "recent")
    if sort not in SORTS:
        raise ValidationError({"sort": "Orden invalido."})
    try:
        page = parse_int(get("page", "1"), 1, 10_000, "x")
        per_page = parse_int(get("per_page", "20"), 1, 50, "x")
    except ValueError as exc:
        raise ValidationError({"page": "Pagina invalida."}) from exc
    if per_page not in PAGE_SIZES:
        per_page = 20
    return {"where": " AND ".join(where) or "TRUE", "values": values, "order": SORTS[sort], "page": page, "per_page": per_page}


LIST_COLUMNS = f"""
    p.id, p.name, p.slug, p.base_price, p.is_active, p.is_featured, p.updated_at, pt.name AS product_type,
    {PROMO_PERCENT_SQL} AS promo_percent,
    (SELECT COALESCE(SUM(i.stock), 0) FROM inventory i WHERE i.product_id = p.id AND i.is_active = TRUE) AS total_stock,
    (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id) AS variants,
    (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.is_active = TRUE) AS active_variants,
    (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.is_active = TRUE AND i.stock <= %s) AS low_variants,
    (SELECT pi.image_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.display_order, pi.id LIMIT 1) AS main_image,
    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN inventory si ON si.id = oi.inventory_id
        JOIN orders o ON o.id = oi.order_id WHERE si.product_id = p.id AND {SALE}) AS units_sold,
    (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id) AS categories,
    (SELECT GROUP_CONCAT(t.name ORDER BY t.name SEPARATOR ', ') FROM product_teams ptm JOIN teams t ON t.id = ptm.team_id WHERE ptm.product_id = p.id) AS teams
"""


def list_products(params):
    query = build_product_filters(params)
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS c FROM products p WHERE {query['where']}", tuple(query["values"]))
        total = int(cursor.fetchone()["c"])
        offset = (query["page"] - 1) * query["per_page"]
        cursor.execute(
            f"""SELECT {LIST_COLUMNS} FROM products p JOIN product_types pt ON pt.id = p.product_type_id
                WHERE {query['where']} ORDER BY {query['order']} LIMIT %s OFFSET %s""",
            (LOW_STOCK_THRESHOLD, *query["values"], query["per_page"], offset),
        )
        rows = cursor.fetchall()
    for row in rows:
        for key in ("is_active", "is_featured"):
            row[key] = bool(row[key])
        for key in ("total_stock", "variants", "active_variants", "low_variants", "units_sold"):
            row[key] = int(row[key] or 0)
    return {"products": rows, "total": total, "page": query["page"], "per_page": query["per_page"],
            "pages": max(1, -(-total // query["per_page"]))}


# Lo que edita el formulario del producto: datos, categorias, equipos e imagenes.
# Variantes y stock tienen sus propios controles (adjust_stock con expected_stock).
PRODUCT_VERSION = ("name", "slug", "description", "base_price", "is_active", "is_featured", "product_type_id", "updated_at",
                   "category_ids", "team_ids", "images", "promo_percent", "promo_starts_at", "promo_ends_at", "specs")


def _relations(cursor, product_id):
    cursor.execute("SELECT category_id FROM product_categories WHERE product_id = %s ORDER BY category_id", (product_id,))
    category_ids = [row["category_id"] for row in cursor.fetchall()]
    cursor.execute("SELECT team_id FROM product_teams WHERE product_id = %s ORDER BY team_id", (product_id,))
    team_ids = [row["team_id"] for row in cursor.fetchall()]
    cursor.execute("SELECT image_path, alt_text, is_main FROM product_images WHERE product_id = %s ORDER BY display_order, id", (product_id,))
    images = [{**row, "is_main": bool(row["is_main"])} for row in cursor.fetchall()]
    cursor.execute("SELECT kind, label, value FROM product_specs WHERE product_id = %s ORDER BY kind, display_order, id", (product_id,))
    specs = cursor.fetchall()
    return {"category_ids": category_ids, "team_ids": team_ids, "images": images, "specs": specs}


def _load_product(cursor, product_id):
    cursor.execute(
        f"""SELECT p.id, p.name, p.slug, p.description, p.base_price, p.is_active, p.is_featured,
                  p.promo_percent, p.promo_starts_at, p.promo_ends_at, {PROMO_PERCENT_SQL} AS promo_active_percent,
                  p.product_type_id, p.created_at, p.updated_at, pt.name AS product_type, pt.uses_size, pt.uses_color
           FROM products p JOIN product_types pt ON pt.id = p.product_type_id WHERE p.id = %s""",
        (product_id,),
    )
    product = cursor.fetchone()
    if not product:
        return None
    product.update(_relations(cursor, product_id))
    product["version"] = record_version(product, PRODUCT_VERSION)
    product["promo_active"] = bool(product.pop("promo_active_percent"))
    cursor.execute(
        f"""SELECT i.id, i.sku, i.size_id, i.color_id, i.price_override, i.stock, i.is_active, i.updated_at,
                   s.name AS size_name, c.name AS color_name, c.hex_code,
                   (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                    WHERE oi.inventory_id = i.id AND {SALE}) AS units_sold,
                   (SELECT COUNT(*) FROM cart_items ci JOIN carts ca ON ca.id = ci.cart_id
                    WHERE ci.inventory_id = i.id AND ca.status = 'ACTIVE') AS in_active_carts
            FROM inventory i LEFT JOIN sizes s ON s.id = i.size_id LEFT JOIN colors c ON c.id = i.color_id
            WHERE i.product_id = %s ORDER BY s.visual_order, c.name, i.id""",
        (product_id,),
    )
    product["variants"] = [
        {**row, "is_active": bool(row["is_active"]), "units_sold": int(row["units_sold"] or 0), "in_active_carts": int(row["in_active_carts"] or 0)}
        for row in cursor.fetchall()
    ]
    for key in ("is_active", "is_featured", "uses_size", "uses_color"):
        product[key] = bool(product[key])
    return product


def get_product(product_id):
    with db_cursor() as (_, cursor):
        return _load_product(cursor, product_id)


# ------------------------------------------------------------- escritura

def _product_type(cursor, type_id):
    cursor.execute("SELECT id, uses_size, uses_color, is_active FROM product_types WHERE id = %s", (type_id,))
    row = cursor.fetchone()
    if not row:
        raise ValidationError({"product_type_id": "El tipo de producto no existe."})
    if not row["is_active"]:
        raise ValidationError({"product_type_id": "Ese tipo de producto está desactivado."})
    return row


def _check_relations(cursor, clean):
    errors = {}
    cursor.execute("SELECT id, parent_id FROM categories")
    parents = {row["id"]: row["parent_id"] for row in cursor.fetchall()}
    if any(cid not in parents for cid in clean["category_ids"]):
        errors["category_ids"] = "Alguna categoria no existe."
    if clean["team_ids"]:
        cursor.execute(f"SELECT id FROM teams WHERE id IN ({', '.join(['%s'] * len(clean['team_ids']))})", tuple(clean["team_ids"]))
        if len(cursor.fetchall()) != len(clean["team_ids"]):
            errors["team_ids"] = "Algun equipo no existe."
    if errors:
        raise ValidationError(errors)
    return with_ancestors(clean["category_ids"], parents)


def _unique_slug(cursor, wanted, product_id=None):
    base = wanted[:170]
    candidate, suffix = base, 2
    while True:
        cursor.execute("SELECT id FROM products WHERE slug = %s", (candidate,))
        row = cursor.fetchone()
        if not row or row["id"] == product_id:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def _replace_relations(cursor, product_id, category_ids, team_ids, images):
    cursor.execute("DELETE FROM product_categories WHERE product_id = %s", (product_id,))
    for category_id in category_ids:
        cursor.execute("INSERT INTO product_categories (product_id, category_id) VALUES (%s, %s)", (product_id, category_id))
    cursor.execute("DELETE FROM product_teams WHERE product_id = %s", (product_id,))
    for team_id in team_ids:
        cursor.execute("INSERT INTO product_teams (product_id, team_id) VALUES (%s, %s)", (product_id, team_id))
    cursor.execute("DELETE FROM product_images WHERE product_id = %s", (product_id,))
    for order, image in enumerate(images, start=1):
        cursor.execute(
            "INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (%s, %s, %s, %s, %s)",
            (product_id, image["image_path"], image["alt_text"] or None, order, image["is_main"]),
        )


def _check_variant_shape(cursor, product_type, clean, product_id, variant_id=None):
    errors = {}
    if product_type["uses_size"] and not clean["size_id"]:
        errors["size_id"] = "Este tipo de producto requiere talla."
    if not product_type["uses_size"] and clean["size_id"]:
        errors["size_id"] = "Este tipo de producto no usa talla."
    if product_type["uses_color"] and not clean["color_id"]:
        errors["color_id"] = "Este tipo de producto requiere color."
    if not product_type["uses_color"] and clean["color_id"]:
        errors["color_id"] = "Este tipo de producto no usa color."
    # Una talla o color desactivado solo se conserva en la variante que ya lo tenia.
    current = {}
    if variant_id:
        cursor.execute("SELECT size_id, color_id FROM inventory WHERE id = %s", (variant_id,))
        current = cursor.fetchone() or {}
    if not errors and clean["size_id"]:
        cursor.execute("SELECT id, is_active FROM sizes WHERE id = %s", (clean["size_id"],))
        size = cursor.fetchone()
        if not size:
            errors["size_id"] = "La talla no existe."
        elif not size["is_active"] and current.get("size_id") != clean["size_id"]:
            errors["size_id"] = "Esa talla está desactivada."
    if not errors and clean["color_id"]:
        cursor.execute("SELECT id, is_active FROM colors WHERE id = %s", (clean["color_id"],))
        color = cursor.fetchone()
        if not color:
            errors["color_id"] = "El color no existe."
        elif not color["is_active"] and current.get("color_id") != clean["color_id"]:
            errors["color_id"] = "Ese color está desactivado."
    if not errors:
        cursor.execute(
            "SELECT id FROM inventory WHERE product_id = %s AND size_id <=> %s AND color_id <=> %s AND id <> %s",
            (product_id, clean["size_id"], clean["color_id"], variant_id or 0),
        )
        if cursor.fetchone():
            errors["size_id"] = "Ya existe una variante con esa talla y color."
    if errors:
        raise ValidationError(errors)


def _resolve_sku(cursor, clean, slug, variant_id=None):
    if clean["sku"]:
        cursor.execute("SELECT id FROM inventory WHERE sku = %s AND id <> %s", (clean["sku"], variant_id or 0))
        if cursor.fetchone():
            raise ValidationError({"sku": "Ese SKU ya esta en uso."})
        return clean["sku"]
    names = []
    if clean["size_id"]:
        cursor.execute("SELECT name FROM sizes WHERE id = %s", (clean["size_id"],))
        names.append(cursor.fetchone()["name"])
    if clean["color_id"]:
        cursor.execute("SELECT name FROM colors WHERE id = %s", (clean["color_id"],))
        names.append(cursor.fetchone()["name"])
    base = sku_base(slug, *names)
    candidate, suffix = base, 2
    while True:
        cursor.execute("SELECT id FROM inventory WHERE sku = %s", (candidate,))
        if not cursor.fetchone():
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def _insert_variant(cursor, product_id, product_type, slug, clean):
    _check_variant_shape(cursor, product_type, clean, product_id)
    sku = _resolve_sku(cursor, clean, slug)
    cursor.execute(
        "INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (product_id, sku, clean["size_id"], clean["color_id"], clean["price_override"], clean["stock"], clean["is_active"]),
    )
    return cursor.lastrowid, sku


def _replace_specs(cursor, product_id, specs):
    """Caracteristicas y especificaciones: se reemplazan en la transaccion del producto."""
    cursor.execute("DELETE FROM product_specs WHERE product_id = %s", (product_id,))
    order = {"FEATURE": 0, "SPEC": 0}
    for spec in specs:
        order[spec["kind"]] += 1
        cursor.execute(
            "INSERT INTO product_specs (product_id, kind, label, value, display_order) VALUES (%s, %s, %s, %s, %s)",
            (product_id, spec["kind"], spec["label"], spec["value"], order[spec["kind"]]),
        )


def create_product(data, actor_id):
    clean = validate_product(data)
    variants = data.get("variants") or []
    if not isinstance(variants, list) or len(variants) > 100:
        raise ValidationError({"variants": "Lista de variantes invalida."})
    try:
        with db_cursor() as (connection, cursor):
            product_type = _product_type(cursor, clean["product_type_id"])
            category_ids = _check_relations(cursor, clean)
            slug = _unique_slug(cursor, clean["slug"] or slugify(clean["name"]))
            cursor.execute(
                """INSERT INTO products (product_type_id, name, slug, description, base_price, promo_percent, promo_starts_at,
                                         promo_ends_at, is_featured, is_active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (clean["product_type_id"], clean["name"], slug, clean["description"] or None, clean["base_price"],
                 clean["promo_percent"], clean["promo_starts_at"], clean["promo_ends_at"], clean["is_featured"], clean["is_active"]),
            )
            product_id = cursor.lastrowid
            _replace_relations(cursor, product_id, category_ids, clean["team_ids"], clean["images"])
            _replace_specs(cursor, product_id, clean["specs"])
            for index, raw in enumerate(variants):
                try:
                    _insert_variant(cursor, product_id, product_type, slug, validate_variant(raw if isinstance(raw, dict) else {}, creating=True))
                except ValidationError as exc:
                    raise ValidationError({f"variants.{index}.{key}": value for key, value in exc.fields.items()}) from exc
            record(cursor, actor_id, "PRODUCT_CREATED", "product", product_id,
                   {"name": clean["name"], "variants": len(variants), "is_active": clean["is_active"]})
            connection.commit()
    except Exception as exc:  # noqa: BLE001 - se re-lanza tal cual salvo duplicados
        if isinstance(exc, (ValidationError, ConflictError)):
            raise
        _duplicate_as_conflict(exc)
    return get_product(product_id)


def _lock_product(cursor, product_id):
    cursor.execute(
        """SELECT p.id, p.name, p.slug, p.description, p.base_price, p.is_active, p.is_featured, p.product_type_id, p.updated_at,
                  p.promo_percent, p.promo_starts_at, p.promo_ends_at, pt.uses_size, pt.uses_color
           FROM products p JOIN product_types pt ON pt.id = p.product_type_id WHERE p.id = %s FOR UPDATE""",
        (product_id,),
    )
    product = cursor.fetchone()
    if not product:
        raise NotFoundError("Producto no encontrado.")
    return product


def update_product(product_id, data, actor_id):
    clean = validate_product(data)
    expected = require_version(data)
    try:
        with db_cursor() as (connection, cursor):
            current = _lock_product(cursor, product_id)
            ensure_version(record_version({**current, **_relations(cursor, product_id)}, PRODUCT_VERSION), expected, "este producto")
            if clean["product_type_id"] != current["product_type_id"]:
                cursor.execute("SELECT COUNT(*) AS c FROM inventory WHERE product_id = %s", (product_id,))
                if cursor.fetchone()["c"]:
                    raise ValidationError({"product_type_id": "No se puede cambiar el tipo de un producto que ya tiene variantes."})
                _product_type(cursor, clean["product_type_id"])
            category_ids = _check_relations(cursor, clean)
            slug = _unique_slug(cursor, clean["slug"] or current["slug"], product_id)
            cursor.execute(
                """UPDATE products SET product_type_id = %s, name = %s, slug = %s, description = %s, base_price = %s,
                          promo_percent = %s, promo_starts_at = %s, promo_ends_at = %s,
                          is_featured = %s, is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s""",
                (clean["product_type_id"], clean["name"], slug, clean["description"] or None, clean["base_price"],
                 clean["promo_percent"], clean["promo_starts_at"], clean["promo_ends_at"],
                 clean["is_featured"], clean["is_active"], product_id),
            )
            previous_specs = _relations(cursor, product_id)["specs"]
            _replace_relations(cursor, product_id, category_ids, clean["team_ids"], clean["images"])
            _replace_specs(cursor, product_id, clean["specs"])
            changed = [key for key in ("name", "slug", "description", "base_price", "is_featured", "is_active", "product_type_id",
                                       "promo_percent", "promo_starts_at", "promo_ends_at")
                       if _comparable(current.get(key)) != _comparable(slug if key == "slug" else clean[key])]
            if _comparable(previous_specs) != _comparable(clean["specs"]):
                changed.append("specs")
            record(cursor, actor_id, "PRODUCT_UPDATED", "product", product_id, {"fields": changed})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        _duplicate_as_conflict(exc)
    return get_product(product_id)


def set_product_flags(product_id, data, actor_id):
    """Activar/desactivar y destacar sin abrir el formulario completo."""
    changes = {}
    for key in ("is_active", "is_featured"):
        if key in data:
            try:
                changes[key] = parse_bool(data[key])
            except ValueError as exc:
                raise ValidationError({key: str(exc)}) from exc
    if not changes:
        raise ValidationError({"is_active": "Indica que cambiar."})
    with db_cursor() as (connection, cursor):
        _lock_product(cursor, product_id)
        assignments = ", ".join(f"{key} = %s" for key in changes)
        cursor.execute(f"UPDATE products SET {assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (*changes.values(), product_id))
        record(cursor, actor_id, "PRODUCT_FLAGS", "product", product_id, changes)
        connection.commit()
    return get_product(product_id)


def create_variant(product_id, data, actor_id):
    clean = validate_variant(data, creating=True)
    try:
        with db_cursor() as (connection, cursor):
            product = _lock_product(cursor, product_id)
            variant_id, sku = _insert_variant(cursor, product_id, product, product["slug"], clean)
            record(cursor, actor_id, "VARIANT_CREATED", "inventory", variant_id, {"product_id": product_id, "sku": sku, "stock": clean["stock"]})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        _duplicate_as_conflict(exc)
    return get_product(product_id)


def _lock_variant(cursor, variant_id):
    cursor.execute("SELECT id, product_id, sku, size_id, color_id, price_override, stock, is_active FROM inventory WHERE id = %s", (variant_id,))
    variant = cursor.fetchone()
    if not variant:
        raise NotFoundError("Variante no encontrada.")
    # Mismo orden que el alta de variantes: primero el producto, luego la variante.
    product = _lock_product(cursor, variant["product_id"])
    cursor.execute("SELECT stock FROM inventory WHERE id = %s FOR UPDATE", (variant_id,))
    return product, variant


def update_variant(variant_id, data, actor_id):
    """Talla, color, SKU, precio especial y estado. El stock se ajusta aparte."""
    clean = validate_variant(data, creating=False)
    try:
        with db_cursor() as (connection, cursor):
            product, variant = _lock_variant(cursor, variant_id)
            _check_variant_shape(cursor, product, clean, variant["product_id"], variant_id)
            sku = _resolve_sku(cursor, clean, product["slug"], variant_id) if clean["sku"] else variant["sku"]
            cursor.execute(
                "UPDATE inventory SET sku = %s, size_id = %s, color_id = %s, price_override = %s, is_active = %s WHERE id = %s",
                (sku, clean["size_id"], clean["color_id"], clean["price_override"], clean["is_active"], variant_id),
            )
            record(cursor, actor_id, "VARIANT_UPDATED", "inventory", variant_id,
                   {"product_id": variant["product_id"], "sku": sku, "is_active": clean["is_active"]})
            connection.commit()
            product_id = variant["product_id"]
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        _duplicate_as_conflict(exc)
    return get_product(product_id)


def adjust_stock(variant_id, data, actor_id):
    """mode=add suma o resta unidades; mode=set fija el valor solo si el stock
    sigue siendo expected_stock (si hubo una venta entretanto, responde conflicto)."""
    mode = data.get("mode")
    try:
        if mode == "add":
            delta = parse_int(data.get("quantity"), -MAX_STOCK, MAX_STOCK, "Indica una cantidad entera.")
            if delta == 0:
                raise ValueError("La cantidad no puede ser 0.")
        elif mode == "set":
            target = parse_int(data.get("quantity"), 0, MAX_STOCK, f"El stock debe estar entre 0 y {MAX_STOCK}.")
            expected = parse_int(data.get("expected_stock"), 0, MAX_STOCK, "Falta el stock actual de referencia.")
        else:
            raise ValueError("Modo de ajuste invalido.")
    except ValueError as exc:
        raise ValidationError({"quantity": str(exc)}) from exc
    with db_cursor() as (connection, cursor):
        cursor.execute("SELECT product_id, stock FROM inventory WHERE id = %s", (variant_id,))
        row = cursor.fetchone()
        if not row:
            raise NotFoundError("Variante no encontrada.")
        if mode == "add":
            cursor.execute(
                "UPDATE inventory SET stock = stock + %s WHERE id = %s AND stock + %s >= 0 AND stock + %s <= %s",
                (delta, variant_id, delta, delta, MAX_STOCK),
            )
            if cursor.rowcount != 1:
                connection.rollback()
                raise ConflictError("El ajuste dejaria el stock por debajo de 0. Recarga para ver el stock actual.")
        else:
            if target == expected:
                connection.rollback()
                return get_product(row["product_id"])
            cursor.execute("UPDATE inventory SET stock = %s WHERE id = %s AND stock = %s", (target, variant_id, expected))
            if cursor.rowcount != 1:
                connection.rollback()
                raise ConflictError("El stock cambio mientras editabas (por ejemplo, por una venta). Recarga e intentalo de nuevo.")
        cursor.execute("SELECT stock FROM inventory WHERE id = %s", (variant_id,))
        new_stock = int(cursor.fetchone()["stock"])
        # "before" se deduce del UPDATE ya aplicado: la lectura inicial puede ser anterior a una venta.
        before = new_stock - delta if mode == "add" else expected
        record(cursor, actor_id, "STOCK_ADJUSTED", "inventory", variant_id,
               {"product_id": row["product_id"], "mode": mode, "before": before, "after": new_stock})
        connection.commit()
    return get_product(row["product_id"])
