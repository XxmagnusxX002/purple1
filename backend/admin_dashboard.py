"""Dashboard administrativo de solo lectura (fase A2).

Definicion de venta: pedido con un pago APPROVED y estado distinto de
CANCELLED. Los ingresos son dinero en EUR (precio base de la tienda); los
PitCoins de los pronosticos se informan aparte y no tienen valor monetario.
Todas las consultas de una peticion comparten una sola conexion.
"""

from datetime import date
from decimal import Decimal

from database import db_cursor

CURRENCY = "EUR"
ORDER_STATUSES = ("PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED")
RACE_STATUSES = ("SCHEDULED", "OPEN", "LOCKED", "FINISHED", "CANCELLED")
LOW_STOCK_THRESHOLD = 5
NEW_USERS_DAYS = 30
SALES_DAYS = 30
SALES_MONTHS = 12

APPROVED = "EXISTS (SELECT 1 FROM payments pa WHERE pa.order_id = o.id AND pa.status = 'APPROVED')"
SALE = f"o.status <> 'CANCELLED' AND {APPROVED}"


def _one(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchone() or {}


def _all(cursor, sql, params=()):
    cursor.execute(sql, params)
    return cursor.fetchall() or []


def _int(value):
    return int(value or 0)


def _money(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def get_dashboard():
    with db_cursor() as (_, cursor):
        users = _one(cursor, """SELECT COUNT(*) AS active,
                                       COALESCE(SUM(created_at >= NOW() - INTERVAL %s DAY), 0) AS recent
                                FROM users WHERE is_active = TRUE""", (NEW_USERS_DAYS,))
        by_status = {status: 0 for status in ORDER_STATUSES}
        for row in _all(cursor, "SELECT status, COUNT(*) AS c FROM orders GROUP BY status"):
            by_status[row["status"]] = _int(row["c"])
        sales = _one(cursor, f"SELECT COUNT(*) AS c FROM orders o WHERE {SALE}")
        unpaid = _one(cursor, f"SELECT COUNT(*) AS c FROM orders o WHERE o.status = 'PENDING' AND NOT {APPROVED}")
        revenue = _one(cursor, """SELECT COALESCE(SUM(p.amount), 0) AS total,
                                         COALESCE(SUM(CASE WHEN p.created_at >= NOW() - INTERVAL %s DAY THEN p.amount ELSE 0 END), 0) AS recent
                                  FROM payments p JOIN orders o ON o.id = p.order_id
                                  WHERE p.status = 'APPROVED' AND o.status <> 'CANCELLED'""", (SALES_DAYS,))
        units = _one(cursor, f"""SELECT COALESCE(SUM(oi.quantity), 0) AS units
                                 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE {SALE}""")
        top_products = _all(cursor, f"""
            SELECT i.product_id, COALESCE(MAX(p.name), MAX(oi.product_name)) AS name,
                   SUM(oi.quantity) AS units, SUM(oi.subtotal) AS revenue
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN inventory i ON i.id = oi.inventory_id
            LEFT JOIN products p ON p.id = i.product_id
            WHERE {SALE}
            GROUP BY i.product_id
            ORDER BY units DESC, revenue DESC, i.product_id
            LIMIT %s""", (5,))
        low_stock_count = _one(cursor, """SELECT COUNT(*) AS c FROM inventory i JOIN products p ON p.id = i.product_id
                                          WHERE i.is_active = TRUE AND p.is_active = TRUE AND i.stock <= %s""", (LOW_STOCK_THRESHOLD,))
        low_stock = _all(cursor, """
            SELECT i.id, i.sku, i.stock, p.id AS product_id, p.name, s.name AS size_name, c.name AS color_name
            FROM inventory i
            JOIN products p ON p.id = i.product_id
            LEFT JOIN sizes s ON s.id = i.size_id
            LEFT JOIN colors c ON c.id = i.color_id
            WHERE i.is_active = TRUE AND p.is_active = TRUE AND i.stock <= %s
            ORDER BY i.stock ASC, p.name ASC, i.id ASC
            LIMIT %s""", (LOW_STOCK_THRESHOLD, 10))
        recent_orders = _all(cursor, f"""
            SELECT o.id, o.created_at, o.status, o.total, u.first_name, u.last_name, {APPROVED} AS paid
            FROM orders o JOIN users u ON u.id = o.user_id
            ORDER BY o.id DESC
            LIMIT %s""", (5,))
        races = {status: 0 for status in RACE_STATUSES}
        for row in _all(cursor, "SELECT status, COUNT(*) AS c FROM races GROUP BY status"):
            races[row["status"]] = _int(row["c"])
        bets = _one(cursor, """SELECT COUNT(*) AS bets, COUNT(DISTINCT user_id) AS participants,
                                      COALESCE(SUM(amount), 0) AS staked,
                                      COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) AS in_play
                               FROM bets""")

    return {
        "users": {"active": _int(users.get("active")), "new_recent": _int(users.get("recent")), "recent_days": NEW_USERS_DAYS},
        "orders": {
            "total": sum(by_status.values()),
            "by_status": by_status,
            "sales": _int(sales.get("c")),
            "unpaid_pending": _int(unpaid.get("c")),
        },
        "revenue": {
            "currency": CURRENCY,
            "approved_total": _money(revenue.get("total")),
            "approved_recent": _money(revenue.get("recent")),
            "recent_days": SALES_DAYS,
        },
        "units_sold": _int(units.get("units")),
        "top_products": [
            {"product_id": row["product_id"], "name": row["name"], "units": _int(row["units"]), "revenue": _money(row["revenue"])}
            for row in top_products
        ],
        "low_stock": {
            "threshold": LOW_STOCK_THRESHOLD,
            "count": _int(low_stock_count.get("c")),
            "items": [
                {"inventory_id": row["id"], "product_id": row["product_id"], "name": row["name"], "sku": row["sku"],
                 "size": row["size_name"], "color": row["color_name"], "stock": _int(row["stock"])}
                for row in low_stock
            ],
        },
        "recent_orders": [
            {"id": row["id"], "created_at": row["created_at"], "status": row["status"], "total": _money(row["total"]),
             "customer": " ".join(part for part in (row["first_name"], row["last_name"]) if part).strip(),
             "paid": bool(row["paid"])}
            for row in recent_orders
        ],
        "predictions": {
            "races_by_status": races,
            "bets": _int(bets.get("bets")),
            "participants": _int(bets.get("participants")),
            "pitcoins_in_play": _int(bets.get("in_play")),
            "pitcoins_staked_total": _int(bets.get("staked")),
            "unit": "PitCoins",
        },
    }


def _month_start(day, back):
    month = day.month - 1 - back
    return date(day.year + month // 12, month % 12 + 1, 1)


def sales_buckets(group, today):
    """Lista ordenada de claves (YYYY-MM-DD o YYYY-MM) del periodo, incluida la actual."""
    if group == "day":
        return [date.fromordinal(today.toordinal() - offset).isoformat() for offset in range(SALES_DAYS - 1, -1, -1)]
    return [_month_start(today, back).strftime("%Y-%m") for back in range(SALES_MONTHS - 1, -1, -1)]


def fill_series(group, today, rows):
    found = {str(row["bucket"]): row for row in rows}
    series = []
    for key in sales_buckets(group, today):
        row = found.get(key, {})
        series.append({"period": key, "revenue": _money(row.get("revenue")), "orders": _int(row.get("orders"))})
    return series


def get_sales(group):
    if group not in ("day", "month"):
        raise ValueError("group debe ser day o month.")
    with db_cursor() as (_, cursor):
        today = _one(cursor, "SELECT CURDATE() AS today")["today"]
        if group == "day":
            start = date.fromordinal(today.toordinal() - (SALES_DAYS - 1))
            bucket = "DATE(o.created_at)"
        else:
            start = _month_start(today, SALES_MONTHS - 1)
            bucket = "CONCAT(YEAR(o.created_at), '-', LPAD(MONTH(o.created_at), 2, '0'))"
        # Ingresos por pago aprobado; los pedidos se cuentan una sola vez.
        # Sin DATE_FORMAT('%%...'): algunas versiones del conector no convierten %% en %.
        rows = _all(cursor, f"""
            SELECT {bucket} AS bucket, SUM(p.amount) AS revenue, COUNT(DISTINCT o.id) AS orders
            FROM orders o JOIN payments p ON p.order_id = o.id AND p.status = 'APPROVED'
            WHERE o.status <> 'CANCELLED' AND o.created_at >= %s
            GROUP BY bucket
            ORDER BY bucket""", (start,))
    return {"group": group, "currency": CURRENCY, "series": fill_series(group, today, rows)}
