/* Presentacion comun de las pantallas de carreras (A5): estados, fechas del
   circuito y PitCoins. Las reglas viven en el backend (admin_races.py). */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const esc = A.escapeHTML;
    const LABELS = { SCHEDULED: "Programada", OPEN: "Abierta", LOCKED: "Cerrada", FINISHED: "Liquidada", CANCELLED: "Cancelada" };
    const BET_LABELS = { PENDING: "Pendiente", WON: "Acertó", LOST: "No acertó", REFUNDED: "Devuelto" };
    const BET_TONES = { PENDING: "pending", WON: "paid", LOST: "cancelled", REFUNDED: "scheduled" };

    function pill(status) {
        return `<span class="status-pill status-pill--${esc(String(status).toLowerCase())}">${esc(LABELS[status] || status)}</span>`;
    }

    function betPill(status) {
        return `<span class="status-pill status-pill--${BET_TONES[status] || "pending"}">${esc(BET_LABELS[status] || status)}</span>`;
    }

    function localDate(value) {
        if (!value) return "";
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    }

    // Hora local del circuito, tal como la escribio el administrador.
    function when(race) {
        if (!race.local_date) return '<span class="admin-muted">Sin fecha</span>';
        const zone = race.legacy ? "zona sin verificar" : race.circuit_timezone;
        return `${esc(localDate(race.local_date))} · ${esc(race.local_time)}<small>${esc(zone)}</small>`;
    }

    function coins(value) {
        return `${A.formatNumber(value)} <span class="pitcoin-unit">PitCoins</span>`;
    }

    window.AdminRaces = { LABELS, pill, betPill, when, coins, localDate };
})();
