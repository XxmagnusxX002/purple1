/* Mi perfil: progresión del piloto y actividad reciente.
 *   GET /api/progress?limit=N           nivel, rango, XP y eventos de XP (404 si el XP está desactivado)
 *   GET /api/pitcoins/movements?limit=N movimientos de PitCoins del usuario
 * Cada pestaña consulta su propia fuente: XP y PitCoins nunca se mezclan. */
(function () {
    "use strict";

    const list = document.getElementById("pf-moves");
    if (!list) return;

    const PREVIEW = 5;      // movimientos visibles al inicio
    const FULL = 500;       // máximo del historial completo (límite del backend)

    const XP_KINDS = {
        RACE_PARTICIPATION: { label: "Participación", icon: "fa-flag-checkered" },
        RACE_CORRECT: { label: "Pronóstico acertado", icon: "fa-bullseye" },
        FIRST_SETTLED_PREDICTION: { label: "Primer pronóstico", icon: "fa-star" },
    };
    const COIN_KINDS = {
        OPENING_BALANCE: { label: "Saldo inicial", icon: "fa-gift" },
        BET_STAKE: { label: "Pronóstico realizado", icon: "fa-ticket" },
        BET_ADJUSTMENT: { label: "Cambio de pronóstico", icon: "fa-right-left" },
        BET_PRIZE: { label: "Premio por acierto", icon: "fa-trophy" },
        BET_REFUND: { label: "Devolución", icon: "fa-rotate-left" },
        AVATAR_PURCHASE: { label: "Compra de prenda", icon: "fa-shirt" },
        STAFF_ADJUSTMENT: { label: "Ajuste de saldo", icon: "fa-user-shield" },
        LEVEL_REWARD: { label: "Recompensa por nivel", icon: "fa-award" },
    };

    const number = (value) => Number(value || 0).toLocaleString("es-CO");
    const date = (value) => (value ? new Date(String(value).replace(" ", "T")).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const byId = (id) => document.getElementById(id);

    async function getJson(url) {
        const response = await fetch(url);
        if (response.status === 404) return { missing: true };
        if (!response.ok) throw new Error("No fue posible cargar la información.");
        return response.json();
    }

    /* ---------- Bloque central: rango, nivel, XP y barra ---------- */
    function renderProgress(progress) {
        if (!progress) {
            byId("pf-rank").textContent = "Progresión no disponible";
            byId("pf-level").textContent = "Nivel –";
            byId("pf-xp-total").textContent = "El sistema de niveles está desactivado.";
            byId("pf-next-label").textContent = "";
            byId("pf-remaining").textContent = "";
            byId("pf-reward").hidden = true;
            return;
        }
        const next = progress.level + 1;
        byId("pf-rank").textContent = progress.rank.name;
        byId("pf-level").textContent = `Nivel ${progress.level}`;
        byId("pf-xp-total").textContent = `${number(progress.xp_total)} XP acumulados`;
        byId("pf-next-label").textContent = `Progreso hacia el nivel ${next}`;
        byId("pf-xp-ratio").textContent = `${number(progress.xp_total)} / ${number(progress.next_level_xp)} XP`;
        // La barra mide el avance dentro del nivel actual: (XP - inicio del nivel) / XP del nivel.
        const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
        const bar = byId("pf-bar");
        bar.setAttribute("aria-valuenow", String(percent));
        bar.querySelector("span").style.width = `${percent}%`;
        byId("pf-remaining").textContent = `Faltan ${number(progress.xp_remaining)} XP para el siguiente nivel.`;
        byId("pf-reward-level").textContent = `Al alcanzar el nivel ${next}`;
        byId("pf-reward-amount").textContent = `+${number(progress.next_level_reward)}`;
        byId("pf-reward").hidden = !progress.next_level_reward;
    }

    /* ---------- Actividad reciente ---------- */
    const state = { tab: "xp", expanded: false, cache: {} };
    const more = byId("pf-more");

    function row({ icon, title, detail, when, amount, unit }) {
        const positive = amount >= 0;
        return `<li class="pf-move">
            <span class="pf-move__icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
            <div class="pf-move__body"><strong>${esc(title)}</strong>${detail ? `<span title="${esc(detail)}">${esc(detail)}</span>` : ""}<span>${esc(when)}</span></div>
            <span class="pf-move__amount ${positive ? "is-positive" : "is-negative"}">${positive ? "+" : "−"}${number(Math.abs(amount))} ${unit}</span>
        </li>`;
    }

    async function load(tab, limit) {
        const key = `${tab}:${limit}`;
        if (state.cache[key]) return state.cache[key];
        let result;
        if (tab === "xp") {
            const data = await getJson(`/api/progress?limit=${limit}`);
            if (data.missing) {
                renderProgress(null);
                result = { disabled: true, items: [], total: 0 };
            } else {
                if (limit === PREVIEW || !state.progressShown) {
                    renderProgress(data.progress);
                    state.progressShown = true;
                }
                result = {
                    total: data.progress.events_total ?? data.progress.events.length,
                    items: data.progress.events.map((e) => {
                        const kind = XP_KINDS[e.kind] || { label: e.kind, icon: "fa-bolt" };
                        return row({ icon: kind.icon, title: kind.label, detail: e.race_name, when: date(e.created_at), amount: e.amount, unit: "XP" });
                    }),
                };
            }
        } else {
            const data = await getJson(`/api/pitcoins/movements?limit=${limit}`);
            result = {
                total: data.total ?? data.movements.length,
                items: data.movements.map((m) => {
                    const kind = COIN_KINDS[m.kind] || { label: m.kind, icon: "fa-coins" };
                    return row({ icon: kind.icon, title: kind.label, detail: m.description, when: date(m.created_at), amount: m.amount, unit: "PitCoins" });
                }),
            };
        }
        state.cache[key] = result;
        return result;
    }

    async function renderActivity() {
        const limit = state.expanded ? FULL : PREVIEW;
        list.classList.toggle("is-expanded", state.expanded);
        try {
            const data = await load(state.tab, limit);
            if (data.disabled) {
                list.innerHTML = '<li class="pf-empty">El sistema de experiencia está desactivado.</li>';
            } else if (!data.items.length) {
                list.innerHTML = state.tab === "xp"
                    ? '<li class="pf-empty">Aún no tienes experiencia. Haz un pronóstico: participar da 20 XP y acertar, 50 XP más.</li>'
                    : '<li class="pf-empty">Todavía no hay movimientos de PitCoins.</li>';
            } else {
                list.innerHTML = data.items.join("");
            }
            more.hidden = !(data.total > PREVIEW);
            more.innerHTML = state.expanded
                ? 'Ver menos <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>'
                : `Ver historial completo (${number(data.total)}) <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>`;
        } catch (error) {
            list.innerHTML = `<li class="pf-empty">${esc(error.message)} <button type="button" class="pf-more" data-retry>Reintentar</button></li>`;
            more.hidden = true;
        }
    }

    document.querySelector(".pf-tabs").addEventListener("click", (event) => {
        const tab = event.target.closest("[data-tab]");
        if (!tab || tab.dataset.tab === state.tab) return;
        state.tab = tab.dataset.tab;
        state.expanded = false;
        document.querySelectorAll(".pf-tab").forEach((button) => {
            const active = button === tab;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", String(active));
        });
        renderActivity();
    });

    more.addEventListener("click", () => {
        state.expanded = !state.expanded;
        renderActivity();
    });

    list.addEventListener("click", (event) => {
        if (event.target.closest("[data-retry]")) {
            state.cache = {};
            renderActivity();
        }
    });

    // Tras comprar una prenda cambia el saldo: se descarta la caché de PitCoins.
    document.addEventListener("purple1:pitcoins-changed", () => {
        Object.keys(state.cache).filter((key) => key.startsWith("coins:")).forEach((key) => delete state.cache[key]);
        if (state.tab === "coins") renderActivity();
    });

    // Solo con sesión iniciada (profile.js oculta el contenido si no la hay).
    fetch("/api/auth/me").then((r) => (r.ok ? renderActivity() : null)).catch(() => {});
})();
