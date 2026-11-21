"""Monedas y conversion. Los precios se guardan en EUR (moneda base); las tasas
(unidades por 1 EUR) estan en la tabla currencies y las edita el superadministrador.

Regla unica de conversion (backend y tienda usan la misma):
    importe_local = redondear(importe_EUR * tasa, decimales de la moneda)
En un pedido se convierte el precio UNITARIO y la linea es unitario_local * cantidad,
asi el total local es exactamente la suma de lo que el cliente vio en cada linea.
"""

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from admin_common import ConflictError, NotFoundError, ValidationError, changed_fields, ensure_version, parse_bool, parse_int, raise_if_duplicate, record_version, require_version, text_field
from audit import record
from database import db_cursor, fetch_all, fetch_one

BASE = "EUR"
CODE = re.compile(r"[A-Z]{3}")
FIELDS = ("code", "name", "symbol", "locale", "decimals", "rate_per_eur", "is_active", "display_order", "updated_at")
LOCALE = re.compile(r"[a-z]{2}(-[A-Z]{2})?")
PUBLIC_COLUMNS = "code, name, symbol, locale, decimals, rate_per_eur"


def to_local(amount_eur, currency):
    quantum = Decimal(1).scaleb(-int(currency["decimals"]))
    return (Decimal(str(amount_eur)) * Decimal(str(currency["rate_per_eur"]))).quantize(quantum, rounding=ROUND_HALF_UP)


def public_list():
    return fetch_all(f"SELECT {PUBLIC_COLUMNS} FROM currencies WHERE is_active = TRUE ORDER BY display_order, code")


def get_active(code, cursor=None):
    """Moneda activa por codigo (o None). Con cursor, dentro de la transaccion del llamador."""
    code = str(code or BASE).strip().upper()
    if not CODE.fullmatch(code):
        return None
    sql = f"SELECT {PUBLIC_COLUMNS} FROM currencies WHERE code = %s AND is_active = TRUE"
    if cursor is None:
        return fetch_one(sql, (code,))
    cursor.execute(sql, (code,))
    return cursor.fetchone()


# ---------------------------------------------------------------- panel

def admin_list():
    with db_cursor() as (_, cursor):
        cursor.execute("""SELECT c.code, c.name, c.symbol, c.locale, c.decimals, c.rate_per_eur, c.is_active, c.display_order,
                                 c.updated_at, u.email AS updated_by_email,
                                 (SELECT COUNT(*) FROM orders o WHERE o.currency_code = c.code) AS orders
                          FROM currencies c LEFT JOIN users u ON u.id = c.updated_by ORDER BY c.display_order, c.code""")
        rows = cursor.fetchall()
    for row in rows:
        row["is_active"] = bool(row["is_active"])
        row["id"] = row["code"]
        row["version"] = record_version(row, FIELDS)
    return rows


def _validate(data, code):
    errors = {}
    clean = {
        "name": text_field(data, "name", errors, 60, required=True, label="El nombre"),
        "symbol": text_field(data, "symbol", errors, 8, required=True, label="El símbolo"),
        "locale": text_field(data, "locale", errors, 10, required=True, label="El formato regional"),
    }
    if clean["locale"] and not LOCALE.fullmatch(clean["locale"]):
        errors["locale"] = "Usa un formato como es-CO o en-US."
    try:
        clean["decimals"] = parse_int(data.get("decimals"), 0, 4, "Decimales entre 0 y 4.")
    except ValueError as exc:
        errors["decimals"] = str(exc)
    try:
        clean["display_order"] = parse_int(data.get("display_order") if data.get("display_order") not in (None, "") else 0, 0, 100000, "Orden inválido.")
    except ValueError as exc:
        errors["display_order"] = str(exc)
    try:
        rate = Decimal(str(data.get("rate_per_eur")).replace(",", "."))
        if not rate.is_finite() or rate <= 0 or rate > Decimal("9999999999") or rate.as_tuple().exponent < -6:
            raise InvalidOperation
        clean["rate_per_eur"] = rate
    except (InvalidOperation, ValueError):
        errors["rate_per_eur"] = "Tasa inválida: número mayor que 0 con hasta 6 decimales."
    try:
        clean["is_active"] = parse_bool(data.get("is_active"), default=True)
    except ValueError as exc:
        errors["is_active"] = str(exc)
    if code == BASE and not errors:
        if clean["rate_per_eur"] != 1 or not clean["is_active"]:
            errors["rate_per_eur"] = "EUR es la moneda base: su tasa es 1 y siempre está activa."
    if errors:
        raise ValidationError(errors)
    return clean


def save(code, data, actor_id, creating=False):
    code = str(code or data.get("code") or "").strip().upper()
    if not CODE.fullmatch(code):
        raise ValidationError({"code": "El código son 3 letras (ISO 4217), por ejemplo COP."})
    clean = _validate(data, code)
    expected = None if creating else require_version(data)
    try:
        with db_cursor() as (connection, cursor):
            if creating:
                cursor.execute("""INSERT INTO currencies (code, name, symbol, locale, decimals, rate_per_eur, is_active, display_order, updated_by)
                                  VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                               (code, clean["name"], clean["symbol"], clean["locale"], clean["decimals"], clean["rate_per_eur"],
                                clean["is_active"], clean["display_order"], actor_id))
                record(cursor, actor_id, "CURRENCY_CREATED", "currency", code, {"rate_per_eur": clean["rate_per_eur"]})
            else:
                cursor.execute("SELECT * FROM currencies WHERE code = %s FOR UPDATE", (code,))
                current = cursor.fetchone()
                if not current:
                    raise NotFoundError("Moneda no encontrada.")
                ensure_version(record_version({**current, "is_active": bool(current["is_active"])}, FIELDS), expected, "esta moneda")
                cursor.execute("""UPDATE currencies SET name = %s, symbol = %s, locale = %s, decimals = %s, rate_per_eur = %s,
                                  is_active = %s, display_order = %s, updated_by = %s WHERE code = %s""",
                               (clean["name"], clean["symbol"], clean["locale"], clean["decimals"], clean["rate_per_eur"],
                                clean["is_active"], clean["display_order"], actor_id, code))
                details = {"fields": changed_fields(current, clean, ("name", "symbol", "locale", "decimals", "rate_per_eur", "is_active", "display_order"))}
                if Decimal(str(current["rate_per_eur"])) != clean["rate_per_eur"]:
                    details.update({"rate_from": current["rate_per_eur"], "rate_to": clean["rate_per_eur"]})
                record(cursor, actor_id, "CURRENCY_UPDATED", "currency", code, details)
            connection.commit()
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, (ValidationError, ConflictError, NotFoundError)):
            raise
        raise_if_duplicate(exc, "Ya existe una moneda con ese código.")
        raise
    return next(row for row in admin_list() if row["code"] == code)
