from decimal import Decimal

import currencies
import rewards
from pricing import PROMO_PERCENT_SQL, list_price_sql, sale_price_sql
from database import db_cursor, fetch_all, fetch_one
from utils import image_path


def _cart_for_user(cursor, user_id, create=True):
    cursor.execute("SELECT id FROM users WHERE id = %s AND is_active = TRUE FOR UPDATE", (user_id,))
    if not cursor.fetchone():
        return None
    cursor.execute("SELECT id FROM carts WHERE user_id = %s AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1 FOR UPDATE", (user_id,))
    cart = cursor.fetchone()
    if cart:
        return cart["id"]
    if not create:
        return None
    cursor.execute("INSERT INTO carts (user_id, status) VALUES (%s, 'ACTIVE')", (user_id,))
    return cursor.lastrowid


def get_or_create_cart(user_id):
    with db_cursor() as (connection, cursor):
        cart_id = _cart_for_user(cursor, user_id)
        connection.commit()
    if not cart_id:
        raise ValueError("Usuario no encontrado.")
    return cart_id


def get_cart(user_id, currency_code="EUR", reward_id=None):
    """Carrito con importes en EUR y en la moneda elegida (misma conversion que el cobro)."""
    cart_id = get_or_create_cart(user_id)
    items = fetch_all(
        f"""SELECT ci.id, ci.inventory_id, ci.quantity, p.id AS product_id, p.name AS product_name,
                  pi.image_path, pt.name AS product_type,
                  s.name AS size_name, c.name AS color_name,
                  {list_price_sql('i')} AS list_price, {PROMO_PERCENT_SQL} AS promo_percent,
                  {sale_price_sql('i')} AS unit_price,
                  ci.quantity * {sale_price_sql('i')} AS subtotal, i.stock
           FROM cart_items ci JOIN inventory i ON i.id = ci.inventory_id
           JOIN products p ON p.id = i.product_id
           JOIN product_types pt ON pt.id = p.product_type_id
           LEFT JOIN sizes s ON s.id = i.size_id
           LEFT JOIN colors c ON c.id = i.color_id
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main = TRUE
           WHERE ci.cart_id = %s ORDER BY ci.created_at""",
        (cart_id,),
    )
    for item in items:
        item["image_path"] = image_path(item.get("image_path"))
    total = sum(Decimal(str(item["subtotal"])) for item in items)
    currency = currencies.get_active(currency_code) or currencies.get_active(currencies.BASE)
    total_local = list_total_local = Decimal("0")
    for item in items:
        item["unit_price_local"] = currencies.to_local(item["unit_price"], currency)
        item["list_price_local"] = currencies.to_local(item["list_price"], currency)
        item["subtotal_local"] = item["unit_price_local"] * item["quantity"]
        total_local += item["subtotal_local"]
        list_total_local += item["list_price_local"] * item["quantity"]
    # Descuentos canjeables con PitCoins y el elegido (misma regla que el cobro).
    coins = int((fetch_one("SELECT coins FROM users WHERE id = %s", (user_id,)) or {"coins": 0})["coins"])
    options = rewards.available(coins) if items else []
    chosen = next((r for r in options if str(r["id"]) == str(reward_id or "") and r["affordable"]), None)
    percent = chosen["applied_percent"] if chosen else 0
    discount = rewards.discount_amount(total, percent)
    discount_local = rewards.discount_amount(total_local, percent, currency["decimals"])
    return {"cart_id": cart_id, "items": items, "total": total - discount, "subtotal": total, "currency": currency,
            "subtotal_local": total_local, "discount_local": discount_local, "total_local": total_local - discount_local,
            "list_total_local": list_total_local, "savings_local": max(Decimal("0"), list_total_local - total_local),
            "pitcoins": coins, "rewards": options, "reward": chosen,
            "pitcoins_after": coins - (int(chosen["pitcoin_cost"]) if chosen else 0)}


def add_to_cart(data):
    user_id = int(data.get("user_id") or 0)
    inventory_id = int(data.get("inventory_id") or 0)
    quantity = int(data.get("quantity") or 1)
    if not user_id or not inventory_id or quantity < 1:
        return None, "Inventario y cantidad válidos son obligatorios.", 400
    with db_cursor() as (connection, cursor):
        cart_id = _cart_for_user(cursor, user_id)
        if not cart_id:
            connection.rollback()
            return None, "Usuario no encontrado.", 404
        # Variante y producto activos; solo se bloquea la fila de inventario (OF i).
        cursor.execute(
            """SELECT i.stock FROM inventory i JOIN products p ON p.id = i.product_id
               WHERE i.id = %s AND i.is_active = TRUE AND p.is_active = TRUE FOR UPDATE OF i""",
            (inventory_id,),
        )
        inv = cursor.fetchone()
        if not inv:
            connection.rollback()
            return None, "Inventario no encontrado.", 404
        cursor.execute("SELECT id, quantity FROM cart_items WHERE cart_id = %s AND inventory_id = %s FOR UPDATE", (cart_id, inventory_id))
        item = cursor.fetchone()
        new_quantity = quantity + (item["quantity"] if item else 0)
        if inv["stock"] < new_quantity:
            connection.rollback()
            return None, "Stock insuficiente.", 400
        if item:
            cursor.execute("UPDATE cart_items SET quantity = %s WHERE id = %s", (new_quantity, item["id"]))
        else:
            cursor.execute("INSERT INTO cart_items (cart_id, inventory_id, quantity) VALUES (%s, %s, %s)", (cart_id, inventory_id, quantity))
        connection.commit()
    return {"success": True, "cart": get_cart(user_id)}, None, 200


def update_cart_item(data):
    user_id = int(data.get("user_id") or 0)
    item_id = int(data.get("cart_item_id") or data.get("item_id") or 0)
    quantity = int(data.get("quantity") or 0)
    if not item_id:
        return None, "Item no encontrado.", 404
    with db_cursor() as (connection, cursor):
        cart_id = _cart_for_user(cursor, user_id, create=False)
        if not cart_id:
            connection.rollback()
            return None, "Carrito no encontrado.", 404
        cursor.execute("SELECT ci.id, i.stock FROM cart_items ci JOIN inventory i ON i.id = ci.inventory_id WHERE ci.id = %s AND ci.cart_id = %s FOR UPDATE", (item_id, cart_id))
        item = cursor.fetchone()
        if not item:
            connection.rollback()
            return None, "Item no encontrado.", 404
        if quantity < 1:
            cursor.execute("DELETE FROM cart_items WHERE id = %s", (item_id,))
        elif item["stock"] < quantity:
            connection.rollback()
            return None, "Stock insuficiente.", 400
        else:
            cursor.execute("UPDATE cart_items SET quantity = %s WHERE id = %s", (quantity, item_id))
        connection.commit()
    return {"success": True, "cart": get_cart(user_id)}, None, 200


def remove_cart_item(user_id, cart_item_id):
    with db_cursor() as (connection, cursor):
        cart_id = _cart_for_user(cursor, user_id, create=False)
        if cart_id:
            cursor.execute("DELETE FROM cart_items WHERE id = %s AND cart_id = %s", (cart_item_id, cart_id))
        connection.commit()
    return {"success": True, "cart": get_cart(user_id)}
