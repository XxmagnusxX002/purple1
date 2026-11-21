/* Mis pedidos: historial del cliente (GET /api/orders).
 * Cada pedido muestra los importes ORIGINALES con que se pagó: moneda, tasa y
 * valores guardados en el pedido. No se recalculan con la tasa actual. */
document.addEventListener("DOMContentLoaded", async () => {
    const list = document.querySelector("#orders-list");
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const STATUS = { PENDING: ["Pendiente", "pending"], PAID: ["Pagado", "paid"], SHIPPED: ["Enviado", "shipped"], DELIVERED: ["Entregado", "delivered"], CANCELLED: ["Cancelado", "cancelled"] };

    function money(amount, order) {
        return window.Purple1Currency.formatLocal(amount, { symbol: order.symbol, locale: order.locale, decimals: order.decimals });
    }

    function orderCard(order) {
        const [label, tone] = STATUS[order.status] || [order.status, "pending"];
        const date = new Date(String(order.created_at).replace(" ", "T")).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
        const rate = order.currency_code === "EUR" ? ""
            : `<p class="order-card__rate">Pagado en ${esc(order.currency_code)} · tasa de la compra: 1 EUR = ${Number(order.exchange_rate).toLocaleString(order.locale, { maximumFractionDigits: 6 })} ${esc(order.currency_code)}</p>`;
        const lines = order.items.map((item) => {
            const variant = [item.size_name && `Talla ${item.size_name}`, item.color_name].filter(Boolean).join(" · ");
            const name = item.product_id ? `<a href="product_detail.html?id=${item.product_id}">${esc(item.product_name)}</a>` : esc(item.product_name);
            return `<li><span><strong>${name}</strong><small>${variant ? `${esc(variant)} · ` : ""}${item.quantity} × ${money(item.unit_price_local, order)}</small></span><span>${money(item.subtotal_local, order)}</span></li>`;
        }).join("");
        return `<article class="order-card surface-card">
            <header class="order-card__head">
                <div><h2>Pedido #${order.id}</h2><p>${esc(date)}</p></div>
                <span class="order-card__status order-card__status--${tone}">${esc(label)}</span>
            </header>
            <ul class="order-card__lines">${lines || '<li class="order-card__empty">Sin productos registrados.</li>'}</ul>
            <footer class="order-card__foot">
                <dl>
                    <div><dt>Subtotal</dt><dd>${money(order.subtotal_local, order)}</dd></div>
                    ${Number(order.discount_local) ? `<div><dt>Descuento ${order.discount_percent} %${order.pitcoins_redeemed ? ` · ${Number(order.pitcoins_redeemed).toLocaleString("es-CO")} PitCoins` : ""}</dt><dd>−${money(order.discount_local, order)}</dd></div>` : ""}
                    <div><dt>Envío</dt><dd>${Number(order.shipping_local) ? money(order.shipping_local, order) : "Gratis"}</dd></div>
                    <div class="order-card__total"><dt>Total</dt><dd>${money(order.total_local, order)}</dd></div>
                </dl>
                ${rate}
            </footer>
        </article>`;
    }

    function empty(icon, title, text, action) {
        list.innerHTML = `<div class="cart-empty surface-card"><span class="cart-empty__icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
            <h3>${title}</h3><p>${text}</p>${action}</div>`;
    }

    try {
        const response = await fetch("/api/orders");
        if (response.status === 401) {
            empty("fa-user", "Inicia sesión", "Necesitas una cuenta para ver tus pedidos.", '<a href="auth.html" class="btn-primary">Iniciar sesión</a>');
            return;
        }
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "No fue posible cargar tus pedidos.");
        if (!data.orders.length) {
            empty("fa-receipt", "Aún no tienes pedidos", "Cuando compres algo aparecerá aquí con su detalle.", '<a href="products.html" class="btn-primary">Ir a la tienda</a>');
            return;
        }
        list.innerHTML = data.orders.map(orderCard).join("");
    } catch (error) {
        empty("fa-triangle-exclamation", "No pudimos cargar tus pedidos", esc(error.message), '<button type="button" class="btn-primary" onclick="location.reload()">Reintentar</button>');
    }
});
