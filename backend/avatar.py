"""Avatar del perfil.

Cada usuario tiene un avatar que se viste por partes (slots). Las prendas se
consiguen de tres formas:

- gratis: disponibles desde el registro
- por aciertos: se desbloquean solas al acumular pronosticos acertados
- compradas: se pagan una sola vez con PitCoins

El catalogo vive aqui (no en la base de datos) para que agregar una prenda sea
solo sumar una linea a CATALOG. En MySQL se guarda unicamente lo que cambia por
usuario: que tiene puesto (users.avatar_config) y que compro (user_avatar_items).
"""

import json

from database import db_cursor, execute_query, fetch_all, fetch_one
from coins import apply_movement

SLOTS = [
    {"id": "skin", "label": "Piel"},
    {"id": "head", "label": "Cabeza"},
    {"id": "face", "label": "Cara"},
    {"id": "torso", "label": "Torso"},
    {"id": "legs", "label": "Piernas"},
    {"id": "extra", "label": "Accesorio"},
    {"id": "bg", "label": "Fondo"},
]


def _item(item_id, slot, name, style, wins=0, price=0):
    return {"id": item_id, "slot": slot, "name": name, "style": style, "wins": wins, "price": price}


# El primer item gratis de cada slot es el que trae puesto un usuario nuevo.
CATALOG = [
    # Piel (todo gratis)
    _item("skin-1", "skin", "Tono 1", {"color": "#f6d2b5"}),
    _item("skin-2", "skin", "Tono 2", {"color": "#e8b48c"}),
    _item("skin-3", "skin", "Tono 3", {"color": "#c98d62"}),
    _item("skin-4", "skin", "Tono 4", {"color": "#99613f"}),
    _item("skin-5", "skin", "Tono 5", {"color": "#6a4027"}),

    # Cabeza
    _item("head-none", "head", "Sin gorra", {"kind": "none"}),
    _item("head-cap-purple", "head", "Gorra morada", {"kind": "cap", "color": "#7b2cff", "accent": "#ffffff"}),
    _item("head-cap-red", "head", "Gorra roja", {"kind": "cap", "color": "#e02440", "accent": "#ffd166"}, price=150),
    _item("head-cap-papaya", "head", "Gorra papaya", {"kind": "cap", "color": "#ff8a1f", "accent": "#1b1733"}, price=150),
    _item("head-headset", "head", "Audífonos de pit wall", {"kind": "headset", "color": "#1b1733", "accent": "#7b2cff"}, price=300),
    _item("head-helmet", "head", "Casco de piloto", {"kind": "helmet", "color": "#7b2cff", "accent": "#ffffff"}, wins=1),
    _item("head-helmet-chrome", "head", "Casco cromado", {"kind": "helmet", "color": "#c9cfdb", "accent": "#7b2cff"}, wins=3),
    _item("head-helmet-gold", "head", "Casco de campeón", {"kind": "helmet", "color": "#f5b942", "accent": "#1b1733"}, wins=5),

    # Cara
    _item("face-none", "face", "Sin accesorio", {"kind": "none"}),
    _item("face-sunglasses", "face", "Gafas de sol", {"kind": "sunglasses", "color": "#1b1733"}, price=120),
    _item("face-visor", "face", "Visor morado", {"kind": "visor", "color": "#7b2cff", "accent": "#ff5fd2"}, wins=2),

    # Torso
    _item("torso-tee-purple", "torso", "Camiseta Purple1", {"kind": "tee", "color": "#7b2cff", "accent": "#ffffff", "print": "P1"}),
    _item("torso-tee-white", "torso", "Camiseta blanca", {"kind": "tee", "color": "#f4f1fa", "accent": "#7b2cff", "print": "P1"}),
    _item("torso-polo-red", "torso", "Polo de escudería", {"kind": "polo", "color": "#e02440", "accent": "#ffffff"}, price=200),
    _item("torso-hoodie-black", "torso", "Hoodie negro", {"kind": "hoodie", "color": "#221c33", "accent": "#b48cff"}, price=250),
    _item("torso-suit-purple", "torso", "Traje de piloto", {"kind": "suit", "color": "#7b2cff", "accent": "#ffffff"}, wins=1),
    _item("torso-suit-gold", "torso", "Traje de campeón", {"kind": "suit", "color": "#1b1733", "accent": "#f5b942"}, wins=4),

    # Piernas
    _item("legs-jeans", "legs", "Jeans", {"kind": "pants", "color": "#3c4f8c"}),
    _item("legs-black", "legs", "Pantalón negro", {"kind": "pants", "color": "#221c33"}),
    _item("legs-shorts", "legs", "Shorts", {"kind": "shorts", "color": "#4a4560"}, price=100),
    _item("legs-suit-purple", "legs", "Pantalón de piloto", {"kind": "suit", "color": "#7b2cff", "accent": "#ffffff"}, wins=2),
    _item("legs-suit-gold", "legs", "Pantalón de campeón", {"kind": "suit", "color": "#1b1733", "accent": "#f5b942"}, wins=4),

    # Accesorio
    _item("extra-none", "extra", "Sin accesorio", {"kind": "none"}),
    _item("extra-flag", "extra", "Bandera a cuadros", {"kind": "flag"}, price=200),
    _item("extra-medal", "extra", "Medalla", {"kind": "medal", "color": "#f5b942"}, wins=1),
    _item("extra-trophy", "extra", "Trofeo", {"kind": "trophy", "color": "#f5b942"}, wins=3),

    # Fondo
    _item("bg-lilac", "bg", "Lila", {"kind": "plain", "color": "#e9dcff"}),
    _item("bg-white", "bg", "Blanco", {"kind": "plain", "color": "#f6f3fb"}),
    _item("bg-grid", "bg", "Parrilla de salida", {"kind": "grid", "color": "#2b2740"}, price=150),
    _item("bg-night", "bg", "Carrera nocturna", {"kind": "night", "color": "#140b2e"}, price=180),
    _item("bg-podium", "bg", "Podio", {"kind": "podium", "color": "#f5b942"}, wins=2),
]

