/* Resultado de una carrera (fase A5). El staff elige al ganador; el reparto lo
   calcula el backend (vista previa sin efectos) y la liquidacion exige escribir
   el nombre de la carrera. Este archivo no calcula premios. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const R = window.AdminRaces;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const raceId = Number(new URLSearchParams(window.location.search).get("id")) || null;
    const RESULT = { WON: "Acertó", LOST: "No acertó", REFUNDED: "Se devuelve" };
    let race = null;
    let preview = null;
    let request = 0;

    function showAlert(message, retry = false) {
        $("#result-alert-text").textContent = message;
        $("#result-retry").hidden = !retry;
        $("#result-alert").hidden = false;
    }

    function chosenWinner() {
        return Number(document.querySelector('#winner-grid input[name="winner"]:checked')?.value) || null;
    }

    function renderHead() {
        $("#race-head").hidden = false;
        $("#race-name").textContent = race.name;
        $("#race-meta").innerHTML = `${esc([race.circuit, race.country].filter(Boolean).join(" · "))} · ${R.when(race).replace("<small>", " (").replace("</small>", ")")}`;
        $("#race-pill").innerHTML = R.pill(race.status);
        $("#back-link").href = `race.html?id=${race.id}`;
        $("#admin-title").textContent = `Resultado: ${race.name}`;
        document.title = `Resultado: ${race.name} | Purple One Admin`;
    }

    function blockedReason() {
        if (race.status === "CANCELLED") return "Esta carrera está cancelada: no tiene ganador y los PitCoins pendientes ya se devolvieron.";
        if (race.status === "LOCKED") return "Los pronósticos están cerrados, pero la carrera aún no ha empezado. Podrás elegir al ganador a partir de la hora de salida.";
        if (race.status === "OPEN") return "Los pronósticos siguen abiertos. Ciérralos desde la ficha de la carrera antes de elegir al ganador.";
        return "La carrera aún no está publicada. Ábrela, ciérrala al empezar y vuelve aquí para elegir al ganador.";
    }

    // ------------------------------------------------------------ paso 1
    function renderPick() {
        $("#result-pick").hidden = false;
        $("#winner-grid").innerHTML = race.options.map(option => {
            return `<label class="winner-option">
                <input type="radio" name="winner" value="${option.id}">
                ${A.driverAvatar(option.driver_name, option.image_path, "medium")}
                <span class="winner-option__main"><strong>${esc(option.driver_name)}</strong><small>${esc(option.team_name || "Sin equipo")}</small></span>
                <span class="winner-option__stats">${A.formatNumber(option.bets)} <small>pronósticos</small></span>
            </label>`;
        }).join("") || '<p class="admin-empty">Esta carrera no tiene participantes.</p>';
    }

    // ------------------------------------------------------------ paso 2
    function outcomeText(data) {
        const s = data.summary;
        if (data.outcome === "NO_BETS") return ["info", "Nadie pronosticó esta carrera: solo se registrará el ganador. No se mueven PitCoins."];
        if (data.outcome === "REFUND_ALL") return ["warning", `Nadie eligió a ${data.winner.driver_name}: se devolverán ${A.formatNumber(s.refunded_pitcoins)} PitCoins, a cada uno lo que pronosticó.`];
        return ["ok", `${A.formatNumber(s.winners)} ${s.winners === 1 ? "acertante se lleva" : "acertantes se reparten"} el bote de ${A.formatNumber(s.total_pool)} PitCoins en proporción a lo que pronosticaron.`];
    }

    function renderPreview(data) {
        preview = data;
        const s = data.summary;
        const [tone, text] = outcomeText(data);
        $("#preview-outcome").dataset.tone = tone;
        $("#preview-outcome").innerHTML = `<strong>Ganador: ${esc(data.winner.driver_name)}${data.winner.team_name ? ` · ${esc(data.winner.team_name)}` : ""}</strong><span>${esc(text)}</span>`;
        const stats = [
            ["Bote total", R.coins(s.total_pool)],
            ["Acertantes", `${A.formatNumber(s.winners)} de ${A.formatNumber(s.bets)}`],
            [data.outcome === "REFUND_ALL" ? "Se devuelven" : "Premios", R.coins(data.outcome === "REFUND_ALL" ? s.refunded_pitcoins : s.paid_out)],
            ["XP", data.xp_enabled ? `${A.formatNumber(s.xp_total)} XP${s.level_reward_pitcoins ? `<small>+ ${R.coins(s.level_reward_pitcoins)} por subir de nivel</small>` : ""}` : '<span class="admin-muted">XP desactivado</span>'],
        ];
        $("#preview-stats").innerHTML = stats.map(([label, value]) => `<div class="mini-stat"><span>${esc(label)}</span><strong>${value}</strong></div>`).join("");
        $("#preview-body").innerHTML = data.bets.length ? data.bets.map(bet => {
            const tone = bet.result === "WON" ? "paid" : bet.result === "LOST" ? "cancelled" : "scheduled";
            const net = bet.net > 0 ? `+${A.formatNumber(bet.net)}` : A.formatNumber(bet.net);
            const levels = bet.levels_rewarded.length ? `<small>Sube a nivel ${esc(bet.levels_rewarded[bet.levels_rewarded.length - 1])} · +${A.formatNumber(bet.level_reward_pitcoins)} PitCoins</small>` : "";
            return `<tr>
                <td data-label="Usuario">${esc(bet.username)}</td>
                <td data-label="Eligió">${esc(bet.driver_name)}</td>
                <td data-label="Pronosticó">${R.coins(bet.amount)}</td>
                <td data-label="Resultado"><span class="status-pill status-pill--${tone}">${esc(RESULT[bet.result])}</span></td>
                <td data-label="Recibe">${R.coins(bet.payout)}</td>
                <td data-label="Balance"><span class="result-net result-net--${bet.net > 0 ? "up" : bet.net < 0 ? "down" : "even"}">${esc(net)}</span></td>
                <td data-label="XP">${data.xp_enabled ? `+${A.formatNumber(bet.xp_gained)} XP${levels}` : '<span class="admin-muted">—</span>'}</td>
            </tr>`;
        }).join("") : '<tr><td colspan="7"><p class="admin-empty">Sin pronósticos pendientes.</p></td></tr>';
        $("#result-preview").hidden = false;
        $("#confirm-button").textContent = `Confirmar a ${data.winner.driver_name} como ganador…`;
        const money = data.outcome === "REFUND_ALL" ? "se devuelven los PitCoins" : data.outcome === "NO_BETS" ? "se registra el ganador" : "se pagan los premios";
        $("#confirm-effects").textContent = `Al confirmar ${money}${data.xp_enabled ? ", se otorga el XP" : ""} y la carrera queda liquidada.`;
        $("#result-preview").scrollIntoView({ block: "start", behavior: "smooth" });
    }

    function clearPreview() {
        preview = null;
        request += 1;
        $("#result-preview").hidden = true;
    }

    async function loadPreview() {
        const winner = chosenWinner();
        if (!winner) return;
        const current = ++request;
        $("#pick-error").textContent = "";
        $("#result-alert").hidden = true;
        $("#preview-button").disabled = true;
        $("#preview-button").textContent = "Calculando…";
        try {
            const data = await A.api(`/api/admin/races/${race.id}/settlement?winner=${winner}`);
            if (current !== request) return;
            renderPreview(data.preview);
        } catch (error) {
            if (current !== request || error.status === 401) return;
            if (error.status === 409 || error.status === 404) return reloadRace(error.message);
            $("#pick-error").textContent = error.fields?.winner_option_id || error.message;
        } finally {
            if (current === request) {
                $("#preview-button").disabled = !chosenWinner();
                $("#preview-button").textContent = "Calcular reparto";
            }
        }
    }

    function confirmDetails(data) {
        const s = data.summary;
        const rows = [
            ["Ganador", esc(data.winner.driver_name)],
            ["Bote", R.coins(s.total_pool)],
            [data.outcome === "REFUND_ALL" ? "Se devuelven" : "Se pagan", R.coins(data.outcome === "REFUND_ALL" ? s.refunded_pitcoins : s.paid_out)],
            ["Acertantes", A.formatNumber(s.winners)],
            ["XP", data.xp_enabled ? `${A.formatNumber(s.xp_total)} XP` : "Desactivado"],
        ];
        return `<dl class="confirm-summary">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
    }

    function openConfirm() {
        if (!preview) return;
        const data = preview;
        let conflict = null;
        AdminForm.typedConfirm({
            title: "Liquidar carrera",
            intro: "Operación definitiva: se pagarán los premios y el ganador no se podrá cambiar.",
            details: confirmDetails(data),
            expected: race.name,
            confirmLabel: "Liquidar definitivamente",
            returnFocus: $("#confirm-button"),
            onConfirm: async typed => {
                try {
                    const result = await A.api(`/api/admin/races/${race.id}/settlement`, {
                        method: "POST",
                        body: JSON.stringify({ winner_option_id: data.winner.option_id, fingerprint: data.fingerprint, confirm_name: typed }),
                    });
                    race = result.race;
                } catch (error) {
                    if (error.status !== 409) throw error;
                    conflict = error.message;   // se cierra la ventana y se recarga el estado real
                }
            },
            onClose: () => {
                if (conflict) return void reloadRace(conflict);
                if (race.status === "FINISHED") {
                    A.notify("Carrera liquidada. Premios y XP registrados.");
                    render();
                }
            },
        });
    }

    // ------------------------------------------------------------ resultado definitivo
    function renderFinal() {
        $("#result-final").hidden = false;
        const winner = race.options.find(option => option.id === race.winner_option_id);
        $("#final-title").textContent = race.winner_name || winner?.driver_name || "Sin registrar";
        const s = race.settlement;
        $("#final-meta").textContent = s ? `Liquidada por ${s.by} el ${A.formatDateTime(s.at)}. Resultado definitivo.`
            : "Liquidada fuera del panel (sin registro de auditoría). Resultado definitivo.";
        const byStatus = race.bets_by_status || {};
        const sum = (key, field) => (byStatus[key]?.[field] || 0);
        const stats = [
            ["Pronósticos", A.formatNumber(race.bets)],
            ["Acertantes", A.formatNumber(sum("WON", "count"))],
            ["Premios pagados", R.coins(sum("WON", "payout"))],
            ["Devuelto", R.coins(sum("REFUNDED", "payout"))],
        ];
        if (s?.details?.xp_enabled) stats.push(["XP otorgado", `${A.formatNumber(s.details.xp_total)} XP`]);
        $("#final-stats").innerHTML = stats.map(([label, value]) => `<div class="mini-stat"><span>${esc(label)}</span><strong>${value}</strong></div>`).join("");
        $("#final-body").innerHTML = race.bets_list.length ? race.bets_list.map(bet => `
            <tr>
                <td data-label="Usuario">${esc(bet.username)}</td>
                <td data-label="Eligió">${esc(bet.driver_name)}</td>
                <td data-label="Pronosticó">${R.coins(bet.amount)}</td>
                <td data-label="Resultado">${R.betPill(bet.status)}</td>
                <td data-label="Recibió">${R.coins(bet.payout)}</td>
            </tr>`).join("") : '<tr><td colspan="5"><p class="admin-empty">Nadie pronosticó esta carrera.</p></td></tr>';
    }

    function render() {
        ["#result-blocked", "#result-pick", "#result-preview", "#result-final"].forEach(id => { $(id).hidden = true; });
        renderHead();
        if (race.status === "FINISHED") return renderFinal();
        if (!race.can_settle) {
            $("#blocked-text").innerHTML = `${esc(blockedReason())} <a href="race.html?id=${race.id}">Ir a la carrera</a>`;
            $("#result-blocked").hidden = false;
            return;
        }
        renderPick();
        $("#preview-button").disabled = true;
    }

    async function reloadRace(message) {
        clearPreview();
        try {
            race = (await A.api(`/api/admin/races/${race.id}`)).race;
            render();
        } catch (error) {
            // Se mantiene la vista; el aviso explica el problema.
        }
        if (message) showAlert(`${message}${race.can_settle ? " Elige al ganador y vuelve a calcular el reparto." : ""}`);
    }

    $("#winner-grid").addEventListener("change", () => {
        clearPreview();
        $("#preview-button").disabled = !chosenWinner();
        $("#pick-error").textContent = "";
    });
    $("#preview-button").addEventListener("click", loadPreview);
    $("#confirm-button").addEventListener("click", openConfirm);
    $("#result-retry").addEventListener("click", () => window.location.reload());

    async function init() {
        if (!raceId) {
            $("#result-loading").hidden = true;
            return showAlert("Falta la carrera. Vuelve al listado y elige una.");
        }
        try {
            race = (await A.api(`/api/admin/races/${raceId}`)).race;
            $("#result-loading").hidden = true;
            render();
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#result-loading").hidden = true;
            showAlert(error.status === 404 ? "Esa carrera no existe." : `No se pudo cargar la carrera: ${error.message}`, error.status !== 404);
        }
    }

    A.ready.then(init, () => {});
})();
