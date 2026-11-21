/* Configuración › PitCoins y XP: parámetros enteros con límites (GET/PUT
 * /api/admin/settings, solo superadministrador). Las pestañas de monedas y de
 * fidelización usan catalog.js. Cada cambio queda en la auditoría. */
(function () {
    "use strict";
    if (document.body.dataset.activeTab !== "parameters") return;
    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const panel = $("#params-panel");
    const GROUPS = [
        ["pitcoins", "PitCoins", "fa-coins", "Moneda virtual y simulada: se gana al registrarse, en pronósticos y al subir de nivel; se usa en pronósticos, el avatar y descuentos de la tienda. No se compra, no se retira ni se convierte en dinero."],
        ["xp", "Experiencia (XP)", "fa-bolt", "Se gana con los pronósticos liquidados y sube el nivel. Solo da recompensas virtuales."],
        ["discounts", "Descuentos con PitCoins", "fa-ticket", "Tope de descuento por pedido. Los porcentajes y costos se editan en la pestaña «Descuentos con PitCoins»."],
    ];
    let items = [];
    let saving = false;

    $("#catalog-panel").hidden = true;
    panel.hidden = false;

    function render() {
        const updated = items.filter(item => item.updated_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
        panel.innerHTML = `<form id="params-form" novalidate>
            <div class="admin-card__head"><div><h2 id="params-heading">Parámetros de PitCoins, XP y cupones</h2>
                <p>${updated ? `Último cambio: ${esc(A.formatDateTime ? A.formatDateTime(updated.updated_at) : updated.updated_at)}${updated.updated_by_email ? ` por ${esc(updated.updated_by_email)}` : ""}.` : "Valores iniciales."} Los cambios aplican a partir de ahora y quedan en la auditoría.</p></div></div>
            ${GROUPS.map(([group, title, icon, help]) => `<fieldset class="settings-group">
                <legend><i class="fa-solid ${icon}" aria-hidden="true"></i> ${esc(title)}</legend><p class="settings-group__help">${esc(help)}</p>
                <div class="admin-form-grid">${items.filter(item => item.group === group).map(item => `<label class="admin-field">${esc(item.label)}
                    <input type="number" step="1" min="${item.min}" max="${item.max}" data-key="${esc(item.key)}" value="${item.value}" required>
                    <span class="admin-field__hint">${esc(item.help)} Rango ${A.formatNumber(item.min)}–${A.formatNumber(item.max)}. Por defecto ${A.formatNumber(item.default)}.</span>
                    <span class="admin-field__error" data-error-for="${esc(item.key)}"></span></label>`).join("")}</div></fieldset>`).join("")}
            <p class="admin-field__error" data-error-for="_general" role="alert"></p>
            <div class="catalog-editor__actions"><button type="button" class="admin-button" data-reset>Descartar cambios</button>
                <button type="submit" class="btn-primary catalog-editor__save"><i class="fa-regular fa-floppy-disk" aria-hidden="true"></i> Guardar parámetros</button></div>
        </form>`;
    }

    async function load() {
        try {
            items = (await A.api("/api/admin/settings")).items;
            render();
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            panel.innerHTML = `<p class="admin-empty">No se pudieron cargar los parámetros: ${esc(error.message)}</p>`;
        }
    }

    panel.addEventListener("click", event => { if (event.target.closest("[data-reset]")) render(); });
    panel.addEventListener("submit", async event => {
        event.preventDefault();
        if (saving) return;
        panel.querySelectorAll("[data-error-for]").forEach(span => { span.textContent = ""; });
        const values = {};
        panel.querySelectorAll("[data-key]").forEach(input => {
            const item = items.find(entry => entry.key === input.dataset.key);
            if (String(item.value) !== input.value.trim()) values[item.key] = input.value.trim();
        });
        if (!Object.keys(values).length) { A.notify("No hay cambios para guardar."); return; }
        saving = true;
        try {
            items = (await A.api("/api/admin/settings", { method: "PUT", body: JSON.stringify({ values }) })).items;
            render();
            A.notify("Parámetros guardados.");
        } catch (error) {
            Object.entries(error.fields || { _general: error.message }).forEach(([key, text]) => {
                const span = panel.querySelector(`[data-error-for="${key}"]`) || panel.querySelector('[data-error-for="_general"]');
                span.textContent = text;
            });
        } finally {
            saving = false;
        }
    });

    A.ready.then(load).catch(() => {});
})();
