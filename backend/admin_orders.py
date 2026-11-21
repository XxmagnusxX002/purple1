"""Pedidos y estadisticas de compras desde el panel (fase A6). Solo lectura.

No cambia estados, pagos ni inventario: reembolsos, cancelaciones y cambios de
envio necesitan reglas propias antes de implementarse. Usa las tablas de la
tienda (orders, order_items, payments, inventory) sin migraciones nuevas.

Definiciones (las mismas que el dashboard, admin_dashboard.py):
- Venta: pedido no cancelado con un pago APPROVED.
- Importes en EUR, la moneda base de la tienda. Los PitCoins no intervienen.
- El pago simulado solo guarda pagos aprobados: los intentos rechazados no se
  registran (decision de la fase 0), asi que no aparecen en el historial.
"""

import re
from datetime import datetime, timedelta

from admin_common import NotFoundError, ValidationError, like_pattern, parse_int
from admin_dashboard import APPROVED, CURRENCY, LOW_STOCK_THRESHOLD, ORDER_STATUSES, SALE
from database import db_cursor

PER_PAGE = 25
MAX_PAGE = 10_000
PERIODS = {"7": 7, "30": 30, "90": 90, "365": 365, "all": None}
SORTS = {"recent": "o.id DESC", "oldest": "o.id ASC", "total_desc": "o.total DESC, o.id DESC", "total_asc": "o.total ASC, o.id DESC"}
ORDER_ID = re.compile(r"#?(\d{1,10})")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _param(params, key, default=""):
    return (params.get(key, [default])[0] or default).strip()


def _date(params, key, errors):
    value = _param(params, key)
    if not value:
        return None
    try:
        if not DATE.fullmatch(value):
            raise ValueError
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        errors[key] = "Fecha invalida (AAAA-MM-DD)."
        return None


def _filters(params):
    errors, where, values = {}, [], []
    status = _param(params, "status", "all").upper()
    if status != "ALL":
        if status not in ORDER_STATUSES:
            errors["status"] = "Estado invalido."
        where.append("o.status = %s")
        values.append(status)
    payment = _param(params, "payment", "all")
    if payment == "approved":
        where.append(APPROVED)
    elif payment == "none":
        where.append(f"NOT {APPROVED}")
    elif payment != "all":
        errors["payment"] = "Filtro de pago invalido."
    term = _param(params, "q")[:100]
    if term:
        match = ORDER_ID.fullmatch(term)
        people = "(u.first_name LIKE %s OR u.last_name LIKE %s OR CONCAT(u.first_name, ' ', u.last_name) LIKE %s OR u.email LIKE %s OR u.username LIKE %s)"
        if match:
            where.append(f"(o.id = %s OR {people})")
            values.append(int(match.group(1)))
        else:
            where.append(people)
        values += [like_pattern(term)] * 5
    start, end = _date(params, "from", errors), _date(params, "to", errors)
    if start and end and end < start:
        errors["to"] = "La fecha final es anterior a la inicial."
    if start:
        where.append("o.created_at >= %s")
        values.append(start)
    if end:
        where.append("o.created_at < %s")
        values.append(end + timedelta(days=1))
    sort = _param(params, "sort", "recent")
    if sort not in SORTS:
        errors["sort"] = "Orden invalido."
    try:
        page = parse_int(_param(params, "page", "1"), 1, MAX_PAGE, "x")
    except ValueError:
        errors["page"] = "Pagina invalida."
        page = 1
    if errors:
        raise ValidationError(errors)
    return " AND ".join(where) or "TRUE", values, SORTS[sort], page


def _name(row, prefix=""):
    return " ".join(part for part in (row.get(f"{prefix}first_name"), row.get(f"{prefix}last_name")) if part).strip()


