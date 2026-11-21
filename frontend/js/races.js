document.addEventListener("DOMContentLoaded", async () => {
    const featured = document.querySelector("#featured-race");
    const otherRaces = document.querySelector("#other-races");
    const leaderboard = document.querySelector("#leaderboard-list");
    const walletAmount = document.querySelector("#wallet-amount");
    const walletHint = document.querySelector("#wallet-hint");
    const count = document.querySelector("#races-count");
    const filters = document.querySelector("#race-filters");
    const historyToggle = document.querySelector("#history-toggle");
    const historyList = document.querySelector("#history-list");

    const LABELS = {
        OPEN: "Abierta", SCHEDULED: "Programada", DEADLINE: "Plazo vencido",
        LOCKED: "Cerrada", FINISHED: "Finalizada", CANCELLED: "Cancelada",
    };
    const GROUPS = [
        ["OPEN", "Otras abiertas"], ["SCHEDULED", "Próximas"],
        ["CLOSED", "Cerradas"], ["RESULTS", "Resultados"],
    ];

    let user = null;
    let races = [];
    let minBet = 10; // lo envía GET /api/races (parámetro de Configuración)
    let activeFilter = "ALL";
    let selectedRaceId = null;
    let showAllPilots = false;
    let actionBusy = false;
    let historyLoaded = false;
    const selectedPilots = new Map();
    const betAmounts = new Map();

    function escapeHTML(value) {
        return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function pilotAvatar(option) {
        const words = String(option.driver_name || "").trim().split(/\s+/).map(word => word.match(/[\p{L}\p{N}]/u)?.[0]).filter(Boolean);
        const initials = (words.length > 1 ? words[0] + words[words.length - 1] : words[0] || "P").toLocaleUpperCase("es");
        const path = String(option.image_path || "").replaceAll("\\", "/");
        const teamLogo = String(option.team_logo || "").replaceAll("\\", "/");
        const isTeamLogo = teamLogo && path.replace(/^\/?img\//, "") === teamLogo.replace(/^\/?img\//, "");
        const realPhoto = path && !isTeamLogo && !/(?:^|\/)\S*placeholder\S*\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i.test(path);
        return `<span class="driver-avatar" aria-hidden="true"><span class="driver-avatar__initials">${escapeHTML(initials)}</span>${realPhoto ? `<img src="${escapeHTML(path)}" alt="" loading="lazy">` : ""}</span>`;
    }

    document.addEventListener("error", event => {
        if (event.target?.matches?.(".driver-avatar img")) event.target.hidden = true;
    }, true);

    async function getJSON(url, options) {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "No se pudo completar la solicitud.");
        return data;
    }

    function raceStatus(race) {
        return race.status === "OPEN" && race.betting_closed ? "DEADLINE" : race.status;
    }

    function raceGroup(race) {
        const status = raceStatus(race);
        if (status === "OPEN" || status === "SCHEDULED") return status;
        return status === "FINISHED" || status === "CANCELLED" ? "RESULTS" : "CLOSED";
    }

    function raceDate(race) {
        if (race.race_local_display) return race.race_local_display;
        // Las fechas antiguas no tienen zona verificada: se muestran sin convertir.
        return String(race.race_date || "Fecha por confirmar").replace("T", " ").slice(0, 16);
    }

    function statusMarkup(race) {
        const status = raceStatus(race);
        return `<span class="race-status race-status--${status.toLowerCase()}">${LABELS[status] || escapeHTML(status)}</span>`;
    }

    function currentRace() {
        return races.find(race => race.id === selectedRaceId);
    }

    function visibleRaces() {
        return activeFilter === "ALL" ? races : races.filter(race => raceGroup(race) === activeFilter);
    }

    function currentPilot(race) {
        const id = selectedPilots.get(race.id);
        return race.options.find(option => option.id === id);
    }

    function currentBetMarkup(race) {
        if (!race.user_bet) return "";
        const picked = race.options.find(option => option.id === race.user_bet.option_id);
        return `<div class="current-bet">Tu pronóstico registrado: <strong>${escapeHTML(picked?.driver_name || "Piloto seleccionado")}</strong> · <strong>${race.user_bet.amount} PitCoins</strong>${raceStatus(race) === "OPEN" ? ". Puedes modificarlo mientras siga abierta." : "."}</div>`;
    }

    function resultMarkup(race) {
        if (race.status === "CANCELLED") return `<div class="race-result race-result--refund">Carrera cancelada.${race.user_bet ? " Tu apuesta fue devuelta." : ""}</div>`;
        if (race.status !== "FINISHED") return "";
        if (!race.user_bet) return `<div class="race-result">Carrera finalizada. No registraste un pronóstico.</div>`;
        const bet = race.user_bet;
        if (bet.status === "WON") return `<div class="race-result race-result--win"><strong>Pronóstico acertado.</strong> Pago recibido: ${bet.payout} PitCoins.</div>`;
        if (bet.status === "REFUNDED") return `<div class="race-result race-result--refund">No hubo apuestas por el ganador. Recibiste ${bet.payout} PitCoins de vuelta.</div>`;
        return `<div class="race-result race-result--loss">Esta vez no acertaste. Apostaste ${bet.amount} PitCoins.</div>`;
    }

    // Abrir, cerrar, cancelar y liquidar se hace en el panel (/admin/), con vista
    // previa del reparto, confirmacion y auditoria. Aqui solo se enlaza.
    function staffMarkup(race) {
        if (!user?.is_staff || ["FINISHED", "CANCELLED"].includes(race.status)) return "";
        const target = race.status === "LOCKED" ? `/admin/result.html?id=${race.id}` : `/admin/race.html?id=${race.id}`;
        const label = race.status === "LOCKED" ? "Elegir ganador en el panel" : "Gestionar en el panel";
        return `<div class="race-staff"><p>Administración de carrera · estado y resultado se gestionan en el panel de administración.</p><div class="race-staff__controls"><a href="${target}">${label}</a></div></div>`;
    }

    function pilotMarkup(race, option, selectable) {
        const selected = selectedPilots.get(race.id) === option.id;
        const winner = race.status === "FINISHED" && race.winner_option_id === option.id;
        // Carrera liquidada: cuota definitiva y pronósticos por piloto (no «sin cuota aún»).
        const finished = race.status === "FINISHED";
        const odds = finished
            ? (option.bets ? `${option.odds ? `x${Number(option.odds).toFixed(2)} · ` : ""}${option.bets} ${option.bets === 1 ? "pronóstico" : "pronósticos"}` : "Sin pronósticos")
            : option.odds == null ? "Sin cuota aún" : `x${Number(option.odds).toFixed(2)}`;
        return `<button type="button" class="pilot-option${selected ? " is-selected" : ""}${winner ? " is-winner" : ""}"
                    data-pilot-id="${option.id}" aria-pressed="${selected}" ${selectable ? "" : "disabled"}>
                    ${pilotAvatar(option)}
                    <span class="pilot-option__text"><strong>${escapeHTML(option.driver_name)}</strong><small>${escapeHTML(option.team_name || "Sin escudería")}${winner ? " · Ganador" : ""}</small></span>
                    <span class="pilot-option__odds">${odds}</span>
                    ${selectable ? `<span class="pilot-option__check" aria-hidden="true">${selected ? "✓" : ""}</span>` : ""}
                </button>`;
    }

    function renderPilots() {
        const race = currentRace();
        const grid = featured.querySelector("#pilot-grid");
        const more = featured.querySelector("#pilot-more");
        if (!race || !grid || !more) return;
        const search = (featured.querySelector("#pilot-search")?.value || "").trim().toLocaleLowerCase("es");
        const team = featured.querySelector("#pilot-team")?.value || "ALL";
        const matches = race.options.filter(option =>
            option.driver_name.toLocaleLowerCase("es").includes(search) &&
            (team === "ALL" || String(option.team_id ?? "none") === team));
        const limited = !search && team === "ALL" && !showAllPilots && matches.length > 8;
        grid.innerHTML = matches.length
            ? (limited ? matches.slice(0, 8) : matches).map(option => pilotMarkup(race, option, raceStatus(race) === "OPEN")).join("")
            : `<div class="pilot-empty">${race.options.length ? "No hay pilotos que coincidan con la búsqueda." : "Esta carrera aún no tiene pilotos registrados."}</div>`;
        more.hidden = !limited;
        more.textContent = `Mostrar todos los pilotos (${race.options.length})`;
    }

    function renderBetSummary() {
        const race = currentRace();
        const target = featured.querySelector("#bet-summary");
        if (!race || !target) return;
        const pilot = currentPilot(race);
        const amount = Number(betAmounts.get(race.id) ?? 10);
        if (!pilot) {
            target.textContent = "Selecciona un piloto para ver el resumen.";
            return;
        }
        const previous = Number(race.user_bet?.amount || 0);
        const ownAmountOnPilot = race.user_bet?.option_id === pilot.id ? previous : 0;
        const newPool = Number(pilot.pool || 0) - ownAmountOnPilot + amount;
        const newTotal = Number(race.total_pool || 0) - previous + amount;
        const odds = Number.isInteger(amount) && amount >= 10 && newPool > 0
            ? `x${(newTotal / newPool).toFixed(2)}` : "—";
        target.innerHTML = `<span>${escapeHTML(pilot.driver_name)}</span><strong>${Number.isFinite(amount) ? amount : "—"} PitCoins</strong><span>Cuota indicativa <strong>${odds}</strong></span>`;
    }

    // ---------- Carrera finalizada: diseño de resultados (sin formulario de pronóstico)
    const coins = value => Number(value || 0).toLocaleString("es-CO");
    const BET_TEXT = { WON: "Acertaste", LOST: "No acertaste", REFUNDED: "Devuelto", PENDING: "Pendiente" };

    function personalResult(race) {
        if (!user) return `<div class="results-personal results-personal--muted">Inicia sesión para ver tu resultado en esta carrera.</div>`;
        const bet = race.user_bet;
        if (!bet) return `<div class="results-personal results-personal--muted">No participaste en esta carrera.</div>`;
        const pick = race.options.find(option => option.id === bet.option_id);
        const net = Number(bet.net || 0);
        return `<div class="results-personal results-personal--${bet.status.toLowerCase()}">
            <div class="results-personal__head">${pick ? pilotAvatar(pick) : ""}<div><span class="results-eyebrow">Tu pronóstico</span><strong>${escapeHTML(pick?.driver_name || "Piloto")}</strong></div>
                <span class="results-badge results-badge--${bet.status.toLowerCase()}">${BET_TEXT[bet.status] || escapeHTML(bet.status)}</span></div>
            <dl class="results-personal__facts">
                <div><dt>PitCoins usados</dt><dd>${coins(bet.amount)}</dd></div>
                <div><dt>Recibiste</dt><dd>${coins(bet.payout)}</dd></div>
                <div><dt>Neto</dt><dd class="${net > 0 ? "is-gain" : net < 0 ? "is-loss" : ""}">${net > 0 ? "+" : net < 0 ? "−" : ""}${coins(Math.abs(net))}</dd></div>
                <div><dt>XP obtenido</dt><dd>+${coins(bet.xp_gained)} XP</dd></div>
            </dl>
        </div>`;
    }

    function resultsMarkup(race) {
        const winner = race.winner || {};
        const withBets = race.options.filter(option => option.bets).sort((a, b) => b.bets - a.bets);
        const maxBets = Math.max(1, ...withBets.map(option => option.bets));
        const allRefunded = race.bets_count && !race.winners_count;
        const classified = race.options.filter(option => option.finish_order);
        const row = option => `<li class="${option.id === race.winner_option_id ? "is-winner" : ""}"><span class="results-pos">${option.finish_position ?? "NC"}</span>
            ${pilotAvatar(option)}<span class="results-name"><strong>${escapeHTML(option.driver_name)}</strong><small>${escapeHTML(option.team_name || "")}</small></span></li>`;
        return `<article class="featured-race surface-card race-results">
            <div class="featured-race__head">
                <div class="featured-race__identity">${window.PurpleMedia.raceFlag(race, "lg")}<div class="featured-race__name"><h3>${escapeHTML(race.name)}</h3><p>${escapeHTML(race.circuit)} · ${escapeHTML(raceDate(race))}</p></div></div>
                <div class="featured-race__status">${statusMarkup(race)}</div>
            </div>
            <div class="results-winner" style="--team:${escapeHTML(winner.team_color || "#7b2cff")}">
                <span class="results-winner__photo">${winner.image_path ? `<img src="${escapeHTML(winner.image_path)}" alt="${escapeHTML(winner.name)}">` : `<i class="fa-solid fa-trophy" aria-hidden="true"></i>`}</span>
                <div><span class="results-eyebrow"><i class="fa-solid fa-trophy" aria-hidden="true"></i> Ganador oficial</span>
                    <h4>${winner.number ? `<span class="results-number">${escapeHTML(winner.number)}</span> ` : ""}${escapeHTML(winner.name || "—")}</h4>
                    <p>${escapeHTML(winner.team || "")}</p></div>
            </div>
            <dl class="results-stats">
                <div><dt>Participantes</dt><dd>${coins(race.participants)}</dd></div>
                <div><dt>PitCoins en juego</dt><dd>${coins(race.total_staked)}</dd></div>
                <div><dt>PitCoins ${allRefunded ? "devueltos" : "repartidos"}</dt><dd>${coins(race.paid_out)}</dd></div>
                <div><dt>Acertaron</dt><dd>${coins(race.winners_count)}${race.final_odds ? `<small>cuota x${Number(race.final_odds).toFixed(2)}</small>` : ""}</dd></div>
            </dl>
            ${allRefunded ? '<p class="results-note">Nadie eligió al ganador: según las reglas, se devolvieron los PitCoins a todos los participantes.</p>' : ""}
            ${personalResult(race)}
            <div class="results-columns">
                <section><h4>Pronósticos por piloto</h4>
                    ${withBets.length ? `<ul class="results-dist">${withBets.map(option => `<li class="${option.id === race.winner_option_id ? "is-winner" : ""}">
                        <span class="results-name"><strong>${escapeHTML(option.driver_name)}</strong><small>${option.bets} ${option.bets === 1 ? "pronóstico" : "pronósticos"} · ${coins(option.pool)} PC${option.odds ? ` · cuota x${Number(option.odds).toFixed(2)}` : ""}</small></span>
                        <span class="results-bar"><span style="width:${Math.round(option.bets / maxBets * 100)}%"></span></span></li>`).join("")}</ul>`
                        : '<p class="results-note">Nadie pronosticó esta carrera.</p>'}
                </section>
                <section><h4>Clasificación oficial</h4>
                    ${classified.length ? `<ol class="results-classification">${classified.slice(0, 10).map(row).join("")}</ol>
                        ${classified.length > 10 ? `<details class="results-more"><summary>Ver clasificación completa (${classified.length})</summary><ol class="results-classification">${classified.slice(10).map(row).join("")}</ol></details>` : ""}`
                        : '<p class="results-note">Clasificación no disponible.</p>'}
                </section>
            </div>
        </article>`;
    }

    function featuredMarkup(race) {
        if (race.status === "FINISHED") return resultsMarkup(race);
        const status = raceStatus(race);
        const teams = [...new Map(race.options.map(option => [String(option.team_id ?? "none"), option.team_name || "Sin escudería"])).entries()];
        const teamOptions = teams.map(([id, name]) => `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`).join("");
        const canBet = status === "OPEN";
        const amount = betAmounts.get(race.id) ?? race.user_bet?.amount ?? 10;
        const betForm = canBet ? `<div class="bet-entry">
                <label>Importe en PitCoins<input id="bet-amount" type="number" min="${minBet}" step="1" inputmode="numeric" value="${escapeHTML(amount)}"></label>
                <div id="bet-summary" class="bet-summary" role="status">Selecciona un piloto para ver el resumen.</div>
                <button type="button" class="btn-primary" data-race-action="bet">${race.user_bet ? "Actualizar pronóstico" : "Registrar pronóstico"}</button>
            </div><p class="bet-note">La cuota es orientativa y puede cambiar hasta que cierren los pronósticos. El premio definitivo lo calcula el servidor.</p><p id="bet-feedback" class="bet-feedback" role="status" aria-live="polite"></p>` : "";
        const unavailable = !canBet && !["FINISHED", "CANCELLED"].includes(race.status)
            ? `<div class="race-result">${status === "SCHEDULED" ? "Los pronósticos de esta carrera aún no están abiertos." : "Ya no se pueden registrar ni modificar pronósticos."}</div>` : "";
        return `<article class="featured-race surface-card">
            <div class="featured-race__head">
                <div class="featured-race__identity">${window.PurpleMedia.raceFlag(race, "lg")}<div class="featured-race__name"><h3>${escapeHTML(race.name)}</h3><p>${escapeHTML(race.circuit)} · ${escapeHTML(raceDate(race))}</p></div></div>
                <div class="featured-race__status">${statusMarkup(race)}${status === "DEADLINE" ? "<small>El estado oficial sigue pendiente de cierre.</small>" : ""}</div>
            </div>
            ${race.status === "FINISHED" ? `<div class="race-metrics race-metrics--final">
                    <p><i class="fa-solid fa-trophy" aria-hidden="true"></i> Ganador: <strong>${escapeHTML(race.winner_name || "—")}</strong></p>
                    <p><strong>${Number(race.participants || 0)}</strong> participantes</p>
                    <p><strong>${Number(race.total_staked || 0).toLocaleString("es-CO")}</strong> PitCoins apostados</p>
                    <p><strong>${Number(race.paid_out || 0).toLocaleString("es-CO")}</strong> PitCoins ${race.winners_count ? "repartidos" : "devueltos"}</p>
                    <p><strong>${Number(race.winners_count || 0)}</strong> ${race.winners_count === 1 ? "acierto" : "aciertos"}</p></div>`
                : `<div class="race-metrics"><p><strong>${Number(race.total_pool || 0)}</strong> PitCoins en el bote</p><p><strong>${Number(race.participants || 0)}</strong> participantes</p></div>`}
            <div class="race-subhead"><h4>Pilotos de esta carrera</h4><span>${race.options.length} registrados</span></div>
            <div class="pilot-toolbar"><label><span class="visually-hidden">Buscar piloto</span><input id="pilot-search" type="search" placeholder="Buscar piloto" autocomplete="off"></label><label><span class="visually-hidden">Filtrar por escudería</span><select id="pilot-team"><option value="ALL">Todas las escuderías</option>${teamOptions}</select></label></div>
            <div id="pilot-grid" class="pilot-grid"></div><button id="pilot-more" type="button" class="race-secondary-button pilot-more" hidden>Mostrar todos los pilotos</button>
            ${currentBetMarkup(race)}${resultMarkup(race)}${unavailable}${betForm}${staffMarkup(race)}
        </article>`;
    }

    function renderRaces() {
        const visible = visibleRaces();
        if (!visible.some(race => race.id === selectedRaceId)) {
            // Prioridad: 1) abierta a pronósticos, 2) próxima programada o cerrada,
            // 3) la última finalizada (solo si ya no quedan carreras por disputar).
            const upcoming = visible.filter(race => ["SCHEDULED", "LOCKED", "DEADLINE"].includes(raceStatus(race)));
            const finished = visible.filter(race => race.status === "FINISHED");
            selectedRaceId = (visible.find(race => raceStatus(race) === "OPEN") || upcoming[0] || finished[finished.length - 1] || visible[0])?.id ?? null;
            showAllPilots = false;
        }
        count.textContent = `${visible.length} ${visible.length === 1 ? "carrera" : "carreras"}`;
        const race = currentRace();
        const emptyMessage = races.length
            ? `<h3>Sin carreras en esta sección</h3><p>Prueba otro filtro para consultar el calendario.</p>`
            : `<h3>Aún no hay carreras publicadas</h3><p>El calendario aparecerá aquí cuando el staff registre las próximas carreras.</p>`;
        featured.innerHTML = race ? featuredMarkup(race) : `<div class="race-message surface-card">${emptyMessage}</div>`;
        if (race && race.status !== "FINISHED") {
            renderPilots();
            renderBetSummary();
        }
        const others = visible.filter(item => item.id !== selectedRaceId);
        otherRaces.innerHTML = others.length ? GROUPS.map(([group, title]) => {
            const inGroup = others.filter(item => raceGroup(item) === group);
            if (!inGroup.length) return "";
            return `<div class="other-races-group"><h3>${title}</h3>${inGroup.map(item =>
                `<button class="other-race" type="button" data-race-id="${item.id}" aria-label="Ver ${escapeHTML(item.name)}">
                    ${window.PurpleMedia.raceFlag(item, "sm")}<span class="other-race__text"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.circuit)} · ${escapeHTML(raceDate(item))}</small></span>${statusMarkup(item)}<i class="fa-solid fa-chevron-right other-race__arrow" aria-hidden="true"></i>
                </button>`).join("")}</div>`;
        }).join("") : `<div class="race-message surface-card">No hay otras carreras en esta sección.</div>`;
    }

    async function refreshWallet() {
        try {
            const response = await fetch("/api/auth/me");
            user = response.ok ? (await response.json()).user : null;
            walletAmount.textContent = user ? String(user.coins) : "—";
            walletHint.textContent = user ? "Saldo actualizado desde tu cuenta." : "Inicia sesión para consultar tu saldo.";
        } catch (error) {
            walletAmount.textContent = "—";
            walletHint.textContent = "No se pudo consultar el saldo.";
        }
    }

    async function loadRaces() {
        try {
            const data = await getJSON("/api/races");
            races = data.races;
            if (data.min_bet) {
                minBet = Number(data.min_bet);
                const rule = document.querySelector("#bet-min-rule");
                if (rule) rule.textContent = `${minBet} PitCoins`;
            }
            for (const race of races) {
                if (!selectedPilots.has(race.id) && race.user_bet) selectedPilots.set(race.id, race.user_bet.option_id);
                if (!betAmounts.has(race.id) && race.user_bet) betAmounts.set(race.id, race.user_bet.amount);
            }
            renderRaces();
        } catch (error) {
            featured.innerHTML = `<div class="race-message surface-card" role="alert"><h3>No se pudieron cargar las carreras</h3><p>${escapeHTML(error.message)}</p><button type="button" class="race-secondary-button" id="retry-races">Reintentar</button></div>`;
            otherRaces.innerHTML = "";
        }
    }

    async function loadLeaderboard() {
        try {
            const data = await getJSON("/api/races/leaderboard");
            leaderboard.innerHTML = data.leaderboard.length ? data.leaderboard.map((row, index) =>
                `<li><span class="leaderboard-rank">${index + 1}</span><span class="leaderboard-name">${escapeHTML(row.display_name)}</span><span class="leaderboard-coins">${Number(row.coins)} PC</span></li>`).join("")
                : `<li class="leaderboard-empty">Aún no hay participantes.</li>`;
        } catch (error) {
            leaderboard.innerHTML = `<li class="leaderboard-empty">No se pudo cargar el ranking: ${escapeHTML(error.message)}</li>`;
        }
    }

    function historyOutcome(bet) {
        if (bet.status === "WON") return `<span class="results-badge results-badge--won">Acertado</span><small>Premio: ${coins(bet.payout)} PC</small>`;
        if (bet.status === "REFUNDED") return `<span class="results-badge results-badge--refunded">Devuelto</span><small>${coins(bet.payout)} PC</small>`;
        if (bet.status === "LOST") return `<span class="results-badge results-badge--lost">No acertado</span><small>Premio: 0 PC</small>`;
        return `<span class="results-badge results-badge--pending">Pendiente</span>`;
    }

    async function loadHistory() {
        if (!user) {
            historyList.innerHTML = `<p class="history-empty">Inicia sesión para consultar tus pronósticos. <a href="auth.html">Ir a iniciar sesión</a></p>`;
            return;
        }
        historyList.innerHTML = `<div class="history-empty" aria-hidden="true">${'<span class="skel skel--line"></span>'.repeat(4)}</div><span class="visually-hidden" role="status">Cargando historial</span>`;
        try {
            const data = await getJSON("/api/bets");
            historyLoaded = true;
            historyList.innerHTML = data.bets.length ? data.bets.map(bet =>
                `<div class="history-item"><div><strong>${escapeHTML(bet.race_name)}</strong><small>${escapeHTML(bet.driver_name)} · ${coins(bet.amount)} PitCoins · ${new Date(String(bet.created_at).replace(" ", "T")).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</small></div><span class="history-item__outcome">${historyOutcome(bet)}</span></div>`).join("")
                : `<p class="history-empty">Todavía no tienes pronósticos registrados.</p>`;
        } catch (error) {
            historyList.innerHTML = `<p class="history-empty" role="alert">No se pudo cargar el historial: ${escapeHTML(error.message)}</p>`;
        }
    }

    filters.addEventListener("click", event => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        activeFilter = button.dataset.filter;
        filters.querySelectorAll("[data-filter]").forEach(item => {
            const selected = item === button;
            item.classList.toggle("is-active", selected);
            item.setAttribute("aria-pressed", String(selected));
        });
        renderRaces();
    });

    otherRaces.addEventListener("click", event => {
        const button = event.target.closest("[data-race-id]");
        if (!button) return;
        selectedRaceId = Number(button.dataset.raceId);
        showAllPilots = false;
        renderRaces();
        document.querySelector("#featured-heading").scrollIntoView({ block: "start" });
    });

    featured.addEventListener("input", event => {
        if (event.target.id === "pilot-search") renderPilots();
        if (event.target.id === "bet-amount") {
            betAmounts.set(selectedRaceId, event.target.value);
            renderBetSummary();
        }
    });
    featured.addEventListener("change", event => {
        if (event.target.id === "pilot-team") renderPilots();
    });

    featured.addEventListener("click", async event => {
        if (event.target.id === "retry-races") return void loadRaces();
        const pilotButton = event.target.closest("[data-pilot-id]");
        if (pilotButton && !pilotButton.disabled) {
            selectedPilots.set(selectedRaceId, Number(pilotButton.dataset.pilotId));
            renderPilots();
            renderBetSummary();
            return;
        }
        if (event.target.id === "pilot-more") {
            showAllPilots = true;
            renderPilots();
            return;
        }
        const action = event.target.closest("[data-race-action]");
        if (!action || actionBusy) return;
        const race = currentRace();
        if (!race) return;
        const kind = action.dataset.raceAction;
        const feedback = featured.querySelector("#bet-feedback");
        let url;
        let payload;
        if (kind === "bet") {
            if (!user) return void (window.location.href = "auth.html");
            if (raceStatus(race) !== "OPEN") return;
            const pilot = currentPilot(race);
            const amount = Number(featured.querySelector("#bet-amount").value);
            if (!pilot || !Number.isInteger(amount) || amount < minBet) {
                feedback.textContent = !pilot ? "Selecciona un piloto." : `Indica un importe entero de al menos ${minBet} PitCoins.`;
                feedback.className = "bet-feedback is-error";
                return;
            }
            url = `/api/races/${race.id}/bet`;
            payload = { option_id: pilot.id, amount };
        } else return;
        actionBusy = true;
        action.disabled = true;
        if (feedback) feedback.textContent = "";
        try {
            await getJSON(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            await Promise.all([refreshWallet(), loadRaces(), loadLeaderboard()]);
            // Cualquier accion cambia pronosticos (importe, piloto o resultado).
            historyLoaded = false;
            if (!historyList.hidden) await loadHistory();
            if (kind === "bet") {
                const done = featured.querySelector("#bet-feedback");
                if (done) {
                    done.textContent = race.user_bet ? "Pronóstico actualizado." : "Pronóstico registrado.";
                    done.className = "bet-feedback is-success";
                }
            }
        } catch (error) {
            if (kind === "bet" && feedback) {
                feedback.textContent = error.message;
                feedback.className = "bet-feedback is-error";
            } else {
                window.alert(error.message);
            }
            action.disabled = false;
        } finally {
            actionBusy = false;
        }
    });

    historyToggle.addEventListener("click", async () => {
        const opening = historyList.hidden;
        historyList.hidden = !opening;
        historyToggle.setAttribute("aria-expanded", String(opening));
        historyToggle.textContent = opening ? "Ocultar historial" : "Ver historial";
        if (opening && !historyLoaded) await loadHistory();
    });

    await refreshWallet();
    await Promise.all([loadRaces(), loadLeaderboard()]);
});
