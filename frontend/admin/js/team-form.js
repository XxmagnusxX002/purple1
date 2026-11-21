/* Formulario de equipo (fase A4). El backend vuelve a validar todo. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const HEX = /^#[0-9A-Fa-f]{6}$/;
    const params = new URLSearchParams(window.location.search);
    const teamId = Number(params.get("id")) || null;
    let team = null;
    let saving = false;

    const form = $("#team-form");
    const ui = AdminForm.create({
        form,
        inputs: { name: $("#t-name"), slug: $("#t-slug"), country: $("#t-country"), description: $("#t-description"),
                  primary_color: $("#t-primary"), secondary_color: $("#t-secondary") },
        alert: $("#form-alert"), alertText: $("#form-alert-text"), reload: $("#form-reload"),
        dirtyLabel: $("#dirty-state"), leaveLinks: [$("#cancel-link"), $("#back-link")],
    });
    function teamImageSlot(container, label) {
        let value = null;
        container.innerHTML = `
            <div class="team-media">
                <button type="button" class="team-media__preview" data-team-media-open aria-expanded="false">
                    <span data-team-media-visual></span>
                </button>
                <div class="team-media__menu" data-team-media-menu hidden>
                    <button type="button" data-team-media-pick>Elegir existente</button>
                    <button type="button" data-team-media-upload>Subir archivo</button>
                    <button type="button" data-team-media-clear>Quitar imagen</button>
                </div>
                <input type="file" accept="image/png,image/jpeg,image/webp" data-team-media-file hidden data-no-dirty>
                <p class="admin-field__hint team-media__status" role="status" aria-live="polite" data-team-media-status>PNG, JPEG o WebP de hasta 2 MB.</p>
            </div>`;
        const open = container.querySelector("[data-team-media-open]");
        const visual = container.querySelector("[data-team-media-visual]");
        const menu = container.querySelector("[data-team-media-menu]");
        const pick = container.querySelector("[data-team-media-pick]");
        const upload = container.querySelector("[data-team-media-upload]");
        const clear = container.querySelector("[data-team-media-clear]");
        const fileInput = container.querySelector("[data-team-media-file]");
        const status = container.querySelector("[data-team-media-status]");
        menu.id = `${container.id}-menu`;
        open.setAttribute("aria-controls", menu.id);

        function closeMenu() {
            menu.hidden = true;
            open.setAttribute("aria-expanded", "false");
        }

        function set(path, notify = false) {
            value = path || null;
            visual.innerHTML = value
                ? `<img src="../${esc(value)}" alt="">`
                : `<span class="team-media__empty"><i class="fa-solid fa-camera" aria-hidden="true"></i><span>Añadir ${esc(label)}</span></span>`;
            open.setAttribute("aria-label", value ? `Cambiar ${label}` : `Añadir ${label}`);
            clear.disabled = !value;
            if (notify) {
                status.textContent = "PNG, JPEG o WebP de hasta 2 MB.";
                ui.setDirty(true);
            }
        }

        open.addEventListener("click", () => {
            if (!menu.hidden) return closeMenu();
            menu.hidden = false;
            open.setAttribute("aria-expanded", "true");
            pick.focus();
        });
        pick.addEventListener("click", () => {
            closeMenu();
            AdminMedia.openGallery({ isChosen: path => path === value, onPick: path => set(path, true), closeOnPick: true, returnFocus: open });
        });
        upload.addEventListener("click", () => { closeMenu(); fileInput.click(); });
        clear.addEventListener("click", () => { closeMenu(); set(null, true); open.focus(); });
        fileInput.addEventListener("change", async () => {
            const file = fileInput.files[0];
            fileInput.value = "";
            if (!file) return;
            const problem = AdminMedia.validate(file);
            if (problem) return void (status.textContent = problem);
            open.disabled = true;
            status.textContent = `Subiendo ${file.name}…`;
            try {
                set(await AdminMedia.upload(file), true);
                status.textContent = "Imagen subida.";
            } catch (error) {
                status.textContent = error.status === 401 ? "" : `No se pudo subir: ${error.message}`;
            } finally {
                open.disabled = false;
            }
        });
        document.addEventListener("click", event => { if (!container.contains(event.target)) closeMenu(); });
        container.addEventListener("keydown", event => {
            if (event.key !== "Escape" || menu.hidden) return;
            closeMenu();
            open.focus();
        });
        set(null);
        return { get value() { return value; }, set };
    }

    const logo = teamImageSlot($("#t-logo"), "escudo");
    const image = teamImageSlot($("#t-image"), "imagen");
    const primary = AdminForm.colorField($("#t-primary"), $("#t-primary-picker"));
    const secondary = AdminForm.colorField($("#t-secondary"), $("#t-secondary-picker"));

    function counter() {
        $("#count-t-description").textContent = `${$("#t-description").value.length} / 200`;
    }

    function relations() {
        if (!team) return;
        $("#team-relations").hidden = false;
        $("#add-driver").href = `driver.html?team=${team.id}`;
        $("#add-driver").hidden = !team.is_active;
        $("#team-drivers").innerHTML = team.drivers.length ? team.drivers.map(driver => `
            <li><span class="driver-entry">${A.driverAvatar(driver.name, driver.image_path)}<span class="admin-list__main"><strong><a href="driver.html?id=${driver.id}">${esc(driver.name)}</a></strong>
                <small>${driver.number ? `#${esc(driver.number)} · ` : ""}${esc(driver.nationality || "Nacionalidad sin definir")}</small></span></span>
                <span class="status-pill status-pill--${driver.is_active ? "paid" : "cancelled"}">${driver.is_active ? "Activo" : "Inactivo"}</span></li>`).join("")
            : '<li class="admin-empty">Sin pilotos asignados.</li>';
        $("#team-products-help").textContent = `${A.formatNumber(team.products)} asociados (${A.formatNumber(team.active_products)} activos). Se asignan desde cada producto.`;
        $("#team-products").innerHTML = team.products_list.length ? team.products_list.map(product => `
            <li><span class="admin-list__main"><strong><a href="product.html?id=${product.id}">${esc(product.name)}</a></strong></span>
                <span class="status-pill status-pill--${product.is_active ? "paid" : "cancelled"}">${product.is_active ? "Activo" : "Inactivo"}</span></li>`).join("")
            : '<li class="admin-empty">Ningún producto asociado.</li>';
    }

    function fill() {
        $("#t-name").value = team?.name || "";
        $("#t-slug").value = team?.slug || "";
        $("#t-country").value = team?.country || "";
        $("#t-description").value = team?.description || "";
        $("#t-active").checked = team ? team.is_active : true;
        primary.set(team?.primary_color);
        secondary.set(team?.secondary_color);
        logo.set(team?.logo_path);
        image.set(team?.image_path);
        counter();
        relations();
        const title = team ? `Editar: ${team.name}` : "Nuevo equipo";
        $("#admin-title").textContent = title;
        document.title = `${title} | Purple One Admin`;
        $("#save-team").textContent = team ? "Guardar cambios" : "Crear equipo";
        ui.setDirty(false);
    }

    function payload() {
        const data = {
            name: $("#t-name").value.trim(), slug: $("#t-slug").value.trim(), country: $("#t-country").value.trim(),
            description: $("#t-description").value.trim(), primary_color: $("#t-primary").value.trim().toUpperCase(),
            secondary_color: $("#t-secondary").value.trim().toUpperCase(), logo_path: logo.value, image_path: image.value,
            is_active: $("#t-active").checked,
        };
        if (team) data.version = team.version;
        return data;
    }

    function localErrors(data) {
        const fields = {};
        if (!data.name) fields.name = "El nombre es obligatorio.";
        if (data.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug)) fields.slug = "Usa solo minúsculas, números y guiones.";
        if (data.primary_color && !HEX.test(data.primary_color)) fields.primary_color = "Usa el formato #RRGGBB.";
        if (data.secondary_color && !HEX.test(data.secondary_color)) fields.secondary_color = "Usa el formato #RRGGBB.";
        return fields;
    }

    form.addEventListener("input", event => {
        if (event.target.id === "t-description") counter();
    });
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (saving) return;
        ui.clearErrors();
        const data = payload();
        const fields = localErrors(data);
        if (Object.keys(fields).length) return ui.showErrors(fields);
        if (team?.is_active && !data.is_active) {
            const note = team.active_drivers ? ` ${team.active_drivers} pilotos activos seguirán asignados a él.` : "";
            if (!window.confirm(`El equipo dejará de aparecer en la tienda.${note} El historial de carreras no cambia. ¿Desactivarlo?`)) return;
        }
        saving = true;
        $("#save-team").disabled = true;
        try {
            const result = await A.api(team ? `/api/admin/teams/${team.id}` : "/api/admin/teams",
                { method: team ? "PUT" : "POST", body: JSON.stringify(data) });
            if (!team) {
                ui.setDirty(false);
                window.location.replace(`team.html?id=${result.team.id}&created=1`);
                return;
            }
            team = result.team;
            fill();
            A.notify("Cambios guardados.");
        } catch (error) {
            ui.handleError(error);
        } finally {
            saving = false;
            $("#save-team").disabled = false;
        }
    });

    async function init() {
        try {
            if (teamId) team = (await A.api(`/api/admin/teams/${teamId}`)).team;
            fill();
            $("#form-loading").hidden = true;
            form.hidden = false;
            if (params.get("created")) {
                A.notify("Equipo creado.");
                window.history.replaceState(null, "", `team.html?id=${teamId}`);
            }
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#form-loading").hidden = true;
            ui.showAlert(error.status === 404 ? "Ese equipo no existe." : `No se pudo cargar el equipo: ${error.message}`, error.status !== 404);
        }
    }

    A.ready.then(init, () => {});
})();
