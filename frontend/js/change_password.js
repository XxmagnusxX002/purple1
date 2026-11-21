document.addEventListener("DOMContentLoaded", () => {
    if (new URLSearchParams(window.location.search).get("required") === "1") {
        const intro = document.querySelector(".cp-title p");
        if (intro) {
            intro.textContent = "Tu cuenta usa la contrasena publica de ejemplo. Cambiala para activar los permisos de administracion.";
        }
    }
    document.querySelector(".cp-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const response = await fetch("/api/auth/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                current_password: document.querySelector('[name="current_password"]').value,
                new_password: document.querySelector('[name="new_password"]').value,
                password_confirm: document.querySelector('[name="password_confirm"]').value
            })
        });
        const data = await response.json();
        alert(data.success ? data.message : data.error);
        if (data.success) {
            localStorage.removeItem("purple1_user");
            window.location.href = "auth.html";
        }
    });
});
