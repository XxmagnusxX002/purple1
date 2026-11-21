/* Mi perfil: sesión, datos personales y avatar.
 * La progresión (nivel, XP, recompensa) y la actividad reciente están en progress.js. */
document.addEventListener("DOMContentLoaded", async () => {
    const guest = document.querySelector("#pf-guest");
    const content = document.querySelector("#pf-content");

    let user = null;
    try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        user = response.ok && data.success ? data.user : null;
    } catch (error) {
        user = null;
    }
    if (!user) {
        content.hidden = true;
        guest.hidden = false;
        return;
    }

    initAvatarStudio();
    initProfileForm(user);
});

/* =========================================================
   DATOS PERSONALES
   Nombre, apellido y correo son de solo lectura; el cliente
   solo edita teléfono y dirección (PUT /api/users/<id>).
========================================================= */
function initProfileForm(user) {
    const form = document.querySelector(".profile-form");
    const status = document.querySelector("#pf-form-status");
    const phone = document.querySelector("#pf-phone");
    const address = document.querySelector("#pf-address");

    document.querySelector("#pf-first-name").textContent = user.first_name || "";
    document.querySelector("#pf-last-name").textContent = user.last_name || "";
    document.querySelector("#pf-email").textContent = user.email || "";
    phone.value = user.phone || "";
    address.value = user.address || "";

    const say = (message, tone) => {
        status.textContent = message;
        status.className = `pf-form-status${tone ? ` is-${tone}` : ""}`;
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("[type=submit]");
        button.disabled = true;
        say("");
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phone.value.trim(), address: address.value.trim() }),
            });
            const updated = await res.json();
            if (res.ok && updated.success) say("Perfil actualizado correctamente.", "ok");
            else say(updated.error || "No fue posible actualizar el perfil.", "error");
        } catch (error) {
            say("No hay conexión con el servidor. Inténtalo de nuevo.", "error");
        } finally {
            button.disabled = false;
        }
    });
}

