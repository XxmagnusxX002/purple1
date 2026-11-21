/* Pronosticos de todas las carreras (consulta). Gestionar una carrera y
   liquidarla se hace en Carreras; aqui no se modifica nada. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const R = window.AdminRaces;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const params = new URLSearchParams(window.location.search);
    const state = { q: (params.get("q") || "").slice(0, 100), status: "all", race: params.get("race") || "", page: 1 };
    let request = 0;
    let lastPages = 1;
    let racesLoaded = false;

    function row(bet) {
        return `<tr>
            <td data-label="Carrera">${esc(bet.race_name)}<small>${esc(R.LABELS[bet.race_status] || bet.race_status)}</small></td>
            <td data-label="Usuario">${esc(bet.username)}</td>
            <td data-label="Piloto elegido"><span class="product-cell">${A.driverAvatar(bet.driver_name, bet.image_path)}<span>${esc(bet.driver_name)}</span></span></td>
            <td data-label="PitCoins">${R.coins(bet.amount)}</td>
            <td data-label="Resultado">${R.betPill(bet.status)}${bet.status === "PENDING" ? "" : `<small>Recibió ${R.coins(bet.payout)}</small>`}</td>
            <td data-label="Fecha">${esc(A.formatDateTime(bet.created_at))}</td>
            <td class="admin-table__actions" data-label="Acciones"><a class="admin-button" href="race.html?id=${esc(bet.race_id)}">Ver carrera</a></td>
        </tr>`;
    }

    function renderStats(by) {
        $("#bet-stats").innerHTML = [
            ["En juego (pendientes)", R.coins(by.PENDING.amount), `${A.formatNumber(by.PENDING.count)} pronósticos`],
            ["Premios pagados", R.coins(by.WON.payout), `${A.formatNumber(by.WON.count)} acertados`],
            ["Perdidos", R.coins(by.LOST.amount), `${A.formatNumber(by.LOST.count)} no acertados`],
            ["Devueltos", R.coins(by.REFUNDED.payout), `${A.formatNumber(by.REFUNDED.count)} pronósticos`],
        ].map(([label, value, foot]) => `<div class="mini-stat"><span>${esc(label)}</span><strong>${value}<small>${esc(foot)}</small></strong></div>`).join("");
    }

    async function load() {
        const current = ++request;
        $("#bets-alert").hidden = true;
        const query = new URLSearchParams({ status: state.status, page: String(state.page) });
        if (state.q) query.set("q", state.q);
        if (state.race) query.set("race", state.race);
        try {
            const data = await A.api(`/api/admin/bets?${query}`);
            if (current !== request) return;
            if (!racesLoaded) {
                racesLoaded = true;
                $("#bet-race").insertAdjacentHTML("beforeend", data.races.map(race => `<option value="${race.id}">${esc(race.name)}</option>`).join(""));
                $("#bet-race").value = state.race;
            }
            state.page = data.page;
            lastPages = data.pages;
            renderStats(data.by_status);
            $("#bets-count").textContent = `${A.formatNumber(data.total)} ${data.total === 1 ? "pronóstico" : "pronósticos"}`;
            $("#bets-body").innerHTML = data.bets.length ? data.bets.map(row).join("")
                : `<tr><td colspan="7"><p class="admin-empty">${state.q || state.status !== "all" || state.race ? "Ningún pronóstico coincide con estos filtros." : "Todavía no hay pronósticos."}</p></td></tr>`;
            const pagination = $("#bets-pagination");
            pagination.hidden = data.pages <= 1;
            $("#bets-page").textContent = `Página ${data.page} de ${data.pages}`;
            pagination.querySelector('[data-page="prev"]').disabled = data.page <= 1;
            pagination.querySelector('[data-page="next"]').disabled = data.page >= data.pages;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#bets-alert-text").textContent = `No se pudieron cargar los pronósticos: ${error.message}`;
            $("#bets-alert").hidden = false;
            $("#bets-body").innerHTML = "";
            $("#bet-stats").innerHTML = "";
            $("#bets-count").textContent = "";
        }
    }

    function reset(key, value) {
        state[key] = value;
        state.page = 1;
        load();
    }

    let timer;
    $("#bet-search").value = state.q;
    $("#bet-search").addEventListener("input", event => {
        clearTimeout(timer);
        timer = setTimeout(() => reset("q", event.target.value.trim()), 300);
    });
    $("#bet-status").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip || chip.dataset.status === state.status) return;
        document.querySelectorAll("[data-status]").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
        reset("status", chip.dataset.status);
    });
    $("#bet-race").addEventListener("change", event => reset("race", event.target.value));
    $("#bets-pagination").addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button || button.disabled) return;
        state.page = Math.min(lastPages, Math.max(1, state.page + (button.dataset.page === "next" ? 1 : -1)));
        load();
    });
    $("#bets-retry").addEventListener("click", load);

    A.ready.then(load, () => {});
})();
