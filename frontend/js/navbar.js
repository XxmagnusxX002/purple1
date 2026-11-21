document.addEventListener("DOMContentLoaded", function () {
    const userMenu = document.querySelector(".nav-user-menu");
    if (!userMenu) return;

    const toggle = userMenu.querySelector(".nav-user-toggle");
    const dropdown = userMenu.querySelector(".nav-user-dropdown");

    let signedInUser = null;
    function getUser() { return signedInUser; }
    function escapeHTML(value) {
        return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function renderUserMenu() {
        const user = getUser();

        if (!dropdown) return;

        if (user && user.id) {
            const displayName = user.first_name || user.email || "Mi cuenta";
            // Solo es un acceso directo: el panel valida el rol en el backend.
            const adminLink = user.is_staff ? '<a href="/admin/index.html" data-admin-link>Panel de administración</a>' : "";
            dropdown.innerHTML = `
                <div class="nav-user-greeting">Hola, ${escapeHTML(displayName)}</div>
                ${adminLink}
                <a href="profile.html">Mi perfil</a>
                <a href="orders.html">Mis pedidos</a>
                <a href="change_password.html">Cambiar contraseña</a>
                <a href="#" data-logout="true">Cerrar sesión</a>
            `;
            toggle.classList.add("active");
        } else {
            dropdown.innerHTML = `
                <div class="nav-user-greeting">Mi cuenta</div>
                <a href="auth.html">Iniciar sesión</a>
            `;
            toggle.classList.remove("active");
        }
    }

    // Pista local (solo el último saldo, nada personal): si la visita anterior tenía
    // sesión, el saldo reserva su lugar desde el inicio y no desplaza el menú.
    const HINT = "purple1_coins_hint";
    const readHint = () => { try { return localStorage.getItem(HINT); } catch (error) { return null; } };
    const writeHint = (value) => { try { value == null ? localStorage.removeItem(HINT) : localStorage.setItem(HINT, String(value)); } catch (error) { /* sin almacenamiento */ } };

    function placeholderBadge() {
        const icons = document.querySelector(".nav-icons");
        if (!icons || readHint() == null || icons.querySelector(".nav-coin-badge")) return;
        const badge = document.createElement("a");
        badge.href = "races.html";
        badge.className = "nav-coin-badge is-loading";
        badge.title = "Tus PitCoins";
        badge.setAttribute("aria-busy", "true");
        badge.innerHTML = `<i class="fa-solid fa-coins"></i> <span>${Number(readHint()).toLocaleString("es-CO")}</span>`;
        icons.insertBefore(badge, userMenu);
    }
    placeholderBadge();

    async function renderCoinBadge() {
        const user = getUser();
        const icons = document.querySelector(".nav-icons");
        if (!icons) return;
        let badge = icons.querySelector(".nav-coin-badge");
        if (!user || !user.id) {
            badge?.remove();
            writeHint(null);
            return;
        }
        if (!badge) {
            badge = document.createElement("a");
            badge.href = "races.html";
            badge.className = "nav-coin-badge";
            badge.title = "Tus PitCoins";
            icons.insertBefore(badge, userMenu);
        }
        if (user.coins != null) {
            badge.classList.remove("is-loading");
            badge.removeAttribute("aria-busy");
            badge.innerHTML = `<i class="fa-solid fa-coins"></i> <span>${user.coins}</span>`;
        }
        try {
            const res = await fetch(`/api/users/${user.id}`);
            const data = await res.json();
            if (data.success) {
                badge.classList.remove("is-loading");
                badge.removeAttribute("aria-busy");
                badge.innerHTML = `<i class="fa-solid fa-coins"></i> <span>${data.user.coins}</span>`;
                writeHint(data.user.coins);
            }
        } catch (error) {
            // Si falla, se mantiene el ultimo saldo conocido.
        }
    }

    fetch("/api/auth/me").then(async (response) => {
        signedInUser = response.ok ? (await response.json()).user : null;
        localStorage.removeItem("purple1_user");
        renderUserMenu();
        renderCoinBadge();
    }).catch(() => { renderUserMenu(); renderCoinBadge(); });

    toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        const isOpen = userMenu.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(isOpen));
    });

    dropdown?.addEventListener("click", async function (event) {
        const logout = event.target.closest("[data-logout]");
        if (!logout) return;

        event.preventDefault();
        try {
            await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        } catch (error) {
            // La sesion del frontend se limpia aunque el endpoint no responda.
        }
        localStorage.removeItem("purple1_user");
        signedInUser = null;
        renderUserMenu();
        renderCoinBadge();
        window.location.href = "auth.html";
    });

    // Otras páginas avisan cuando cambia el saldo (p. ej. un canje en el carrito).
    window.addEventListener("purple1:coinschange", () => renderCoinBadge());

    document.addEventListener("click", function (event) {
        if (!userMenu.contains(event.target)) {
            userMenu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }
    });
});
