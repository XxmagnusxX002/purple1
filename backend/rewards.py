"""Descuentos canjeables con PitCoins (economía definitiva de Purple One).

Proyecto académico: pagos y pronósticos son simulados. Los PitCoins no se
compran con dinero, no se retiran, no se transfieren ni se convierten en
efectivo; solo se canjean por un descuento en la tienda.

Reglas:
- El cliente elige un descuento en el carrito (tabla discount_rewards).
- Uno por pedido, solo sobre los productos (nunca el envío).
- Porcentaje aplicado = min(descuento, máximo configurado) y nunca más de 20 %.
- Los PitCoins se descuentan en la MISMA transacción que crea el pedido pagado
  (movimiento DISCOUNT_REDEMPTION con referencia única por pedido). Si el pago
  se rechaza no hay pedido y no se toca el saldo; el saldo nunca queda negativo.
"""

from decimal import Decimal, ROUND_HALF_UP

import settings
from admin_common import ConflictError, NotFoundError, ValidationError, changed_fields, ensure_version, parse_bool, parse_int, raise_if_duplicate, record_version, require_version, text_field
from audit import record
from coins import apply_movement
from database import db_cursor, fetch_all, fetch_one

HARD_LIMIT = 20
FIELDS = ("name", "percent", "pitcoin_cost", "is_active", "display_order", "updated_at")


def max_percent(cursor=None):
    return min(HARD_LIMIT, settings.get("discounts.max_percent", cursor))


def discount_amount(amount, percent, decimals=2):
    quantum = Decimal(1).scaleb(-int(decimals))
    return (Decimal(str(amount)) * Decimal(int(percent)) / Decimal(100)).quantize(quantum, rounding=ROUND_HALF_UP)


def available(coins):
    """Descuentos activos, con el porcentaje que realmente aplica y si el saldo alcanza."""
    limit = max_percent()
    rows = fetch_all("SELECT id, name, percent, pitcoin_cost FROM discount_rewards WHERE is_active = TRUE ORDER BY pitcoin_cost, percent")
    for row in rows:
        row["applied_percent"] = min(int(row["percent"]), limit)
        row["affordable"] = int(coins) >= int(row["pitcoin_cost"])
        row["missing"] = max(0, int(row["pitcoin_cost"]) - int(coins))
    return rows


def lock_reward(cursor, reward_id):
    cursor.execute("SELECT id, name, percent, pitcoin_cost FROM discount_rewards WHERE id = %s AND is_active = TRUE", (reward_id,))
    return cursor.fetchone()


def redeem(cursor, user_id, reward, order_id):
    """Descuenta los PitCoins del canje (dentro de la transacción del pedido)."""
    return apply_movement(cursor, user_id, -int(reward["pitcoin_cost"]), "DISCOUNT_REDEMPTION", f"redeem:order:{order_id}",
                          reason=f"{reward['name']} en el pedido #{order_id}")


def summary(user_id):
    """Perfil: saldo, descuentos canjeables y últimos canjes."""
    user = fetch_one("SELECT coins FROM users WHERE id = %s", (user_id,))
    coins = int(user["coins"]) if user else 0
    history = fetch_all("""SELECT o.id AS order_id, o.created_at, o.discount_percent, o.pitcoins_redeemed, o.discount_local, o.currency_code,
                                  c.symbol, c.locale, c.decimals
                           FROM orders o JOIN currencies c ON c.code = o.currency_code
                           WHERE o.user_id = %s AND o.pitcoins_redeemed > 0 ORDER BY o.id DESC LIMIT 10""", (user_id,))
    return {"coins": coins, "rewards": available(coins), "history": history, "max_percent": max_percent()}


# ---------------------------------------------------------------- panel

def admin_list():
    rows = fetch_all("""SELECT r.id, r.name, r.percent, r.pitcoin_cost, r.is_active, r.display_order, r.updated_at,
                               (SELECT COUNT(*) FROM orders o WHERE o.discount_reward_id = r.id) AS redeemed
                        FROM discount_rewards r ORDER BY r.pitcoin_cost, r.id""")
    for row in rows:
        row["is_active"] = bool(row["is_active"])
        row["version"] = record_version(row, FIELDS)
    return rows


def _validate(data):
    errors = {}
    clean = {"name": text_field(data, "name", errors, 80, required=True, label="El nombre")}
    limit = max_percent()
    try:
        clean["percent"] = parse_int(data.get("percent"), 1, limit, f"El descuento va de 1 a {limit} % (máximo configurado).")
    except ValueError as exc:
        errors["percent"] = str(exc)
    try:
        clean["pitcoin_cost"] = parse_int(data.get("pitcoin_cost"), 1, 1000000, "El costo va de 1 a 1.000.000 PitCoins.")
    except ValueError as exc:
        errors["pitcoin_cost"] = str(exc)
    try:
        clean["display_order"] = parse_int(data.get("display_order") if data.get("display_order") not in (None, "") else 0, 0, 100000, "Orden inválido.")
    except ValueError as exc:
        errors["display_order"] = str(exc)
    try:
        clean["is_active"] = parse_bool(data.get("is_active"), default=True)
    except ValueError as exc:
        errors["is_active"] = str(exc)
    if errors:
        raise ValidationError(errors)
    return clean


def save(reward_id, data, actor_id):
    clean = _validate(data)
    expected = None if reward_id is None else require_version(data)
    columns = ("name", "percent", "pitcoin_cost", "is_active", "display_order")
    try:
        with db_cursor() as (connection, cursor):
            if reward_id is None:
                cursor.execute("""INSERT INTO discount_rewards (name, percent, pitcoin_cost, is_active, display_order, updated_by)
                                  VALUES (%s, %s, %s, %s, %s, %s)""", (*[clean[c] for c in columns], actor_id))
                reward_id = cursor.lastrowid
                record(cursor, actor_id, "DISCOUNT_REWARD_CREATED", "discount_reward", reward_id,
                       {"percent": clean["percent"], "pitcoin_cost": clean["pitcoin_cost"]})
            else:
                cursor.execute("SELECT * FROM discount_rewards WHERE id = %s FOR UPDATE", (reward_id,))
                current = cursor.fetchone()
                if not current:
                    raise NotFoundError("Descuento no encontrado.")
                ensure_version(record_version({**current, "is_active": bool(current["is_active"])}, FIELDS), expected, "este descuento")
                cursor.execute("""UPDATE discount_rewards SET name = %s, percent = %s, pitcoin_cost = %s, is_active = %s, display_order = %s,
                                  updated_by = %s WHERE id = %s""", (*[clean[c] for c in columns], actor_id, reward_id))
                record(cursor, actor_id, "DISCOUNT_REWARD_UPDATED", "discount_reward", reward_id,
                       {"fields": changed_fields(current, clean, columns)})
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        raise_if_duplicate(exc, "Ya existe un descuento con ese porcentaje.")
        raise
    return next(row for row in admin_list() if row["id"] == reward_id)
