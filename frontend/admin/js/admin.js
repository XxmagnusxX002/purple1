/* Estructura comun del panel administrativo de Purple One.
 *
 * Cada pagina del panel declara en <body> data-admin-page y data-admin-title, y
 * carga este archivo antes de su propio script. El acceso real lo valida el
 * backend en cada peticion (/api/admin/*); aqui solo se adapta la interfaz.
 * Expone window.PurpleAdmin con utilidades compartidas.
 */
(function () {
    "use strict";

    const LOGIN_PAGE = "/admin/login.html";

    // Unica lista de modulos. "pending" = fase futura: se muestra en el menu como
    // "Proximamente", sin enlace, para no presentar pantallas vacias como terminadas.
    // "superadmin" = solo lo ve el superadministrador (el backend tambien lo exige).
    const MODULES = [
        { id: "dashboard", group: "Gestión", label: "Dashboard", icon: "fa-gauge-high", href: "/admin/index.html" },
        { id: "products", group: "Gestión", label: "Productos", icon: "fa-shirt", href: "/admin/products.html" },
        { id: "categories", group: "Gestión", label: "Categorías", icon: "fa-sitemap", href: "/admin/categories.html" },
        { id: "attributes", group: "Gestión", label: "Atributos", icon: "fa-tags", href: "/admin/attributes.html" },
        { id: "teams", group: "Gestión", label: "Equipos", icon: "fa-flag-checkered", href: "/admin/teams.html" },
        { id: "drivers", group: "Gestión", label: "Pilotos", icon: "fa-helmet-safety", href: "/admin/drivers.html" },
        { id: "races", group: "Gestión", label: "Carreras", icon: "fa-stopwatch", href: "/admin/races.html" },
        { id: "predictions", group: "Gestión", label: "Pronósticos", icon: "fa-chart-simple", href: "/admin/predictions.html" },
        { id: "orders", group: "Gestión", label: "Pedidos", icon: "fa-receipt", href: "/admin/orders.html" },
        { id: "banners", group: "Administración", label: "Banners", icon: "fa-images", href: "/admin/banners.html" },
        { id: "users", group: "Administración", label: "Usuarios", icon: "fa-users", href: "/admin/users.html" },
        { id: "pitcoins", group: "Administración", label: "PitCoins", icon: "fa-coins", href: "/admin/pitcoins.html", superadmin: true },
        { id: "settings", group: "Administración", label: "Configuración", icon: "fa-sliders", href: "/admin/settings.html", superadmin: true },
        { id: "audit", group: "Administración", label: "Auditoría", icon: "fa-clipboard-list", href: "/admin/audit.html", superadmin: true },
    ];

    const body = document.body;
    const shell = document.querySelector("#admin-shell");
    const sidebar = document.querySelector("#admin-sidebar");
    const overlay = document.querySelector("#admin-overlay");
    const title = document.querySelector("#admin-title");
    const userBox = document.querySelector("#admin-user");
    const content = document.querySelector("#admin-content");
    const menuToggle = document.querySelector("#admin-menu-toggle");

    class ApiError extends Error {
        constructor(message, status, fields) {
            super(message);
            this.status = status;
            this.fields = fields || {};
        }
    }

    function escapeHTML(value) {
        return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function driverInitials(name) {
        const words = String(name || "").trim().split(/\s+/).map(word => word.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean);
        return (words.length > 1 ? words[0] + words[words.length - 1] : words[0] || "P").toLocaleUpperCase("es");
    }

    function isDriverPhoto(imagePath) {
        const path = String(imagePath || "").replaceAll("\\", "/");
        return Boolean(path && !/(?:^|\/)\S*placeholder\S*\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(path));
    }

    function driverAvatar(name, imagePath, size = "small") {
        const sizeClass = size === "medium" ? " driver-avatar--medium" : size === "large" ? " driver-avatar--large" : "";
        const path = String(imagePath || "").replaceAll("\\", "/");
        const src = /^https?:\/\/|^\//i.test(path) ? path : `../${path}`;
        const image = isDriverPhoto(path) ? `<img src="${escapeHTML(src)}" alt="" loading="lazy">` : "";
        return `<span class="driver-avatar${sizeClass}" aria-hidden="true"><span class="driver-avatar__initials">${escapeHTML(driverInitials(name))}</span>${image}</span>`;
    }

    // Miniatura de producto o equipo: imagen real o icono neutro (nunca un placeholder "P1").
    function thumb(imagePath, size = 44, icon = "fa-box-open", className = "") {
        const path = String(imagePath || "").replaceAll("\\", "/");
        if (!isDriverPhoto(path)) {
            return `<span class="admin-thumb-fallback ${className}" style="--size:${size}px" aria-hidden="true"><i class="fa-solid ${icon}"></i></span>`;
        }
        const src = /^https?:\/\/|^\//i.test(path) ? path : `../${path}`;
        return `<img class="${className}" src="${escapeHTML(src)}" alt="" width="${size}" height="${size}" loading="lazy">`;
    }

    document.addEventListener("error", event => {
        if (event.target?.matches?.(".driver-avatar img")) event.target.hidden = true;
    }, true);

    const moneyFormat = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
    const numberFormat = new Intl.NumberFormat("es-ES");

    function formatMoney(value) {
        return moneyFormat.format(Number(value || 0));
    }

    function formatNumber(value) {
        return numberFormat.format(Number(value || 0));
    }

    function formatDateTime(value) {
        if (!value) return "—";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    async function api(url, options = {}) {
        let response;
        try {
            response = await fetch(url, {
                credentials: "same-origin",
                ...options,
                headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            });
        } catch (error) {
            throw new ApiError("No hay conexión con el servidor.", 0);
        }
        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            throw new ApiError("Respuesta inválida del servidor.", response.status);
        }
        if (response.status === 401) {
            window.location.replace(LOGIN_PAGE);
            throw new ApiError(data?.error || "Inicia sesión para continuar.", 401);
        }
        if (!response.ok || !data?.success) {
            throw new ApiError(data?.error || "No se pudo completar la solicitud.", response.status, data?.fields);
        }
        return data;
    }

    // Aviso breve (exito o error) que no bloquea la pantalla.
    function notify(message, tone = "ok") {
        let box = document.querySelector("#admin-toast");
        if (!box) {
            box = document.createElement("div");
            box.id = "admin-toast";
            box.className = "admin-toast";
            box.setAttribute("role", "status");
            box.setAttribute("aria-live", "polite");
            document.body.appendChild(box);
        }
        box.textContent = message;
        box.dataset.tone = tone;
        box.hidden = false;
        clearTimeout(notify.timer);
        notify.timer = setTimeout(() => { box.hidden = true; }, 4000);
    }

    const ROLE_LABELS = { SUPERADMIN: "Superadministrador", STAFF: "Administrador" };

    // Hasta conocer la sesion se muestran solo los modulos comunes.
    function renderSidebar(user) {
        if (!sidebar) return;
        const current = body.dataset.adminPage;
        const visible = MODULES.filter(module => !module.superadmin || user?.is_superadmin);
        const groups = [...new Set(visible.map(module => module.group))];
        const item = module => module.pending
            ? `<span class="admin-nav__pending" aria-disabled="true" title="Se implementará en una fase posterior"><i class="fa-solid ${module.icon}" aria-hidden="true"></i>${escapeHTML(module.label)}<small aria-hidden="true">Pronto</small><span class="visually-hidden">(próximamente)</span></span>`
            : `<a href="${module.href}"${module.id === current ? ' aria-current="page"' : ""}><i class="fa-solid ${module.icon}" aria-hidden="true"></i>${escapeHTML(module.label)}</a>`;
        sidebar.innerHTML = `
            <a class="admin-brand" href="/admin/index.html"><span class="admin-brand__logo">PURPLE1</span><span class="admin-brand__tag">Admin</span></a>
            ${groups.map(group => `<nav class="admin-nav" aria-label="${escapeHTML(group)}">
                <p class="admin-nav__label">${escapeHTML(group)}</p>
                ${visible.filter(module => module.group === group).map(item).join("")}
            </nav>`).join("")}
            <div class="admin-nav admin-sidebar__footer">
                <a href="/index.html"><i class="fa-solid fa-store" aria-hidden="true"></i>Ver tienda</a>
            </div>`;
        if (title) title.textContent = body.dataset.adminTitle || "Panel";
        document.title = `${body.dataset.adminTitle || "Panel"} | Purple One Admin`;
    }

    function setMenuOpen(open) {
        if (!shell) return;
        shell.classList.toggle("is-menu-open", open);
        if (overlay) overlay.hidden = !open;
        if (menuToggle) menuToggle.setAttribute("aria-expanded", String(open));
    }

    async function logout() {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
        } finally {
            window.location.replace(LOGIN_PAGE);
        }
    }

    function renderUser(user) {
        if (!userBox) return;
        const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
        const initials = (user.first_name?.[0] || user.email?.[0] || "A").toUpperCase();
        userBox.innerHTML = `
            <button type="button" class="admin-user__toggle" aria-expanded="false" aria-controls="admin-user-menu">
                <span class="admin-user__avatar" aria-hidden="true">${escapeHTML(initials)}</span>
                <span class="admin-user__name">${escapeHTML(user.first_name || name)}</span>
                <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
            </button>
            <div class="admin-user__menu" id="admin-user-menu" hidden>
                <div class="admin-user__identity"><strong>${escapeHTML(name)}</strong><span>${escapeHTML(user.email)}</span><span class="admin-role-badge">${escapeHTML(ROLE_LABELS[user.role] || "Administrador")}</span></div>
                <a href="/profile.html"><i class="fa-regular fa-user" aria-hidden="true"></i>Mi perfil</a>
                <a href="/change_password.html"><i class="fa-solid fa-key" aria-hidden="true"></i>Cambiar contraseña</a>
                <a href="/index.html"><i class="fa-solid fa-store" aria-hidden="true"></i>Ver tienda</a>
                <button type="button" data-admin-logout><i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>Cerrar sesión</button>
            </div>`;
        const toggle = userBox.querySelector(".admin-user__toggle");
        const menu = userBox.querySelector(".admin-user__menu");
        const setOpen = open => {
            menu.hidden = !open;
            toggle.setAttribute("aria-expanded", String(open));
        };
        toggle.addEventListener("click", event => {
            event.stopPropagation();
            setOpen(menu.hidden);
        });
        menu.querySelector("[data-admin-logout]").addEventListener("click", logout);
        document.addEventListener("click", event => {
            if (!userBox.contains(event.target)) setOpen(false);
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") setOpen(false);
        });
    }

    function renderForbidden() {
        if (!content) return;
        content.innerHTML = `<div class="admin-card admin-gate" role="alert"><h2>Acceso restringido</h2><p>Esta cuenta no tiene acceso administrativo.</p><button type="button" class="admin-button" data-admin-logout>Cerrar sesión</button></div>`;
        content.querySelector("[data-admin-logout]").addEventListener("click", logout);
    }

    function renderSuperadminOnly() {
        if (!content) return;
        content.innerHTML = `<div class="admin-card admin-gate" role="alert"><h2>Solo para el superadministrador</h2><p>Tu rol de administrador no incluye esta sección.</p><a class="admin-button" href="/admin/index.html">Volver al dashboard</a></div>`;
    }

    class SuperadminRequired extends Error {}

    renderSidebar();
    menuToggle?.addEventListener("click", () => setMenuOpen(!shell.classList.contains("is-menu-open")));
    overlay?.addEventListener("click", () => setMenuOpen(false));
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") setMenuOpen(false);
    });

    // Sin conexion con el servidor o con la base de datos: se dice claramente en
    // lugar de dejar la pagina con indicadores de carga para siempre.
    function renderUnavailable(error) {
        if (!content) return;
        const detail = error.status ? `El servidor respondió ${error.status}.` : "No hubo respuesta del servidor.";
        content.innerHTML = `<div class="admin-card admin-gate" role="alert"><h2>No se pudo conectar con el panel</h2>
            <p>${escapeHTML(detail)} Comprueba que el servidor (<code>python main.py</code>) y MySQL estén en marcha.</p>
            <button type="button" class="admin-button" data-admin-retry>Reintentar</button></div>`;
        content.querySelector("[data-admin-retry]").addEventListener("click", () => window.location.reload());
    }

    const ready = api("/api/admin/session").then(data => {
        renderUser(data.user);
        renderSidebar(data.user);
        const module = MODULES.find(item => item.id === body.dataset.adminPage);
        if (module?.superadmin && !data.user.is_superadmin) {
            renderSuperadminOnly();
            throw new SuperadminRequired();
        }
        return data.user;
    }).catch(error => {
        if (error instanceof SuperadminRequired) throw error;
        if (error.status === 403) renderForbidden();
        else if (error.status !== 401) renderUnavailable(error);
        throw error;
    });
    // Evita avisos de promesa no atendida; cada pagina espera "ready" por su cuenta.
    ready.catch(() => {});

    // ------------------------------------------------------------ textos legibles
    // Códigos técnicos -> español. El código original solo se muestra en los detalles.
    const LABELS = {
        movements: {
            OPENING_BALANCE: "Saldo inicial", STAFF_ADJUSTMENT: "Ajuste administrativo", BET_REFUND: "Devolución de pronóstico",
            BET_STAKE: "Pronóstico realizado", BET_PRIZE: "Premio por pronóstico", BET_ADJUSTMENT: "Cambio de pronóstico",
            LEVEL_REWARD: "Recompensa por nivel", AVATAR_PURCHASE: "Compra de artículo del avatar", DISCOUNT_REDEMPTION: "Canje por descuento",
        },
        actions: {
            ADMIN_LOGIN: "Inicio de sesión en el panel", USER_ACCESS_CHANGED: "Rol o estado de usuario cambiado", USER_DEACTIVATED: "Usuario desactivado",
            PITCOIN_ADJUSTED: "Ajuste de PitCoins", IMAGE_UPLOADED: "Imagen subida",
            RACE_CREATED: "Carrera creada", RACE_UPDATED: "Carrera editada", RACE_OPENED: "Pronósticos abiertos", RACE_LOCKED: "Pronósticos cerrados",
            RACE_REOPENED: "Pronósticos reabiertos", RACE_UNPUBLISHED: "Carrera devuelta a programada", RACE_SETTLED: "Carrera liquidada",
            RACE_CANCELLED: "Carrera cancelada", RACE_PARTICIPANTS_ADDED: "Pilotos agregados a la carrera", RACE_PARTICIPANT_REMOVED: "Piloto retirado de la carrera",
            PRODUCT_CREATED: "Producto creado", PRODUCT_UPDATED: "Producto editado", PRODUCT_FLAGS: "Producto activado o destacado",
            VARIANT_CREATED: "Variante creada", VARIANT_UPDATED: "Variante editada", STOCK_ADJUSTED: "Stock ajustado",
            CATEGORY_CREATED: "Categoría creada", CATEGORY_UPDATED: "Categoría actualizada", PRODUCT_TYPE_CREATED: "Tipo de producto creado",
            PRODUCT_TYPE_UPDATED: "Tipo de producto actualizado", SIZE_CREATED: "Talla creada", SIZE_UPDATED: "Talla actualizada",
            COLOR_CREATED: "Color creado", COLOR_UPDATED: "Color actualizado",
            TEAM_CREATED: "Escudería creada", TEAM_UPDATED: "Escudería editada", TEAM_ACTIVATED: "Escudería activada", TEAM_DEACTIVATED: "Escudería desactivada",
            DRIVER_CREATED: "Piloto creado", DRIVER_UPDATED: "Piloto editado", DRIVER_ACTIVATED: "Piloto activado", DRIVER_DEACTIVATED: "Piloto desactivado",
            BANNER_CREATED: "Banner creado", BANNER_UPDATED: "Banner editado", BANNER_ACTIVATED: "Banner activado", BANNER_DEACTIVATED: "Banner desactivado",
            CURRENCY_CREATED: "Moneda creada", CURRENCY_UPDATED: "Moneda actualizada", DISCOUNT_REWARD_CREATED: "Descuento con PitCoins creado",
            DISCOUNT_REWARD_UPDATED: "Descuento con PitCoins actualizado", REWARD_RULE_CREATED: "Objetivo de fidelización creado (versión anterior)",
            REWARD_RULE_UPDATED: "Objetivo de fidelización actualizado (versión anterior)", SETTINGS_UPDATED: "Parámetros actualizados",
        },
        entities: {
            session: "Sesión", user: "Usuario", image: "Imagen", race: "Carrera", product: "Producto", inventory: "Variante",
            category: "Categoría", product_type: "Tipo de producto", size: "Talla", color: "Color", team: "Escudería", driver: "Piloto",
            banner: "Banner", currency: "Moneda", discount_reward: "Descuento con PitCoins", reward_rule: "Objetivo de fidelización", settings: "Configuración",
        },
    };
    const label = (group, code) => LABELS[group][code] || String(code || "").toLowerCase().replaceAll("_", " ").replace(/^./, c => c.toUpperCase());

    // ------------------------------------------------------------ ventana de detalle
    // Modal de solo lectura: filas [etiqueta, html]. Se cierra con Esc, el fondo o el botón.
    function detailModal(title, rows, intro = "") {
        document.querySelector("#detail-modal")?.remove();
        const box = document.createElement("div");
        box.className = "admin-modal";
        box.id = "detail-modal";
        box.innerHTML = `<div class="admin-modal__backdrop" data-close-detail></div>
            <section class="admin-modal__card detail-card" role="dialog" aria-modal="true" aria-labelledby="detail-title">
                <header class="detail-card__head"><div><h2 id="detail-title">${escapeHTML(title)}</h2>${intro ? `<p>${intro}</p>` : ""}</div>
                    <button type="button" class="admin-icon-button" data-close-detail aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
                <dl class="detail-list">${rows.filter(Boolean).map(([key, value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${value}</dd></div>`).join("")}</dl>
            </section>`;
        const opener = document.activeElement;
        const close = () => { box.remove(); document.removeEventListener("keydown", onKey); opener?.focus?.(); };
        const onKey = event => { if (event.key === "Escape") close(); };
        box.addEventListener("click", event => { if (event.target.closest("[data-close-detail]")) close(); });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(box);
        box.querySelector(".detail-card__head .admin-icon-button").focus();
        return close;
    }

    // ------------------------------------------------------------ paginación
    // Mismo marcado que Usuarios: <nav class="admin-pagination"> con Anterior / Siguiente.
    function pagination(nav, data, go) {
        nav.hidden = data.pages <= 1;
        nav.innerHTML = `<button type="button" class="admin-button" data-page="prev" ${data.page <= 1 ? "disabled" : ""}><i class="fa-solid fa-chevron-left" aria-hidden="true"></i> Anterior</button>
            <span>Página ${data.page} de ${data.pages}</span>
            <button type="button" class="admin-button" data-page="next" ${data.page >= data.pages ? "disabled" : ""}>Siguiente <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>`;
        nav.onclick = event => {
            const button = event.target.closest("[data-page]");
            if (button) go(Math.min(data.pages, Math.max(1, data.page + (button.dataset.page === "next" ? 1 : -1))));
        };
    }

    window.PurpleAdmin = { api, ApiError, escapeHTML, driverInitials, isDriverPhoto, driverAvatar, thumb, formatMoney, formatNumber, formatDateTime, ready, logout, notify, MODULES, LABELS, label, detailModal, pagination };
})();
