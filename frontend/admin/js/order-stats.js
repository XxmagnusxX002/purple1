/* Estadisticas de compras (fase A6, solo consulta). EUR en todo: los PitCoins
   de los pronosticos no aparecen aqui. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const O = window.AdminOrders;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const PERIOD_TEXT = { 7: "los últimos 7 días", 30: "los últimos 30 días", 90: "los últimos 90 días", 365: "los últimos 12 meses", all: "todo el historial" };
    const empty = message => `<p class="admin-empty">${esc(message)}</p>`;
    let period = "30";
    let group = "day";
    let statsRequest = 0;
    let salesRequest = 0;

    function renderStats(stats) {
        const t = stats.totals;
        const when = PERIOD_TEXT[stats.period];
        $("#kpi-sales").textContent = A.formatNumber(t.sales);
        $("#kpi-sales-foot").textContent = `Compras aprobadas en ${when}`;
        $("#kpi-revenue").textContent = A.formatMoney(t.revenue);
        $("#kpi-revenue-foot").textContent = Number(t.discounts) ? `Descuentos aplicados: ${A.formatMoney(t.discounts)}` : "Sin descuentos aplicados";
        $("#kpi-average").textContent = A.formatMoney(t.average);
        $("#kpi-units").textContent = A.formatNumber(t.units);

        $("#status-subtitle").textContent = `Pedidos creados en ${when}`;
        const counts = Object.entries(stats.by_status);
        const max = Math.max(1, ...counts.map(([, count]) => count));
        $("#stats-status").innerHTML = counts.some(([, count]) => count)
            ? `<ul class="status-bars">${counts.map(([status, count]) => `
                <li><span>${esc(O.ORDER[status] || status)}</span>
                    <span class="status-bars__track" aria-hidden="true"><span class="status-bars__fill" style="width:${Math.round(count / max * 100)}%"></span></span>
                    <span class="status-bars__value">${A.formatNumber(count)}</span></li>`).join("")}</ul>`
            : empty(`No hay pedidos en ${when}.`);

        $("#top-body").innerHTML = stats.top_products.length ? stats.top_products.map((item, index) => `
            <tr>
                <td data-label="#">${index + 1}</td>
                <td data-label="Producto"><a href="product.html?id=${esc(item.product_id)}"><strong>${esc(item.name)}</strong></a></td>
                <td data-label="Unidades">${A.formatNumber(item.units)}</td>
                <td data-label="Ingresos">${A.formatMoney(item.revenue)}</td>
                <td data-label="Stock actual">${item.stock <= stats.low_stock_threshold ? `<span class="stock-badge stock-badge--out">${A.formatNumber(item.stock)}</span>` : A.formatNumber(item.stock)}</td>
            </tr>`).join("") : `<tr><td colspan="5">${empty(`No hay compras aprobadas en ${when}.`)}</td></tr>`;

        $("#inventory-subtitle").textContent = `Variantes con más unidades vendidas en ${when}. Stock bajo: ${stats.low_stock_threshold} unidades o menos.`;
        $("#inventory-body").innerHTML = stats.variants.length ? stats.variants.map(item => {
            const variant = [item.size, item.color].filter(Boolean).join(" · ") || "Variante única";
            const situation = !item.is_active ? '<span class="stock-badge stock-badge--none">Variante inactiva</span>'
                : item.stock === 0 ? '<span class="stock-badge stock-badge--out">Agotado</span>'
                : item.low_stock ? '<span class="stock-badge stock-badge--out">Reponer pronto</span>'
                : '<span class="status-pill status-pill--paid">Suficiente</span>';
            return `<tr>
                <td data-label="Variante"><strong>${esc(item.name)}</strong><small>${esc(variant)} · ${esc(item.sku)}</small></td>
                <td data-label="Vendidas">${A.formatNumber(item.units)}</td>
                <td data-label="Stock actual">${A.formatNumber(item.stock)}</td>
                <td data-label="Situación">${situation}</td>
                <td class="admin-table__actions" data-label="Acciones"><a class="admin-button" href="product.html?id=${esc(item.product_id)}">Ver inventario</a></td>
            </tr>`;
        }).join("") : `<tr><td colspan="5">${empty(`Sin ventas en ${when}.`)}</td></tr>`;
    }

    function failStats() {
        ["#kpi-sales", "#kpi-revenue", "#kpi-average", "#kpi-units"].forEach(id => { $(id).textContent = "—"; });
        $("#stats-status").innerHTML = empty("No disponible.");
        $("#top-body").innerHTML = `<tr><td colspan="5">${empty("No disponible.")}</td></tr>`;
        $("#inventory-body").innerHTML = `<tr><td colspan="5">${empty("No disponible.")}</td></tr>`;
    }

    function showError(message) {
        $("#stats-alert-text").textContent = message;
        $("#stats-alert").hidden = false;
    }

    async function loadStats() {
        const current = ++statsRequest;
        try {
            const { stats } = await A.api(`/api/admin/orders/stats?period=${encodeURIComponent(period)}`);
            if (current === statsRequest) renderStats(stats);
        } catch (error) {
            if (current !== statsRequest || error.status === 401 || error.status === 403) return;
            failStats();
            showError(`No se pudieron cargar las estadísticas: ${error.message}`);
        }
    }

    async function loadSales() {
        const current = ++salesRequest;
        try {
            const { sales } = await A.api(`/api/admin/sales?group=${encodeURIComponent(group)}`);
            if (current === salesRequest) AdminSalesChart.render(sales);
        } catch (error) {
            if (current !== salesRequest || error.status === 401 || error.status === 403) return;
            $("#sales-chart").innerHTML = empty("No se pudieron cargar las ventas.");
            showError(`No se pudo cargar la gráfica: ${error.message}`);
        }
    }

    function loadAll() {
        $("#stats-alert").hidden = true;
        return Promise.all([loadStats(), loadSales()]);
    }

    $("#stats-period").addEventListener("click", event => {
        const chip = event.target.closest("[data-period]");
        if (!chip || chip.dataset.period === period) return;
        period = chip.dataset.period;
        document.querySelectorAll("[data-period]").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
        $("#stats-alert").hidden = true;
        loadStats();
    });
    document.querySelectorAll("[data-sales-group]").forEach(button => button.addEventListener("click", () => {
        if (button.dataset.salesGroup === group) return;
        group = button.dataset.salesGroup;
        document.querySelectorAll("[data-sales-group]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        loadSales();
    }));
    $("#stats-retry").addEventListener("click", loadAll);

    A.ready.then(loadAll, () => {});
})();
