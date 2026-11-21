/* Dashboard administrativo (fase A2, solo lectura).
   Ingresos = dinero en EUR de pagos aprobados. PitCoins = moneda virtual de los
   pronosticos: se muestran en su propia seccion y nunca se mezclan con euros. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;

    const ORDER_LABELS = { PENDING: "Pendiente", PAID: "Pagado", SHIPPED: "Enviado", DELIVERED: "Entregado", CANCELLED: "Cancelado" };
    const RACE_LABELS = { SCHEDULED: "Programadas", OPEN: "Abiertas", LOCKED: "Cerradas", FINISHED: "Liquidadas", CANCELLED: "Canceladas" };

    let salesGroup = "day";
    let salesRequest = 0;

    function pitcoins(value) {
        return `${A.formatNumber(value)} <span class="pitcoin-unit"><i class="fa-solid fa-coins" aria-hidden="true"></i>PC</span>`;
    }

    function empty(message) {
        return `<p class="admin-empty">${esc(message)}</p>`;
    }

    function statusPill(status, labels) {
        return `<span class="status-pill status-pill--${esc(String(status).toLowerCase())}">${esc(labels[status] || status)}</span>`;
    }

    function renderKpis(data) {
        $("#kpi-users").textContent = A.formatNumber(data.users.active);
        $("#kpi-users-foot").textContent = `${A.formatNumber(data.users.new_recent)} nuevos en ${data.users.recent_days} días`;
        $("#kpi-orders").textContent = A.formatNumber(data.orders.sales);
        $("#kpi-orders-foot").textContent = `${A.formatNumber(data.orders.total)} pedidos registrados en total`;
        $("#kpi-revenue").textContent = A.formatMoney(data.revenue.approved_total);
        $("#kpi-revenue-foot").textContent = `${A.formatMoney(data.revenue.approved_recent)} en los últimos ${data.revenue.recent_days} días`;
        $("#kpi-units").textContent = A.formatNumber(data.units_sold);
    }

    function renderOrderStatus(orders) {
        const max = Math.max(1, ...Object.values(orders.by_status));
        const rows = Object.entries(orders.by_status).map(([status, count]) => `
            <li><span>${esc(ORDER_LABELS[status] || status)}</span>
                <span class="status-bars__track" aria-hidden="true"><span class="status-bars__fill" style="width:${Math.round(count / max * 100)}%"></span></span>
                <span class="status-bars__value">${A.formatNumber(count)}</span></li>`).join("");
        const unpaid = orders.unpaid_pending
            ? `<p class="money-note">${A.formatNumber(orders.unpaid_pending)} pedidos pendientes sin pago aprobado (históricos, no cuentan como compras).</p>` : "";
        $("#order-status").innerHTML = orders.total
            ? `<ul class="status-bars">${rows}</ul>${unpaid}`
            : empty("Aún no hay pedidos registrados.");
    }

    function renderTopProducts(items) {
        $("#top-products").innerHTML = items.length
            ? `<ol class="admin-list">${items.map((item, index) => `
                <li><span class="admin-list__main"><strong>${index + 1}. ${esc(item.name)}</strong><small>${A.formatMoney(item.revenue)} en ventas</small></span>
                    <span class="admin-list__side">${A.formatNumber(item.units)}<small>uds.</small></span></li>`).join("")}</ol>`
            : empty("Todavía no hay compras aprobadas.");
    }

    function renderLowStock(low) {
        $("#stock-subtitle").textContent = `${A.formatNumber(low.count)} variantes con ${low.threshold} unidades o menos`;
        $("#low-stock").innerHTML = low.items.length
            ? `<ul class="admin-list">${low.items.map(item => {
                const variant = [item.size, item.color].filter(Boolean).join(" · ") || "Variante única";
                return `<li><span class="admin-list__main"><strong>${esc(item.name)}</strong><small>${esc(variant)} · ${esc(item.sku)}</small></span>
                    <span class="admin-list__side stock-low">${A.formatNumber(item.stock)}<small>en stock</small></span></li>`;
            }).join("")}</ul>`
            : empty("No hay variantes con poco inventario.");
    }

    function renderRecentOrders(orders) {
        $("#recent-orders").innerHTML = orders.length
            ? `<ul class="admin-list">${orders.map(order => `
                <li><span class="admin-list__main"><strong><a href="order.html?id=${esc(order.id)}">#${esc(order.id)} · ${esc(order.customer || "Cliente")}</a></strong><small>${esc(A.formatDateTime(order.created_at))}</small></span>
                    <span class="admin-list__side">${A.formatMoney(order.total)}<small>${statusPill(order.status, ORDER_LABELS)}</small></span></li>`).join("")}</ul>`
            : empty("Aún no hay pedidos.");
    }

    function renderPredictions(p) {
        const races = Object.entries(p.races_by_status).filter(([, count]) => count > 0)
            .map(([status, count]) => `${statusPill(status, RACE_LABELS)} ${A.formatNumber(count)}`).join(" &nbsp; ");
        $("#predictions").innerHTML = `
            <div class="mini-stats">
                <div class="mini-stat"><span>PitCoins en juego</span><strong>${pitcoins(p.pitcoins_in_play)}</strong></div>
                <div class="mini-stat"><span>PitCoins apostados (total)</span><strong>${pitcoins(p.pitcoins_staked_total)}</strong></div>
                <div class="mini-stat"><span>Participantes</span><strong>${A.formatNumber(p.participants)}</strong></div>
                <div class="mini-stat"><span>Pronósticos registrados</span><strong>${A.formatNumber(p.bets)}</strong></div>
            </div>
            <p class="money-note predictions-races">${races ? `Carreras: ${races}` : "Aún no hay carreras registradas."}</p>`;
    }

    function showError(message) {
        $("#dash-alert-text").textContent = `No se pudo cargar el dashboard: ${message}`;
        $("#dash-alert").hidden = false;
    }

    async function loadDashboard() {
        const { dashboard } = await A.api("/api/admin/dashboard");
        renderKpis(dashboard);
        renderOrderStatus(dashboard.orders);
        renderTopProducts(dashboard.top_products);
        renderLowStock(dashboard.low_stock);
        renderRecentOrders(dashboard.recent_orders);
        renderPredictions(dashboard.predictions);
    }

    async function loadSales(group) {
        const request = ++salesRequest;
        const { sales } = await A.api(`/api/admin/sales?group=${encodeURIComponent(group)}`);
        // Si se pulso otro agrupamiento mientras tanto, se ignora la respuesta vieja.
        if (request === salesRequest) AdminSalesChart.render(sales);
    }

    // Si una parte falla, sus bloques dejan de mostrar "cargando" y lo dicen.
    function failDashboard() {
        ["#kpi-users", "#kpi-orders", "#kpi-revenue", "#kpi-units"].forEach(id => { $(id).textContent = "—"; });
        ["#kpi-users-foot", "#kpi-orders-foot", "#kpi-revenue-foot"].forEach(id => { $(id).textContent = "Sin datos"; });
        ["#order-status", "#top-products", "#low-stock", "#recent-orders", "#predictions"].forEach(id => {
            $(id).innerHTML = empty("No disponible. Usa «Reintentar».");
        });
    }

    function failSales() {
        $("#sales-chart").innerHTML = empty("No se pudieron cargar las ventas.");
        $("#sales-summary").innerHTML = "";
    }

    function loading() {
        ["#kpi-users", "#kpi-orders", "#kpi-revenue", "#kpi-units"].forEach(id => { $(id).innerHTML = '<span class="skeleton skeleton--value"></span>'; });
        ["#order-status", "#top-products", "#low-stock", "#recent-orders", "#predictions"].forEach(id => { $(id).innerHTML = '<span class="skeleton"></span>'; });
        $("#sales-chart").innerHTML = '<span class="skeleton skeleton--block"></span>';
    }

    async function loadAll(event) {
        $("#dash-alert").hidden = true;
        if (event) loading();
        const [dashboard, sales] = await Promise.allSettled([loadDashboard(), loadSales(salesGroup)]);
        const failures = [dashboard, sales].filter(result => result.status === "rejected").map(result => result.reason);
        if (dashboard.status === "rejected") failDashboard();
        if (sales.status === "rejected") failSales();
        const shown = failures.find(error => error.status !== 401 && error.status !== 403);
        if (shown) showError(shown.message);
    }

    document.querySelectorAll("[data-sales-group]").forEach(button => button.addEventListener("click", async () => {
        if (button.dataset.salesGroup === salesGroup) return;
        salesGroup = button.dataset.salesGroup;
        document.querySelectorAll("[data-sales-group]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        try {
            await loadSales(salesGroup);
        } catch (error) {
            failSales();
            if (error.status !== 401 && error.status !== 403) showError(error.message);
        }
    }));
    $("#dash-retry").addEventListener("click", loadAll);

    A.ready.then(loadAll, () => {});
})();
