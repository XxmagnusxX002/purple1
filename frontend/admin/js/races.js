/* Listado de carreras (fase A5): busqueda, filtro por estado con contadores y
   acceso directo a la liquidacion cuando la carrera ya puede liquidarse. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const R = window.AdminRaces;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const state = { q: "", status: "all" };
    let request = 0;

    function row(race) {
        const winner = race.status === "FINISHED" && race.winner_name ? `<small>Ganador: ${esc(race.winner_name)}</small>` : "";
        const action = race.can_settle
            ? `<a class="btn-primary admin-button--compact" href="result.html?id=${race.id}">Ganador</a>`
            : race.status === "FINISHED" ? `<a class="admin-button" href="result.html?id=${race.id}">Ver resultado</a>` : "";
        return `<tr data-race-id="${race.id}">
            <td data-label="Gran Premio"><span class="race-cell"><strong>${esc(race.name)}</strong>
                <small>${esc([race.circuit, race.country].filter(Boolean).join(" · "))}</small></span>${winner}</td>
            <td data-label="Hora del circuito">${R.when(race)}</td>
            <td data-label="Pilotos">${A.formatNumber(race.participants)}</td>
            <td data-label="Pronósticos">${A.formatNumber(race.bets)}${race.bets && race.status !== "CANCELLED"
                ? `<small>${R.coins(race.status === "FINISHED" ? race.pool : race.pending_pool)} ${race.status === "FINISHED" ? "repartidos" : "en juego"}</small>` : ""}</td>
            <td data-label="Estado">${R.pill(race.status)}</td>
            <td class="admin-table__actions" data-label="Acciones"><span class="admin-row-actions"><a class="admin-button" href="race.html?id=${race.id}">Gestionar</a>${action}</span></td>
        </tr>`;
    }

    async function load() {
        const current = ++request;
        $("#races-alert").hidden = true;
        const query = new URLSearchParams({ status: state.status });
        if (state.q) query.set("q", state.q);
        try {
            const data = await A.api(`/api/admin/races?${query}`);
            if (current !== request) return;
            Object.entries(data.counts || {}).forEach(([status, total]) => {
                const target = document.querySelector(`[data-count="${status}"]`);
                if (target) target.textContent = `(${A.formatNumber(total)})`;
            });
            $("#races-count").textContent = `${A.formatNumber(data.races.length)} ${data.races.length === 1 ? "carrera" : "carreras"}`;
            $("#races-body").innerHTML = data.races.length ? data.races.map(row).join("")
                : `<tr><td colspan="6"><p class="admin-empty">${state.q || state.status !== "all" ? "Ninguna carrera coincide con estos filtros." : "Todavía no hay carreras. Crea la primera con «Nueva carrera»."}</p></td></tr>`;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#races-alert-text").textContent = `No se pudieron cargar las carreras: ${error.message}`;
            $("#races-alert").hidden = false;
            $("#races-body").innerHTML = "";
            $("#races-count").textContent = "";
        }
    }

    let timer;
    $("#race-search").addEventListener("input", event => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = event.target.value.trim(); load(); }, 300);
    });
    $("#race-status").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip || chip.dataset.status === state.status) return;
        state.status = chip.dataset.status;
        document.querySelectorAll("[data-status]").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
        load();
    });
    $("#races-retry").addEventListener("click", load);

    A.ready.then(load, () => {});
})();
