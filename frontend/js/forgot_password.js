document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const response = await fetch("/api/auth/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: document.getElementById("identifier").value.trim()
            })
        });
        const data = await response.json();
        alert(data.success ? data.message : data.error);
    });
});
