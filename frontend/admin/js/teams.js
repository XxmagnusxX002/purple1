/* Listado de equipos (fase A4): búsqueda y filtro por estado. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const state = { q: "", status: "all" };
    let teams = [];
    let request = 0;

    function swatch(color, label) {
        return color ? `<span class="color-swatch" style="--swatch:${esc(color)}" title="${esc(label)} ${esc(color)}"><span class="visually-hidden">${esc(label)} ${esc(color)}</span></span>` : "";
    }

    function card(team) {
        return `<article class="admin-card entity-card${team.is_active ? "" : " is-inactive"}" data-team-id="${team.id}">
            <div class="entity-card__head">
                ${A.thumb(team.logo_path, 56, "fa-flag-checkered", "entity-card__logo")}
                <div class="entity-card__title">
                    <h2>${esc(team.name)}</h2>
                    <p>${esc(team.country || "País sin definir")}</p>
                </div>
                <span class="status-pill status-pill--${team.is_active ? "paid" : "cancelled"}">${team.is_active ? "Activo" : "Inactivo"}</span>
            </div>
            <div class="entity-card__colors">${swatch(team.primary_color, "Color principal")}${swatch(team.secondary_color, "Color secundario")}${team.primary_color || team.secondary_color ? "" : '<small>Sin colores</small>'}</div>
            <dl class="entity-card__stats">
                <div><dt>Pilotos activos</dt><dd>${A.formatNumber(team.active_drivers)}</dd></div>
                <div><dt>Productos</dt><dd>${A.formatNumber(team.products)}</dd></div>
                <div><dt>Carreras</dt><dd>${A.formatNumber(team.races)}</dd></div>
            </dl>
            <div class="entity-card__actions">
                <a class="admin-button" href="team.html?id=${team.id}">Editar</a>
            </div>
        </article>`;
    }

    async function load() {
        const current = ++request;
        $("#teams-alert").hidden = true;
        const params = new URLSearchParams({ status: state.status });
        if (state.q) params.set("q", state.q);
        try {
            const data = await A.api(`/api/admin/teams?${params}`);
            if (current !== request) return;
            teams = data.teams;
            $("#teams-count").textContent = `${A.formatNumber(teams.length)} ${teams.length === 1 ? "equipo" : "equipos"}`;
            $("#teams-grid").innerHTML = teams.length ? teams.map(card).join("")
                : `<p class="admin-empty">${state.q || state.status !== "all" ? "Ningún equipo coincide con estos filtros." : "Todavía no hay equipos. Crea el primero con «Nuevo equipo»."}</p>`;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#teams-alert-text").textContent = `No se pudieron cargar los equipos: ${error.message}`;
            $("#teams-alert").hidden = false;
            $("#teams-grid").innerHTML = "";
            $("#teams-count").textContent = "";
        }
    }

    let timer;
    $("#team-search").addEventListener("input", event => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = event.target.value.trim(); load(); }, 300);
    });
    $("#team-status").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip || chip.dataset.status === state.status) return;
        state.status = chip.dataset.status;
        document.querySelectorAll("[data-status]").forEach(item => item.setAttribute("aria-pressed", String(item === chip)));
        load();
    });
    $("#teams-retry").addEventListener("click", load);

    A.ready.then(load, () => {});
})();
