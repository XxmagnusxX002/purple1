/* Detalle de un usuario del panel.
 *   GET  /api/admin/users/<id>          datos, estadísticas y rol
 *   POST /api/admin/users/<id>/access   { version, role, is_active } (solo superadministrador)
 * La interfaz se adapta al rol de quien consulta, pero los permisos los decide
 * el backend en cada petición. */
(function () {
    "use strict";
    const A = window.PurpleAdmin;
    const esc = A.escapeHTML;
    const root = document.querySelector("#admin-content");
    const id = Number(new URLSearchParams(location.search).get("id"));

    const ROLE_LABELS = { CUSTOMER: "Cliente", STAFF: "Administrador", SUPERADMIN: "Superadministrador" };
    const ROLE_HELP = {
        CUSTOMER: "Usa la tienda, pronostica y personaliza su avatar. No entra al panel.",
        STAFF: "Opera el panel: productos, equipos, pilotos, carreras, pronósticos, pedidos, banners y consulta de usuarios.",
        SUPERADMIN: "Todo lo del administrador, además de roles, activación de cuentas, PitCoins y auditoría.",
    };
    let me = {};
    let user = null;

    const roleTag = role => `<span class="admin-role admin-role--${esc(role.toLowerCase())}">${esc(ROLE_LABELS[role] || role)}</span>`;
    const statusPill = active => `<span class="status-pill status-pill--${active ? "paid" : "cancelled"}">${active ? "Activo" : "Inactivo"}</span>`;
    const fullName = data => `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.username;

    function stat(icon, label, value, note) {
        return `<div class="user-stat"><span class="user-stat__icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
            <div><span class="user-stat__label">${esc(label)}</span><strong>${value}</strong><small>${note}</small></div></div>`;
    }

    function info(label, value) {
        return `<div><dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="admin-muted">Sin registrar</span>'}</dd></div>`;
    }

    function accessCard() {
        const head = `<div class="admin-card__head"><div><h2>Configuración de acceso</h2><p>Rol y estado de la cuenta</p></div></div>`;
        if (!me.is_superadmin || user.id === me.id) {
            const why = !me.is_superadmin
                ? "Solo el superadministrador puede cambiar roles o desactivar cuentas."
                : "Es tu propia cuenta: tu rol y tu estado no se pueden cambiar desde aquí.";
            return `<section class="admin-card user-access">${head}
                <dl class="user-info user-info--single">${`<div><dt>Rol</dt><dd>${roleTag(user.role)}</dd></div><div><dt>Estado</dt><dd>${statusPill(user.is_active)}</dd></div>`}</dl>
                <p class="user-access__help">${esc(ROLE_HELP[user.role])}</p>
                <p class="admin-field__hint"><i class="fa-solid fa-lock" aria-hidden="true"></i> ${esc(why)}</p></section>`;
        }
        const options = Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("");
        return `<section class="admin-card user-access">${head}
            <form id="access-form" novalidate>
                <label class="admin-field">Rol<select id="user-role">${options}</select></label>
                <p class="user-access__help" id="role-help">${esc(ROLE_HELP[user.role])}</p>
                <label class="admin-toggle">
                    <input type="checkbox" id="user-active" role="switch" ${user.is_active ? "checked" : ""}>
                    <span class="admin-toggle__track" aria-hidden="true"></span>
                    <span><strong>Cuenta activa</strong><small id="active-help">${user.is_active ? "Puede iniciar sesión." : "No puede iniciar sesión."}</small></span>
                </label>
                <div class="user-access__confirm" id="access-confirm" hidden role="alert"></div>
                <p class="admin-field__error" id="access-error" role="alert"></p>
                <div class="user-access__actions">
                    <button type="submit" class="btn-primary user-access__save" id="access-save" disabled><i class="fa-regular fa-floppy-disk" aria-hidden="true"></i> Guardar cambios</button>
                </div>
            </form></section>`;
    }

    function activityCard() {
        const links = [
            { href: `orders.html?q=${encodeURIComponent(user.email)}`, icon: "fa-receipt", title: "Compras", note: `${A.formatNumber(user.purchases.total)} ${user.purchases.total === 1 ? "compra" : "compras"} · ${A.formatMoney(user.purchases.spent)}` },
            { href: `predictions.html?q=${encodeURIComponent(user.username)}`, icon: "fa-chart-simple", title: "Pronósticos", note: `${A.formatNumber(user.predictions.total)} ${Number(user.predictions.total) === 1 ? "realizado" : "realizados"} · ${A.formatNumber(user.predictions.won)} ${Number(user.predictions.won) === 1 ? "acertado" : "acertados"}` },
        ];
        if (me.is_superadmin) {
            links.unshift({ href: `pitcoins.html?user=${user.id}`, icon: "fa-coins", title: "Movimientos de PitCoins", note: `Saldo actual: ${A.formatNumber(user.coins)} PitCoins` });
        }
        return `<section class="admin-card"><div class="admin-card__head"><div><h2>Actividad del usuario</h2><p>Historiales completos en sus módulos</p></div></div>
            <div class="user-links">${links.map(link => `<a class="user-link" href="${link.href}">
                <span class="user-stat__icon"><i class="fa-solid ${link.icon}" aria-hidden="true"></i></span>
                <span><strong>${esc(link.title)}</strong><small>${esc(link.note)}</small></span>
                <i class="fa-solid fa-chevron-right user-link__arrow" aria-hidden="true"></i></a>`).join("")}</div></section>`;
    }

    function render() {
        const name = fullName(user);
        const won = Number(user.predictions.won || 0);
        const total = Number(user.predictions.total || 0);
        const xpValue = user.xp_total == null ? "—" : `${A.formatNumber(user.xp_total)}`;
        const xpNote = user.xp_total == null ? "Sistema de XP desactivado" : `Nivel ${user.level} · ${esc(user.rank)}`;
        root.innerHTML = `
            <a class="admin-link" href="users.html"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Usuarios</a>
            <section class="admin-card user-head">
                ${A.driverAvatar(name, null, "medium")}
                <div class="user-head__main">
                    <h2>${esc(name)}</h2>
                    <p>${esc(user.email)}</p>
                </div>
                <div class="user-head__meta">${roleTag(user.role)}${statusPill(user.is_active)}
                    <span class="user-head__date"><i class="fa-regular fa-calendar" aria-hidden="true"></i> Registro: ${esc(A.formatDateTime(user.created_at))}</span></div>
            </section>
            <section class="user-stats" aria-label="Estadísticas del usuario">
                ${stat("fa-bag-shopping", "Compras", A.formatNumber(user.purchases.total), `${A.formatMoney(user.purchases.spent)} en total`)}
                ${stat("fa-chart-simple", "Pronósticos", A.formatNumber(total), "Realizados")}
                ${stat("fa-bullseye", "Aciertos", A.formatNumber(won), total ? `${Math.round((won / total) * 100)} % de efectividad` : "Sin pronósticos")}
                ${stat("fa-coins", "PitCoins", A.formatNumber(user.coins), "Saldo actual")}
                ${stat("fa-bolt", "Experiencia (XP)", xpValue, xpNote)}
            </section>
            <div class="user-columns">
                <section class="admin-card"><div class="admin-card__head"><div><h2>Información personal</h2><p>Datos de la cuenta y de entrega</p></div></div>
                    <dl class="user-info">
                        ${info("Nombre completo", name)}
                        ${info("Correo electrónico", user.email)}
                        ${info("Teléfono", user.phone)}
                        ${info("Dirección", user.address)}
                        ${info("Fecha de registro", A.formatDateTime(user.created_at))}
                        ${user.username !== user.email ? info("Usuario", user.username) : ""}
                    </dl>
                </section>
                ${accessCard()}
            </div>
            ${activityCard()}`;
        bindAccess();
    }

    function bindAccess() {
        const form = root.querySelector("#access-form");
        if (!form) return;
        const role = form.querySelector("#user-role");
        const active = form.querySelector("#user-active");
        const save = form.querySelector("#access-save");
        const confirmBox = form.querySelector("#access-confirm");
        const error = form.querySelector("#access-error");
        const changed = () => role.value !== user.role || active.checked !== Boolean(user.is_active);

        const refresh = () => {
            form.querySelector("#role-help").textContent = ROLE_HELP[role.value];
            form.querySelector("#active-help").textContent = active.checked ? "Puede iniciar sesión." : "No puede iniciar sesión.";
            save.disabled = !changed();
            confirmBox.hidden = true;
            error.textContent = "";
        };
        role.addEventListener("change", refresh);
        active.addEventListener("change", refresh);

        // Confirmación en la propia tarjeta (sin ventanas emergentes del navegador).
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (!changed()) return;
            confirmBox.innerHTML = `<span>¿Guardar para <strong>${esc(user.email)}</strong>: rol <strong>${esc(ROLE_LABELS[role.value])}</strong>, cuenta <strong>${active.checked ? "activa" : "inactiva"}</strong>? El cambio queda en auditoría.</span>
                <span class="user-access__confirm-actions"><button type="button" class="admin-button" data-cancel>Cancelar</button><button type="button" class="btn-primary" data-confirm>Confirmar</button></span>`;
            confirmBox.hidden = false;
        });
        confirmBox.addEventListener("click", async event => {
            if (event.target.closest("[data-cancel]")) { confirmBox.hidden = true; return; }
            const button = event.target.closest("[data-confirm]");
            if (!button) return;
            button.disabled = true;
            try {
                const data = await A.api(`/api/admin/users/${user.id}/access`, {
                    method: "POST",
                    body: JSON.stringify({ version: user.version, role: role.value, is_active: active.checked }),
                });
                user = data.user;
                render();
                A.notify("Acceso actualizado.");
            } catch (cause) {
                confirmBox.hidden = true;
                error.textContent = cause.message;
                button.disabled = false;
            }
        });
    }

    async function load() {
        if (!Number.isInteger(id) || id < 1) {
            root.innerHTML = `<div class="admin-alert" role="alert"><span>Usuario inválido.</span><a class="admin-button" href="users.html">Volver a usuarios</a></div>`;
            return;
        }
        try {
            user = (await A.api(`/api/admin/users/${id}`)).user;
            render();
        } catch (cause) {
            if (cause.status === 401) return;
            root.innerHTML = `<div class="admin-alert" role="alert"><span>${esc(cause.message)}</span><button type="button" class="admin-button" id="user-retry">Reintentar</button></div>`;
            root.querySelector("#user-retry").addEventListener("click", load);
        }
    }

    A.ready.then(session => { me = session; load(); }).catch(() => {});
})();
