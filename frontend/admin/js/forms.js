/* Utilidades de formularios del panel (equipos y pilotos).
 *
 * AdminForm.create({...}) -> errores por campo, aviso general, cambios sin
 *   guardar, conflicto entre administradores (409 con "Recargar").
 * AdminForm.imageSlot(contenedor, { onChange }) -> una imagen: elegir de la
 *   galeria, subir o quitar. Usa media.js.
 * AdminForm.colorField(texto, selector) -> sincroniza #RRGGBB con <input type=color>.
 * AdminForm.typedConfirm({...}) -> confirmacion de una accion definitiva: hay
 *   que escribir un texto exacto (el nombre de la carrera) para habilitarla.
 */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const esc = A.escapeHTML;

    function create({ form, inputs = {}, alert, alertText, reload, dirtyLabel, leaveLinks = [] }) {
        let dirty = false;
        const api = {
            get dirty() { return dirty; },
            setDirty(value) {
                dirty = value;
                if (dirtyLabel) dirtyLabel.textContent = value ? "Cambios sin guardar" : "";
            },
            clearErrors() {
                form.querySelectorAll("[data-error-for]").forEach(el => { el.textContent = ""; });
                form.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
                alert.hidden = true;
            },
            showErrors(fields) {
                let first = null;
                Object.entries(fields || {}).forEach(([key, message]) => {
                    const target = form.querySelector(`[data-error-for="${key}"]`);
                    if (target) target.textContent = message;
                    const input = inputs[key];
                    if (input) {
                        input.setAttribute("aria-invalid", "true");
                        first = first || input;
                    }
                });
                first?.focus();
            },
            showAlert(message, withReload = false) {
                alertText.textContent = message;
                if (reload) reload.hidden = !withReload;
                alert.hidden = false;
                alert.scrollIntoView({ block: "nearest" });
            },
            handleError(error) {
                if (error.status === 401) return;
                if (error.status === 400 && Object.keys(error.fields || {}).length) {
                    api.showAlert(error.message);
                    api.showErrors(error.fields);
                } else {
                    api.showAlert(error.message, error.status === 409);
                }
            },
        };
        const mark = event => {
            if (!event.target.closest("[data-no-dirty]")) api.setDirty(true);
        };
        form.addEventListener("input", mark);
        form.addEventListener("change", mark);
        leaveLinks.forEach(link => link.addEventListener("click", event => {
            if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?")) event.preventDefault();
            else api.setDirty(false);
        }));
        window.addEventListener("beforeunload", event => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = "";
        });
        reload?.addEventListener("click", () => window.location.reload());
        return api;
    }

    // Componente único de imagen (el de Pilotos y Banners): recuadro de vista previa
    // con fondo lavanda, subir/reemplazar, elegir existente y quitar.
    // fallback(): HTML que se muestra cuando no hay imagen (p. ej. la bandera del país).
    function imageSlot(container, { label = "imagen", hint = "PNG, JPEG o WebP. Máx. 2 MB. Formato horizontal (16:9).", fallback = null, onChange = () => {} } = {}) {
        let value = null;
        container.innerHTML = `
            <div class="driver-photo banner-photo">
                <button type="button" class="driver-photo__picker banner-photo__picker" data-slot-picker aria-label="Subir ${esc(label)}">
                    <span data-slot-visual></span>
                </button>
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden data-slot-upload data-no-dirty>
                <div class="banner-photo__actions">
                    <button type="button" class="admin-link-button" data-slot-upload-btn><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i> <span data-slot-upload-label>Subir imagen</span></button>
                    <button type="button" class="admin-link-button" data-slot-pick><i class="fa-regular fa-images" aria-hidden="true"></i> Elegir existente</button>
                    <button type="button" class="admin-link-button admin-link-button--danger" data-slot-clear hidden><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Quitar</button>
                </div>
                <p class="admin-field__hint">${esc(hint)}</p>
                <p class="driver-photo__status" role="status" aria-live="polite" data-slot-status></p>
            </div>`;
        const $slot = selector => container.querySelector(selector);
        const visual = $slot("[data-slot-visual]");
        const picker = $slot("[data-slot-picker]");
        const status = (text, tone = "") => { $slot("[data-slot-status]").textContent = text; $slot("[data-slot-status]").dataset.tone = tone; };

        function render() {
            picker.classList.toggle("is-filled", Boolean(value));
            if (value) {
                visual.className = "banner-photo__image";
                visual.innerHTML = `<img src="../${esc(value)}" alt="Vista previa: ${esc(label)}">`;
            } else {
                const alt = fallback ? fallback() : "";
                visual.className = alt ? "banner-photo__empty banner-photo__fallback" : "banner-photo__empty";
                visual.innerHTML = alt || `<i class="fa-regular fa-image" aria-hidden="true"></i><span>Sin ${esc(label)}</span>`;
            }
            $slot("[data-slot-upload-label]").textContent = value ? "Reemplazar" : "Subir imagen";
            $slot("[data-slot-clear]").hidden = !value;
        }

        function set(path, notify = false) {
            value = path || null;
            render();
            if (notify) onChange(value);
        }

        const upload = $slot("[data-slot-upload]");
        const openUpload = () => upload.click();
        picker.addEventListener("click", openUpload);
        $slot("[data-slot-upload-btn]").addEventListener("click", openUpload);
        $slot("[data-slot-pick]").addEventListener("click", () => AdminMedia.openGallery({
            isChosen: path => path === value,
            onPick: path => { set(path, true); status("Imagen elegida."); },
            closeOnPick: true,
            returnFocus: $slot("[data-slot-pick]"),
        }));
        $slot("[data-slot-clear]").addEventListener("click", () => { set(null, true); status(fallback ? "Imagen quitada: se mostrará la vista alternativa." : "Imagen quitada."); });
        upload.addEventListener("change", async event => {
            const file = event.target.files[0];
            event.target.value = "";
            if (!file) return;
            const problem = AdminMedia.validate(file);
            if (problem) return void status(problem, "error");
            status(`Subiendo ${file.name}…`);
            picker.disabled = true;
            try {
                set(await AdminMedia.upload(file), true);
                status("Imagen subida.");
            } catch (error) {
                status(error.status === 401 ? "" : `No se pudo subir: ${error.message}`, "error");
            } finally {
                picker.disabled = false;
            }
        });
        set(null);
        return { get value() { return value; }, set, refresh: render, disable(on) { container.querySelectorAll("button").forEach(b => { b.disabled = on; }); container.firstElementChild.classList.toggle("is-readonly", on); } };
    }

    function colorField(text, picker) {
        const sync = () => {
            if (/^#[0-9A-Fa-f]{6}$/.test(text.value.trim())) picker.value = text.value.trim().toLowerCase();
        };
        text.addEventListener("input", sync);
        picker.addEventListener("input", () => {
            text.value = picker.value.toUpperCase();
            text.dispatchEvent(new Event("input", { bubbles: true }));
        });
        return { set(value) { text.value = value || ""; sync(); } };
    }

    const normalize = value => String(value ?? "").trim().replace(/\s+/g, " ");

    // Ventana para acciones que no se pueden deshacer. onConfirm(texto) hace la
    // peticion: si falla, el error se muestra dentro y la ventana sigue abierta.
    function typedConfirm({ title, intro, details = "", expected, confirmLabel, onConfirm, onClose = () => {}, returnFocus }) {
        document.querySelector("#typed-confirm")?.remove();
        document.body.insertAdjacentHTML("beforeend", `
            <div class="admin-modal" id="typed-confirm">
                <div class="admin-modal__backdrop" data-close-confirm></div>
                <section class="admin-modal__card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-intro">
                    <div class="confirm-card__head">
                        <span class="confirm-card__icon" aria-hidden="true"><i class="fa-solid fa-triangle-exclamation"></i></span>
                        <div><h2 id="confirm-title">${esc(title)}</h2><p id="confirm-intro">${esc(intro)}</p></div>
                    </div>
                    <div class="confirm-card__details">${details}</div>
                    <label class="admin-field confirm-card__field">Para confirmar, escribe <strong class="confirm-card__expected">${esc(expected)}</strong>
                        <input type="text" id="confirm-input" autocomplete="off" spellcheck="false" aria-describedby="confirm-error">
                        <span class="admin-field__error" id="confirm-error" role="alert"></span>
                    </label>
                    <div class="confirm-card__actions">
                        <button type="button" class="admin-button" data-close-confirm>Volver sin cambios</button>
                        <button type="button" class="admin-button admin-button--danger" id="confirm-submit" disabled>${esc(confirmLabel)}</button>
                    </div>
                </section>
            </div>`);
        const modal = document.querySelector("#typed-confirm");
        const input = modal.querySelector("#confirm-input");
        const submit = modal.querySelector("#confirm-submit");
        const error = modal.querySelector("#confirm-error");
        let busy = false;
        const close = () => {
            if (busy) return;
            modal.remove();
            document.removeEventListener("keydown", onKey);
            returnFocus?.focus();
            onClose();
        };
        const onKey = event => { if (event.key === "Escape") close(); };
        const matches = () => normalize(input.value) === normalize(expected);
        input.addEventListener("input", () => {
            submit.disabled = !matches();
            error.textContent = "";
        });
        modal.querySelectorAll("[data-close-confirm]").forEach(el => el.addEventListener("click", close));
        document.addEventListener("keydown", onKey);
        submit.addEventListener("click", async () => {
            if (busy || !matches()) return;
            busy = true;
            submit.disabled = true;
            submit.textContent = "Procesando…";
            try {
                await onConfirm(normalize(input.value));
                busy = false;
                close();
            } catch (failure) {
                busy = false;
                submit.textContent = confirmLabel;
                submit.disabled = !matches();
                if (failure?.status !== 401) error.textContent = failure?.fields?.confirm_name || failure?.message || "No se pudo completar la acción.";
            }
        });
        input.focus();
        return { close };
    }

    window.AdminForm = { create, imageSlot, colorField, typedConfirm };
})();
