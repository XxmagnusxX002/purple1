/* Galeria e imagenes del panel (compartido por productos, equipos y pilotos).
 *
 * AdminMedia.openGallery({ isChosen(path), onPick(path), returnFocus })
 *   abre la ventana con las imagenes de frontend/img (se cargan una vez).
 * AdminMedia.upload(file) -> Promise<"img/uploads/...">
 *   valida tipo y tamano en el navegador; el servidor vuelve a validarlo todo.
 * Requiere admin.js (window.PurpleAdmin).
 */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const esc = A.escapeHTML;
    const MAX_UPLOAD = 2 * 1024 * 1024;
    const TYPES = ["image/png", "image/jpeg", "image/webp"];
    let images = null;
    let options = null;

    function ensureModal() {
        let modal = document.querySelector("#gallery-modal");
        if (modal) return modal;
        document.body.insertAdjacentHTML("beforeend", `
            <div class="admin-modal" id="gallery-modal" hidden>
                <div class="admin-modal__backdrop" data-close-gallery></div>
                <section class="admin-modal__card" role="dialog" aria-modal="true" aria-labelledby="gallery-title">
                    <div class="admin-card__head">
                        <div><h2 id="gallery-title">Imágenes del proyecto</h2><p>Elige una imagen. Las subidas aparecen marcadas.</p></div>
                        <button type="button" class="admin-icon-button" data-close-gallery aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                    </div>
                    <label class="admin-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="visually-hidden">Buscar imagen</span><input type="search" id="gallery-search" placeholder="Buscar por nombre de archivo"></label>
                    <div class="gallery-grid" id="gallery-grid"></div>
                </section>
            </div>`);
        modal = document.querySelector("#gallery-modal");
        modal.querySelectorAll("[data-close-gallery]").forEach(el => el.addEventListener("click", close));
        modal.querySelector("#gallery-search").addEventListener("input", render);
        modal.querySelector("#gallery-grid").addEventListener("click", event => {
            const pick = event.target.closest("[data-pick]");
            if (!pick || !options) return;
            options.onPick(pick.dataset.pick);
            if (options.closeOnPick) close();
            else render();
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !modal.hidden) close();
        });
        return modal;
    }

    function render() {
        const grid = document.querySelector("#gallery-grid");
        const term = document.querySelector("#gallery-search").value.trim().toLowerCase();
        const items = images.filter(image => image.image_path.toLowerCase().includes(term));
        grid.innerHTML = items.length ? items.map(image => {
            const chosen = Boolean(options?.isChosen?.(image.image_path));
            return `<button type="button" class="gallery-item${chosen ? " is-chosen" : ""}" data-pick="${esc(image.image_path)}" aria-pressed="${chosen}">
                <img src="../${esc(image.image_path)}" alt="" loading="lazy">
                <span>${esc(image.name)}</span>${image.uploaded ? "<small>Subida</small>" : ""}
            </button>`;
        }).join("") : '<p class="admin-empty">No hay imágenes con ese nombre.</p>';
    }

    function close() {
        const modal = document.querySelector("#gallery-modal");
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        options?.returnFocus?.focus();
    }

    async function openGallery(settings) {
        options = settings;
        const modal = ensureModal();
        modal.hidden = false;
        const search = modal.querySelector("#gallery-search");
        search.value = "";
        search.focus();
        if (!images) {
            modal.querySelector("#gallery-grid").innerHTML = '<span class="skeleton skeleton--block"></span>';
            try {
                images = (await A.api("/api/admin/images")).images;
            } catch (error) {
                modal.querySelector("#gallery-grid").innerHTML = `<p class="admin-empty">No se pudo cargar la galería: ${esc(error.message)}</p>`;
                return;
            }
        }
        render();
    }

    function validate(file) {
        if (!TYPES.includes(file.type)) return "Formato no admitido: usa PNG, JPEG o WebP.";
        if (file.size > MAX_UPLOAD) return "La imagen supera el máximo de 2 MB.";
        return "";
    }

    async function upload(file) {
        const problem = validate(file);
        if (problem) throw new A.ApiError(problem, 400);
        const result = await A.api("/api/admin/uploads", { method: "POST", headers: { "Content-Type": file.type }, body: file });
        images?.push({ image_path: result.image_path, name: result.image_path.split("/").pop(), uploaded: true });
        return result.image_path;
    }

    window.AdminMedia = { openGallery, close, upload, validate };
})();
