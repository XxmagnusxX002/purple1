"""Portada (GET /api/home): todas las secciones salen de la base de datos.

- banners: los vigentes del panel.
- featured: productos activos marcados como destacados.
- best_sellers: unidades vendidas en compras REALES (pedido no cancelado con pago
  APPROVED, la misma definicion de venta que el dashboard).
- new_arrivals: los productos activos mas recientes.
- categories: categorias principales activas con su imagen y cuantos productos tienen.
- next_race / open_races: proxima carrera y pronosticos abiertos.
- leaderboard: ranking de PitCoins, solo con nombre visible (nunca el correo).
Una seccion sin datos se devuelve vacia y la portada la oculta.
"""

from admin_banners import public_banners
from admin_dashboard import SALE
from bets import _prepare_race, get_leaderboard
from database import fetch_all, fetch_one
from products import normalize_product, product_summary_sql
from utils import image_path

PRODUCTS_PER_SECTION = 8


def _products(extra_where="", order="p.id DESC", args=()):
    rows = fetch_all(product_summary_sql(extra_where) + f" ORDER BY {order} LIMIT {PRODUCTS_PER_SECTION}", args)
    return [normalize_product(row) for row in rows]


def _best_sellers():
    sold = fetch_all(
        f"""SELECT i.product_id, SUM(oi.quantity) AS units
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN inventory i ON i.id = oi.inventory_id
            JOIN products p ON p.id = i.product_id AND p.is_active = TRUE
            WHERE {SALE}
            GROUP BY i.product_id ORDER BY units DESC, i.product_id LIMIT {PRODUCTS_PER_SECTION}"""
    )
    if not sold:
        return []
    units = {row["product_id"]: int(row["units"]) for row in sold}
    marks = ", ".join(["%s"] * len(units))
    products = _products(f"AND p.id IN ({marks})", "p.id", tuple(units))
    for product in products:
        product["units_sold"] = units[product["id"]]
    return sorted(products, key=lambda product: (-product["units_sold"], product["id"]))


def _categories():
    rows = fetch_all(
        """SELECT c.id, c.name, c.slug, c.description, c.image_path,
                  (SELECT COUNT(DISTINCT pc.product_id) FROM product_categories pc
                   JOIN products p ON p.id = pc.product_id AND p.is_active = TRUE
                   WHERE pc.category_id = c.id) AS products
           FROM categories c
           WHERE c.is_active = TRUE AND c.parent_id IS NULL
           ORDER BY c.display_order, c.name"""
    )
    for row in rows:
        row["products"] = int(row["products"] or 0)
        row["image_path"] = image_path(row["image_path"]) if row["image_path"] else None
    return [row for row in rows if row["products"]]


def _race_summary(race):
    _prepare_race(race)
    stats = fetch_one(
        """SELECT (SELECT COUNT(*) FROM race_options WHERE race_id = %s) AS drivers,
                  (SELECT COUNT(DISTINCT user_id) FROM bets WHERE race_id = %s) AS participants,
                  (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE race_id = %s AND status <> 'REFUNDED') AS pool""",
        (race["id"], race["id"], race["id"]),
    )
    return {
        "id": race["id"], "name": race["name"], "circuit": race["circuit"], "country": race["country"],
        "status": race["status"], "race_date": race["race_date"], "local_display": race.get("race_local_display"),
        "betting_closed": race["betting_closed"], "image_path": image_path(race["image_path"]) if race.get("image_path") else None,
        "drivers": int(stats["drivers"]), "participants": int(stats["participants"]), "pool": int(stats["pool"]),
    }


def _races():
    upcoming = fetch_all(
        """SELECT * FROM races
           WHERE status IN ('SCHEDULED', 'OPEN', 'LOCKED')
             AND COALESCE(race_date_utc, race_date) > UTC_TIMESTAMP()
           ORDER BY COALESCE(race_date_utc, race_date) ASC LIMIT 4"""
    )
    summaries = [_race_summary(race) for race in upcoming]
    open_races = [race for race in summaries if race["status"] == "OPEN" and not race["betting_closed"]][:3]
    # Carrera destacada: 1) abierta a pronósticos, 2) próxima programada,
    # 3) la última finalizada, solo si ya no quedan carreras por disputar.
    featured = open_races[0] if open_races else (summaries[0] if summaries else None)
    if not featured:
        last = fetch_all("SELECT * FROM races WHERE status = 'FINISHED' ORDER BY COALESCE(race_date_utc, race_date) DESC LIMIT 1")
        featured = _race_summary(last[0]) if last else None
    return featured, open_races


def _leaderboard():
    return [{"position": index + 1, "name": row["display_name"], "coins": int(row["coins"])}
            for index, row in enumerate(get_leaderboard(5))]


def get_home():
    next_race, open_races = _races()
    return {
        "banners": public_banners(),
        "featured": _products("AND p.is_featured = TRUE", "p.updated_at DESC, p.id DESC"),
        "best_sellers": _best_sellers(),
        "new_arrivals": _products("", "p.created_at DESC, p.id DESC"),
        "categories": _categories(),
        "next_race": next_race,
        "open_races": open_races,
        "leaderboard": _leaderboard(),
    }
