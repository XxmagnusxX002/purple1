document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.querySelector(".teams-grid");

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // Monoplaza 2026 si hay foto; si no, el escudo; si tampoco, la inicial con el color del equipo.
    function teamCard(team) {
        const color = team.primary_color || "#7B2CFF";
        const badge = team.logo_path
            ? `<img class="team-badge" src="${escapeHTML(team.logo_path)}" alt="" loading="lazy">`
            : `<span class="team-badge team-badge--initial" style="background:${escapeHTML(color)}" aria-hidden="true">${escapeHTML(team.name.charAt(0))}</span>`;
        const media = team.image_path
            ? `<img src="${escapeHTML(team.image_path)}" alt="Monoplaza de ${escapeHTML(team.name)}" loading="lazy">`
            : `<span class="team-img__empty" style="--team:${escapeHTML(color)}"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i></span>`;
        const drivers = (team.drivers || []).map((d) => `<li><strong>${d.number ?? "–"}</strong> ${escapeHTML(d.name)}</li>`).join("");
        const official = String(team.description || "").split(". ")[0];
        return `<article class="team-card surface-card" style="--team:${escapeHTML(color)}">
            <div class="team-img team-img--photo">${media}${badge}</div>
            <h3>${escapeHTML(team.name)}</h3>
            <p class="team-card__official">${escapeHTML(official)}${team.country ? ` · ${escapeHTML(team.country)}` : ""}</p>
            ${drivers ? `<ul class="team-card__drivers">${drivers}</ul>` : ""}
            <a href="products.html?team=${encodeURIComponent(team.slug)}" class="btn-team">Ver colección</a>
        </article>`;
    }

    try {
        const response = await fetch("/api/teams");
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "No fue posible cargar equipos.");
        grid.innerHTML = data.teams.length
            ? data.teams.map(teamCard).join("")
            : '<div class="surface-card empty-products"><h3>No hay equipos</h3><p>Agrega equipos en MySQL.</p></div>';
    } catch (error) {
        grid.innerHTML = `<div class="surface-card empty-products"><h3>Error</h3><p>${escapeHTML(error.message)}</p></div>`;
    }
});
