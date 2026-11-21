/* Grafica de ventas en EUR (SVG sin librerias), compartida por el dashboard (A2)
   y las estadisticas de pedidos (A6). Pinta en #sales-chart y #sales-summary
   los datos de /api/admin/sales. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const empty = message => `<p class="admin-empty">${esc(message)}</p>`;

    function periodLabel(period, group) {
        if (group === "month") {
            const [year, month] = period.split("-");
            return `${MONTHS[Number(month) - 1]} ${year.slice(2)}`;
        }
        const [, month, day] = period.split("-");
        return `${day}/${month}`;
    }

    function render(sales) {
        const series = sales.series;
        const revenue = series.map(point => Number(point.revenue));
        const total = revenue.reduce((sum, value) => sum + value, 0);
        const orders = series.reduce((sum, point) => sum + Number(point.orders), 0);
        const max = Math.max(...revenue, 0);
        const W = 600, H = 220, left = 8, bottom = 22, top = 10;
        const step = (W - left * 2) / series.length;
        const barWidth = Math.max(4, step * 0.66);
        const labelEvery = sales.group === "day" ? 5 : 1;
        const grid = [0.25, 0.5, 0.75, 1].map(f => {
            const y = top + (H - top - bottom) * (1 - f);
            return `<line class="grid-line" x1="${left}" x2="${W - left}" y1="${y}" y2="${y}"/>`;
        }).join("");
        const bars = series.map((point, index) => {
            const value = Number(point.revenue);
            const h = max > 0 ? Math.max(value > 0 ? 3 : 0, (H - top - bottom) * value / max) : 0;
            const x = left + index * step + (step - barWidth) / 2;
            const label = periodLabel(point.period, sales.group);
            const text = index % labelEvery === 0 || index === series.length - 1
                ? `<text class="axis-label" x="${x + barWidth / 2}" y="${H - 6}" text-anchor="middle">${esc(label)}</text>` : "";
            const bar = value > 0
                ? `<rect class="bar" x="${x}" y="${H - bottom - h}" width="${barWidth}" height="${h}" rx="3"><title>${esc(label)}: ${esc(A.formatMoney(value))} · ${esc(point.orders)} pedidos</title></rect>`
                : `<rect class="bar bar--empty" x="${x}" y="${H - bottom - 2}" width="${barWidth}" height="2" rx="1"/>`;
            return bar + text;
        }).join("");
        const period = sales.group === "day" ? "últimos 30 días" : "últimos 12 meses";
        const tableRows = series.map(point => `<tr><th scope="row">${esc(point.period)}</th><td>${esc(A.formatMoney(point.revenue))}</td><td>${esc(point.orders)}</td></tr>`).join("");
        $("#sales-chart").innerHTML = `
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sales-svg-title"><title id="sales-svg-title">Ingresos aprobados en EUR por ${sales.group === "day" ? "día" : "mes"}, ${period}</title>${grid}${bars}</svg>
            <table class="visually-hidden"><caption>Ventas por ${sales.group === "day" ? "día" : "mes"}</caption><thead><tr><th scope="col">Periodo</th><th scope="col">Ingresos (EUR)</th><th scope="col">Pedidos</th></tr></thead><tbody>${tableRows}</tbody></table>
            ${total === 0 ? empty(`No hay ventas aprobadas en los ${period}.`) : ""}`;
        $("#sales-summary").innerHTML = `<span>Total ${period}: <strong>${A.formatMoney(total)}</strong></span><span>Compras: <strong>${A.formatNumber(orders)}</strong></span>`;
    }

    window.AdminSalesChart = { render };
})();
