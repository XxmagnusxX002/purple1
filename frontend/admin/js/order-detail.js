/* Detalle de un pedido (fase A6, solo consulta): productos, importes en EUR,
   comprador, pagos simulados y stock actual de cada variante comprada. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const O = window.AdminOrders;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const orderId = Number(new URLSearchParams(window.location.search).get("id")) || null;

    function showAlert(message, retry) {
        $("#order-loading").hidden = true;
        $("#order-alert-text").textContent = message;
        $("#order-retry").hidden = !retry;
        $("#order-alert").hidden = false;
    }

    function stockCell(item, threshold) {
        if (item.stock === null || item.stock === undefined) return '<span class="admin-muted">—</span>';
        const notes = [];
        if (!item.variant_active) notes.push("variante inactiva");
        if (item.product_active === false) notes.push("producto inactivo");
        const badge = item.stock === 0 ? '<span class="stock-badge stock-badge--out">Agotado</span>'
            : item.low_stock ? `<span class="stock-badge stock-badge--out">${A.formatNumber(item.stock)} · bajo</span>` : A.formatNumber(item.stock);
        return `${badge}${notes.length ? `<small>${esc(notes.join(" · "))}</small>` : ""}${item.low_stock ? `<small>≤ ${threshold} unidades</small>` : ""}`;
    }

    function itemRow(item, threshold) {
        const variant = [item.size_name, item.color_name].filter(Boolean).join(" · ") || "Variante única";
        const name = item.product_id ? `<a href="product.html?id=${item.product_id}"><strong>${esc(item.product_name)}</strong></a>` : `<strong>${esc(item.product_name)}</strong>`;
        return `<article class="order-item">
            <div class="order-item__main">${A.thumb(item.image_path, 56)}<div>${name}<small>${esc(variant)} · ${esc(item.sku || "")}</small></div></div>
            <dl class="order-item__facts"><div><dt>Precio</dt><dd>${A.formatMoney(item.unit_price)}</dd></div>
                <div><dt>Cantidad</dt><dd>${A.formatNumber(item.quantity)}</dd></div>
                <div><dt>Subtotal</dt><dd><strong>${A.formatMoney(item.subtotal)}</strong></dd></div>
                <div><dt>Stock actual</dt><dd>${stockCell(item, threshold)}</dd></div></dl>
        </article>`;
    }

    function fact(label, value) {
        return `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
    }

    function render(order) {
        const title = `Pedido #${order.id}`;
        $("#admin-title").textContent = title;
        document.title = `${title} | Purple One Admin`;
        $("#order-number").textContent = `#${order.id}`;
        $("#order-meta").textContent = `${A.formatDateTime(order.created_at)} · ${A.formatNumber(order.units)} ${order.units === 1 ? "unidad" : "unidades"}`;
        const latest = order.payments[order.payments.length - 1];
        $("#order-pills").innerHTML = `${O.orderPill(order.status)} ${O.paymentPill(latest?.status)}${order.is_sale ? "" : ' <span class="status-pill status-pill--cancelled">No cuenta como venta</span>'}`;

        $("#items-help").textContent = "Precio y nombre tal como se compraron; el stock es el actual de cada variante.";
        $("#items-body").innerHTML = order.items.map(item => itemRow(item, order.low_stock_threshold)).join("")
            || '<p class="admin-empty">Este pedido no tiene productos registrados.</p>';
        const a = order.amounts;
        $("#order-amounts").innerHTML = [
            fact("Subtotal", A.formatMoney(a.subtotal)),
            fact(a.pitcoins_redeemed ? `Descuento ${a.discount_percent} % (canje de ${A.formatNumber(a.pitcoins_redeemed)} PitCoins)` : "Descuento",
                Number(a.discount) ? `− ${A.formatMoney(a.discount)}` : A.formatMoney(0)),
            fact("Envío", A.formatMoney(a.shipping_cost)),
            `<div class="order-amounts__total"><dt>Total (${esc(order.currency)})</dt><dd>${A.formatMoney(a.total)}</dd></div>`,
            order.paid && order.paid.currency_code !== order.currency
                ? fact(`Pagado por el cliente (${esc(order.paid.currency_code)})`,
                    `${esc(order.paid.symbol)} ${Number(order.paid.total_local).toLocaleString(order.paid.locale, { minimumFractionDigits: order.paid.decimals, maximumFractionDigits: order.paid.decimals })}<small>Tasa: ${Number(order.paid.exchange_rate).toLocaleString("es-CO", { maximumFractionDigits: 6 })} ${esc(order.paid.currency_code)} por 1 EUR</small>`)
                : "",
        ].join("");

        const c = order.customer;
        $("#customer-facts").innerHTML = [
            fact("Nombre", `${esc(c.name || "—")}${c.is_active ? "" : ' <span class="status-pill status-pill--cancelled">Cuenta inactiva</span>'}`),
            fact("Usuario", `@${esc(c.username)}`),
            fact("Correo", c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : "—"),
            fact("Teléfono", esc(c.phone || "—")),
            fact("Dirección de envío", esc(order.shipping_address || "Sin dirección registrada")),
            fact("Historial", `${A.formatNumber(c.sales)} ${c.sales === 1 ? "compra" : "compras"} · ${A.formatMoney(c.spent)}<small>${A.formatNumber(c.orders)} pedidos en total</small>`),
        ].join("");

        $("#payments-list").innerHTML = order.payments.length ? order.payments.map(payment => `
            <li><span class="admin-list__main"><strong>${esc(O.METHOD[payment.method] || payment.method)} · ${A.formatMoney(payment.amount)}</strong>
                <small>${esc(payment.reference || "Sin referencia")} · ${esc(A.formatDateTime(payment.created_at))}</small></span>
                <span class="admin-list__side">${O.paymentPill(payment.status)}</span></li>`).join("")
            : `<li><p class="admin-empty">Sin pagos registrados. Es un pedido histórico sin pago aprobado.</p></li>`;

        $("#order-loading").hidden = true;
        $("#order-view").hidden = false;
    }

    async function init() {
        if (!orderId) return showAlert("Falta el número de pedido. Vuelve al listado y elige uno.", false);
        try {
            render((await A.api(`/api/admin/orders/${orderId}`)).order);
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            showAlert(error.status === 404 ? "Ese pedido no existe." : `No se pudo cargar el pedido: ${error.message}`, error.status !== 404);
        }
    }

    $("#order-retry").addEventListener("click", () => {
        $("#order-alert").hidden = true;
        $("#order-loading").hidden = false;
        init();
    });
    A.ready.then(init, () => {});
})();