ITEMS_BY_ID = {item["id"]: item for item in CATALOG}


def _default_equipped():
    equipped = {}
    for item in CATALOG:
        if item["slot"] not in equipped and not item["wins"] and not item["price"]:
            equipped[item["slot"]] = item["id"]
    return equipped


def _count_wins(user_id):
    row = fetch_one("SELECT COUNT(*) AS c FROM bets WHERE user_id = %s AND status = 'WON'", (user_id,))
    return int(row["c"]) if row else 0


def _purchased_ids(user_id):
    rows = fetch_all("SELECT item_id FROM user_avatar_items WHERE user_id = %s", (user_id,))
    return {row["item_id"] for row in rows}


def _is_owned(item, wins, purchased):
    if item["price"]:
        return item["id"] in purchased
    if item["wins"]:
        return wins >= item["wins"]
    return True


def _clean_equipped(raw, wins, purchased):
    """Devuelve una prenda valida por slot: lo guardado si el usuario aun la
    tiene, o la gratis por defecto si no."""
    equipped = _default_equipped()
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raw = {}
    if not isinstance(raw, dict):
        raw = {}
    for slot, item_id in raw.items():
        item = ITEMS_BY_ID.get(item_id)
        if item and item["slot"] == slot and _is_owned(item, wins, purchased):
            equipped[slot] = item_id
    return equipped


def get_avatar(user_id):
    user = fetch_one("SELECT id, coins, avatar_config FROM users WHERE id = %s", (user_id,))
    if not user:
        return None
    wins = _count_wins(user_id)
    purchased = _purchased_ids(user_id)
    items = []
    for item in CATALOG:
        if item["price"]:
            unlock = "buy"
        elif item["wins"]:
            unlock = "wins"
        else:
            unlock = "free"
        items.append({**item, "unlock": unlock, "owned": _is_owned(item, wins, purchased)})
    return {
        "slots": SLOTS,
        "items": items,
        "equipped": _clean_equipped(user.get("avatar_config"), wins, purchased),
        "wins": wins,
        "coins": user["coins"],
    }


def save_avatar(data):
    user_id = int(data.get("user_id") or 0)
    if not user_id:
        return None, "user_id es obligatorio.", 400
    user = fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not user:
        return None, "Usuario no encontrado.", 404
    wanted = data.get("equipped")
    if not isinstance(wanted, dict):
        return None, "Falta la seleccion del avatar.", 400

    wins = _count_wins(user_id)
    purchased = _purchased_ids(user_id)
    for slot, item_id in wanted.items():
        item = ITEMS_BY_ID.get(item_id)
        if not item or item["slot"] != slot:
            return None, "Esa prenda no existe.", 400
        if not _is_owned(item, wins, purchased):
            return None, f"Todavia no tienes \"{item['name']}\".", 403

    equipped = _clean_equipped(wanted, wins, purchased)
    execute_query("UPDATE users SET avatar_config = %s WHERE id = %s", (json.dumps(equipped), user_id))
    return {"success": True, "avatar": get_avatar(user_id)}, None, 200


def buy_avatar_item(data):
    user_id = int(data.get("user_id") or 0)
    item = ITEMS_BY_ID.get(data.get("item_id") or "")
    if not user_id:
        return None, "user_id es obligatorio.", 400
    if not item:
        return None, "Esa prenda no existe.", 404
    if not item["price"]:
        return None, "Esta prenda no se compra: se desbloquea acertando pronosticos.", 400

    error, status = None, 400
    with db_cursor(dictionary=True) as (connection, cursor):
        cursor.execute("SELECT id, coins FROM users WHERE id = %s FOR UPDATE", (user_id,))
        user = cursor.fetchone()
        if not user:
            error, status = "Usuario no encontrado.", 404
        else:
            cursor.execute(
                "SELECT 1 AS owned FROM user_avatar_items WHERE user_id = %s AND item_id = %s",
                (user_id, item["id"]),
            )
            if cursor.fetchone():
                error = "Ya tienes esta prenda."
            elif user["coins"] < item["price"]:
                faltan = item["price"] - user["coins"]
                error = f"Te faltan {faltan} PitCoins para comprar \"{item['name']}\"."
            else:
                cursor.execute(
                    "INSERT INTO user_avatar_items (user_id, item_id) VALUES (%s, %s)",
                    (user_id, item["id"]),
                )
                apply_movement(cursor, user_id, -item["price"], "AVATAR_PURCHASE", f"avatar:{user_id}:{item['id']}")
        connection.rollback() if error else connection.commit()

    if error:
        return None, error, status
    return {"success": True, "avatar": get_avatar(user_id)}, None, 200
