from database import fetch_all
from pricing import PROMO_ACTIVE_SQL, PROMO_PERCENT_SQL, list_price_sql, sale_price_sql
from utils import image_path


def product_summary_sql(extra_where=""):
    return f"""
        SELECT
            p.id, p.name, p.slug, p.description, p.base_price, p.is_featured,
            pt.name AS product_type, pt.uses_size, pt.uses_color,
            {PROMO_PERCENT_SQL} AS promo_percent,
            CASE WHEN {PROMO_ACTIVE_SQL} THEN p.promo_ends_at END AS promo_ends_at,
            COALESCE((
                SELECT MIN({sale_price_sql('i')})
                FROM inventory i
                WHERE i.product_id = p.id AND i.is_active = TRUE
            ), ROUND(p.base_price * (100 - {PROMO_PERCENT_SQL}) / 100, 2)) AS final_price,
            COALESCE((
                SELECT MIN({list_price_sql('i')})
                FROM inventory i
                WHERE i.product_id = p.id AND i.is_active = TRUE
            ), p.base_price) AS list_price,
            COALESCE((
                SELECT SUM(i.stock)
                FROM inventory i
                WHERE i.product_id = p.id AND i.is_active = TRUE
            ), 0) AS total_stock,
            COALESCE(
                (SELECT pi.image_path FROM product_images pi WHERE pi.product_id = p.id AND pi.is_main = TRUE ORDER BY pi.display_order, pi.id LIMIT 1),
                (SELECT pi.image_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.display_order, pi.id LIMIT 1)
            ) AS main_image,
            (SELECT GROUP_CONCAT(DISTINCT c2.name ORDER BY c2.name SEPARATOR ', ')
             FROM product_categories pc2 JOIN categories c2 ON c2.id = pc2.category_id
             WHERE pc2.product_id = p.id) AS categories,
            (SELECT GROUP_CONCAT(DISTINCT t2.name ORDER BY t2.name SEPARATOR ', ')
             FROM product_teams ptm2 JOIN teams t2 ON t2.id = ptm2.team_id
             WHERE ptm2.product_id = p.id) AS teams
        FROM products p
        JOIN product_types pt ON pt.id = p.product_type_id
        LEFT JOIN product_categories pc ON pc.product_id = p.id
        LEFT JOIN categories c ON c.id = pc.category_id
        WHERE p.is_active = TRUE {extra_where}
        GROUP BY p.id
    """


def normalize_product(row):
    if row:
        row["main_image"] = image_path(row.get("main_image"))
    return row


def sort_clause(params):
    sort = params.get("sort", ["recent"])[0]
    return {
        "recent": "p.created_at DESC",
        "name": "p.name ASC",
        "price_asc": "final_price ASC",
        "price_desc": "final_price DESC",
    }.get(sort, "p.created_at DESC")


def get_products(params):
    rows = fetch_all(product_summary_sql() + f" ORDER BY {sort_clause(params)}")
    return [normalize_product(row) for row in rows]


def search_products(params):
    term = (params.get("q", [""])[0] or "").strip()
    if not term:
        return get_products(params)
    like = f"%{term}%"
    rows = fetch_all(
        product_summary_sql("AND (p.name LIKE %s OR p.description LIKE %s OR c.name LIKE %s)") + " ORDER BY p.name ASC",
        (like, like, like),
    )
    return [normalize_product(row) for row in rows]


def filter_products(params):
    clauses = []
    values = []
    category = params.get("category", [""])[0]
    team = params.get("team", [""])[0]
    size = params.get("size", [""])[0]
    color = params.get("color", [""])[0]
    min_price = params.get("min_price", [""])[0]
    max_price = params.get("max_price", [""])[0]
    query = (params.get("q", [""])[0] or "").strip()

    if category:
        clauses.append("AND EXISTS (SELECT 1 FROM product_categories fpc JOIN categories fc ON fc.id = fpc.category_id WHERE fpc.product_id = p.id AND fc.slug = %s)")
        values.append(category)
    if team:
        clauses.append("AND EXISTS (SELECT 1 FROM product_teams fpt JOIN teams ft ON ft.id = fpt.team_id WHERE fpt.product_id = p.id AND ft.slug = %s)")
        values.append(team)
    if size:
        clauses.append("AND EXISTS (SELECT 1 FROM inventory fi JOIN sizes fs ON fs.id = fi.size_id WHERE fi.product_id = p.id AND fs.name = %s AND fi.stock > 0 AND fi.is_active = TRUE)")
        values.append(size)
    if color:
        clauses.append("AND EXISTS (SELECT 1 FROM inventory fi JOIN colors fc ON fc.id = fi.color_id WHERE fi.product_id = p.id AND fc.name = %s AND fi.stock > 0 AND fi.is_active = TRUE)")
        values.append(color)
    if min_price:
        clauses.append(f"AND EXISTS (SELECT 1 FROM inventory fpi WHERE fpi.product_id = p.id AND fpi.is_active = TRUE AND {sale_price_sql('fpi')} >= %s)")
        values.append(min_price)
    if max_price:
        clauses.append(f"AND EXISTS (SELECT 1 FROM inventory fpi WHERE fpi.product_id = p.id AND fpi.is_active = TRUE AND {sale_price_sql('fpi')} <= %s)")
        values.append(max_price)
    if query:
        like = f"%{query}%"
        clauses.append("AND (p.name LIKE %s OR p.description LIKE %s OR c.name LIKE %s)")
        values.extend([like, like, like])

    rows = fetch_all(product_summary_sql(" ".join(clauses)) + f" ORDER BY {sort_clause(params)}", tuple(values))
    return [normalize_product(row) for row in rows]


def get_product_detail(product_id):
    rows = fetch_all(product_summary_sql("AND p.id = %s"), (product_id,))
    product = normalize_product(rows[0]) if rows else None
    if not product:
        return None
    images = fetch_all(
        "SELECT id, image_path, alt_text, is_main FROM product_images WHERE product_id = %s ORDER BY display_order, id",
        (product_id,),
    )
    for item in images:
        item["image_path"] = image_path(item.get("image_path"))
    inventory = fetch_all(
        f"""
        SELECT i.id, i.sku, i.stock, {sale_price_sql('i')} AS effective_price, {list_price_sql('i')} AS list_price,
               s.id AS size_id, s.name AS size_name, c.id AS color_id, c.name AS color_name, c.hex_code
        FROM inventory i
        JOIN products p ON p.id = i.product_id
        LEFT JOIN sizes s ON s.id = i.size_id
        LEFT JOIN colors c ON c.id = i.color_id
        WHERE i.product_id = %s AND i.is_active = TRUE
        ORDER BY s.visual_order, c.name, i.id
        """,
        (product_id,),
    )
    specs = fetch_all(
        "SELECT kind, label, value FROM product_specs WHERE product_id = %s ORDER BY kind, display_order, id",
        (product_id,),
    )
    product["features"] = [row["value"] for row in specs if row["kind"] == "FEATURE"]
    product["specs"] = [{"label": row["label"], "value": row["value"]} for row in specs if row["kind"] == "SPEC"]
    product["uses_size"] = bool(product.get("uses_size"))
    product["uses_color"] = bool(product.get("uses_color"))
    product["images"] = images
    product["inventory"] = inventory
    product["sizes"] = list({item["size_name"]: {"id": item["size_id"], "name": item["size_name"]} for item in inventory if item.get("size_name")}.values())
    product["colors"] = list({item["color_name"]: {"id": item["color_id"], "name": item["color_name"], "hex_code": item["hex_code"]} for item in inventory if item.get("color_name")}.values())
    return product


