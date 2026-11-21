/* Listado de pedidos (fase A6, solo consulta): busqueda, filtros, orden y
   paginacion en el servidor. Los importes son EUR. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const O = window.AdminOrders;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    // ?q= permite llegar filtrado, p. ej. desde el detalle de un usuario.
    const state = { q: (new URLSearchParams(window.location.search).get("q") || "").slice(0, 100), status: "all", payment: "all", from: "", to: "", sort: "recent", page: 1 };
    let request = 0;
    let lastPages = 1;

    function row(order) {
        const sale = order.is_sale ? "" : '<small>No cuenta como venta</small>';
        return `<tr>
            <td data-label="Pedido"><strong>#${esc(order.id)}</strong></td>
            <td data-label="Cliente">${esc(order.customer.name || "Cliente")}<small>@${esc(order.customer.username)}</small></td>
            <td data-label="Fecha">${esc(A.formatDateTime(order.created_at))}</td>
            <td data-label="Productos">${A.formatNumber(order.units)}</td>
            <td data-label="Total"><strong>${A.formatMoney(order.total)}</strong>${sale}</td>
            <td data-label="Pago">${O.paymentPill(order.payment_status)}</td>
            <td data-label="Estado">${O.orderPill(order.status)}</td>
            <td class="admin-table__actions" data-label="Acciones"><a class="admin-button" href="order.html?id=${order.id}">Ver detalle</a></td>
        </tr>`;
    }

    function filtered() {
        return state.q || state.status !== "all" || state.payment !== "all" || state.from || state.to;
    }

    async function load() {
        const current = ++request;
        $("#orders-alert").hidden = true;
        const query = new URLSearchParams({ status: state.status, payment: state.payment, sort: state.sort, page: String(state.page) });
        ["q", "from", "to"].forEach(key => { if (state[key]) query.set(key, state[key]); });
        try {
            const data = await A.api(`/api/admin/orders?${query}`);
            if (current !== request) return;
            state.page = data.page;
            lastPages = data.pages;
            const s = data.summary;
            $("#orders-count").textContent = `${A.formatNumber(data.total)} ${data.total === 1 ? "pedido" : "pedidos"} · ${A.formatNumber(s.sales)} ventas por ${A.formatMoney(s.sales_amount)}`;
            $("#orders-body").innerHTML = data.orders.length ? data.orders.map(row).join("")
                : `<tr><td colspan="8"><p class="admin-empty">${filtered() ? "Ningún pedido coincide con estos filtros." : "Todavía no hay pedidos. Aparecerán aquí cuando los clientes compren en la tienda."}</p></td></tr>`;
            const pagination = $("#orders-pagination");
            pagination.hidden = data.pages <= 1;
            $("#orders-page").textContent = `Página ${data.page} de ${data.pages}`;
            pagination.querySelector('[data-page="prev"]').disabled = data.page <= 1;
            pagination.querySelector('[data-page="next"]').disabled = data.page >= data.pages;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#orders-alert-text").textContent = Object.values(error.fields || {})[0] || `No se pudieron cargar los pedidos: ${error.message}`;
            $("#orders-alert").hidden = false;
            $("#orders-body").innerHTML = "";
            $("#orders-count").textContent = "";
            $("#orders-pagination").hidden = true;
        }
    }

    function reset(key, value) {
        state[key] = value;
        state.page = 1;
        load();
    }

    let timer;
    $("#order-search").value = state.q;
    $("#order-search").addEventListener("input", event => {
        clearTimeout(timer);
        timer = setTimeout(() => reset("q", event.target.value.trim()), 300);
    });
    $("#order-status").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip || chip.dataset.status === state.status) return;
        document.querySelectorAll("[data-status]").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
        reset("status", chip.dataset.status);
    });
    $("#order-payment").addEventListener("change", event => reset("payment", event.target.value));
    $("#order-from").addEventListener("change", event => reset("from", event.target.value));
    $("#order-to").addEventListener("change", event => reset("to", event.target.value));
    $("#order-sort").addEventListener("change", event => reset("sort", event.target.value));
    $("#orders-pagination").addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button || button.disabled) return;
        state.page = Math.min(lastPages, Math.max(1, state.page + (button.dataset.page === "next" ? 1 : -1)));
        load();
        $("#orders-heading").scrollIntoView({ block: "start" });
    });
    $("#orders-retry").addEventListener("click", load);

    A.ready.then(load, () => {});
})();
