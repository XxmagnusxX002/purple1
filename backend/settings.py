"""Parametros administrables (tabla app_settings), editados por el superadministrador
en Configuracion. Si una clave falta, se usa el valor por defecto de PARAMS.

Solo enteros con limites conocidos: no es un sistema generico de configuracion.
"""

from admin_common import ValidationError
from audit import record
from database import db_cursor, fetch_all

# clave: (grupo, etiqueta, ayuda, por defecto, minimo, maximo)
PARAMS = {
    "pitcoins.opening_balance": ("pitcoins", "Saldo inicial de PitCoins", "PitCoins que recibe cada cuenta nueva al registrarse.", 1000, 0, 100000),
    "pitcoins.min_bet": ("pitcoins", "Pronóstico mínimo", "PitCoins mínimos para registrar un pronóstico.", 10, 1, 10000),
    "xp.participation": ("xp", "XP por participar", "Por cada pronóstico liquidado.", 20, 0, 1000),
    "xp.correct": ("xp", "XP por acertar", "Adicional cuando el pronóstico acierta.", 50, 0, 1000),
    "xp.first_settled": ("xp", "XP del primer pronóstico", "Una sola vez, con el primer pronóstico liquidado.", 30, 0, 1000),
    "discounts.max_percent": ("discounts", "Descuento máximo por pedido (%)", "Ningún canje supera este porcentaje. Límite absoluto: 20 %.", 20, 1, 20),
}


def get(key, cursor=None):
    default = PARAMS[key][3]
    sql = "SELECT int_value FROM app_settings WHERE setting_key = %s"
    if cursor is None:
        rows = fetch_all(sql, (key,))
        row = rows[0] if rows else None
    else:
        cursor.execute(sql, (key,))
        row = cursor.fetchone()
    if not row:
        return default
    return int(row["int_value"] if isinstance(row, dict) else row[0])


def admin_list():
    stored = {row["setting_key"]: row for row in fetch_all(
        """SELECT s.setting_key, s.int_value, s.updated_at, u.email AS updated_by_email
           FROM app_settings s LEFT JOIN users u ON u.id = s.updated_by""")}
    items = []
    for key, (group, label, help_text, default, low, high) in PARAMS.items():
        row = stored.get(key) or {}
        items.append({"key": key, "group": group, "label": label, "help": help_text, "value": int(row.get("int_value", default)),
                      "default": default, "min": low, "max": high, "updated_at": row.get("updated_at"),
                      "updated_by_email": row.get("updated_by_email")})
    return items


def save(data, actor_id):
    values = data.get("values") if isinstance(data.get("values"), dict) else {}
    errors, clean = {}, {}
    for key, raw in values.items():
        if key not in PARAMS:
            errors[key] = "Parámetro desconocido."
            continue
        low, high = PARAMS[key][4], PARAMS[key][5]
        try:
            value = int(str(raw).strip())
            if not low <= value <= high:
                raise ValueError
            clean[key] = value
        except (TypeError, ValueError):
            errors[key] = f"Debe ser un número entero entre {low} y {high}."
    if not clean and not errors:
        errors["_general"] = "No hay cambios para guardar."
    if errors:
        raise ValidationError(errors)
    with db_cursor() as (connection, cursor):
        cursor.execute("SELECT setting_key, int_value FROM app_settings FOR UPDATE")
        current = {row["setting_key"]: int(row["int_value"]) for row in cursor.fetchall()}
        changes = {}
        for key, value in clean.items():
            before = current.get(key, PARAMS[key][3])
            if before == value:
                continue
            cursor.execute("""INSERT INTO app_settings (setting_key, int_value, updated_by) VALUES (%s, %s, %s)
                              ON DUPLICATE KEY UPDATE int_value = VALUES(int_value), updated_by = VALUES(updated_by)""",
                           (key, value, actor_id))
            changes[key] = {"from": before, "to": value}
        if changes:
            record(cursor, actor_id, "SETTINGS_UPDATED", "settings", "app", {"changes": changes})
        connection.commit()
    return admin_list()
