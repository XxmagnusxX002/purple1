document.addEventListener("DOMContentLoaded", () => {
    const token = new URLSearchParams(location.search).get("token") || "";
    history.replaceState(null, "", location.pathname);
    document.querySelector("form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!token) return alert("El enlace de recuperación no es válido.");
        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    new_password: document.getElementById("new-password").value,
                    password_confirm: document.getElementById("password-confirm").value
                })
            });
            const data = await response.json();
            alert(data.success ? data.message : data.error);
            if (data.success) location.href = "auth.html";
        } catch (error) {
            alert("No fue posible actualizar la contraseña.");
        }
    });
});
