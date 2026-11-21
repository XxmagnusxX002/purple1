/* PitCoins (solo superadministrador): historial de movimientos con el mismo
 * patrón que Usuarios. GET /api/admin/pitcoins?q=&direction=&kind=&from=&to=&page=
 * Los filtros se aplican solos; referencias y motivos se ven en el detalle.
 * Ajuste manual en una ventana aparte: POST /api/admin/pitcoins/adjust. */
(function () {
    "use strict";
    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const params = new URLSearchParams(location.search);
    const state = {
        q: (params.get("q") || "").slice(0, 100), direction: ["in", "out"].includes(params.get("direction")) ? params.get("direction") : "",
        kind: params.get("kind") || "", from: params.get("from") || "", to: params.get("to") || "", user: params.get("user") || "",
        page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1),
    };
    let request = 0;
    let rows = [];
    let timer = null;

    $("#filter-kind").innerHTML += Object.entries(A.LABELS.movements).map(([code, text]) => `<option value="${code}">${esc(text)}</option>`).join("");

    function query() {
        const q = new URLSearchParams();
        Object.entries(state).forEach(([key, value]) => { if (value && !(key === "page" && value === 1)) q.set(key, value); });
        return q;
    }

    function sync() {
        $("#coin-search").value = state.q;
        $("#filter-kind").value = state.kind;
        $("#filter-from").value = state.from;
        $("#filter-to").value = state.to;
        document.querySelectorAll("[data-direction]").forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.direction === state.direction)));
    }

    const person = m => `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.username;

    function row(m, index) {
        const name = person(m);
        const positive = m.amount > 0;
        return `<tr>
            <td data-label="Usuario"><a class="product-cell user-cell" href="user.html?id=${m.user_id}">${A.driverAvatar(name, null)}
                <span><strong>${esc(name)}</strong><small class="user-cell__email" title="${esc(m.email)}">${esc(m.email)}</small></span></a></td>
            <td data-label="Tipo de movimiento"><span class="kind-pill">${esc(A.label("movements", m.kind))}</span></td>
            <td data-label="Fecha">${esc(A.formatDateTime(m.created_at))}</td>
            <td data-label="Importe"><span class="coin-delta coin-delta--${positive ? "in" : "out"}"><i class="fa-solid fa-coins" aria-hidden="true"></i>${positive ? "+" : "−"}${A.formatNumber(Math.abs(m.amount))}</span></td>
            <td data-label="Saldo resultante"><span class="coin-amount"><i class="fa-solid fa-coins" aria-hidden="true"></i>${A.formatNumber(m.balance_after)}</span></td>
            <td class="admin-table__actions" data-label="Acciones"><button type="button" class="admin-icon-button" data-detail="${index}" title="Ver detalle del movimiento" aria-label="Ver detalle del movimiento"><i class="fa-regular fa-eye" aria-hidden="true"></i></button></td>
        </tr>`;
    }

    async function load() {
        const current = ++request;
        $("#coin-alert").hidden = true;
        const q = query();
        history.replaceState(null, "", q.toString() ? `?${q}` : location.pathname);
        try {
            const data = await A.api(`/api/admin/pitcoins?${q}`);
            if (current !== request) return;
            rows = data.movements;
            state.page = data.page;
            const filtered = state.q || state.direction || state.kind || state.from || state.to || state.user;
            $("#coin-count").textContent = `${A.formatNumber(data.total)} ${data.total === 1 ? "movimiento" : "movimientos"}${state.user ? " de un usuario" : ""}`;
            $("#coin-body").innerHTML = rows.length ? rows.map(row).join("")
                : `<tr><td colspan="6"><p class="admin-empty">${filtered ? "Ningún movimiento coincide con estos filtros." : "Todavía no hay movimientos."}</p></td></tr>`;
            A.pagination($("#coin-pagination"), data, page => { state.page = page; load(); $("#coin-heading").scrollIntoView({ block: "start", behavior: "smooth" }); });
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            $("#coin-alert-text").textContent = `No se pudieron cargar los movimientos: ${error.message}`;
            $("#coin-alert").hidden = false;
            $("#coin-body").innerHTML = "";
            $("#coin-count").textContent = "";
        }
    }

    const reset = () => { state.page = 1; load(); };
    $("#coin-search").addEventListener("input", event => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = event.target.value.trim().slice(0, 100); state.user = ""; reset(); }, 300);
    });
    $("#coin-views").addEventListener("click", event => {
        const chip = event.target.closest("[data-direction]");
        if (!chip || chip.dataset.direction === state.direction) return;
        state.direction = chip.dataset.direction;
        sync();
        reset();
    });
    $("#filter-kind").addEventListener("change", event => { state.kind = event.target.value; reset(); });
    $("#filter-from").addEventListener("change", event => { state.from = event.target.value; reset(); });
    $("#filter-to").addEventListener("change", event => { state.to = event.target.value; reset(); });
    $("#coin-retry").addEventListener("click", load);

    // Detalle de solo lectura: aquí van la referencia técnica, el motivo y el responsable.
    $("#coin-body").addEventListener("click", event => {
        const button = event.target.closest("[data-detail]");
        if (!button) return;
        const m = rows[Number(button.dataset.detail)];
        A.detailModal(`Movimiento #${m.id}`, [
            ["Usuario", `${esc(person(m))}<br><small>${esc(m.email)}</small>`],
            ["Tipo", `${esc(A.label("movements", m.kind))} <code>${esc(m.kind)}</code>`],
            ["Fecha", esc(A.formatDateTime(m.created_at))],
            ["Importe", `<span class="coin-delta coin-delta--${m.amount > 0 ? "in" : "out"}">${m.amount > 0 ? "+" : "−"}${A.formatNumber(Math.abs(m.amount))} PitCoins</span>`],
            ["Saldo resultante", `${A.formatNumber(m.balance_after)} PitCoins`],
            m.reason ? ["Motivo", esc(m.reason)] : null,
            m.actor_email ? ["Registrado por", esc(m.actor_email)] : null,
            ["Referencia", `<code>${esc(m.reference)}</code>`],
        ], "Solo lectura: los movimientos no se editan ni se borran.");
    });

    // ------------------------------------------------------------ ajuste manual
    const modal = $("#adjust-modal");
    const form = $("#coin-adjust");
    const openAdjust = () => { form.reset(); $("#coin-error").textContent = ""; modal.hidden = false; form.elements.email.focus(); };
    const closeAdjust = () => { modal.hidden = true; $("#coin-adjust-open").focus(); };
    $("#coin-adjust-open").addEventListener("click", openAdjust);
    modal.addEventListener("click", event => { if (event.target.closest("[data-close-adjust]")) closeAdjust(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeAdjust(); });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const error = $("#coin-error");
        error.textContent = "";
        const email = form.elements.email.value.trim().toLowerCase();
        const amount = Number(form.elements.amount.value);
        const reason = form.elements.reason.value.trim();
        if (!email || !Number.isSafeInteger(amount) || amount === 0 || !reason) { error.textContent = "Indica el correo, un importe entero distinto de 0 y el motivo."; return; }
        if (!form.elements.confirm.checked) { error.textContent = "Marca la confirmación para aplicar el ajuste."; return; }
        const button = form.querySelector("[type=submit]");
        button.disabled = true;
        try {
            const found = (await A.api(`/api/admin/users?${new URLSearchParams({ q: email, status: "all" })}`)).users.find(user => user.email.toLowerCase() === email);
            if (!found) throw new Error("No existe una cuenta con ese correo.");
            const reference = form.dataset.reference || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
            form.dataset.reference = reference; // reintentos sin duplicar el ajuste
            await A.api("/api/admin/pitcoins/adjust", { method: "POST", body: JSON.stringify({ target_user_id: found.id, amount, reason, reference, confirm: true }) });
            form.dataset.reference = "";
            A.notify(`Ajuste de ${amount > 0 ? "+" : ""}${A.formatNumber(amount)} PitCoins aplicado a ${found.email}.`);
            closeAdjust();
            state.page = 1;
            load();
        } catch (cause) {
            error.textContent = cause.message;
        } finally {
            button.disabled = false;
        }
    });

    sync();
    A.ready.then(load).catch(() => {});
})();
