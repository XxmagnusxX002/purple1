from decimal import Decimal

import currencies
import rewards
from pricing import sale_price_sql
from database import db_cursor, fetch_all, fetch_one


def create_order(data, payment_reference):
    """Crea un pedido pagado. Solo lo invoca el pago simulado aprobado: no
    existe un pedido sin pago que retenga inventario."""
    user_id = int(data.get("user_id") or 0)
    shipping_address = (data.get("shipping_address") or "").strip()
    if not user_id:
        return None, "Usuario no encontrado.", 400
    if not payment_reference:
        raise ValueError("Un pedido requiere un pago aprobado.")
    with db_cursor(dictionary=True) as (connection, cursor):
        # Mismo orden de bloqueo que el carrito: usuario, carrito, inventario.
        cursor.execute("SELECT id, coins FROM users WHERE id = %s AND is_active = TRUE FOR UPDATE", (user_id,))
        buyer = cursor.fetchone()
        if not buyer:
            connection.rollback()
            return None, "Usuario no encontrado.", 404
        # Moneda elegida y su tasa EN ESTE MOMENTO. Si el cliente vio otra tasa
        # (el superadministrador la cambio mientras pagaba), no se cobra.
        currency = currencies.get_active(data.get("currency_code") or currencies.BASE, cursor)
        if not currency:
            connection.rollback()
            return None, "Esa moneda no está disponible. Elige otra para pagar.", 400
        quoted = data.get("quoted_rate")
        if quoted not in (None, ""):
            try:
                same = Decimal(str(quoted)) == Decimal(str(currency["rate_per_eur"]))
            except Exception:  # noqa: BLE001 - tasa mal formada
                same = False
            if not same:
                connection.rollback()
                return None, f"La tasa de cambio de {currency['code']} se actualizó. Revisa el total del carrito antes de pagar.", 409
        # Descuento canjeado con PitCoins (uno por pedido). El usuario ya esta
        # bloqueado: el saldo no puede cambiar hasta que termine esta compra.
        reward = None
        if data.get("reward_id") not in (None, "", 0, "0"):
            try:
                reward = rewards.lock_reward(cursor, int(data.get("reward_id")))
            except (TypeError, ValueError):
                reward = None
            quoted_cost = data.get("reward_cost")
            if not reward or (quoted_cost not in (None, "") and str(quoted_cost) != str(reward["pitcoin_cost"])):
                connection.rollback()
                return None, "Ese descuento cambió o ya no está disponible. Revisa el carrito antes de pagar.", 409
            if int(buyer["coins"]) < int(reward["pitcoin_cost"]):
                connection.rollback()
                return None, "No tienes PitCoins suficientes para ese descuento.", 409
        cursor.execute(
            "SELECT id FROM carts WHERE user_id = %s AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1 FOR UPDATE",
            (user_id,),
        )
        cart = cursor.fetchone()
        if not cart:
            connection.rollback()
            return None, "El carrito esta vacio.", 400
        cursor.execute(
            "SELECT inventory_id, quantity FROM cart_items WHERE cart_id = %s ORDER BY inventory_id FOR UPDATE",
            (cart["id"],),
        )
        cart_lines = cursor.fetchall()
        if not cart_lines:
            connection.rollback()
            return None, "El carrito esta vacio.", 400
        # Cada checkout bloquea los SKU compartidos en el mismo orden.
        stock_by_inventory = {}
        for line in sorted(cart_lines, key=lambda item: item["inventory_id"]):
            cursor.execute("SELECT stock FROM inventory WHERE id = %s FOR UPDATE", (line["inventory_id"],))
            inventory = cursor.fetchone()
            if not inventory:
                connection.rollback()
                return None, "Inventario no encontrado.", 404
            stock_by_inventory[line["inventory_id"]] = inventory["stock"]
        cursor.execute(
            f"""SELECT ci.inventory_id, ci.quantity, p.name AS product_name,
                      s.name AS size_name, c.name AS color_name,
                      {sale_price_sql('i')} AS unit_price,
                      (i.is_active AND p.is_active) AS available
               FROM cart_items ci
               JOIN inventory i ON i.id = ci.inventory_id
               JOIN products p ON p.id = i.product_id
               LEFT JOIN sizes s ON s.id = i.size_id
               LEFT JOIN colors c ON c.id = i.color_id
               WHERE ci.cart_id = %s ORDER BY ci.inventory_id""",
            (cart["id"],),
        )
        items = cursor.fetchall()
        if len(items) != len(cart_lines):
            raise RuntimeError("El carrito cambió durante la compra.")
        # Un producto o variante desactivado desde el panel ya no se vende,
        # aunque siguiera en el carrito. Nada se cobra ni se descuenta.
        unavailable = [item["product_name"] for item in items if not item["available"]]
        if unavailable:
            connection.rollback()
            names = ", ".join(sorted(set(unavailable)))
            return None, f"Ya no está disponible: {names}. Quítalo del carrito para continuar.", 400
        for item in items:
            if item["quantity"] < 1 or stock_by_inventory[item["inventory_id"]] < item["quantity"]:
                connection.rollback()
                return None, f"Stock insuficiente para {item['product_name']}.", 400
        # EUR (informes) y moneda del cliente (lo que paga), con la misma conversion del carrito.
        for item in items:
            item["unit_price_local"] = currencies.to_local(item["unit_price"], currency)
        subtotal = sum(Decimal(str(item["unit_price"])) * item["quantity"] for item in items)
        subtotal_local = sum(item["unit_price_local"] * item["quantity"] for item in items)
        # El descuento aplica solo a los productos (nunca al envio), con el tope configurado.
        percent = min(int(reward["percent"]), rewards.max_percent(cursor)) if reward else 0
        pitcoins = int(reward["pitcoin_cost"]) if reward else 0
        discount = rewards.discount_amount(subtotal, percent)
        discount_local = rewards.discount_amount(subtotal_local, percent, currency["decimals"])
        shipping_cost = shipping_local = Decimal("0.00")
        total = subtotal - discount + shipping_cost
        total_local = subtotal_local - discount_local + shipping_local
        cursor.execute(
            """INSERT INTO orders (user_id, status, subtotal, discount, shipping_cost, total, currency_code, exchange_rate,
                                   subtotal_local, discount_local, shipping_local, total_local, discount_reward_id, discount_percent,
                                   pitcoins_redeemed, shipping_address)
               VALUES (%s, 'PAID', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (user_id, subtotal, discount, shipping_cost, total, currency["code"], currency["rate_per_eur"],
             subtotal_local, discount_local, shipping_local, total_local, reward["id"] if reward else None, percent,
             pitcoins, shipping_address),
        )
        order_id = cursor.lastrowid
        for item in items:
            line_total = Decimal(str(item["unit_price"])) * item["quantity"]
            cursor.execute(
                """INSERT INTO order_items (order_id, inventory_id, product_name, size_name, color_name, unit_price,
                   unit_price_local, quantity, subtotal, subtotal_local) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (order_id, item["inventory_id"], item["product_name"], item["size_name"], item["color_name"], item["unit_price"],
                 item["unit_price_local"], item["quantity"], line_total, item["unit_price_local"] * item["quantity"]),
            )
            cursor.execute(
                "UPDATE inventory SET stock = stock - %s WHERE id = %s AND stock >= %s",
                (item["quantity"], item["inventory_id"], item["quantity"]),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("El inventario cambió durante la compra.")
        cursor.execute(
            """INSERT INTO payments (order_id, method, status, amount, currency_code, amount_local, reference)
               VALUES (%s, 'CARD', 'APPROVED', %s, %s, %s, %s)""",
            (order_id, total, currency["code"], total_local, payment_reference),
        )
        cursor.execute("UPDATE carts SET status = 'CLOSED' WHERE id = %s AND status = 'ACTIVE'", (cart["id"],))
        if cursor.rowcount != 1:
            raise RuntimeError("El carrito cambió durante la compra.")
        balance = rewards.redeem(cursor, user_id, reward, order_id) if reward else int(buyer["coins"])
        connection.commit()
    order = fetch_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    return {"success": True, "order": order, "pitcoins_balance": balance}, None, 201


def get_user_orders(user_id, limit=50):
    """Historial del cliente con los importes ORIGINALES de cada compra (moneda,
    tasa y valores guardados en el pedido; no se recalculan con la tasa actual)."""
    orders = fetch_all(
        """SELECT o.id, o.created_at, o.status, o.currency_code, o.exchange_rate, o.subtotal_local, o.discount_local,
                  o.shipping_local, o.total_local, o.total AS total_eur, o.discount_percent, o.pitcoins_redeemed, c.symbol, c.locale, c.decimals,
                  (SELECT p.status FROM payments p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) AS payment_status
           FROM orders o JOIN currencies c ON c.code = o.currency_code
           WHERE o.user_id = %s ORDER BY o.id DESC LIMIT %s""",
        (user_id, int(limit)),
    )
    if not orders:
        return []
    marks = ", ".join(["%s"] * len(orders))
    items = fetch_all(
        f"""SELECT oi.order_id, oi.product_name, oi.size_name, oi.color_name, oi.quantity, oi.unit_price_local, oi.subtotal_local,
                   i.product_id
            FROM order_items oi LEFT JOIN inventory i ON i.id = oi.inventory_id
            WHERE oi.order_id IN ({marks}) ORDER BY oi.id""",
        tuple(order["id"] for order in orders),
    )
    by_order = {}
    for item in items:
        by_order.setdefault(item["order_id"], []).append(item)
    for order in orders:
        order["items"] = by_order.get(order["id"], [])
    return orders
