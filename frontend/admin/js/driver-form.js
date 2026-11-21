/* Formulario de piloto (fase A4). Cambiar el equipo solo afecta a la ficha del
   piloto: el historial de carreras conserva el equipo de entonces. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const RACE_LABELS = { SCHEDULED: "Programada", OPEN: "Abierta", LOCKED: "Cerrada", FINISHED: "Liquidada", CANCELLED: "Cancelada" };
    const params = new URLSearchParams(window.location.search);
    const driverId = Number(params.get("id")) || null;
    let driver = null;
    let teams = [];
    let saving = false;
    let uploading = false;

    const form = $("#driver-form");
    const ui = AdminForm.create({
        form,
        inputs: { name: $("#d-name"), number: $("#d-number"), nationality: $("#d-nationality"), team_id: $("#d-team") },
        alert: $("#form-alert"), alertText: $("#form-alert-text"), reload: $("#form-reload"),
        dirtyLabel: $("#dirty-state"), leaveLinks: [$("#cancel-link"), $("#back-link")],
    });
    const photoPicker = $("#d-photo-pick");
    const photoUpload = $("#d-photo-upload");
    const photoVisual = $("#d-photo-visual");
    const photoStatus = $("#d-photo-status");
    let photoPath = null;
    const photo = {
        get value() { return photoPath; },
        set(path) {
            photoPath = path || null;
            const hasPhoto = A.isDriverPhoto(photoPath);
            photoPicker.classList.toggle("is-filled", hasPhoto);
            photoPicker.setAttribute("aria-label", hasPhoto ? "Reemplazar fotografía" : "Subir fotografía");
            photoVisual.className = hasPhoto ? "driver-photo__image" : "driver-photo__empty";
            photoVisual.innerHTML = `${A.driverAvatar(driver?.name || $("#d-name").value || "Piloto", photoPath, "large")}${hasPhoto ? "" : '<span>Subir fotografía</span>'}`;
        },
    };
    photoPicker.addEventListener("click", () => photoUpload.click());
    photoUpload.addEventListener("change", async event => {
        const file = event.target.files[0];
        event.target.value = "";
        if (!file || uploading) return;
        const problem = AdminMedia.validate(file);
        if (problem) {
            photoStatus.textContent = problem;
            photoStatus.dataset.tone = "error";
            return;
        }
        uploading = true;
        photoPicker.disabled = true;
        $("#save-driver").disabled = true;
        photoStatus.dataset.tone = "";
        photoStatus.textContent = `Subiendo ${file.name}…`;
        try {
            photo.set(await AdminMedia.upload(file));
            ui.setDirty(true);
            photoStatus.textContent = "Fotografía subida. Guarda los cambios para aplicarla.";
        } catch (error) {
            photoStatus.textContent = error.status === 401 ? "" : `No se pudo subir: ${error.message}`;
            photoStatus.dataset.tone = "error";
        } finally {
            uploading = false;
            photoPicker.disabled = false;
            $("#save-driver").disabled = false;
        }
    });

    function teamOptions(selected) {
        // Equipos activos; un equipo inactivo solo aparece si ya es el del piloto.
        const usable = teams.filter(team => team.is_active || String(team.id) === String(selected ?? ""));
        $("#d-team").innerHTML = '<option value="">Sin equipo</option>' + usable.map(team =>
            `<option value="${team.id}">${esc(team.name)}${team.is_active ? "" : " (inactivo)"}</option>`).join("");
        $("#d-team").value = selected ?? "";
    }

    function history() {
        if (!driver) return;
        $("#driver-history").hidden = false;
        $("#history-body").innerHTML = driver.history.length ? driver.history.map(item => `
            <tr>
                <td data-label="Carrera"><strong>${esc(item.race_name)}</strong><small>${esc(A.formatDateTime(item.race_date))}</small></td>
                <td data-label="Registrado como">${esc(item.driver_name)}</td>
                <td data-label="Equipo en esa carrera">${esc(item.team_name || "Sin equipo")}</td>
                <td data-label="Pronósticos">${A.formatNumber(item.predictions)}</td>
                <td data-label="Estado"><span class="status-pill status-pill--${esc(String(item.status).toLowerCase())}">${esc(RACE_LABELS[item.status] || item.status)}</span></td>
            </tr>`).join("") : '<tr><td colspan="5"><p class="admin-empty">Este piloto aún no participa en carreras.</p></td></tr>';
    }

    function fill() {
        $("#d-name").value = driver?.name || "";
        $("#d-number").value = driver?.number ?? "";
        $("#d-nationality").value = driver?.nationality || "";
        $("#d-active").checked = driver ? driver.is_active : true;
        teamOptions(driver ? driver.team_id : params.get("team"));
        photo.set(driver?.image_path);
        photoStatus.textContent = "";
        photoStatus.dataset.tone = "";
        history();
        const title = driver ? "Editar piloto" : "Nuevo piloto";
        $("#admin-title").textContent = title;
        document.title = driver ? `Editar: ${driver.name} | Purple One Admin` : `${title} | Purple One Admin`;
        $("#save-driver").textContent = driver ? "Guardar cambios" : "Crear piloto";
        ui.setDirty(false);
    }

    function payload() {
        const data = {
            name: $("#d-name").value.trim(), number: $("#d-number").value.trim(), nationality: $("#d-nationality").value.trim(),
            team_id: $("#d-team").value || null, image_path: photo.value, is_active: $("#d-active").checked,
        };
        if (driver) data.version = driver.version;
        return data;
    }

    function localErrors(data) {
        const fields = {};
        if (data.name.length < 2) fields.name = data.name ? "El nombre es demasiado corto." : "El nombre es obligatorio.";
        if (data.number && !(/^\d+$/.test(data.number) && Number(data.number) >= 1 && Number(data.number) <= 99)) fields.number = "El dorsal debe estar entre 1 y 99.";
        return fields;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (saving) return;
        if (uploading) return A.notify("Espera a que termine la subida de la fotografía.", "error");
        ui.clearErrors();
        const data = payload();
        const fields = localErrors(data);
        if (Object.keys(fields).length) return ui.showErrors(fields);
        if (driver && String(driver.team_id ?? "") !== String(data.team_id ?? "") && driver.history.length) {
            const target = teams.find(team => String(team.id) === String(data.team_id))?.name || "sin equipo";
            if (!window.confirm(`${driver.name} pasará a ${target}. Sus ${driver.history.length} carreras anteriores conservarán el equipo con el que corrió. ¿Continuar?`)) return;
        }
        if (driver?.is_active && !data.is_active
            && !window.confirm(`¿Desactivar a ${driver.name}? No se podrá asignar a nuevas carreras; sus pronósticos anteriores se conservan.`)) return;
        saving = true;
        $("#save-driver").disabled = true;
        try {
            const result = await A.api(driver ? `/api/admin/drivers/${driver.id}` : "/api/admin/drivers",
                { method: driver ? "PUT" : "POST", body: JSON.stringify(data) });
            if (!driver) {
                ui.setDirty(false);
                window.location.replace(`driver.html?id=${result.driver.id}&created=1`);
                return;
            }
            driver = result.driver;
            fill();
            A.notify("Cambios guardados.");
        } catch (error) {
            ui.handleError(error);
        } finally {
            saving = false;
            $("#save-driver").disabled = false;
        }
    });

    async function init() {
        try {
            teams = (await A.api("/api/admin/team-options")).teams;
            if (driverId) driver = (await A.api(`/api/admin/drivers/${driverId}`)).driver;
            fill();
            $("#form-loading").hidden = true;
            form.hidden = false;
            if (params.get("created")) {
                A.notify("Piloto creado.");
                window.history.replaceState(null, "", `driver.html?id=${driverId}`);
            }
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#form-loading").hidden = true;
            ui.showAlert(error.status === 404 ? "Ese piloto no existe." : `No se pudo cargar el piloto: ${error.message}`, error.status !== 404);
        }
    }

    A.ready.then(init, () => {});
})();