def list_orders(params):
    where, values, order_by, page = _filters(params)
    base = f"FROM orders o JOIN users u ON u.id = o.user_id WHERE {where}"
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN {SALE} THEN o.total ELSE 0 END), 0) AS sales_amount,
                       COALESCE(SUM({SALE}), 0) AS sales {base}""",
            tuple(values),
        )
        summary = cursor.fetchone() or {}
        total = int(summary.get("total") or 0)
        pages = max(1, -(-total // PER_PAGE))
        page = min(page, pages)
        cursor.execute(
            f"""SELECT o.id, o.created_at, o.status, o.total, u.id AS user_id, u.first_name, u.last_name, u.username,
                       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS units,
                       (SELECT pa.status FROM payments pa WHERE pa.order_id = o.id ORDER BY pa.id DESC LIMIT 1) AS payment_status,
                       ({SALE}) AS is_sale
                {base} ORDER BY {order_by} LIMIT %s OFFSET %s""",
            (*values, PER_PAGE, (page - 1) * PER_PAGE),
        )
        rows = cursor.fetchall()
    orders = [{"id": row["id"], "created_at": row["created_at"], "status": row["status"], "total": row["total"],
               "customer": {"id": row["user_id"], "name": _name(row), "username": row["username"]},
               "units": int(row["units"] or 0), "payment_status": row["payment_status"], "is_sale": bool(row["is_sale"])}
              for row in rows]
    return {"orders": orders, "page": page, "pages": pages, "per_page": PER_PAGE, "total": total,
            "summary": {"currency": CURRENCY, "sales": int(summary.get("sales") or 0), "sales_amount": summary.get("sales_amount") or 0}}


def get_order(order_id):
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""SELECT o.id, o.status, o.subtotal, o.discount, o.shipping_cost, o.total, o.shipping_address, o.created_at, o.updated_at,
                       o.currency_code, o.exchange_rate, o.total_local, o.discount_percent, o.pitcoins_redeemed, cur.symbol AS currency_symbol, cur.locale AS currency_locale,
                       cur.decimals AS currency_decimals,
                       ({SALE}) AS is_sale, u.id AS user_id, u.username, u.email, u.first_name, u.last_name, u.phone, u.is_active AS user_active
                FROM orders o JOIN users u ON u.id = o.user_id JOIN currencies cur ON cur.code = o.currency_code WHERE o.id = %s""",
            (order_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise NotFoundError("Pedido no encontrado.")
        cursor.execute(
            """SELECT oi.id, oi.inventory_id, oi.product_name, oi.size_name, oi.color_name, oi.unit_price, oi.quantity, oi.subtotal,
                      i.sku, i.stock, i.is_active AS variant_active, p.id AS product_id, p.is_active AS product_active,
                      (SELECT pi.image_path FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.display_order, pi.id LIMIT 1) AS image_path
               FROM order_items oi JOIN inventory i ON i.id = oi.inventory_id LEFT JOIN products p ON p.id = i.product_id
               WHERE oi.order_id = %s ORDER BY oi.id""",
            (order_id,),
        )
        items = cursor.fetchall()
        cursor.execute("SELECT id, method, status, amount, reference, created_at, updated_at FROM payments WHERE order_id = %s ORDER BY id",
                       (order_id,))
        payments = cursor.fetchall()
        cursor.execute(
            f"""SELECT COUNT(*) AS orders, COALESCE(SUM({SALE}), 0) AS sales,
                       COALESCE(SUM(CASE WHEN {SALE} THEN o.total ELSE 0 END), 0) AS spent
                FROM orders o WHERE o.user_id = %s""",
            (row["user_id"],),
        )
        history = cursor.fetchone() or {}
    for item in items:
        item["variant_active"] = bool(item["variant_active"])
        item["product_active"] = None if item["product_active"] is None else bool(item["product_active"])
        item["low_stock"] = item["stock"] is not None and item["stock"] <= LOW_STOCK_THRESHOLD
    return {
        "id": row["id"], "status": row["status"], "created_at": row["created_at"], "updated_at": row["updated_at"],
        "is_sale": bool(row["is_sale"]), "currency": CURRENCY,
        "amounts": {"subtotal": row["subtotal"], "discount": row["discount"], "shipping_cost": row["shipping_cost"], "total": row["total"],
                    "discount_percent": row["discount_percent"], "pitcoins_redeemed": row["pitcoins_redeemed"]},
        # Lo que pago el cliente en su moneda, con la tasa del momento de la compra.
        "paid": {"currency_code": row["currency_code"], "exchange_rate": row["exchange_rate"], "total_local": row["total_local"],
                 "symbol": row["currency_symbol"], "locale": row["currency_locale"], "decimals": row["currency_decimals"]},
        "shipping_address": row["shipping_address"],
        # Datos del comprador: solo los que el staff necesita para atender el pedido.
        "customer": {"id": row["user_id"], "name": _name(row), "username": row["username"], "email": row["email"], "phone": row["phone"],
                     "is_active": bool(row["user_active"]), "orders": int(history.get("orders") or 0),
                     "sales": int(history.get("sales") or 0), "spent": history.get("spent") or 0},
        "items": items,
        "units": sum(int(item["quantity"]) for item in items),
        "payments": payments,
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    }


def get_order_stats(params):
    period = _param(params, "period", "30")
    if period not in PERIODS:
        raise ValidationError({"period": "Periodo invalido."})
    days = PERIODS[period]
    window = "o.created_at >= NOW() - INTERVAL %s DAY" if days else "TRUE"
    args = (days,) if days else ()
    with db_cursor() as (_, cursor):
        cursor.execute(
            f"""SELECT COUNT(*) AS sales, COALESCE(SUM(o.total), 0) AS revenue, COALESCE(AVG(o.total), 0) AS average,
                       COALESCE(SUM(o.discount), 0) AS discounts,
                       COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE {SALE} AND {window}), 0) AS units
                FROM orders o WHERE {SALE} AND {window}""",
            args + args,
        )
        totals = cursor.fetchone() or {}
        cursor.execute(f"SELECT o.status, COUNT(*) AS total FROM orders o WHERE {window} GROUP BY o.status", args)
        by_status = {status: 0 for status in ORDER_STATUSES}
        for row in cursor.fetchall():
            by_status[row["status"]] = int(row["total"])
        cursor.execute(
            f"""SELECT i.product_id, COALESCE(MAX(p.name), MAX(oi.product_name)) AS name, SUM(oi.quantity) AS units, SUM(oi.subtotal) AS revenue,
                       (SELECT COALESCE(SUM(i2.stock), 0) FROM inventory i2 WHERE i2.product_id = i.product_id AND i2.is_active = TRUE) AS stock
                FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN inventory i ON i.id = oi.inventory_id
                LEFT JOIN products p ON p.id = i.product_id
                WHERE {SALE} AND {window}
                GROUP BY i.product_id ORDER BY units DESC, revenue DESC, i.product_id LIMIT 10""",
            args,
        )
        top_products = cursor.fetchall()
        # Inventario relacionado con las compras: variantes mas vendidas y su stock actual.
        cursor.execute(
            f"""SELECT i.id AS inventory_id, i.sku, i.stock, i.is_active, MAX(oi.product_name) AS name, MAX(oi.size_name) AS size,
                       MAX(oi.color_name) AS color, i.product_id, SUM(oi.quantity) AS units
                FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN inventory i ON i.id = oi.inventory_id
                WHERE {SALE} AND {window}
                GROUP BY i.id ORDER BY units DESC, i.stock ASC, i.id LIMIT 15""",
            args,
        )
        variants = cursor.fetchall()
    for row in top_products:
        row["units"], row["stock"] = int(row["units"] or 0), int(row["stock"] or 0)
    for row in variants:
        row["units"], row["is_active"] = int(row["units"] or 0), bool(row["is_active"])
        row["low_stock"] = row["stock"] <= LOW_STOCK_THRESHOLD
    return {
        "period": period, "days": days, "currency": CURRENCY, "low_stock_threshold": LOW_STOCK_THRESHOLD,
        "totals": {"sales": int(totals.get("sales") or 0), "revenue": totals.get("revenue") or 0, "average": totals.get("average") or 0,
                   "discounts": totals.get("discounts") or 0, "units": int(totals.get("units") or 0)},
        "by_status": by_status,
        "top_products": top_products,
        "variants": variants,
    }
