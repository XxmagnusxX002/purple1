/* Presentacion comun de pedidos (A6): estados del pedido y del pago. */
(function () {
    "use strict";

    const esc = window.PurpleAdmin.escapeHTML;
    const ORDER = { PENDING: "Pendiente", PAID: "Pagado", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" };
    const PAYMENT = { APPROVED: "Aprobado", PENDING: "Pendiente", REJECTED: "Rechazado" };
    const PAYMENT_TONE = { APPROVED: "paid", PENDING: "pending", REJECTED: "cancelled" };
    const METHOD = { CARD: "Tarjeta (simulada)", PSE: "PSE", NEQUI: "Nequi", DAVIPLATA: "Daviplata", TRANSFER: "Transferencia" };

    const orderPill = status => `<span class="status-pill status-pill--${esc(String(status).toLowerCase())}">${esc(ORDER[status] || status)}</span>`;
    const paymentPill = status => status
        ? `<span class="status-pill status-pill--${PAYMENT_TONE[status] || "pending"}">${esc(PAYMENT[status] || status)}</span>`
        : '<span class="status-pill status-pill--cancelled">Sin pago</span>';

    window.AdminOrders = { ORDER, METHOD, orderPill, paymentPill };
})();
