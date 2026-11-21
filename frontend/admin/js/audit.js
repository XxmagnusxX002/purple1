/* Auditoría (solo superadministrador, solo lectura): GET /api/admin/audit.
 * Mismo patrón que Usuarios: filtros que se aplican solos, tarjeta del listado,
 * paginación y detalle en una ventana modal. Los códigos técnicos (acción,
 * entidad, datos) solo aparecen en el detalle; nada se edita ni se borra. */
(function () {
    "use strict";
    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const params = new URLSearchParams(location.search);
    const state = { action: params.get("action") || "", entity: params.get("entity") || "", actor: params.get("actor") || "",
        from: params.get("from") || "", to: params.get("to") || "", page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1) };
    let request = 0;
    let rows = [];
    let filtersReady = false;

    const actorName = row => `${row.actor_first_name || ""} ${row.actor_last_name || ""}`.trim() || row.actor_email;
    const FIELD_NAMES = { name: "Nombre", status: "Estado", is_active: "Activo", price: "Precio", stock: "Stock", percent: "Porcentaje", pitcoin_cost: "Costo en PitCoins",
        rate_per_eur: "Tasa", fields: "Campos modificados", changes: "Cambios", amount: "Importe", reason: "Motivo", role: "Rol", sku: "SKU",
        is_featured: "Destacado", description: "Descripción", slug: "URL", display_order: "Orden", image_path: "Imagen", logo_path: "Escudo",
        number: "Dorsal", nationality: "Nacionalidad", team_id: "Escudería", country: "País", circuit: "Circuito", race_date_utc: "Fecha y hora",
        circuit_timezone: "Zona horaria", symbol: "Símbolo", locale: "Formato regional", decimals: "Decimales", hex_code: "Color",
        visual_order: "Orden visual", parent_id: "Categoría principal", base_price: "Precio base", promo_percent: "Promoción", from: "Antes", to: "Después",
        rate_from: "Tasa anterior", rate_to: "Tasa nueva", bytes: "Tamaño (bytes)", format: "Formato", product_id: "Producto", winner: "Ganador" };

    function detailValue(value) {
        if (value == null || value === "") return '<span class="admin-muted">—</span>';
        if (typeof value !== "object") return esc(String(value));
        if (Array.isArray(value)) return value.map(item => esc(typeof item === "object" ? JSON.stringify(item) : FIELD_NAMES[item] || item)).join(", ") || "—";
        return `<pre>${esc(JSON.stringify(value, null, 2))}</pre>`;
    }

    function query() {
        const q = new URLSearchParams();
        Object.entries(state).forEach(([key, value]) => { if (value && !(key === "page" && value === 1)) q.set(key, value); });
        return q;
    }

    function fillFilters(filters) {
        if (filtersReady) return;
        filtersReady = true;
        const options = (items, text) => items.map(item => `<option value="${esc(item.value)}">${esc(text(item))}</option>`).join("");
        $("#filter-action").innerHTML += options(filters.actions.map(a => ({ value: a })).sort((x, y) => A.label("actions", x.value).localeCompare(A.label("actions", y.value), "es")), a => A.label("actions", a.value));
        $("#filter-entity").innerHTML += options(filters.entities.map(e => ({ value: e })), e => A.label("entities", e.value));
        $("#filter-actor").innerHTML += options(filters.actors.map(u => ({ value: u.id, ...u })), u => `${`${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email} · ${u.email}`);
        ["action", "entity", "actor"].forEach(key => { $(`#filter-${key}`).value = state[key]; });
    }

    function row(entry, index) {
        const name = actorName(entry);
        return `<tr>
            <td data-label="Fecha">${esc(A.formatDateTime(entry.created_at))}</td>
            <td data-label="Administrador"><span class="product-cell user-cell">${A.driverAvatar(name, null)}
                <span><strong>${esc(name)}</strong><small class="user-cell__email" title="${esc(entry.actor_email)}">${esc(entry.actor_email)}</small></span></span></td>
            <td data-label="Acción"><strong>${esc(A.label("actions", entry.action))}</strong></td>
            <td data-label="Entidad">${esc(A.label("entities", entry.entity))}${entry.entity_id ? ` <small class="admin-muted">#${esc(entry.entity_id)}</small>` : ""}</td>
            <td class="admin-table__actions" data-label="Acciones"><button type="button" class="admin-icon-button" data-detail="${index}" title="Ver detalle" aria-label="Ver detalle de la acción"><i class="fa-regular fa-eye" aria-hidden="true"></i></button></td>
        </tr>`;
    }

    async function load() {
        const current = ++request;
        $("#audit-alert").hidden = true;
        const q = query();
        history.replaceState(null, "", q.toString() ? `?${q}` : location.pathname);
        try {
            const data = await A.api(`/api/admin/audit?${q}`);
            if (current !== request) return;
            fillFilters(data.filters);
            rows = data.entries;
            state.page = data.page;
            $("#audit-count").textContent = `${A.formatNumber(data.total)} ${data.total === 1 ? "acción registrada" : "acciones registradas"} · solo lectura`;
            const filtered = state.action || state.entity || state.actor || state.from || state.to;
            $("#audit-body").innerHTML = rows.length ? rows.map(row).join("")
                : `<tr><td colspan="5"><p class="admin-empty">${filtered ? "Ninguna acción coincide con estos filtros." : "Todavía no hay acciones registradas."}</p></td></tr>`;
            A.pagination($("#audit-pagination"), data, page => { state.page = page; load(); $("#audit-heading").scrollIntoView({ block: "start", behavior: "smooth" }); });
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#audit-alert-text").textContent = `No se pudo cargar el registro: ${error.message}`;
            $("#audit-alert").hidden = false;
            $("#audit-body").innerHTML = "";
            $("#audit-count").textContent = "";
        }
    }

    ["action", "entity", "actor", "from", "to"].forEach(key => {
        const input = $(`#filter-${key}`);
        input.value = state[key];
        input.addEventListener("change", () => { state[key] = input.value; state.page = 1; load(); });
    });
    $("#audit-retry").addEventListener("click", load);

    $("#audit-body").addEventListener("click", event => {
        const button = event.target.closest("[data-detail]");
        if (!button) return;
        const entry = rows[Number(button.dataset.detail)];
        const details = entry.details && typeof entry.details === "object" && !Array.isArray(entry.details)
            ? Object.entries(entry.details).map(([key, value]) => [FIELD_NAMES[key] || key, detailValue(value)])
            : entry.details ? [["Datos", detailValue(entry.details)]] : [];
        A.detailModal(A.label("actions", entry.action), [
            ["Fecha", esc(A.formatDateTime(entry.created_at))],
            ["Administrador", `${esc(actorName(entry))}<br><small>${esc(entry.actor_email)}</small>`],
            ["Entidad", `${esc(A.label("entities", entry.entity))}${entry.entity_id ? ` #${esc(entry.entity_id)}` : ""}`],
            ...details,
            ["Código técnico", `<code>${esc(entry.action)}</code> · <code>${esc(entry.entity)}</code> · registro #${entry.id}`],
        ], "Registro de auditoría de solo lectura.");
    });

    A.ready.then(load).catch(() => {});
})();
