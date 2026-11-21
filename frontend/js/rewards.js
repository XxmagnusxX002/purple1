/* Perfil › Canjea tus PitCoins (GET /api/rewards): saldo, descuentos que se
 * pueden canjear en el carrito y últimos canjes. El canje se hace al pagar:
 * no hay cupones que comprar antes. Proyecto académico: los PitCoins no se
 * compran, no se retiran y no se convierten en dinero. */
document.addEventListener("DOMContentLoaded", async () => {
    const box = document.querySelector("#pf-rewards");
    if (!box) return;
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const coins = (value) => Number(value).toLocaleString("es-CO");
    const date = (value) => new Date(String(value).replace(" ", "T")).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
    const money = (row) => `${row.symbol} ${Number(row.discount_local).toLocaleString(row.locale, { minimumFractionDigits: row.decimals, maximumFractionDigits: row.decimals })}`;

    function reward(item, balance) {
        const pct = Math.min(100, Math.round((balance / item.pitcoin_cost) * 100));
        return `<li class="pf-goal${item.affordable ? " is-ready" : ""}">
            <div class="pf-goal__top"><strong><span class="pf-coupon__percent pf-coupon__percent--sm">${item.applied_percent}<small>%</small></span> ${esc(item.name)}</strong>
                <span class="pf-goal__reward"><i class="fa-solid fa-coins" aria-hidden="true"></i> ${coins(item.pitcoin_cost)}</span></div>
            <div class="pf-bar" role="progressbar" aria-label="Progreso hacia ${esc(item.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
            <p class="pf-goal__count">${item.affordable ? '<a href="cart.html">Disponible: elígelo en el carrito</a>' : `Te faltan ${coins(item.missing)} PitCoins`}</p>
        </li>`;
    }

    function history(row) {
        return `<li class="pf-coupon is-used">
            <span class="pf-coupon__percent">${row.discount_percent}<small>%</small></span>
            <span class="pf-coupon__text"><strong>Pedido #${row.order_id} · −${money(row)}</strong>
                <small>${date(row.created_at)} · ${coins(row.pitcoins_redeemed)} PitCoins canjeados</small></span>
        </li>`;
    }

    try {
        const response = await fetch("/api/rewards");
        if (response.status === 401) { box.closest(".pf-rewards").hidden = true; return; }
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "No se pudieron cargar.");
        const r = data.rewards;
        box.innerHTML = `
            <div class="pf-rewards__col">
                <h3>Descuentos disponibles · tienes ${coins(r.coins)} PitCoins</h3>
                ${r.rewards.length ? `<ul class="pf-goals">${r.rewards.map((item) => reward(item, r.coins)).join("")}</ul>`
                    : '<p class="pf-empty"><i class="fa-solid fa-coins" aria-hidden="true"></i>Por ahora no hay descuentos activos.</p>'}
            </div>
            <div class="pf-rewards__col">
                <h3>Últimos canjes</h3>
                ${r.history.length ? `<ul class="pf-coupons">${r.history.map(history).join("")}</ul>`
                    : '<p class="pf-empty"><i class="fa-solid fa-ticket" aria-hidden="true"></i>Aún no has canjeado PitCoins. Elige un descuento al pagar tu carrito.</p>'}
                <p class="pf-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>Un descuento por compra, máximo ${r.max_percent} %, solo sobre productos.
                    Los PitCoins se descuentan únicamente si el pago se aprueba. Son simulados: no se compran, no se retiran y no se convierten en dinero.</p>
            </div>`;
    } catch (error) {
        box.innerHTML = `<p class="pf-muted">No pudimos cargar tus recompensas: ${esc(error.message)}</p>`;
    }
});