/* =========================================================
   AVATAR DEL PERFIL
   Muestra el avatar, deja cambiarle las prendas y comprar
   las que tienen precio. El dibujo lo hace js/avatar.js y
   las reglas (qué tiene cada usuario) las decide el backend.
========================================================= */
function initAvatarStudio() {
    const figure = document.querySelector("#avatar-figure");
    const mini = document.querySelector("#profile-avatar-mini");
    const tabs = document.querySelector("#avatar-tabs");
    const grid = document.querySelector("#avatar-items");
    const status = document.querySelector("#avatar-status");
    const previewFlag = document.querySelector("#avatar-preview-flag");
    const winsEl = document.querySelector("#avatar-wins");
    const coinsEl = document.querySelector("#avatar-coins");
    if (!figure || !window.PurpleAvatar) return;

    let avatar = null;        // respuesta de /api/avatar
    let activeSlot = "head";  // pestaña abierta
    let previewId = null;     // prenda que se está probando sin tenerla
    let busy = false;

    const number = (value) => Number(value || 0).toLocaleString("es-CO");
    const itemById = (id) => avatar.items.find((item) => item.id === id);
    const aciertos = (n) => `${n} ${n === 1 ? "acierto" : "aciertos"}`;

    // Convierte { slot: item_id } en { slot: style } para el dibujante.
    function partsFor(equipped) {
        const parts = {};
        Object.entries(equipped).forEach(([slot, id]) => {
            const item = itemById(id);
            if (item) parts[slot] = item.style;
        });
        return parts;
    }

    function say(message, tone) {
        status.textContent = message || "";
        status.className = `avatar-status${tone ? ` is-${tone}` : ""}`;
    }

    function syncCoins() {
        coinsEl.textContent = number(avatar.coins);
        const badge = document.querySelector(".nav-coin-badge span");
        if (badge) badge.textContent = avatar.coins;
    }

    function renderStage() {
        const preview = previewId ? itemById(previewId) : null;
        const shown = preview ? { ...avatar.equipped, [preview.slot]: preview.id } : avatar.equipped;
        figure.innerHTML = PurpleAvatar.render(partsFor(shown), { label: "Tu avatar" });
        previewFlag.hidden = !preview;
        mini.innerHTML = PurpleAvatar.render(partsFor(avatar.equipped), { crop: "head" });
        mini.classList.add("has-avatar");
        winsEl.textContent = number(avatar.wins);
        syncCoins();
    }

    function renderTabs() {
        tabs.innerHTML = avatar.slots.map((slot) => `
            <button type="button" role="tab" class="avatar-tab${slot.id === activeSlot ? " is-active" : ""}"
                aria-selected="${slot.id === activeSlot}" data-slot="${slot.id}">${slot.label}</button>`).join("");
    }

    function tagFor(item) {
        if (avatar.equipped[item.slot] === item.id) return '<i class="fa-solid fa-check" aria-hidden="true"></i> En uso';
        if (item.owned) return "Usar";
        if (item.unlock === "wins") return `<i class="fa-solid fa-lock" aria-hidden="true"></i> ${Math.min(avatar.wins, item.wins)} de ${aciertos(item.wins)}`;
        if (previewId === item.id) return `Comprar por ${number(item.price)}`;
        return `<i class="fa-solid fa-coins" aria-hidden="true"></i> ${number(item.price)}`;
    }

    function renderItems() {
        const items = avatar.items.filter((item) => item.slot === activeSlot);
        // Las miniaturas usan el avatar actual con esa prenda puesta, sobre fondo claro.
        const plainBg = avatar.items.find((item) => item.slot === "bg" && item.unlock === "free");
        grid.innerHTML = items.map((item) => {
            const equipped = { ...avatar.equipped, [item.slot]: item.id };
            if (item.slot !== "bg" && plainBg) equipped.bg = plainBg.id;
            const classes = ["avatar-item"];
            if (avatar.equipped[item.slot] === item.id) classes.push("is-equipped");
            if (!item.owned) classes.push(item.unlock === "wins" ? "is-locked" : "is-buy");
            if (previewId === item.id) classes.push("is-preview");
            return `
                <button type="button" class="${classes.join(" ")}" data-item="${item.id}">
                    <span class="avatar-item__preview">${PurpleAvatar.render(partsFor(equipped), { crop: item.slot })}</span>
                    <span class="avatar-item__name">${item.name}</span>
                    <span class="avatar-item__tag">${tagFor(item)}</span>
                </button>`;
        }).join("");
    }

    function renderAll() {
        renderStage();
        renderTabs();
        renderItems();
    }

    async function request(url, method, body) {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "No fue posible actualizar el avatar.");
        return data.avatar;
    }

    async function equip(item, message) {
        avatar = await request("/api/avatar", "PUT", { equipped: { ...avatar.equipped, [item.slot]: item.id } });
        previewId = null;
        renderAll();
        say(message || `Tu avatar ahora lleva «${item.name}».`, "ok");
    }

    async function buy(item) {
        avatar = await request("/api/avatar/buy", "POST", { item_id: item.id });
        renderAll();
        // El saldo cambió: la pestaña de PitCoins de la actividad se actualiza.
        document.dispatchEvent(new CustomEvent("purple1:pitcoins-changed"));
        await equip(itemById(item.id), `Compraste «${item.name}» por ${number(item.price)} PitCoins y ya está en tu avatar.`);
    }

    tabs.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-slot]");
        if (!tab || !avatar) return;
        activeSlot = tab.dataset.slot;
        previewId = null;
        say("");
        renderAll();
    });

    grid.addEventListener("click", async (event) => {
        const tile = event.target.closest("[data-item]");
        if (!tile || !avatar || busy) return;
        const item = itemById(tile.dataset.item);
        if (!item) return;

        busy = true;
        try {
            if (item.owned) {
                if (avatar.equipped[item.slot] !== item.id) await equip(item);
            } else if (item.unlock === "wins") {
                // Se puede probar, pero solo se desbloquea acertando pronósticos.
                previewId = item.id;
                renderAll();
                const faltan = item.wins - avatar.wins;
                say(`«${item.name}» se desbloquea con ${item.wins} ${item.wins === 1 ? "pronóstico acertado" : "pronósticos acertados"}. Te ${faltan === 1 ? "falta 1" : `faltan ${faltan}`}.`, "info");
            } else if (previewId === item.id) {
                await buy(item);
            } else {
                // Primer toque: se prueba la prenda. Segundo toque: se compra.
                previewId = item.id;
                renderAll();
                say(avatar.coins >= item.price
                    ? `«${item.name}» cuesta ${number(item.price)} PitCoins. Tócala de nuevo para comprarla.`
                    : `«${item.name}» cuesta ${number(item.price)} PitCoins y tienes ${number(avatar.coins)}. Acierta pronósticos para ganar más.`, "info");
            }
        } catch (error) {
            say(error.message, "error");
        } finally {
            busy = false;
        }
    });

    (async () => {
        try {
            const res = await fetch("/api/avatar");
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "No fue posible cargar tu avatar.");
            avatar = data.avatar;
            renderAll();
        } catch (error) {
            say(error.message, "error");
        }
    })();
}
