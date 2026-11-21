document.addEventListener("DOMContentLoaded", function () {
    const tabs = document.querySelectorAll(".tab");
    const loginPanel = document.getElementById("panel-login");
    const registerPanel = document.getElementById("panel-register");
    const regPass = document.getElementById("reg-pass");
    const strengthBar = document.getElementById("strength-bar");
    const loginForm = document.getElementById("panel-login");
    const registerForm = document.getElementById("panel-register");

    tabs.forEach((tab) => {
        tab.addEventListener("click", function () {
            activateTab(this.dataset.tab);
        });
    });

    function activateTab(tabName) {
        tabs.forEach((item) => item.classList.toggle("active", item.dataset.tab === tabName));
        loginPanel.classList.toggle("active", tabName === "login");
        registerPanel.classList.toggle("active", tabName === "register");
    }

    if (regPass && strengthBar) {
        regPass.addEventListener("input", function () {
            let level = 0;
            const value = this.value;
            if (value.length >= 8) level++;
            if (/[A-Z]/.test(value)) level++;
            if (/[0-9]/.test(value)) level++;
            if (/[^A-Za-z0-9]/.test(value)) level++;
            strengthBar.dataset.level = level;
        });
    }

    function getOrCreateAlert(form) {
        let alertBox = form.querySelector(".auth-message.client-message");
        if (!alertBox) {
            alertBox = document.createElement("div");
            alertBox.className = "auth-message error client-message";
            form.insertBefore(alertBox, form.querySelector(".field, .field-row"));
        }
        return alertBox;
    }

    function showAlert(form, message, ok = false) {
        const alertBox = getOrCreateAlert(form);
        alertBox.textContent = message;
        alertBox.hidden = false;
        alertBox.classList.toggle("error", !ok);
        alertBox.classList.toggle("success", ok);
    }

    async function postJSON(url, payload) {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || "No fue posible completar la operacion.");
        }
        return data;
    }

    loginForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
            const data = await postJSON("/api/auth/login", {
                email: document.getElementById("login-email").value.trim(),
                password: document.getElementById("login-pass").value
            });
            localStorage.removeItem("purple1_user");
            // Cuenta de ejemplo con la contrasena publica de seed.sql: debe cambiarla.
            window.location.href = data.user && data.user.password_change_required
                ? "change_password.html?required=1"
                : "products.html";
        } catch (error) {
            showAlert(loginForm, error.message);
        }
    });

    registerForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
            const email = document.getElementById("reg-email").value.trim();
            const data = await postJSON("/api/auth/register", {
                first_name: document.getElementById("reg-name").value.trim(),
                last_name: document.getElementById("reg-lastname").value.trim(),
                email,
                password: document.getElementById("reg-pass").value,
                password_confirm: document.getElementById("reg-pass2").value
            });
            registerForm.reset();
            document.getElementById("login-email").value = email;
            activateTab("login");
            showAlert(loginForm, "Registro exitoso. Ahora inicia sesion.", true);
        } catch (error) {
            showAlert(registerForm, error.message);
        }
    });
});
