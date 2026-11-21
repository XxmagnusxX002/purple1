"""Registro de acciones administrativas (tabla admin_audit_log, migracion 006).

record() recibe el cursor de la transaccion de la accion: si la accion se
deshace, su registro tambien. Nunca guarda contrasenas, tokens ni datos de pago.
"""

import json
import re

ACTION_PATTERN = re.compile(r"[A-Z][A-Z0-9_]{0,59}")
ENTITY_PATTERN = re.compile(r"[a-z][a-z0-9_]{0,39}")
SENSITIVE_KEYS = ("password", "token", "secret", "card", "cvv", "hash", "cookie", "session")
MAX_DETAILS_LENGTH = 4000


def _check_details(value, path="details"):
    if isinstance(value, dict):
        for key, item in value.items():
            name = str(key).lower()
            if any(word in name for word in SENSITIVE_KEYS):
                raise ValueError(f"La auditoria no admite el dato sensible '{path}.{key}'.")
            _check_details(item, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _check_details(item, f"{path}[{index}]")


def record(cursor, actor_user_id, action, entity, entity_id=None, details=None):
    if not isinstance(actor_user_id, int) or isinstance(actor_user_id, bool) or actor_user_id < 1:
        raise ValueError("La auditoria requiere el usuario que realiza la accion.")
    if not ACTION_PATTERN.fullmatch(action or ""):
        raise ValueError("Accion de auditoria invalida.")
    if not ENTITY_PATTERN.fullmatch(entity or ""):
        raise ValueError("Entidad de auditoria invalida.")
    text = None
    if details is not None:
        _check_details(details)
        text = json.dumps(details, ensure_ascii=False, default=str, sort_keys=True)
        if len(text) > MAX_DETAILS_LENGTH:
            raise ValueError("El detalle de auditoria es demasiado largo.")
    cursor.execute(
        """INSERT INTO admin_audit_log (actor_user_id, action, entity, entity_id, details)
           VALUES (%s, %s, %s, %s, %s)""",
        (actor_user_id, action, entity, None if entity_id is None else str(entity_id)[:64], text),
    )
