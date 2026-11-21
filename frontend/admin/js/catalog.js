/* Catálogo administrable: categorías (categories.html) y atributos
 * (attributes.html: tipos de producto, tallas y colores).
 *   GET  /api/admin/<kind>        lista
 *   POST /api/admin/<kind>        crear
 *   PUT  /api/admin/<kind>/<id>   editar (exige "version")
 * Configuración (settings.html, solo superadministrador): monedas (el código es
 * el id) y descuentos canjeables con PitCoins; la pestaña de parámetros la dibuja settings.js.
 * Nada se borra: se activa o desactiva. Cada lista se describe con una
 * configuración (columnas, fila, formulario y datos que se envían). */
(function () {
    "use strict";
    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;

    const statusPill = active => `<span class="status-pill status-pill--${active ? "paid" : "cancelled"}">${active ? "Activo" : "Inactivo"}</span>`;
    const yesNo = value => (value ? '<i class="fa-solid fa-check catalog-yes" aria-label="Sí"></i>' : '<span class="admin-muted" aria-label="No">—</span>');
    const toggle = (id, label, help, checked) => `<label class="admin-toggle"><input type="checkbox" id="${id}" role="switch" ${checked ? "checked" : ""}>
        <span class="admin-toggle__track" aria-hidden="true"></span><span><strong>${esc(label)}</strong><small>${esc(help)}</small></span></label>`;
    const field = (label, control, key, hint = "") => `<label class="admin-field">${esc(label)}${control}
        ${hint ? `<span class="admin-field__hint">${esc(hint)}</span>` : ""}<span class="admin-field__error" data-error-for="${key}"></span></label>`;

    const CONFIG = {
        categories: {
            heading: "Árbol de categorías", single: "categoría", plural: "categorías", newLabel: "Nueva categoría",
            headers: ["Categoría", "Categoría principal", "Orden", "Productos", "Estado", "Acciones"],
            search: item => `${item.name} ${item.slug}`,
            row: (item, all) => {
                const parent = all.find(other => other.id === item.parent_id);
                return `<td data-label="Categoría"><span class="catalog-name" style="--depth:${item.depth}">${item.depth ? '<i class="fa-solid fa-turn-up fa-rotate-90" aria-hidden="true"></i>' : ""}
                        <span><strong>${esc(item.name)}</strong><small>/${esc(item.slug)}</small></span></span></td>
                    <td data-label="Categoría principal">${parent ? esc(parent.name) : '<span class="admin-muted">Principal</span>'}</td>
                    <td data-label="Orden">${A.formatNumber(item.display_order)}</td>
                    <td data-label="Productos">${A.formatNumber(item.products)}${item.children ? `<small>${A.formatNumber(item.children)} subcategorías</small>` : ""}</td>`;
            },
            form: (item, all) => {
                // No se puede elegir como principal a sí misma ni a una de sus descendientes.
                const blocked = new Set(item ? [item.id] : []);
                let grew = true;
                while (grew) {
                    grew = false;
                    all.forEach(other => { if (other.parent_id && blocked.has(other.parent_id) && !blocked.has(other.id)) { blocked.add(other.id); grew = true; } });
                }
                const options = all.filter(other => !blocked.has(other.id)).map(other =>
                    `<option value="${other.id}" ${item?.parent_id === other.id ? "selected" : ""}>${"— ".repeat(other.depth)}${esc(other.name)}${other.is_active ? "" : " (inactiva)"}</option>`).join("");
                return `${field("Nombre *", `<input id="e-name" maxlength="100" required value="${esc(item?.name || "")}">`, "name")}
                    ${field("URL", `<input id="e-slug" maxlength="120" value="${esc(item?.slug || "")}" placeholder="se genera desde el nombre">`, "slug", "Minúsculas, números y guiones.")}
                    ${field("Categoría principal", `<select id="e-parent"><option value="">Ninguna (categoría principal)</option>${options}</select>`, "parent_id")}
                    ${field("Orden", `<input id="e-order" type="number" min="0" max="100000" step="1" value="${item?.display_order ?? 0}">`, "display_order", "Menor número = aparece antes.")}
                    <div class="admin-field--wide">${field("Descripción", `<input id="e-description" maxlength="200" value="${esc(item?.description || "")}">`, "description")}</div>
                    <div class="admin-field--wide catalog-image">${field("Imagen en la portada (opcional)", `<select id="e-image"><option value="">Sin imagen</option>${images.map(img =>
                        `<option value="${esc(img.image_path)}" ${item?.image_path === img.image_path ? "selected" : ""}>${esc(img.name)}</option>`).join("")}</select>`, "image_path",
                        "Solo las categorías principales con imagen se muestran en «Explora por categorías».")}
                        <img id="e-image-preview" class="catalog-image__preview" alt="" ${item?.image_path ? `src="../${esc(item.image_path)}"` : "hidden"}></div>
                    <div class="admin-field--wide">${toggle("e-active", "Activa", "Visible en la tienda y en los filtros.", item ? item.is_active : true)}</div>`;
            },
            read: () => ({ name: $("#e-name").value.trim(), slug: $("#e-slug").value.trim(), parent_id: $("#e-parent").value ? Number($("#e-parent").value) : null,
                display_order: Number($("#e-order").value || 0), description: $("#e-description").value.trim(), image_path: $("#e-image").value || null, is_active: $("#e-active").checked }),
            payload: item => ({ name: item.name, slug: item.slug, parent_id: item.parent_id, display_order: item.display_order, description: item.description || "", image_path: item.image_path }),
        },
        "product-types": {
            heading: "Tipos de producto", single: "tipo de producto", plural: "tipos de producto", newLabel: "Nuevo tipo",
            headers: ["Tipo", "Usa talla", "Usa color", "Etiquetas sugeridas", "Productos", "Estado", "Acciones"],
            search: item => `${item.name} ${item.templates.join(" ")}`,
            row: item => `<td data-label="Tipo"><strong>${esc(item.name)}</strong></td>
                <td data-label="Usa talla">${yesNo(item.uses_size)}</td>
                <td data-label="Usa color">${yesNo(item.uses_color)}</td>
                <td data-label="Etiquetas sugeridas"><span class="catalog-tags">${item.templates.length ? item.templates.map(label => `<span class="catalog-tag">${esc(label)}</span>`).join("") : '<span class="admin-muted">Sin sugerencias</span>'}</span></td>
                <td data-label="Productos">${A.formatNumber(item.products)}</td>`,
            form: item => `${field("Nombre *", `<input id="e-name" maxlength="50" required value="${esc(item?.name || "")}">`, "name")}
                <div class="catalog-switches">${toggle("e-size", "Usa talla", "Sus variantes llevan talla.", item?.uses_size)}${toggle("e-color", "Usa color", "Sus variantes llevan color.", item?.uses_color)}</div>
                <div class="admin-field--wide">${field("Etiquetas sugeridas para especificaciones", `<textarea id="e-templates" rows="4" placeholder="Una por línea, por ejemplo:&#10;Material&#10;Composición">${esc((item?.templates || []).join("\n"))}</textarea>`, "templates",
                    "Solo son sugerencias al cargar un producto: ninguna es obligatoria.")}</div>
                <div class="admin-field--wide">${toggle("e-active", "Activo", "Se puede elegir al crear productos.", item ? item.is_active : true)}</div>`,
            read: () => ({ name: $("#e-name").value.trim(), uses_size: $("#e-size").checked, uses_color: $("#e-color").checked,
                templates: $("#e-templates").value.split("\n").map(line => line.trim()).filter(Boolean), is_active: $("#e-active").checked }),
            payload: item => ({ name: item.name, uses_size: item.uses_size, uses_color: item.uses_color, templates: item.templates }),
        },
        sizes: {
            heading: "Tallas", single: "talla", plural: "tallas", newLabel: "Nueva talla",
            headers: ["Talla", "Orden", "Variantes", "Estado", "Acciones"],
            search: item => item.name,
            row: item => `<td data-label="Talla"><strong>${esc(item.name)}</strong></td>
                <td data-label="Orden">${A.formatNumber(item.visual_order)}</td>
                <td data-label="Variantes">${A.formatNumber(item.variants)}</td>`,
            form: item => `${field("Nombre *", `<input id="e-name" maxlength="20" required value="${esc(item?.name || "")}">`, "name")}
                ${field("Orden visual", `<input id="e-order" type="number" min="0" max="100000" step="1" value="${item?.visual_order ?? 0}">`, "visual_order", "XS antes que S, S antes que M…")}
                <div class="admin-field--wide">${toggle("e-active", "Activa", "Se puede elegir en variantes nuevas.", item ? item.is_active : true)}</div>`,
            read: () => ({ name: $("#e-name").value.trim(), visual_order: Number($("#e-order").value || 0), is_active: $("#e-active").checked }),
            payload: item => ({ name: item.name, visual_order: item.visual_order }),
        },
        colors: {
            heading: "Colores", single: "color", plural: "colores", newLabel: "Nuevo color",
            headers: ["Color", "Código", "Variantes", "Estado", "Acciones"],
            search: item => `${item.name} ${item.hex_code || ""}`,
            row: item => `<td data-label="Color"><span class="catalog-color"><span class="catalog-swatch" style="background:${esc(item.hex_code || "#ffffff")}"></span><strong>${esc(item.name)}</strong></span></td>
                <td data-label="Código"><code>${esc(item.hex_code || "—")}</code></td>
                <td data-label="Variantes">${A.formatNumber(item.variants)}</td>`,
            form: item => `${field("Nombre *", `<input id="e-name" maxlength="50" required value="${esc(item?.name || "")}">`, "name")}
                ${field("Código de color", `<span class="catalog-color-input"><input id="e-color-picker" type="color" value="${esc(item?.hex_code || "#7B2CFF")}" aria-label="Elegir color">
                    <input id="e-hex" maxlength="7" value="${esc(item?.hex_code || "#7B2CFF")}" placeholder="#RRGGBB"></span>`, "hex_code")}
                <div class="admin-field--wide">${toggle("e-active", "Activo", "Se puede elegir en variantes nuevas.", item ? item.is_active : true)}</div>`,
            read: () => ({ name: $("#e-name").value.trim(), hex_code: $("#e-hex").value.trim().toUpperCase(), is_active: $("#e-active").checked }),
            payload: item => ({ name: item.name, hex_code: item.hex_code }),
        },
    };

    CONFIG.currencies = {
        heading: "Monedas y tasas de cambio", single: "moneda", plural: "monedas", newLabel: "Nueva moneda",
        headers: ["Moneda", "Tasa por 1 EUR", "Ejemplo", "Pedidos", "Estado", "Acciones"],
        search: item => `${item.code} ${item.name}`,
        row: item => {
            const sample = Number(item.rate_per_eur) * 100;
            return `<td data-label="Moneda"><span class="currency-cell"><strong class="currency-code">${esc(item.code)}</strong>
                    <span><strong>${esc(item.name)}</strong><small>${esc(item.symbol)} · ${esc(item.locale)} · ${item.decimals} decimales</small></span></span></td>
                <td data-label="Tasa por 1 EUR"><strong>${Number(item.rate_per_eur).toLocaleString("es-CO", { maximumFractionDigits: 6 })}</strong>
                    <small>${item.updated_by_email ? `Actualizada por ${esc(item.updated_by_email)}` : "Tasa inicial"}</small></td>
                <td data-label="Ejemplo">100 EUR = ${esc(item.symbol)} ${sample.toLocaleString(item.locale, { minimumFractionDigits: item.decimals, maximumFractionDigits: item.decimals })}</td>
                <td data-label="Pedidos">${A.formatNumber(item.orders)}</td>`;
        },
        form: item => `${item ? "" : field("Código ISO *", '<input id="e-code" maxlength="3" required placeholder="COP" style="text-transform:uppercase">', "code", "Tres letras, por ejemplo COP, USD o UYU.")}
            ${field("Nombre *", `<input id="e-name" maxlength="60" required value="${esc(item?.name || "")}">`, "name")}
            ${field("Tasa: unidades por 1 EUR *", `<input id="e-rate" inputmode="decimal" required value="${esc(item?.rate_per_eur ?? "")}" ${item?.code === "EUR" ? "readonly" : ""}>`, "rate_per_eur",
                item?.code === "EUR" ? "EUR es la moneda base: su tasa siempre es 1." : "Tasa de referencia manual. Afecta a los precios mostrados y a los pagos nuevos; los pedidos anteriores conservan su tasa.")}
            ${field("Símbolo *", `<input id="e-symbol" maxlength="8" required value="${esc(item?.symbol || "")}" placeholder="$">`, "symbol")}
            ${field("Formato regional *", `<input id="e-locale" maxlength="10" required value="${esc(item?.locale || "")}" placeholder="es-CO">`, "locale", "Define separadores de miles y decimales.")}
            ${field("Decimales *", `<input id="e-decimals" type="number" min="0" max="4" step="1" value="${item?.decimals ?? 2}">`, "decimals")}
            ${field("Orden", `<input id="e-order" type="number" min="0" max="100000" step="1" value="${item?.display_order ?? 0}">`, "display_order")}
            <div class="admin-field--wide">${toggle("e-active", "Activa", item?.code === "EUR" ? "La moneda base siempre está activa." : "Aparece en el selector de la tienda.", item ? item.is_active : true)}</div>`,
        read: () => ({ code: $("#e-code") ? $("#e-code").value.trim().toUpperCase() : undefined, name: $("#e-name").value.trim(),
            rate_per_eur: $("#e-rate").value.trim().replace(",", "."), symbol: $("#e-symbol").value.trim(), locale: $("#e-locale").value.trim(),
            decimals: Number($("#e-decimals").value), display_order: Number($("#e-order").value || 0), is_active: $("#e-active").checked }),
        payload: item => ({ name: item.name, rate_per_eur: String(item.rate_per_eur), symbol: item.symbol, locale: item.locale,
            decimals: item.decimals, display_order: item.display_order }),
    };

    CONFIG["discount-rewards"] = {
        heading: "Descuentos canjeables con PitCoins", single: "descuento", plural: "descuentos", newLabel: "Nuevo descuento",
        headers: ["Descuento", "Porcentaje", "Costo", "Canjes", "Estado", "Acciones"],
        search: item => item.name,
        row: item => `<td data-label="Descuento"><strong>${esc(item.name)}</strong></td>
            <td data-label="Porcentaje"><span class="reward-percent">${item.percent} %</span>${item.percent > maxPercent ? `<small>Se aplica ${maxPercent} % (máximo configurado)</small>` : ""}</td>
            <td data-label="Costo"><span class="coin-delta"><i class="fa-solid fa-coins" aria-hidden="true"></i>${A.formatNumber(item.pitcoin_cost)}</span></td>
            <td data-label="Canjes">${A.formatNumber(item.redeemed)}</td>`,
        form: item => `${field("Nombre *", `<input id="e-name" maxlength="80" required value="${esc(item?.name || "")}" placeholder="Descuento del 10 %">`, "name")}
            ${field("Porcentaje de descuento *", `<input id="e-percent" type="number" min="1" max="${maxPercent}" step="1" required value="${item?.percent ?? 5}">`, "percent", `Entre 1 y ${maxPercent} % (máximo configurado). Límite absoluto: 20 %.`)}
            ${field("Costo en PitCoins *", `<input id="e-cost" type="number" min="1" max="1000000" step="1" required value="${item?.pitcoin_cost ?? 500}">`, "pitcoin_cost", "Se descuentan del saldo solo si el pago se aprueba.")}
            ${field("Orden", `<input id="e-order" type="number" min="0" max="100000" step="1" value="${item?.display_order ?? 0}">`, "display_order")}
            <div class="admin-field--wide">${toggle("e-active", "Disponible", "Los clientes pueden elegirlo en el carrito si les alcanza el saldo.", item ? item.is_active : true)}</div>`,
        read: () => ({ name: $("#e-name").value.trim(), percent: Number($("#e-percent").value), pitcoin_cost: Number($("#e-cost").value),
            display_order: Number($("#e-order").value || 0), is_active: $("#e-active").checked }),
        payload: item => ({ name: item.name, percent: item.percent, pitcoin_cost: item.pitcoin_cost, display_order: item.display_order }),
    };
    let maxPercent = 20; // lo envía el backend con la lista de objetivos

    const tab = new URLSearchParams(location.search).get("tab");
    const tabs = (document.body.dataset.catalogTabs || "").split(",").filter(Boolean);
    const kind = document.body.dataset.catalogKind
        || (tabs.length ? (tabs.includes(tab) ? tab : tabs[0]) : (CONFIG[tab] && tab !== "categories" ? tab : "product-types"));
    document.querySelectorAll(".admin-tabs [data-tab]").forEach(link => {
        if (link.dataset.tab === kind) link.setAttribute("aria-current", "page");
    });
    // Pestaña sin listado (parámetros): la dibuja settings.js.
    if (!CONFIG[kind]) { document.body.dataset.activeTab = kind; return; }
    if ($("#catalog-panel")) document.body.dataset.activeTab = kind;
    const config = CONFIG[kind];
    const state = { q: "", status: "all", items: [], editing: null, saving: false };
    let images = []; // imágenes de frontend/img para la categoría (GET /api/admin/images)
    let searchTimer = null;

    function setup() {
        document.querySelectorAll(".admin-tabs [data-tab]").forEach(link => {
            if (link.dataset.tab === kind) link.setAttribute("aria-current", "page");
        });
        if ($("#new-label")) $("#new-label").textContent = config.newLabel;
        $("#catalog-heading").textContent = config.heading;
        $("#catalog-table").classList.add(`admin-table--${kind}`);
        $("#catalog-table thead").innerHTML = `<tr>${config.headers.map(h => `<th scope="col">${esc(h)}</th>`).join("")}</tr>`;
    }

    function visible() {
        const q = state.q.toLocaleLowerCase("es");
        return state.items.filter(item => (state.status === "all" || item.is_active === (state.status === "active"))
            && (!q || config.search(item).toLocaleLowerCase("es").includes(q)));
    }

    function render() {
        const rows = visible();
        const cols = config.headers.length;
        $("#catalog-count").textContent = `${A.formatNumber(rows.length)} de ${A.formatNumber(state.items.length)} ${state.items.length === 1 ? config.single : config.plural}`;
        $("#catalog-body").innerHTML = rows.length ? rows.map(item => `<tr data-id="${item.id}">
                ${config.row(item, state.items)}
                <td data-label="Estado">${statusPill(item.is_active)}</td>
                <td class="admin-table__actions" data-label="Acciones">
                    <button type="button" class="admin-icon-button" data-edit="${item.id}" title="Editar ${esc(item.name)}" aria-label="Editar ${esc(item.name)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                    ${item.id === "EUR" ? "" : `<button type="button" class="admin-icon-button" data-toggle="${item.id}" title="${item.is_active ? "Desactivar" : "Activar"} ${esc(item.name)}" aria-label="${item.is_active ? "Desactivar" : "Activar"} ${esc(item.name)}"><i class="fa-solid ${item.is_active ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i></button>`}
                </td></tr>`).join("")
            : `<tr><td colspan="${cols}"><p class="admin-empty">${state.items.length ? "Nada coincide con la búsqueda." : `Todavía no hay ${config.plural}.`}</p></td></tr>`;
    }

    async function load() {
        $("#catalog-alert").hidden = true;
        try {
            const data = await A.api(`/api/admin/${kind}`);
            state.items = data.items;
            if (data.max_percent) maxPercent = data.max_percent;
            render();
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#catalog-alert-text").textContent = `No se pudo cargar la lista: ${error.message}`;
            $("#catalog-alert").hidden = false;
            $("#catalog-body").innerHTML = "";
            $("#catalog-count").textContent = "";
        }
    }

    function openEditor(item) {
        state.editing = item;
        const editor = $("#catalog-editor");
        editor.innerHTML = `<form id="catalog-form" novalidate>
            <div class="admin-card__head"><div><h2>${item ? `Editar ${esc(config.single)}: ${esc(item.name)}` : esc(config.newLabel)}</h2><p>Los cambios quedan en la auditoría.</p></div></div>
            <div class="admin-form-grid catalog-form-grid">${config.form(item, state.items)}</div>
            <p class="admin-field__error" data-error-for="_general" role="alert"></p>
            <div class="catalog-editor__actions"><button type="button" class="admin-button" data-cancel>Cancelar</button>
                <button type="submit" class="btn-primary catalog-editor__save"><i class="fa-regular fa-floppy-disk" aria-hidden="true"></i> ${item ? "Guardar cambios" : "Crear"}</button></div></form>`;
        editor.hidden = false;
        const imageSelect = $("#e-image");
        if (imageSelect) imageSelect.addEventListener("change", () => {
            const preview = $("#e-image-preview");
            preview.hidden = !imageSelect.value;
            if (imageSelect.value) preview.src = `../${imageSelect.value}`;
        });
        const picker = $("#e-color-picker");
        if (picker) {
            picker.addEventListener("input", () => { $("#e-hex").value = picker.value.toUpperCase(); });
            $("#e-hex").addEventListener("input", () => { if (/^#[0-9A-Fa-f]{6}$/.test($("#e-hex").value)) picker.value = $("#e-hex").value; });
        }
        editor.scrollIntoView({ block: "start", behavior: "smooth" });
        $("#e-name").focus({ preventScroll: true });
    }

    function closeEditor() {
        state.editing = null;
        $("#catalog-editor").hidden = true;
        $("#catalog-editor").innerHTML = "";
    }

    function showErrors(fields, message) {
        document.querySelectorAll("#catalog-form [data-error-for]").forEach(span => { span.textContent = ""; });
        Object.entries(fields || {}).forEach(([key, text]) => {
            const span = document.querySelector(`#catalog-form [data-error-for="${key}"]`) || document.querySelector('#catalog-form [data-error-for="_general"]');
            span.textContent = text;
        });
        if (message && !Object.keys(fields || {}).length) document.querySelector('#catalog-form [data-error-for="_general"]').textContent = message;
    }

    async function send(item, data) {
        const body = item ? { ...data, version: item.version } : data;
        return A.api(item ? `/api/admin/${kind}/${item.id}` : `/api/admin/${kind}`, { method: item ? "PUT" : "POST", body: JSON.stringify(body) });
    }

    $("#catalog-editor").addEventListener("click", event => { if (event.target.closest("[data-cancel]")) closeEditor(); });
    $("#catalog-editor").addEventListener("submit", async event => {
        event.preventDefault();
        if (state.saving) return;
        const data = config.read();
        if (!data.name) return showErrors({ name: "El nombre es obligatorio." });
        state.saving = true;
        try {
            await send(state.editing, data);
            A.notify(state.editing ? "Cambios guardados." : "Registro creado.");
            closeEditor();
            await load();
        } catch (error) {
            if (error.status === 409) showErrors({}, `${error.message} Recarga la lista para ver los datos actuales.`);
            else showErrors(error.fields, error.message);
        } finally {
            state.saving = false;
        }
    });

    $("#catalog-body").addEventListener("click", async event => {
        const edit = event.target.closest("[data-edit]");
        if (edit) return openEditor(state.items.find(item => String(item.id) === edit.dataset.edit));
        const flip = event.target.closest("[data-toggle]");
        if (!flip) return;
        const item = state.items.find(entry => String(entry.id) === flip.dataset.toggle);
        flip.disabled = true;
        try {
            await send(item, { ...config.payload(item), is_active: !item.is_active });
            A.notify(item.is_active ? "Desactivado." : "Activado.");
            await load();
        } catch (error) {
            A.notify(error.message, "error");
            flip.disabled = false;
        }
    });

    document.querySelector("[data-new]").addEventListener("click", () => openEditor(null));
    $("#catalog-search").addEventListener("input", event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => { state.q = event.target.value.trim(); render(); }, 200);
    });
    $("#catalog-views").addEventListener("click", event => {
        const chip = event.target.closest("[data-status]");
        if (!chip) return;
        state.status = chip.dataset.status;
        document.querySelectorAll("[data-status]").forEach(other => other.setAttribute("aria-pressed", String(other === chip)));
        render();
    });
    $("#catalog-retry").addEventListener("click", load);

    setup();
    A.ready.then(async () => {
        if (kind === "categories") {
            try { images = (await A.api("/api/admin/images")).images; } catch (error) { images = []; }
        }
        await load();
    }).catch(() => {});
})();
