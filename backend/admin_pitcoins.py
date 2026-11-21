"""Consultas paginadas del historial de PitCoins para staff."""

from datetime import datetime, timedelta

from admin_common import ValidationError, like_pattern, parse_int
from database import db_cursor


PER_PAGE = 30
KINDS = {"OPENING_BALANCE", "BET_STAKE", "BET_ADJUSTMENT", "BET_PRIZE", "BET_REFUND",
         "AVATAR_PURCHASE", "STAFF_ADJUSTMENT", "LEVEL_REWARD", "DISCOUNT_REDEMPTION"}


def list_movements(params):
    try:
        page = parse_int(params.get("page", ["1"])[0], 1, 10000, "Página inválida.")
        user_id = params.get("user", [""])[0]
        user_id = parse_int(user_id, 1, 2147483647, "Usuario inválido.") if user_id else None
    except ValueError as exc:
        raise ValidationError({}, str(exc)) from exc
    kind = (params.get("kind", [""])[0] or "").strip().upper()
    if kind and kind not in KINDS:
        raise ValidationError({}, "Tipo de movimiento inválido.")
    where, values = [], []
    term = (params.get("q", [""])[0] or "").strip()[:100]
    if term:
        where.append("(CONCAT_WS(' ', u.first_name, u.last_name) LIKE %s OR u.email LIKE %s OR u.username LIKE %s)")
        values += [like_pattern(term)] * 3
    direction = (params.get("direction", [""])[0] or "").strip()
    if direction == "in":
        where.append("m.amount > 0")
    elif direction == "out":
        where.append("m.amount < 0")
    elif direction:
        raise ValidationError({}, "Filtro de importe inválido.")
    if user_id:
        where.append("m.user_id = %s")
        values.append(user_id)
    if kind:
        where.append("m.kind = %s")
        values.append(kind)
    for key, operator in (("from", ">="), ("to", "<")):
        value = (params.get(key, [""])[0] or "").strip()
        if not value:
            continue
        try:
            date = datetime.strptime(value, "%Y-%m-%d")
            if date.strftime("%Y-%m-%d") != value:
                raise ValueError
        except ValueError as exc:
            raise ValidationError({key: "Fecha inválida (AAAA-MM-DD)."}) from exc
        where.append(f"m.created_at {operator} %s")
        values.append(date + timedelta(days=1) if key == "to" else date)
    clause = " AND ".join(where) or "TRUE"
    with db_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS total FROM pitcoin_movements m JOIN users u ON u.id = m.user_id WHERE {clause}", tuple(values))
        total = int(cursor.fetchone()["total"])
        pages = max(1, -(-total // PER_PAGE))
        page = min(page, pages)
        cursor.execute(f"""SELECT m.id, m.user_id, u.username, u.email, u.first_name, u.last_name, m.amount, m.balance_after, m.kind,
                               m.reference, m.actor_user_id, a.email AS actor_email, m.reason, m.created_at
                           FROM pitcoin_movements m JOIN users u ON u.id = m.user_id LEFT JOIN users a ON a.id = m.actor_user_id
                           WHERE {clause} ORDER BY m.id DESC LIMIT %s OFFSET %s""",
                       (*values, PER_PAGE, (page - 1) * PER_PAGE))
        movements = cursor.fetchall()
    return {"movements": movements, "total": total, "page": page, "pages": pages}
