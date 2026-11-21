/* Listado de usuarios del panel (mismo patrón que products.js).
 * GET /api/admin/users?q=&status=&role=&sort=&page=
 * Los filtros se aplican solos; el estado se refleja en la URL para poder
 * volver desde el detalle sin perder la búsqueda. */
(function () {
    "use strict";
    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;

    const ROLE_LABELS = { CUSTOMER: "Cliente", STAFF: "Administrador", SUPERADMIN: "Superadministrador" };
    const params = new URLSearchParams(window.location.search);
    const state = {
        q: (params.get("q") || "").slice(0, 100),
        status: ["all", "active", "inactive"].includes(params.get("status")) ? params.get("status") : "all",
        role: ["all", "customer", "staff", "superadmin"].includes(params.get("role")) ? params.get("role") : "all",
        sort: ["recent", "oldest", "name", "coins_desc", "coins_asc"].includes(params.get("sort")) ? params.get("sort") : "recent",
        page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1),
    };
    let request = 0;
    let lastPages = 1;
    let searchTimer = null;

    function query() {
        const q = new URLSearchParams({ status: state.status, role: state.role, sort: state.sort, page: String(state.page) });
        if (state.q) q.set("q", state.q);
        return q;
    }

    function writeUrl() {
        const q = query();
        ["status", "role", "sort"].forEach(key => { if (q.get(key) === { status: "all", role: "all", sort: "recent" }[key]) q.delete(key); });
        if (q.get("page") === "1") q.delete("page");
        const text = q.toString();
        history.replaceState(null, "", text ? `?${text}` : location.pathname);
    }

    function syncControls() {
        $("#user-search").value = state.q;
        $("#filter-role").value = state.role;
        $("#filter-sort").value = state.sort;
        document.querySelectorAll("[data-status]").forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.status === state.status)));
    }

    function row(user) {
        const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
        const detail = `user.html?id=${user.id}`;
        return `<tr>
            <td data-label="Usuario"><a class="product-cell user-cell" href="${detail}">
                ${A.driverAvatar(name, null)}
                <span><strong>${esc(name)}</strong><small class="user-cell__email" title="${esc(user.email)}">${esc(user.email)}</small></span></a></td>
            <td data-label="Rol"><span class="admin-role admin-role--${esc(user.role.toLowerCase())}">${esc(ROLE_LABELS[user.role] || user.role)}</span></td>
            <td data-label="Registro">${esc(A.formatDateTime(user.created_at))}</td>
            <td data-label="Estado"><span class="status-pill status-pill--${user.is_active ? "paid" : "cancelled"}">${user.is_active ? "Activo" : "Inactivo"}</span></td>
            <td data-label="PitCoins"><span class="coin-amount"><i class="fa-solid fa-coins" aria-hidden="true"></i>${A.formatNumber(user.coins)}</span></td>
            <td class="admin-table__actions" data-label="Acciones">
                <a class="admin-icon-button" href="${detail}" title="Ver detalle de ${esc(name)}" aria-label="Ver detalle de ${esc(name)}"><i class="fa-regular fa-eye" aria-hidden="true"></i></a>
            </td>
        </tr>`;
    }

    function showError(message) {
        $("#users-alert-text").textContent = message;
        $("#users-alert").hidden = false;
    }

    async function load() {
        const current = ++request;
        $("#users-alert").hidden = true;
        writeUrl();
        try {
            const data = await A.api(`/api/admin/users?${query()}`);
            if (current !== request) return; // llegó tarde: ya hay otra búsqueda
            lastPages = data.pages;
            $("#users-count").textContent = `${A.formatNumber(data.total)} ${data.total === 1 ? "usuario" : "usuarios"}`;
            const filtered = state.q || state.status !== "all" || state.role !== "all";
            $("#users-body").innerHTML = data.users.length
                ? data.users.map(row).join("")
                : `<tr><td colspan="6"><p class="admin-empty">${filtered ? "Ningún usuario coincide con estos filtros." : "Todavía no hay usuarios registrados."}</p></td></tr>`;
            state.page = data.page;
            const pagination = $("#users-pagination");
            pagination.hidden = data.pages <= 1;
            $("#users-page").textContent = `Página ${data.page} de ${data.pages}`;
            pagination.querySelector('[data-page="prev"]').disabled = data.page <= 1;
            pagination.querySelector('[data-page="next"]').disabled = data.page >= data.pages;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            showError(`No se pudieron cargar los usuarios: ${error.message}`);
            $("#users-body").innerHTML = "";
            $("#users-count").textContent = "";
        }
    }

    function reset() {
        state.page = 1;
        load();
    }

    $("#user-search").addEventListener("input", event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.q = event.target.value.trim().slice(0, 100);
            reset();
        }, 300);
    });
    $("#user-views").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip || chip.dataset.status === state.status) return;
        state.status = chip.dataset.status;
        syncControls();
        reset();
    });
    $("#filter-role").addEventListener("change", event => { state.role = event.target.value; reset(); });
    $("#filter-sort").addEventListener("change", event => { state.sort = event.target.value; reset(); });
    $("#users-pagination").addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        state.page = Math.min(lastPages, Math.max(1, state.page + (button.dataset.page === "next" ? 1 : -1)));
        load();
        $("#users-heading").scrollIntoView({ block: "start", behavior: "smooth" });
    });
    $("#users-retry").addEventListener("click", load);

    syncControls();
    A.ready.then(load).catch(() => {});
})();
