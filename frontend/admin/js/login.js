/* Login del panel. Usa POST /api/admin/login: el backend crea la sesion solo
   para cuentas staff y responde lo mismo ante cualquier fallo. */
(function () {
    "use strict";

    const PANEL = "/admin/index.html";
    const form = document.querySelector("#admin-login-form");
    const email = document.querySelector("#admin-email");
    const password = document.querySelector("#admin-password");
    const submit = document.querySelector("#admin-login-submit");
    const errorBox = document.querySelector("#admin-login-error");
    let busy = false;

    function showError(message) {
        errorBox.textContent = message;
        errorBox.hidden = false;
    }

    // Si ya hay una sesion de staff, se entra directo al panel.
    fetch("/api/admin/session", { credentials: "same-origin" })
        .then(response => { if (response.ok) window.location.replace(PANEL); })
        .catch(() => {});

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;
        errorBox.hidden = true;
        if (!email.value.trim() || !password.value) {
            showError("Escribe tu correo y tu contraseña.");
            return;
        }
        busy = true;
        submit.disabled = true;
        submit.textContent = "Ingresando…";
        try {
            const response = await fetch("/api/admin/login", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.value.trim(), password: password.value }),
            });
            let data = null;
            try {
                data = await response.json();
            } catch (error) {
                data = null;
            }
            if (!response.ok || !data?.success) {
                showError(data?.error || "No fue posible iniciar sesión.");
                password.value = "";
                password.focus();
                return;
            }
            window.location.replace(PANEL);
        } catch (error) {
            showError("No hay conexión con el servidor. Inténtalo de nuevo.");
        } finally {
            busy = false;
            submit.disabled = false;
            submit.textContent = "Ingresar al panel";
        }
    });
})();
