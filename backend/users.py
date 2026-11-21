from database import execute_query, fetch_all, fetch_one


def get_user(user_id):
    return fetch_one(
        "SELECT id, username, email, first_name, last_name, phone, address, is_staff, coins, created_at FROM users WHERE id = %s",
        (user_id,),
    )


# Longitudes de las columnas en database/schema.sql.
MAX_LENGTHS = {"first_name": 100, "last_name": 100, "phone": 10, "address": 200}
LABELS = {"first_name": "nombre", "last_name": "apellido", "phone": "telefono", "address": "direccion"}


def _text(value):
    return value.strip() if isinstance(value, str) else ""


def update_user(user_id, data):
    """Actualiza solo los campos enviados; los ausentes conservan su valor."""
    user = fetch_one("SELECT first_name, last_name, phone, address FROM users WHERE id = %s", (user_id,))
    if not user:
        return None, "Usuario no encontrado.", 404
    values = {field: user[field] or "" for field in MAX_LENGTHS}
    for field in MAX_LENGTHS:
        if field in data:
            values[field] = _text(data[field])
    # Nombre y apellido son obligatorios en el registro: no se pueden vaciar.
    for field in ("first_name", "last_name"):
        if not values[field]:
            values[field] = user[field] or ""
    for field, limit in MAX_LENGTHS.items():
        if len(values[field]) > limit:
            return None, f"El campo {LABELS[field]} admite maximo {limit} caracteres.", 400
    if values["phone"] and not values["phone"].isdigit():
        return None, "El teléfono solo puede contener números.", 400
    execute_query(
        "UPDATE users SET first_name = %s, last_name = %s, phone = %s, address = %s WHERE id = %s",
        (values["first_name"], values["last_name"], values["phone"], values["address"], user_id),
    )
    return {"success": True, "user": get_user(user_id)}, None, 200


def list_users():
    return fetch_all(
        "SELECT id, username, email, first_name, last_name, phone, address, is_staff, is_active, coins, created_at FROM users ORDER BY created_at DESC"
    )


def delete_user(user_id):
    user = fetch_one("SELECT id FROM users WHERE id = %s", (user_id,))
    if not user:
        return False
    execute_query("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
    return True
