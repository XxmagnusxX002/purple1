"""Precio de venta en un solo lugar (catalogo, carrito y pedidos usan lo mismo).

Precio de lista = price_override de la variante o, si no tiene, base_price del producto.
Precio de venta = precio de lista con la promocion del producto, solo si esta vigente:
    products.promo_percent IS NOT NULL y la fecha UTC actual esta entre
    promo_starts_at y promo_ends_at (un extremo NULL significa "sin limite").
Los fragmentos SQL suponen el alias p para products e i para inventory.
"""

PROMO_ACTIVE_SQL = (
    "(p.promo_percent IS NOT NULL"
    " AND (p.promo_starts_at IS NULL OR p.promo_starts_at <= UTC_TIMESTAMP())"
    " AND (p.promo_ends_at IS NULL OR p.promo_ends_at > UTC_TIMESTAMP()))"
)

# Porcentaje vigente (0 si no hay promocion activa).
PROMO_PERCENT_SQL = f"(CASE WHEN {PROMO_ACTIVE_SQL} THEN p.promo_percent ELSE 0 END)"


def list_price_sql(inventory_alias="i"):
    return f"COALESCE({inventory_alias}.price_override, p.base_price)"


def sale_price_sql(inventory_alias="i"):
    """Precio con la promocion aplicada, redondeado a centimos."""
    return f"ROUND({list_price_sql(inventory_alias)} * (100 - {PROMO_PERCENT_SQL}) / 100, 2)"
