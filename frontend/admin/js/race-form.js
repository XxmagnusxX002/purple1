/* Carrera (fase A5): datos del Gran Premio, estado, participantes, pronosticos
   y actividad. Las reglas las aplica el backend; aqui solo se muestran las
   acciones que el estado permite y se explica por que. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const R = window.AdminRaces;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const params = new URLSearchParams(window.location.search);
    const raceId = Number(params.get("id")) || null;
    // País y zona horaria salen de la misma lista que dibuja las banderas
    // (../js/media.js): todo país que se puede elegir tiene bandera.
    const COUNTRIES = window.PurpleMedia.countries();
    const ACTIONS = {
        RACE_CREATED: "Creó la carrera", RACE_UPDATED: "Editó los datos", RACE_PARTICIPANTS_ADDED: "Agregó pilotos",
        RACE_PARTICIPANT_REMOVED: "Quitó un piloto", RACE_OPENED: "Abrió los pronósticos", RACE_LOCKED: "Cerró los pronósticos",
        RACE_REOPENED: "Reabrió los pronósticos", RACE_UNPUBLISHED: "La devolvió a programada", RACE_CANCELLED: "Canceló la carrera",
        RACE_SETTLED: "Liquidó la carrera",
    };
    let race = null;
    let drivers = [];
    let saving = false;
    let busy = false;

    const form = $("#race-form");
    const scheduleInputs = [$("#r-date"), $("#r-time"), $("#r-timezone")];
    const ui = AdminForm.create({
        form,
        inputs: { name: $("#r-name"), circuit: $("#r-circuit"), country: $("#r-country"), date: $("#r-date"), time: $("#r-time"), timezone: $("#r-timezone"), fold: $("#r-fold") },
        alert: $("#form-alert"), alertText: $("#form-alert-text"), reload: $("#form-reload"),
        dirtyLabel: $("#dirty-state"), leaveLinks: [$("#cancel-link"), $("#back-link")],
    });
    // Sin póster propio, Pronósticos muestra la bandera del país: es la vista previa por defecto.
    const poster = AdminForm.imageSlot($("#r-image"), {
        label: "imagen", hint: "Opcional. PNG, JPEG o WebP de hasta 2 MB, horizontal (16:9).",
        fallback: () => $("#r-country").value
            ? `${window.PurpleMedia.raceFlag({ country: $("#r-country").value }, "lg")}<small>Sin póster: se mostrará la bandera de ${A.escapeHTML($("#r-country").value)}</small>`
            : "",
        onChange: () => ui.setDirty(true),
    });
    const countrySelect = $("#r-country");
    const zoneSelect = $("#r-timezone");

    // Lista de países; un país antiguo escrito a mano se conserva como opción "sin bandera".
    function renderCountries(selected) {
        const known = COUNTRIES.some(country => country.name === selected);
        countrySelect.innerHTML = '<option value="">Sin país</option>'
            + (selected && !known ? `<option value="${esc(selected)}">${esc(selected)} (sin bandera)</option>` : "")
            + COUNTRIES.map(country => `<option value="${esc(country.name)}">${esc(country.name)}</option>`).join("");
        countrySelect.value = selected || "";
    }

    // Zonas: primero las del país elegido; después todas, por si el circuito es especial.
    function renderZones(selected) {
        const country = COUNTRIES.find(item => item.name === countrySelect.value);
        const own = country ? country.zones : [];
        const option = ([zone, place], owner) => `<option value="${esc(zone)}">${esc(owner ? `${owner} · ` : "")}${esc(place)} — ${esc(zone)}</option>`;
        const others = COUNTRIES.flatMap(item => item.zones.map(zone => [zone, item.name])).filter(([zone]) => !own.some(([z]) => z === zone[0]));
        const known = own.some(([z]) => z === selected) || others.some(([zone]) => zone[0] === selected) || selected === "UTC";
        zoneSelect.innerHTML = (own.length ? `<optgroup label="${esc(country.name)}">${own.map(zone => option(zone)).join("")}</optgroup>` : "")
            + `<optgroup label="${own.length ? "Otras zonas" : "Zonas horarias"}">${others.map(([zone, owner]) => option(zone, owner)).join("")}<option value="UTC">UTC</option></optgroup>`
            + (selected && !known ? `<option value="${esc(selected)}">${esc(selected)}</option>` : "");
        zoneSelect.value = selected && [...zoneSelect.options].some(opt => opt.value === selected) ? selected : (own[0]?.[0] || "UTC");
    }

    function renderFlag() {
        $("#r-country-flag").innerHTML = window.PurpleMedia.raceFlag({ country: countrySelect.value }, "sm");
        poster.refresh();
    }

    countrySelect.addEventListener("change", () => {
        // Al cambiar de país se propone su zona, salvo que la actual ya sea de ese país.
        const country = COUNTRIES.find(item => item.name === countrySelect.value);
        const keep = country?.zones.some(([zone]) => zone === zoneSelect.value);
        renderZones(keep ? zoneSelect.value : country?.zones[0]?.[0] || zoneSelect.value);
        renderFlag();
    });

    // ------------------------------------------------------------ formulario
    // Hora repetida al atrasar el reloj: el servidor pide elegir cual de las dos es.
    function showFold(value) {
        $("#r-fold-field").hidden = false;
        if (value !== undefined) $("#r-fold").value = value === null ? "" : String(value);
    }

    function hideFold() {
        $("#r-fold-field").hidden = true;
        $("#r-fold").value = "";
    }

    scheduleInputs.forEach(input => input.addEventListener("input", hideFold));
    function applyScheduleLock() {
        const locked = Boolean(race?.schedule_locked);
        if (locked) {
            $("#r-date").value = race.local_date || "";
            $("#r-time").value = race.local_time || "";
            renderZones(race.circuit_timezone || "");
        }
        scheduleInputs.forEach(input => { input.disabled = locked || (race && !race.editable); });
        const hint = $("#hint-r-timezone");
        if (race && !race.editable) hint.textContent = "Carrera definitiva: sus datos ya no se pueden cambiar.";
        else if (locked) hint.textContent = race.bets ? "Ya hay pronósticos: la fecha y la hora no cambian. Si se aplaza, cancela la carrera y crea otra."
            : "Con los pronósticos cerrados la fecha y la hora ya no cambian.";
        else hint.textContent = "Hora local del circuito: se propone al elegir el país. Los pronósticos se cierran solos a esa hora.";
    }

    function fill() {
        $("#r-name").value = race?.name || "";
        $("#r-circuit").value = race?.circuit || "";
        renderCountries(race?.country || "");
        renderFlag();
        $("#r-date").value = race?.local_date || "";
        $("#r-time").value = race?.local_time || "";
        renderZones(race ? race.circuit_timezone || "" : "");
        const readOnly = race && !race.editable;
        form.querySelectorAll("input, button, select").forEach(el => { if (!el.closest(".admin-form-actions")) el.disabled = Boolean(readOnly); });
        poster.set(race?.image_path);
        if (race?.time_ambiguous) showFold(race.fold);
        else hideFold();
        $("#r-fold").disabled = Boolean(race?.schedule_locked);
        poster.disable(Boolean(readOnly));
        $("#save-race").hidden = Boolean(readOnly);
        // Carrera liquidada o cancelada: sin barra de guardar/cancelar (volver está arriba).
        document.querySelector(".admin-form-actions").hidden = Boolean(readOnly);
        applyScheduleLock();
        const title = race ? race.name : "Nueva carrera";
        $("#admin-title").textContent = title;
        document.title = `${title} | Purple One Admin`;
        $("#save-race").textContent = race ? "Guardar cambios" : "Crear carrera";
        ui.setDirty(false);
    }

    function payload() {
        const data = { name: $("#r-name").value.trim(), circuit: $("#r-circuit").value.trim(), country: $("#r-country").value.trim(), image_path: poster.value };
        if (!race?.schedule_locked) {
            Object.assign(data, { date: $("#r-date").value, time: $("#r-time").value, timezone: $("#r-timezone").value.trim() });
            if (!$("#r-fold-field").hidden && $("#r-fold").value !== "") data.fold = Number($("#r-fold").value);
        }
        if (race) data.version = race.version;
        return data;
    }

    function localErrors(data) {
        const fields = {};
        if (data.name.length < 3) fields.name = data.name ? "El nombre es demasiado corto." : "El nombre es obligatorio.";
        if (!data.circuit) fields.circuit = "El circuito es obligatorio.";
        if ("date" in data) {
            if (!data.date) fields.date = "La fecha es obligatoria.";
            if (!data.time) fields.time = "La hora es obligatoria.";
            if (!data.timezone) fields.timezone = "La zona horaria es obligatoria.";
        }
        return fields;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (saving) return;
        ui.clearErrors();
        const data = payload();
        const fields = localErrors(data);
        if (Object.keys(fields).length) return ui.showErrors(fields);
        saving = true;
        $("#save-race").disabled = true;
        try {
            const result = await A.api(race ? `/api/admin/races/${race.id}` : "/api/admin/races", { method: race ? "PUT" : "POST", body: JSON.stringify(data) });
            if (!race) {
                ui.setDirty(false);
                window.location.replace(`race.html?id=${result.race.id}&created=1`);
                return;
            }
            race = result.race;
            fill();
            renderManage();
            A.notify("Cambios guardados.");
        } catch (error) {
            if (error.fields?.fold) showFold();
            ui.handleError(error);
        } finally {
            saving = false;
            $("#save-race").disabled = false;
        }
    });

    // ------------------------------------------------------------ estado
    function statusHelp() {
        switch (race.status) {
            case "SCHEDULED": return race.participants < 2 ? "Aún no se puede pronosticar. Agrega al menos 2 pilotos y abre los pronósticos." : "Aún no se puede pronosticar. Ábrela cuando quieras publicar la carrera.";
            case "OPEN": return "Los usuarios pueden pronosticar hasta la hora de salida. Después ciérrala para poder liquidarla.";
            case "LOCKED": return race.can_settle ? "Pronósticos cerrados y la carrera ya empezó: elige al ganador para liquidarla."
                : "Pronósticos cerrados. Podrás elegir al ganador cuando empiece la carrera.";
            case "FINISHED": return `Liquidada${race.winner_name ? `: ganó ${race.winner_name}` : ""}. El resultado es definitivo.`;
            case "CANCELLED": return "Cancelada. Los PitCoins de los pronósticos pendientes se devolvieron.";
            default: return "";
        }
    }

    function statusButtons() {
        const buttons = [];
        if (race.can_settle) buttons.push(`<a class="btn-primary" href="result.html?id=${race.id}"><i class="fa-solid fa-trophy" aria-hidden="true"></i> Elegir ganador y liquidar</a>`);
        if (race.status === "FINISHED") buttons.push(`<a class="btn-primary" href="result.html?id=${race.id}">Ver resultado</a>`);
        race.transitions.forEach(target => {
            if (target === "OPEN") {
                const reopen = race.status === "LOCKED";
                const blocked = race.participants < 2 || (race.started && !race.legacy);
                buttons.push(`<button type="button" class="admin-button" data-status-action="OPEN" ${blocked ? "disabled" : ""}>${reopen ? "Reabrir pronósticos" : "Abrir pronósticos"}</button>`);
            } else if (target === "LOCKED") {
                buttons.push('<button type="button" class="admin-button" data-status-action="LOCKED">Cerrar pronósticos</button>');
            } else if (target === "SCHEDULED" && !race.bets) {
                buttons.push('<button type="button" class="admin-button" data-status-action="SCHEDULED">Volver a programada</button>');
            } else if (target === "CANCELLED") {
                buttons.push('<button type="button" class="admin-button admin-button--danger" data-status-action="CANCELLED">Cancelar carrera</button>');
            }
        });
        return buttons.join("");
    }

    function renderStatus() {
        $("#race-status").hidden = false;
        $("#status-pill").innerHTML = R.pill(race.status);
        $("#status-help").textContent = statusHelp();
        $("#race-stats").innerHTML = [
            ["Salida (hora del circuito)", R.when(race)],
            ["Pilotos", A.formatNumber(race.participants)],
            ...(race.status === "FINISHED" ? finishedFacts() : [
                ["Pronósticos", A.formatNumber(race.bets)],
                ["PitCoins en juego", R.coins(race.pending_pool)],
            ]),
        ].map(([label, value]) => `<div class="mini-stat"><span>${esc(label)}</span><strong>${value}</strong></div>`).join("");
        $("#status-actions").innerHTML = statusButtons();
    }

    // Carrera liquidada: cifras definitivas desde los pronósticos registrados.
    function finishedFacts() {
        const by = race.bets_by_status || {};
        const get = (status, key) => (by[status] || {})[key] || 0;
        const users = new Set(race.bets_list.map(bet => bet.user_id)).size;
        const staked = ["WON", "LOST", "REFUNDED"].reduce((sum, status) => sum + get(status, "amount"), 0);
        return [
            ["Usuarios que pronosticaron", A.formatNumber(users)],
            ["Acertados · fallidos · devueltos", `${A.formatNumber(get("WON", "count"))} · ${A.formatNumber(get("LOST", "count"))} · ${A.formatNumber(get("REFUNDED", "count"))}`],
            ["PitCoins utilizados", R.coins(staked)],
            [get("WON", "count") ? "PitCoins repartidos en premios" : "PitCoins devueltos", R.coins(get("WON", "payout") + get("REFUNDED", "payout"))],
        ];
    }

    async function changeStatus(target) {
        if (busy) return;
        if (target === "LOCKED" && !window.confirm("¿Cerrar los pronósticos? Nadie podrá pronosticar ni cambiar su elección. Puedes reabrirlos mientras no empiece la carrera.")) return;
        if (target === "SCHEDULED" && !window.confirm("¿Volver a programada? La carrera dejará de admitir pronósticos hasta que la abras de nuevo.")) return;
        busy = true;
        try {
            race = (await A.api(`/api/admin/races/${race.id}/status`, { method: "POST", body: JSON.stringify({ status: target }) })).race;
            A.notify({ OPEN: "Pronósticos abiertos.", LOCKED: "Pronósticos cerrados.", SCHEDULED: "La carrera volvió a programada." }[target]);
            renderManage();
        } catch (error) {
            if (error.status !== 401) A.notify(error.message, "error");
            if (error.status === 409) await reload();
        } finally {
            busy = false;
        }
    }

    function cancelRace(button) {
        const refund = race.pending_bets
            ? `<p>Se devolverán <strong>${R.coins(race.pending_pool)}</strong> a los ${A.formatNumber(race.pending_bets)} pronósticos pendientes.</p>`
            : "<p>No hay pronósticos pendientes que devolver.</p>";
        AdminForm.typedConfirm({
            title: "Cancelar carrera",
            intro: "Esta acción es definitiva: la carrera no se podrá reabrir ni liquidar.",
            details: refund,
            expected: race.name,
            confirmLabel: "Cancelar carrera definitivamente",
            returnFocus: button,
            onConfirm: async typed => {
                race = (await A.api(`/api/admin/races/${race.id}/status`, { method: "POST", body: JSON.stringify({ status: "CANCELLED", confirm_name: typed }) })).race;
                A.notify("Carrera cancelada. Los PitCoins se devolvieron.");
                fill();
                renderManage();
            },
        });
    }

    // ------------------------------------------------------------ participantes
    function participantRow(option) {
        // Una carrera abierta no puede quedarse con menos de dos pilotos (lo exige el backend).
        const removable = race.roster_editable && !option.bets && !(race.status === "OPEN" && race.participants <= 2);
        const notes = [option.team_name || "Sin equipo"];
        if (!option.driver_id) notes.push("sin ficha de piloto");
        else if (option.driver_active === false) notes.push("piloto inactivo");
        return `<li class="participant${race.winner_option_id === option.id ? " is-winner" : ""}" data-option-id="${option.id}">
            ${option.finish_order ? `<span class="participant__pos" title="Posición oficial">${option.finish_position ?? "NC"}</span>` : ""}${A.driverAvatar(option.driver_name, option.image_path)}
            <div class="participant__main"><strong>${option.number ? `<span class="driver-number">${esc(option.number)}</span> ` : ""}${esc(option.driver_name)}</strong>
                <small>${esc(notes.join(" · "))}</small></div>
            <div class="participant__stats"><strong>${A.formatNumber(option.bets)}</strong> ${option.bets === 1 ? "pronóstico" : "pronósticos"}<small>${R.coins(option.pool)}${option.odds ? ` · cuota ${esc(option.odds)}` : ""}</small></div>
            ${removable ? `<button type="button" class="admin-icon-button admin-icon-button--danger" data-remove-option aria-label="Quitar a ${esc(option.driver_name)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>` : ""}
        </li>`;
    }

    function renderParticipants() {
        $("#race-participants").hidden = false;
        $("#participant-list").innerHTML = race.options.length ? race.options.map(participantRow).join("")
            : '<li><p class="admin-empty">Todavía no hay pilotos en esta carrera.</p></li>';
        $("#participants-help").textContent = race.roster_editable
            ? "Se guarda el nombre, el equipo y la foto de hoy. Solo se puede quitar a un piloto sin pronósticos."
            : "Lista definitiva: los participantes ya no cambian.";
        const add = $("#participant-add");
        add.hidden = !race.roster_editable;
        if (add.hidden) return;
        const taken = new Set(race.options.map(option => option.driver_id).filter(Boolean));
        const free = drivers.filter(driver => !taken.has(driver.id));
        $("#driver-choices").innerHTML = free.length ? free.map(driver => `
            <label class="admin-check admin-check--compact"><input type="checkbox" value="${driver.id}" data-no-dirty>
                <span>${esc(driver.name)}<small>${esc(driver.team_name || "Sin equipo")}</small></span></label>`).join("")
            : '<p class="admin-empty">Todos los pilotos activos ya participan.</p>';
        $("#select-all-drivers").hidden = !free.length;
        $("#participants-error").textContent = "";
        updateAddButton();
    }

    function chosenDrivers() {
        return [...document.querySelectorAll("#driver-choices input:checked")].map(input => Number(input.value));
    }

    function updateAddButton() {
        const count = chosenDrivers().length;
        $("#add-drivers").disabled = !count;
        $("#add-drivers").textContent = count ? `Agregar ${count} ${count === 1 ? "piloto" : "pilotos"}` : "Agregar seleccionados";
    }

    async function addDrivers() {
        const ids = chosenDrivers();
        if (!ids.length || busy) return;
        busy = true;
        $("#add-drivers").disabled = true;
        try {
            race = (await A.api(`/api/admin/races/${race.id}/participants`, { method: "POST", body: JSON.stringify({ driver_ids: ids }) })).race;
            A.notify(ids.length === 1 ? "Piloto agregado." : `${ids.length} pilotos agregados.`);
            renderManage();
        } catch (error) {
            if (error.status === 401) return;
            $("#participants-error").textContent = error.fields?.driver_ids || error.message;
            updateAddButton();
        } finally {
            busy = false;
        }
    }

    async function removeOption(button) {
        const option = race.options.find(item => String(item.id) === button.closest("[data-option-id]").dataset.optionId);
        if (busy || !window.confirm(`¿Quitar a ${option.driver_name} de ${race.name}?`)) return;
        busy = true;
        button.disabled = true;
        try {
            race = (await A.api(`/api/admin/races/${race.id}/participants/${option.id}`, { method: "DELETE" })).race;
            A.notify("Piloto quitado de la carrera.");
            renderManage();
        } catch (error) {
            if (error.status !== 401) A.notify(error.message, "error");
            button.disabled = false;
        } finally {
            busy = false;
        }
    }

    // ------------------------------------------------------------ pronosticos y actividad
    function renderBets() {
        $("#race-bets").hidden = false;
        $("#bets-all").href = `predictions.html?race=${race.id}`;
        const shown = race.bets_list.length;
        $("#bets-help").textContent = race.bets
            ? `${A.formatNumber(race.bets)} pronósticos${shown < race.bets ? ` · se muestran los ${A.formatNumber(shown)} más recientes` : ""}.`
            : "Aún no hay pronósticos.";
        $("#bets-body").innerHTML = shown ? race.bets_list.map(bet => {
            const name = `${bet.first_name || ""} ${bet.last_name || ""}`.trim() || bet.username;
            const net = bet.net;
            return `<tr class="bet-row bet-row--${bet.status.toLowerCase()}">
                <td data-label="Usuario"><span class="product-cell user-cell">${A.driverAvatar(name, null)}<span><strong>${esc(name)}</strong><small class="user-cell__email">${esc(bet.email)}</small></span></span></td>
                <td data-label="Piloto elegido"><span class="product-cell">${A.driverAvatar(bet.driver_name, race.options.find(option => option.id === bet.option_id)?.image_path)}<span>${esc(bet.driver_name)}</span></span></td>
                <td data-label="PitCoins">${R.coins(bet.amount)}</td>
                <td data-label="Cuota">${bet.odds ? `x${Number(bet.odds).toFixed(2)}` : '<span class="admin-muted">—</span>'}</td>
                <td data-label="Estado">${R.betPill(bet.status)}</td>
                <td data-label="Recibió">${bet.status === "PENDING" ? '<span class="admin-muted">—</span>' : R.coins(bet.payout)}</td>
                <td data-label="Neto">${net == null ? '<span class="admin-muted">—</span>' : `<span class="coin-delta coin-delta--${net > 0 ? "in" : net < 0 ? "out" : "zero"}">${net > 0 ? "+" : net < 0 ? "−" : ""}${A.formatNumber(Math.abs(net))}</span>`}</td>
                <td data-label="XP">${bet.status === "PENDING" ? '<span class="admin-muted">—</span>' : `+${A.formatNumber(bet.xp_gained)} XP`}</td>
                <td data-label="Fecha">${esc(A.formatDateTime(bet.created_at))}</td>
            </tr>`;
        }).join("") : '<tr><td colspan="9"><p class="admin-empty">Cuando los usuarios pronostiquen, aparecerán aquí.</p></td></tr>';
    }

    function activityDetail(item) {
        const d = item.details || {};
        if (item.action === "RACE_SETTLED") return `Ganador: ${d.winner || "—"}`;
        if (item.action === "RACE_PARTICIPANT_REMOVED") return d.driver_name || "";
        if (item.action === "RACE_PARTICIPANTS_ADDED") return `${(d.drivers || []).length} pilotos`;
        if (item.action === "RACE_CANCELLED") return `${A.formatNumber(d.refunded_bets || 0)} pronósticos devueltos`;
        return "";
    }

    function renderActivity() {
        $("#race-activity").hidden = false;
        $("#activity-list").innerHTML = race.activity.length ? race.activity.map(item => `
            <li><div class="admin-list__main"><strong>${esc(ACTIONS[item.action] || item.action)}</strong><small>${esc(item.actor)}${activityDetail(item) ? ` · ${esc(activityDetail(item))}` : ""}</small></div>
                <div class="admin-list__side"><small>${esc(A.formatDateTime(item.created_at))}</small></div></li>`).join("")
            : '<li><p class="admin-empty">Sin cambios registrados desde el panel.</p></li>';
    }

    function renderManage() {
        renderStatus();
        renderParticipants();
        renderBets();
        renderActivity();
        applyScheduleLock();
    }

    async function reload() {
        try {
            race = (await A.api(`/api/admin/races/${race.id}`)).race;
            renderManage();
        } catch (error) {
            // Se conserva la vista anterior; el aviso ya informo del problema.
        }
    }

    $("#status-actions").addEventListener("click", event => {
        const button = event.target.closest("[data-status-action]");
        if (!button || button.disabled) return;
        if (button.dataset.statusAction === "CANCELLED") cancelRace(button);
        else changeStatus(button.dataset.statusAction);
    });
    $("#participant-list").addEventListener("click", event => {
        const button = event.target.closest("[data-remove-option]");
        if (button) removeOption(button);
    });
    $("#driver-choices").addEventListener("change", updateAddButton);
    $("#select-all-drivers").addEventListener("click", () => {
        const boxes = [...document.querySelectorAll("#driver-choices input")];
        const all = boxes.every(box => box.checked);
        boxes.forEach(box => { box.checked = !all; });
        updateAddButton();
    });
    $("#add-drivers").addEventListener("click", addDrivers);

    async function init() {
        try {
            if (raceId) {
                const [raceData, driverData] = await Promise.all([
                    A.api(`/api/admin/races/${raceId}`),
                    A.api("/api/admin/drivers?status=active&sort=name"),
                ]);
                race = raceData.race;
                drivers = driverData.drivers;
            }
            fill();
            $("#form-loading").hidden = true;
            form.hidden = false;
            if (race) renderManage();
            if (params.get("created")) {
                A.notify("Carrera creada. Ahora agrega a los pilotos.");
                window.history.replaceState(null, "", `race.html?id=${raceId}`);
            }
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#form-loading").hidden = true;
            ui.showAlert(error.status === 404 ? "Esa carrera no existe." : `No se pudo cargar la carrera: ${error.message}`, error.status !== 404);
        }
    }

    A.ready.then(init, () => {});
})();
