import re
import secrets
from datetime import datetime

from orders import create_order

CARD_BRANDS = (
    ("4", "Visa"),
    ("2", "Mastercard"),
    ("5", "Mastercard"),
    ("3", "American Express"),
)


def _detect_brand(digits):
    for prefix, brand in CARD_BRANDS:
        if digits.startswith(prefix):
            return brand
    return "Tarjeta"


def _validate_card(data):
    """Simulador pensado para un prototipo/proyecto academico: NO valida que la
    tarjeta sea real ni corre el algoritmo de Luhn. Simplemente revisa que
    cada campo este completo y con el formato que tendria una tarjeta de
    verdad. Si algo falta o esta mal escrito, el pago se rechaza; si todo
    esta bien diligenciado, se aprueba. Ningun dato de tarjeta se guarda en
    la base de datos, ni siquiera cuando el pago es aprobado."""
    card_holder = (data.get("card_holder") or "").strip()
    card_number = "".join(ch for ch in str(data.get("card_number") or "") if ch.isdigit())
    expiry = (data.get("card_expiry") or "").strip()
    cvv = "".join(ch for ch in str(data.get("card_cvv") or "") if ch.isdigit())

    if not card_holder or len(card_holder) < 3:
        return False, "Falta el nombre del titular.", {"card_number": card_number}

    if len(card_number) < 13 or len(card_number) > 19:
        return False, "El numero de tarjeta esta incompleto.", {"card_number": card_number}

    match = re.fullmatch(r"(\d{2})/(\d{2})", expiry)
    if not match:
        return False, "La fecha de vencimiento debe tener el formato MM/AA.", {"card_number": card_number}
    month, year = int(match.group(1)), int(match.group(2))
    if month < 1 or month > 12:
        return False, "El mes de vencimiento no es valido.", {"card_number": card_number}
    now = datetime.now()
    card_year = 2000 + year
    if (card_year, month) < (now.year, now.month):
        return False, "La tarjeta esta vencida.", {"card_number": card_number}

    if len(cvv) < 3 or len(cvv) > 4:
        return False, "El CVV debe tener 3 o 4 digitos.", {"card_number": card_number}

    return True, None, {"card_number": card_number, "card_holder": card_holder}


def simulate_payment(data):
    valid, reason, parsed = _validate_card(data)
    if not valid:
        return {"success": True, "approved": False, "reason": reason,
                "payment_status": "REJECTED", "order": None}, None, 200
    reference = f"SIM-{secrets.token_hex(12).upper()}"
    order_payload, error, status = create_order(data, payment_reference=reference)
    if error:
        return None, error, status
    order = order_payload["order"]
    card_number = parsed.get("card_number", "")
    card_last4 = card_number[-4:]
    card_brand = _detect_brand(card_number)
    return {
        "success": True,
        "approved": True,
        "reason": None,
        "payment_status": "APPROVED",
        "card_brand": card_brand,
        "pitcoins_balance": order_payload.get("pitcoins_balance"),
        "card_last4": card_last4,
        "reference": reference,
        "order": order,
    }, None, 201
