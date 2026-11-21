/* Listado de pilotos (fase A4): busqueda, filtros por equipo y estado, orden.
   El filtro de equipo viene en la URL (?team=). */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const params = new URLSearchParams(window.location.search);
    const state = { q: "", status: "all", team: params.get("team") || "", sort: "name" };
    let request = 0;

    function row(driver) {
        const team = driver.team_name
            ? `${esc(driver.team_name)}${driver.team_active === false ? ' <small>(equipo inactivo)</small>' : ""}`
            : '<span class="admin-muted">Sin equipo</span>';
        return `<tr data-driver-id="${driver.id}">
            <td data-label="Piloto"><span class="product-cell">
                ${A.driverAvatar(driver.name, driver.image_path)}
                <span><strong>${esc(driver.name)}</strong></span></span></td>
            <td data-label="Dorsal">${driver.number ? `<span class="driver-number">${esc(driver.number)}</span>` : '<span class="admin-muted">—</span>'}</td>
            <td data-label="Equipo actual">${team}</td>
            <td data-label="Nacionalidad">${esc(driver.nationality || "Sin definir")}</td>
            <td data-label="Carreras">${A.formatNumber(driver.races)}<small>${A.formatNumber(driver.predictions)} pronósticos</small></td>
            <td data-label="Estado"><span class="status-pill status-pill--${driver.is_active ? "paid" : "cancelled"}">${driver.is_active ? "Activo" : "Inactivo"}</span></td>
            <td class="admin-table__actions" data-label="Acciones">
                <a class="admin-button" href="driver.html?id=${driver.id}">Editar</a>
            </td>
        </tr>`;
    }

    async function load() {
        const current = ++request;
        $("#drivers-alert").hidden = true;
        const query = new URLSearchParams({ status: state.status, sort: state.sort });
        if (state.q) query.set("q", state.q);
        if (state.team) query.set("team", state.team);
        window.history.replaceState(null, "", state.team ? `?team=${encodeURIComponent(state.team)}` : window.location.pathname);
        $("#new-driver").href = state.team && state.team !== "none" ? `driver.html?team=${encodeURIComponent(state.team)}` : "driver.html";
        try {
            const data = await A.api(`/api/admin/drivers?${query}`);
            if (current !== request) return;
            const drivers = data.drivers;
            $("#drivers-count").textContent = `${A.formatNumber(drivers.length)} ${drivers.length === 1 ? "piloto" : "pilotos"}`;
            $("#drivers-body").innerHTML = drivers.length ? drivers.map(row).join("")
                : `<tr><td colspan="7"><p class="admin-empty">${state.q || state.status !== "all" || state.team ? "Ningún piloto coincide con estos filtros." : "Todavía no hay pilotos. Crea el primero con «Nuevo piloto»."}</p></td></tr>`;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#drivers-alert-text").textContent = `No se pudieron cargar los pilotos: ${error.message}`;
            $("#drivers-alert").hidden = false;
            $("#drivers-body").innerHTML = "";
            $("#drivers-count").textContent = "";
        }
    }

    async function loadTeams() {
        try {
            const { teams } = await A.api("/api/admin/team-options");
            $("#driver-team").insertAdjacentHTML("beforeend", teams.map(team =>
                `<option value="${team.id}">${esc(team.name)}${team.is_active ? "" : " (inactivo)"}</option>`).join(""));
            $("#driver-team").value = state.team;
        } catch (error) {
            // Sin la lista, el filtro queda en "Todos"; el listado sigue funcionando.
        }
    }

    let timer;
    $("#driver-search").addEventListener("input", event => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = event.target.value.trim(); load(); }, 300);
    });
    $("#driver-status").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip || chip.dataset.status === state.status) return;
        state.status = chip.dataset.status;
        document.querySelectorAll("[data-status]").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
        load();
    });
    $("#driver-team").addEventListener("change", event => { state.team = event.target.value; load(); });
    $("#driver-sort").addEventListener("change", event => { state.sort = event.target.value; load(); });
    $("#drivers-retry").addEventListener("click", load);

    A.ready.then(() => Promise.all([loadTeams(), load()]), () => {});
})();
