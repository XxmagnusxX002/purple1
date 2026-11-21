/* Banners de la portada: listado y formulario de crear/editar.
 *   banners.html            listado (miniatura, orden, vigencia, estado, acciones)
 *   banners.html?new=1      crear
 *   banners.html?edit=<id>  editar
 * API: GET/POST /api/admin/banners, PUT /api/admin/banners/<id> (con version),
 *      POST /api/admin/banners/<id>/status { is_active, version }.
 * La imagen usa AdminMedia (subir o elegir, igual que Pilotos) y la vista previa
 * el mismo carrusel de la portada (../js/banners.js + ../css/banners.css). */
(function () {
    "use strict";
    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const params = new URLSearchParams(location.search);
    const editId = Number(params.get("edit")) || null;
    const creating = params.get("new") === "1";

    // Fechas: el servidor guarda UTC; los campos muestran la hora local.
    const utcDate = value => (value ? new Date(`${String(value).replace(" ", "T").replace(/Z$/, "")}Z`) : null);
    function toLocalInput(value) {
        const date = utcDate(value);
        if (!date) return "";
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    const toIso = value => (value ? new Date(value).toISOString() : null);
    const shortDate = value => (value ? utcDate(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : null);

    /* ============================ Listado ============================ */
    function vigencia(row) {
        const start = shortDate(row.starts_at);
        const end = shortDate(row.ends_at);
        if (!start && !end) return '<span class="admin-muted">Sin límite</span>';
        return `${start ? `Desde ${esc(start)}` : "Desde ya"}<small>${end ? `Hasta ${esc(end)}` : "Sin fecha de fin"}</small>`;
    }

    function listRow(row) {
        const thumb = row.image_path ? `<img class="banner-thumb" src="../${esc(row.image_path)}" alt="" loading="lazy">`
            : '<span class="banner-thumb banner-thumb--empty" aria-hidden="true"><i class="fa-regular fa-image"></i></span>';
        return `<tr data-id="${row.id}">
            <td data-label="Banner"><a class="product-cell" href="banners.html?edit=${row.id}">${thumb}
                <span><strong>${esc(row.title)}</strong><small>${row.link_url ? esc(row.link_url) : "Sin enlace"}</small></span></a></td>
            <td data-label="Orden">${A.formatNumber(row.display_order)}</td>
            <td data-label="Vigencia">${vigencia(row)}</td>
            <td data-label="Estado"><span class="status-pill status-pill--${row.is_active ? "paid" : "cancelled"}">${row.is_active ? "Activo" : "Inactivo"}</span></td>
            <td class="admin-table__actions" data-label="Acciones">
                <a class="admin-icon-button" href="banners.html?edit=${row.id}" title="Editar ${esc(row.title)}" aria-label="Editar ${esc(row.title)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></a>
                <button type="button" class="admin-icon-button" data-toggle="${row.id}" title="${row.is_active ? "Desactivar" : "Activar"} ${esc(row.title)}" aria-label="${row.is_active ? "Desactivar" : "Activar"} ${esc(row.title)}"><i class="fa-solid ${row.is_active ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i></button>
            </td></tr>`;
    }

    let rows = [];
    async function loadList() {
        $("#banners-alert").hidden = true;
        try {
            rows = (await A.api("/api/admin/banners")).banners;
            $("#banners-count").textContent = `${A.formatNumber(rows.length)} ${rows.length === 1 ? "banner" : "banners"} · ${A.formatNumber(rows.filter(r => r.is_active).length)} activos`;
            $("#banners-body").innerHTML = rows.length ? rows.map(listRow).join("")
                : '<tr><td colspan="5"><p class="admin-empty">Todavía no hay banners. Mientras tanto, la portada muestra su encabezado original.</p></td></tr>';
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#banners-alert-text").textContent = `No se pudieron cargar los banners: ${error.message}`;
            $("#banners-alert").hidden = false;
            $("#banners-body").innerHTML = "";
        }
    }

    function initList() {
        $("#banner-list-view").hidden = false;
        $("#banners-retry").addEventListener("click", loadList);
        $("#banners-body").addEventListener("click", async event => {
            const button = event.target.closest("[data-toggle]");
            if (!button) return;
            const row = rows.find(item => item.id === Number(button.dataset.toggle));
            button.disabled = true;
            try {
                await A.api(`/api/admin/banners/${row.id}/status`, { method: "POST", body: JSON.stringify({ is_active: !row.is_active, version: row.version }) });
                A.notify(row.is_active ? "Banner desactivado." : "Banner activado.");
                await loadList();
            } catch (error) {
                A.notify(error.message, "error");
                button.disabled = false;
            }
        });
        loadList();
    }

    /* ============================ Formulario ============================ */
    let banner = null;
    let imagePath = null;
    let dirty = false;
    let saving = false;
    let uploading = false;

    function setDirty(value) {
        dirty = value;
        $("#b-dirty").textContent = value ? "Cambios sin guardar" : "";
    }

    function read() {
        return {
            title: $("#b-title").value.trim(), description: $("#b-description").value.trim(), link_url: $("#b-link").value.trim(),
            image_path: imagePath, display_order: Number($("#b-order").value || 0), is_active: $("#b-active").checked,
            starts_at: toIso($("#b-start").value), ends_at: toIso($("#b-end").value),
        };
    }

    // Vista previa: el mismo marcado y estilos del carrusel de la portada.
    function renderPreview() {
        const data = read();
        $("#b-preview").innerHTML = `<div class="banner-carousel banner-carousel--preview"><div class="banner-track">
            ${window.PurpleBanners.slideMarkup(data, { root: "../", active: true })}</div>
            <div class="banner-dots" aria-hidden="true"><span class="banner-dot is-active"></span></div></div>`;
        $("#b-preview").querySelectorAll("a").forEach(link => { link.removeAttribute("href"); link.setAttribute("role", "presentation"); });
    }

    function renderImage() {
        const has = Boolean(imagePath);
        const picker = $("#b-photo-pick");
        picker.classList.toggle("is-filled", has);
        picker.setAttribute("aria-label", has ? "Reemplazar imagen del banner" : "Subir imagen del banner");
        $("#b-photo-visual").className = has ? "banner-photo__image" : "banner-photo__empty";
        $("#b-photo-visual").innerHTML = has ? `<img src="../${esc(imagePath)}" alt="">`
            : '<i class="fa-regular fa-image" aria-hidden="true"></i><span>Sin imagen</span>';
        $("#b-photo-upload-label").textContent = has ? "Reemplazar" : "Subir imagen";
        $("#b-photo-remove").hidden = !has;
        renderPreview();
    }

    function setImage(path) {
        imagePath = path || null;
        renderImage();
        setDirty(true);
    }

    function status(text, tone = "") {
        $("#b-photo-status").textContent = text;
        $("#b-photo-status").dataset.tone = tone;
    }

    function showErrors(fields = {}, message = "") {
        document.querySelectorAll("#banner-form [data-error-for]").forEach(span => { span.textContent = ""; });
        Object.entries(fields).forEach(([key, text]) => {
            const span = document.querySelector(`#banner-form [data-error-for="${key}"]`) || $('#banner-form [data-error-for="_general"]');
            span.textContent = text;
        });
        if (message && !Object.keys(fields).length) $('#banner-form [data-error-for="_general"]').textContent = message;
    }

    function fill() {
        $("#b-title").value = banner?.title || "";
        $("#b-description").value = banner?.description || "";
        $("#b-link").value = banner?.link_url || "";
        $("#b-order").value = banner?.display_order ?? 0;
        $("#b-active").checked = banner ? Boolean(banner.is_active) : true;
        $("#b-active-label").textContent = $("#b-active").checked ? "Activo" : "Inactivo";
        $("#b-start").value = toLocalInput(banner?.starts_at);
        $("#b-end").value = toLocalInput(banner?.ends_at);
        imagePath = banner?.image_path || null;
        const title = banner ? `Editar banner: ${banner.title}` : "Nuevo banner";
        $("#admin-title").textContent = title;
        document.title = `${title} | Purple One Admin`;
        $("#b-save span").textContent = banner ? "Guardar cambios" : "Crear banner";
        renderImage();
        setDirty(false);
    }

    async function save(event) {
        event.preventDefault();
        if (saving) return;
        if (uploading) return A.notify("Espera a que termine la subida de la imagen.", "error");
        const data = read();
        const fields = {};
        if (!data.title) fields.title = "El título es obligatorio.";
        if (!data.image_path) fields.image_path = "Elige o sube una imagen.";
        if (data.starts_at && data.ends_at && data.starts_at >= data.ends_at) fields.ends_at = "El fin debe ser posterior al inicio.";
        if (Object.keys(fields).length) return showErrors(fields);
        showErrors();
        saving = true;
        $("#b-save").disabled = true;
        try {
            const body = banner ? { ...data, version: banner.version } : data;
            const result = await A.api(banner ? `/api/admin/banners/${banner.id}` : "/api/admin/banners", { method: banner ? "PUT" : "POST", body: JSON.stringify(body) });
            setDirty(false);
            if (!banner) {
                location.replace(`banners.html?edit=${result.banner.id}&created=1`);
                return;
            }
            banner = result.banner;
            fill();
            A.notify("Cambios guardados.");
        } catch (error) {
            if (error.status === 409) showErrors({}, `${error.message} Recarga la página para ver la versión actual.`);
            else showErrors(error.fields || {}, error.message);
        } finally {
            saving = false;
            $("#b-save").disabled = false;
        }
    }

    async function initForm() {
        const form = $("#banner-form");
        if (editId) {
            try {
                banner = (await A.api(`/api/admin/banners/${editId}`)).banner;
            } catch (error) {
                if (error.status === 401 || error.status === 403) return;
                $("#admin-content").insertAdjacentHTML("afterbegin", `<div class="admin-alert" role="alert"><span>${esc(error.status === 404 ? "Ese banner no existe." : error.message)}</span><a class="admin-button" href="banners.html">Volver a banners</a></div>`);
                return;
            }
        }
        fill();
        form.hidden = false;
        if (params.get("created")) {
            A.notify("Banner creado.");
            history.replaceState(null, "", `banners.html?edit=${editId}`);
        }

        form.addEventListener("submit", save);
        form.addEventListener("input", event => {
            if (event.target.id === "b-active") $("#b-active-label").textContent = event.target.checked ? "Activo" : "Inactivo";
            if (event.target.id !== "b-photo-upload") setDirty(true);
            renderPreview();
        });
        form.addEventListener("change", event => {
            if (event.target.id === "b-active") $("#b-active-label").textContent = event.target.checked ? "Activo" : "Inactivo";
        });

        const upload = $("#b-photo-upload");
        const openUpload = () => upload.click();
        $("#b-photo-pick").addEventListener("click", openUpload);
        $("#b-photo-upload-btn").addEventListener("click", openUpload);
        upload.addEventListener("change", async () => {
            const file = upload.files[0];
            upload.value = "";
            if (!file || uploading) return;
            const problem = AdminMedia.validate(file);
            if (problem) return status(problem, "error");
            uploading = true;
            $("#b-photo-pick").disabled = true;
            status(`Subiendo ${file.name}…`);
            try {
                setImage(await AdminMedia.upload(file));
                status("Imagen subida. Guarda para publicarla.");
            } catch (error) {
                status(error.status === 401 ? "" : `No se pudo subir: ${error.message}`, "error");
            } finally {
                uploading = false;
                $("#b-photo-pick").disabled = false;
            }
        });
        $("#b-photo-gallery").addEventListener("click", () => AdminMedia.openGallery({
            isChosen: path => path === imagePath,
            onPick: path => { setImage(path); status(""); },
            returnFocus: $("#b-photo-gallery"),
        }));
        $("#b-photo-remove").addEventListener("click", () => { setImage(null); status("Imagen quitada. El banner necesita una imagen para guardarse."); });
        $("#b-cancel").addEventListener("click", event => {
            if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?")) event.preventDefault();
        });
        window.addEventListener("beforeunload", event => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = "";
        });
    }

    A.ready.then(() => (editId || creating ? initForm() : initList())).catch(() => {});
})();
