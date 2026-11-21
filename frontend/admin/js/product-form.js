/* Formulario de producto (fase A3): crear y editar productos, imagenes,
   categorias, equipos y variantes con su stock. El backend vuelve a validar
   todo; aqui solo se guia al usuario y se muestran sus errores por campo. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const MAX_IMAGES = 10;
    const PRICE = /^\d{1,8}([.,]\d{1,2})?$/;

    const params = new URLSearchParams(window.location.search);
    const productId = Number(params.get("id")) || null;
    let catalog = null;
    let product = null;
    let images = [];
    let editingImage = null;
    let drafts = [];          // variantes iniciales (solo al crear)
    let dirty = false;
    let saving = false;

    // ---------------------------------------------------------- utilidades
    function setDirty(value) {
        dirty = value;
        $("#dirty-state").textContent = value ? "Cambios sin guardar" : "";
    }

    function clearErrors() {
        document.querySelectorAll("[data-error-for]").forEach(el => { el.textContent = ""; });
        document.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
        $("#form-alert").hidden = true;
    }

    const FIELD_INPUTS = { name: "#f-name", slug: "#f-slug", product_type_id: "#f-type", description: "#f-description", base_price: "#f-price",
        promo_percent: "#f-promo", promo_starts_at: "#f-promo-start", promo_ends_at: "#f-promo-end" };

    function showErrors(fields) {
        let first = null;
        Object.entries(fields || {}).forEach(([key, message]) => {
            const base = key.startsWith("variants.") ? "variants" : key;
            const target = document.querySelector(`[data-error-for="${base}"]`);
            if (target) target.textContent = base === "variants" ? `Variante ${Number(key.split(".")[1]) + 1}: ${message}` : message;
            const input = FIELD_INPUTS[key] && $(FIELD_INPUTS[key]);
            if (input) {
                input.setAttribute("aria-invalid", "true");
                first = first || input;
            }
        });
        first?.focus();
    }

    function alertBox(message, reload = false) {
        $("#form-alert-text").textContent = message;
        $("#form-reload").hidden = !reload;
        $("#form-alert").hidden = false;
        $("#form-alert").scrollIntoView({ block: "nearest" });
    }

    function currentType() {
        return catalog.product_types.find(type => String(type.id) === $("#f-type").value) || null;
    }

    function optionList(items, selected, empty) {
        // Una talla o color desactivado solo aparece si la variante ya lo tenía.
        return `<option value="">${esc(empty)}</option>` + items
            .filter(item => item.is_active !== false || String(item.id) === String(selected ?? ""))
            .map(item => `<option value="${item.id}"${String(item.id) === String(selected ?? "") ? " selected" : ""}>${esc(item.name)}${item.is_active === false ? " (inactivo)" : ""}</option>`).join("");
    }

    // ---------------------------------------------------------- promoción
    // El servidor guarda UTC; el formulario muestra la hora local del navegador.
    function toLocalInput(utc) {
        if (!utc) return "";
        const date = new Date(`${String(utc).replace(" ", "T")}Z`);
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 16);
    }

    const toIso = value => (value ? new Date(value).toISOString() : null);

    function updatePromoState() {
        const percent = Number($("#f-promo").value);
        const start = $("#f-promo-start").value ? new Date($("#f-promo-start").value) : null;
        const end = $("#f-promo-end").value ? new Date($("#f-promo-end").value) : null;
        const now = new Date();
        let text = "Sin promoción";
        let tone = "none";
        if (percent > 0) {
            if (end && end <= now) { text = "Vencida"; tone = "off"; }
            else if (start && start > now) { text = "Programada"; tone = "soon"; }
            else { text = `Vigente: −${percent} %`; tone = "on"; }
            const base = Number(String($("#f-price").value).replace(",", "."));
            if (base > 0 && tone !== "off") text += ` · ${A.formatMoney(Math.round(base * (100 - percent)) / 100)}`;
        }
        $("#promo-state").textContent = text;
        $("#promo-state").dataset.tone = tone;
    }

    // ------------------------------------------- características y especificaciones
    function featureRow(value = "") {
        return `<li class="spec-row spec-row--feature"><input type="text" data-feature maxlength="255" value="${esc(value)}" placeholder="Ej.: Escudo bordado" aria-label="Característica">
            <button type="button" class="admin-icon-button admin-icon-button--danger" data-remove-spec title="Quitar" aria-label="Quitar característica"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></li>`;
    }

    function specRow(label = "", value = "") {
        return `<li class="spec-row"><input type="text" data-spec-label maxlength="80" value="${esc(label)}" placeholder="Etiqueta (ej.: Material)" aria-label="Etiqueta">
            <input type="text" data-spec-value maxlength="255" value="${esc(value)}" placeholder="Valor (ej.: 100 % algodón)" aria-label="Valor">
            <button type="button" class="admin-icon-button admin-icon-button--danger" data-remove-spec title="Quitar" aria-label="Quitar especificación"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></li>`;
    }

    function renderSpecs(list) {
        $("#f-features").innerHTML = list.filter(item => item.kind === "FEATURE").map(item => featureRow(item.value)).join("");
        $("#f-specs").innerHTML = list.filter(item => item.kind === "SPEC").map(item => specRow(item.label, item.value)).join("");
        renderSuggestions();
    }

    // Etiquetas sugeridas del tipo: solo atajos, ninguna es obligatoria.
    function renderSuggestions() {
        const type = currentType();
        const used = new Set([...document.querySelectorAll("[data-spec-label]")].map(input => input.value.trim().toLowerCase()));
        const free = (type?.spec_templates || []).filter(label => !used.has(label.toLowerCase()));
        $("#spec-suggestions").innerHTML = !type ? "Elige el tipo de producto para ver etiquetas sugeridas."
            : free.length ? `Sugeridas para ${esc(type.name)}: ${free.map(label => `<button type="button" class="admin-chip" data-suggest="${esc(label)}">+ ${esc(label)}</button>`).join(" ")}`
            : (type.spec_templates || []).length ? "Ya usas todas las etiquetas sugeridas para este tipo." : "Este tipo no tiene etiquetas sugeridas.";
    }

    function readSpecs() {
        const features = [...document.querySelectorAll("[data-feature]")].map(input => ({ kind: "FEATURE", label: null, value: input.value.trim() }));
        const specs = [...document.querySelectorAll("#f-specs .spec-row")].map(row => ({
            kind: "SPEC", label: row.querySelector("[data-spec-label]").value.trim(), value: row.querySelector("[data-spec-value]").value.trim(),
        }));
        return [...features, ...specs].filter(item => item.value || item.label);
    }

    // ---------------------------------------------------------- render
    function renderStatic() {
        $("#f-type").innerHTML = `<option value="">Elige un tipo</option>` + catalog.product_types.map(type =>
            `<option value="${type.id}"${type.is_active ? "" : " disabled"}>${esc(type.name)}${type.uses_size || type.uses_color ? ` (${[type.uses_size && "talla", type.uses_color && "color"].filter(Boolean).join(" y ")})` : ""}${type.is_active ? "" : " · inactivo"}</option>`).join("");
        $("#f-categories").innerHTML = catalog.categories.length ? catalog.categories.map(category => `
            <label class="admin-check admin-check--compact" style="--depth:${category.depth}">
                <input type="checkbox" value="${category.id}" data-parent="${category.parent_id ?? ""}">
                <span>${esc(category.name)}${category.is_active ? "" : ' <small>(inactiva)</small>'}</span></label>`).join("")
            : '<p class="admin-empty">No hay categorías registradas.</p>';
        $("#f-teams").innerHTML = catalog.teams.length ? catalog.teams.map(team => `
            <button type="button" class="admin-chip" data-team="${team.id}" aria-pressed="false">${esc(team.name)}${team.is_active ? "" : " (inactivo)"}</button>`).join("")
            : '<p class="admin-empty">No hay equipos registrados.</p>';
    }

    function fillForm() {
        $("#f-name").value = product?.name || "";
        $("#f-slug").value = product?.slug || "";
        $("#f-type").value = product?.product_type_id || "";
        $("#f-description").value = product?.description || "";
        $("#f-price").value = product ? Number(product.base_price).toFixed(2) : "";
        $("#f-active").checked = product ? product.is_active : true;
        $("#f-featured").checked = product ? product.is_featured : false;
        $("#f-promo").value = product?.promo_percent ?? "";
        $("#f-promo-start").value = toLocalInput(product?.promo_starts_at);
        $("#f-promo-end").value = toLocalInput(product?.promo_ends_at);
        const categories = new Set((product?.category_ids || []).map(String));
        document.querySelectorAll("#f-categories input").forEach(input => { input.checked = categories.has(input.value); });
        const teams = new Set((product?.team_ids || []).map(String));
        document.querySelectorAll("[data-team]").forEach(chip => chip.setAttribute("aria-pressed", String(teams.has(chip.dataset.team))));
        images = (product?.images || []).map(image => ({ ...image }));
        editingImage = null;
        const hasVariants = Boolean(product?.variants?.length);
        $("#f-type").disabled = hasVariants;
        $("#hint-type").textContent = hasVariants
            ? "No se puede cambiar: el producto ya tiene variantes."
            : "Define si las variantes llevan talla y color.";
        updateCounter();
        renderImages();
        renderVariants();
        renderSpecs(product?.specs || []);
        updatePromoState();
        const title = product ? `Editar: ${product.name}` : "Nuevo producto";
        $("#admin-title").textContent = title;
        document.title = `${title} | Purple One Admin`;
        $("#save-product").textContent = product ? "Guardar cambios" : "Crear producto";
        setDirty(false);
    }

    function updateCounter() {
        $("#count-description").textContent = `${$("#f-description").value.length} / 5000`;
    }

    function renderImages() {
        $("#f-images").innerHTML = images.map((image, index) => `
            <li class="image-item${image.is_main ? " is-main" : ""}" data-index="${index}">
                <button type="button" data-edit-image="${index}" aria-label="Editar imagen ${index + 1}: ${esc(image.image_path)}" aria-pressed="${editingImage === index}">
                    <img src="../${esc(image.image_path)}" alt="" width="110" height="110">
                    ${image.is_main ? '<span class="image-item__badge">Principal</span>' : ""}
                </button>
            </li>`).join("") + `<li class="image-item image-item--add"><button type="button" id="image-add-trigger" aria-label="Añadir imagen" aria-expanded="false"${images.length >= MAX_IMAGES ? " disabled" : ""}><i class="fa-solid fa-plus" aria-hidden="true"></i><span>Añadir</span></button></li>`;
        $("#image-add-actions").hidden = true;
        if (editingImage !== null && images[editingImage]) {
            const image = images[editingImage];
            $("#image-tools").innerHTML = `<div class="product-image-tools__head"><h3>Imagen ${editingImage + 1} de ${images.length}</h3><button type="button" class="admin-icon-button" data-close-image-tools aria-label="Cerrar detalles"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>
                <p class="image-item__path">${esc(image.image_path)}</p>
                <label class="admin-field">Texto alternativo<input type="text" maxlength="150" value="${esc(image.alt_text || "")}" data-alt="${editingImage}" placeholder="Describe la imagen"></label>
                <div class="product-image-tools__actions">
                    <label class="admin-check admin-check--compact"><input type="radio" name="main-image" value="${editingImage}"${image.is_main ? " checked" : ""}> Principal</label>
                    <button type="button" class="admin-button" data-replace-gallery>Elegir existente</button>
                    <label class="admin-button admin-upload">Subir reemplazo<input type="file" accept="image/png,image/jpeg,image/webp" data-replace-upload="${editingImage}" class="visually-hidden"></label>
                    <button type="button" class="admin-icon-button" data-move="-1" aria-label="Mover antes"${editingImage === 0 ? " disabled" : ""}><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
                    <button type="button" class="admin-icon-button" data-move="1" aria-label="Mover después"${editingImage === images.length - 1 ? " disabled" : ""}><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
                    <button type="button" class="admin-icon-button admin-icon-button--danger" data-remove-image aria-label="Quitar imagen"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
                </div>`;
            $("#image-tools").hidden = false;
        } else {
            $("#image-tools").hidden = true;
            $("#image-tools").innerHTML = "";
        }
    }

    function ensureMain() {
        if (images.length && !images.some(image => image.is_main)) images[0].is_main = true;
    }

    function addImage(path) {
        if (images.some(image => image.image_path === path)) return A.notify("Esa imagen ya está en el producto.", "error");
        if (images.length >= MAX_IMAGES) return A.notify(`Máximo ${MAX_IMAGES} imágenes por producto.`, "error");
        images.push({ image_path: path, alt_text: $("#f-name").value.trim(), is_main: images.length === 0 });
        renderImages();
        setDirty(true);
    }

    function variantColumns() {
        const type = currentType();
        const showSize = Boolean(type?.uses_size);
        const showColor = Boolean(type?.uses_color);
        document.querySelectorAll('[data-col="size"]').forEach(cell => { cell.hidden = !showSize; });
        document.querySelectorAll('[data-col="color"]').forEach(cell => { cell.hidden = !showColor; });
        return { showSize, showColor, type };
    }

    function variantCells(variant, prefix, { showSize, showColor }) {
        return `
            <td data-col="size" data-label="Talla"${showSize ? "" : " hidden"}><select data-field="size_id" aria-label="Talla">${optionList(catalog.sizes, variant.size_id, "Talla")}</select></td>
            <td data-col="color" data-label="Color"${showColor ? "" : " hidden"}><select data-field="color_id" aria-label="Color">${optionList(catalog.colors, variant.color_id, "Color")}</select></td>
            <td data-label="SKU"><input type="text" data-field="sku" maxlength="60" value="${esc(variant.sku || "")}" placeholder="automático" aria-label="SKU"></td>
            <td data-label="Precio especial"><input type="text" data-field="price_override" inputmode="decimal" value="${variant.price_override ? Number(variant.price_override).toFixed(2) : ""}" placeholder="usa el base" aria-label="Precio especial"></td>`;
    }

    function renderVariants() {
        const columns = variantColumns();
        const help = $("#variants-help");
        if (!columns.type) {
            $("#variants-body").innerHTML = '<tr><td colspan="7"><p class="admin-empty">Elige primero el tipo de producto.</p></td></tr>';
            $("#variant-new").innerHTML = "";
            return;
        }
        help.textContent = `Este tipo ${[columns.showSize && "usa talla", columns.showColor && "usa color"].filter(Boolean).join(" y ") || "no usa talla ni color (una sola variante)"}. El SKU se genera si lo dejas vacío.`;
        if (product) {
            $("#variants-body").innerHTML = product.variants.length ? product.variants.map(variant => `
                <tr data-variant="${variant.id}">
                    ${variantCells(variant, "v", columns)}
                    <td data-label="Stock" class="stock-cell">
                        <strong class="${variant.stock <= catalog.low_stock_threshold ? "stock-low" : ""}">${A.formatNumber(variant.stock)}</strong>
                        <small>${A.formatNumber(variant.units_sold)} vendidas${variant.in_active_carts ? ` · en ${variant.in_active_carts} carritos` : ""}</small>
                    </td>
                    <td data-label="Activa"><input type="checkbox" data-field="is_active"${variant.is_active ? " checked" : ""} aria-label="Variante activa"></td>
                    <td class="admin-table__actions"><button type="button" class="admin-button" data-save-variant>Guardar</button></td>
                </tr><tr class="variant-stock-row" data-stock-for="${variant.id}"><td colspan="7">
                    <details class="variant-stock-details"><summary>Ajustar inventario · ${esc(variant.sku || `Variante ${variant.id}`)}</summary>
                        <div class="stock-adjust">
                            <select data-stock-mode aria-label="Tipo de ajuste"><option value="add">Sumar</option><option value="set">Fijar</option></select>
                            <input type="number" data-stock-qty step="1" aria-label="Cantidad" placeholder="+5 / -2" title="Con Sumar usa números negativos para restar">
                            <button type="button" class="admin-button" data-stock-apply>Aplicar</button>
                        </div>
                    </details>
                </td></tr>`).join("") : '<tr><td colspan="7"><p class="admin-empty">Sin variantes: añade al menos una para poder venderlo.</p></td></tr>';
        } else {
            $("#variants-body").innerHTML = drafts.length ? drafts.map((draft, index) => `
                <tr data-draft="${index}">
                    ${variantCells(draft, "d", columns)}
                    <td data-label="Stock"><input type="number" data-field="stock" min="0" step="1" value="${esc(draft.stock ?? 0)}" aria-label="Stock inicial"></td>
                    <td data-label="Activa"><input type="checkbox" data-field="is_active"${draft.is_active !== false ? " checked" : ""} aria-label="Variante activa"></td>
                    <td class="admin-table__actions"><button type="button" class="admin-icon-button admin-icon-button--danger" data-remove-draft aria-label="Quitar variante"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></td>
                </tr>`).join("") : '<tr><td colspan="7"><p class="admin-empty">Sin variantes iniciales. Puedes añadirlas ahora o después de crear el producto.</p></td></tr>';
        }
        $("#variant-new").innerHTML = `
            <tr data-new-variant>
                ${variantCells({}, "n", columns)}
                <td data-label="Stock inicial"><input type="number" data-field="stock" min="0" step="1" value="0" aria-label="Stock inicial"></td>
                <td data-label="Activa"><input type="checkbox" data-field="is_active" checked aria-label="Variante activa"></td>
                <td class="admin-table__actions"><button type="button" class="admin-button" data-add-variant><i class="fa-solid fa-plus" aria-hidden="true"></i> Añadir</button></td>
            </tr>`;
    }

    function readRow(row) {
        const value = field => row.querySelector(`[data-field="${field}"]`);
        const { showSize, showColor } = variantColumns();
        return {
            size_id: showSize ? value("size_id").value || null : null,
            color_id: showColor ? value("color_id").value || null : null,
            sku: value("sku").value.trim().toUpperCase(),
            price_override: value("price_override").value.trim() || null,
            stock: value("stock") ? Number(value("stock").value || 0) : undefined,
            is_active: value("is_active").checked,
        };
    }

    function checkVariant(variant) {
        const { showSize, showColor } = variantColumns();
        if (showSize && !variant.size_id) return "Elige una talla.";
        if (showColor && !variant.color_id) return "Elige un color.";
        if (variant.price_override && !PRICE.test(variant.price_override)) return "El precio especial debe tener hasta 2 decimales.";
        if (variant.sku && !/^[A-Z0-9][A-Z0-9-]{0,59}$/.test(variant.sku)) return "El SKU admite mayúsculas, números y guiones.";
        if (variant.stock !== undefined && (!Number.isInteger(variant.stock) || variant.stock < 0)) return "El stock debe ser un entero de 0 o más.";
        return "";
    }

    // ---------------------------------------------------------- datos
    function payload() {
        const data = {
            name: $("#f-name").value.trim(),
            slug: $("#f-slug").value.trim(),
            product_type_id: $("#f-type").value ? Number($("#f-type").value) : null,
            description: $("#f-description").value.trim(),
            base_price: $("#f-price").value.trim().replace(",", "."),
            is_active: $("#f-active").checked,
            is_featured: $("#f-featured").checked,
            category_ids: [...document.querySelectorAll("#f-categories input:checked")].map(input => Number(input.value)),
            team_ids: [...document.querySelectorAll('[data-team][aria-pressed="true"]')].map(chip => Number(chip.dataset.team)),
            images: images.map(image => ({ image_path: image.image_path, alt_text: image.alt_text || "", is_main: Boolean(image.is_main) })),
            promo_percent: $("#f-promo").value.trim() === "" ? null : Number($("#f-promo").value),
            promo_starts_at: toIso($("#f-promo-start").value),
            promo_ends_at: toIso($("#f-promo-end").value),
            specs: readSpecs(),
        };
        if (product) data.version = product.version;
        else data.variants = drafts;
        return data;
    }

    function validateLocally(data) {
        const fields = {};
        if (!data.name) fields.name = "El nombre es obligatorio.";
        if (data.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.slug)) fields.slug = "Usa solo minúsculas, números y guiones.";
        if (!data.product_type_id) fields.product_type_id = "Elige un tipo de producto.";
        if (!PRICE.test(data.base_price) || Number(data.base_price) <= 0) fields.base_price = "Indica un precio mayor que 0 con hasta 2 decimales, por ejemplo 89.90.";
        if (data.promo_percent !== null && !(Number.isInteger(data.promo_percent) && data.promo_percent >= 1 && data.promo_percent <= 90)) {
            fields.promo_percent = "El descuento debe ser un número entero entre 1 y 90.";
        }
        if (data.promo_starts_at && data.promo_ends_at && data.promo_starts_at >= data.promo_ends_at) {
            fields.promo_ends_at = "El fin debe ser posterior al inicio.";
        }
        if (data.specs.some(item => item.kind === "SPEC" && item.value && !item.label)) fields.specs = "Cada especificación necesita su etiqueta.";
        return fields;
    }

    async function save(event) {
        event.preventDefault();
        if (saving) return;
        clearErrors();
        const data = payload();
        const fields = validateLocally(data);
        if (Object.keys(fields).length) return showErrors(fields);
        if (product && product.is_active && !data.is_active
            && !window.confirm("El producto dejará de mostrarse en la tienda. ¿Desactivarlo?")) return;
        saving = true;
        $("#save-product").disabled = true;
        $("#save-product").textContent = "Guardando…";
        try {
            const result = await A.api(product ? `/api/admin/products/${product.id}` : "/api/admin/products",
                { method: product ? "PUT" : "POST", body: JSON.stringify(data) });
            if (!product) {
                setDirty(false);
                window.location.replace(`product.html?id=${result.product.id}&created=1`);
                return;
            }
            product = result.product;
            fillForm();
            A.notify("Cambios guardados.");
        } catch (error) {
            if (error.status === 400 && Object.keys(error.fields).length) {
                alertBox(error.message);
                showErrors(error.fields);
            } else if (error.status === 409) {
                alertBox(error.message, true);
            } else if (error.status !== 401) {
                alertBox(error.message);
            }
        } finally {
            saving = false;
            $("#save-product").disabled = false;
            $("#save-product").textContent = product ? "Guardar cambios" : "Crear producto";
        }
    }

    async function variantRequest(url, options, success) {
        try {
            const result = await A.api(url, options);
            product = result.product;
            const keepDirty = dirty;
            fillForm();
            setDirty(keepDirty);
            A.notify(success);
        } catch (error) {
            if (error.status === 401) return;
            A.notify(Object.values(error.fields || {})[0] || error.message, "error");
            if (error.status === 409) alertBox(error.message, true);
        }
    }

    function openGallery(replaceIndex = null) {
        // La misma galería permite añadir o reemplazar sin cambiar el contrato de imágenes.
        AdminMedia.openGallery({
            isChosen: path => images.some((image, index) => image.image_path === path && index !== replaceIndex),
            onPick: path => {
                if (replaceIndex !== null) {
                    if (images.some((image, index) => image.image_path === path && index !== replaceIndex)) {
                        A.notify("Esa imagen ya está en el producto.", "error");
                        return;
                    }
                    images[replaceIndex].image_path = path;
                    renderImages();
                    setDirty(true);
                } else if (images.some(image => image.image_path === path)) {
                    const removed = images.findIndex(image => image.image_path === path);
                    images.splice(removed, 1);
                    if (editingImage === removed) editingImage = null;
                    else if (editingImage !== null && editingImage > removed) editingImage--;
                    ensureMain();
                    renderImages();
                    setDirty(true);
                } else {
                    addImage(path);
                }
            },
            closeOnPick: replaceIndex !== null,
            returnFocus: { focus: () => (replaceIndex === null ? $("#image-add-trigger") : $("#f-images [aria-pressed='true']"))?.focus() },
        });
    }

    async function upload(file, replaceIndex = null) {
        const status = $("#upload-status");
        const problem = AdminMedia.validate(file);
        if (problem) return void (status.textContent = problem);
        if (replaceIndex === null && images.length >= MAX_IMAGES) return void (status.textContent = `Máximo ${MAX_IMAGES} imágenes por producto.`);
        status.textContent = `Subiendo ${file.name}…`;
        try {
            const path = await AdminMedia.upload(file);
            if (replaceIndex === null) {
                addImage(path);
                status.textContent = "Imagen subida y añadida al producto.";
            } else if (images[replaceIndex]) {
                if (images.some((image, index) => image.image_path === path && index !== replaceIndex)) {
                    status.textContent = "Esa imagen ya está en el producto.";
                    return;
                }
                images[replaceIndex].image_path = path;
                renderImages();
                setDirty(true);
                status.textContent = "Imagen reemplazada.";
            }
        } catch (error) {
            status.textContent = error.status === 401 ? "" : `No se pudo subir: ${error.message}`;
        }
    }

    // ---------------------------------------------------------- eventos
    const form = $("#product-form");
    form.addEventListener("submit", save);
    form.addEventListener("input", event => {
        if (event.target.dataset.alt !== undefined) images[Number(event.target.dataset.alt)].alt_text = event.target.value;
        if (event.target.id === "f-description") updateCounter();
        if (["f-promo", "f-promo-start", "f-promo-end", "f-price"].includes(event.target.id)) updatePromoState();
        if (event.target.matches("[data-spec-label]")) renderSuggestions();
        if (!event.target.closest("[data-variant], [data-new-variant], .stock-adjust")) setDirty(true);
    });
    form.addEventListener("change", event => {
        if (event.target.matches("[data-replace-upload]")) {
            const file = event.target.files[0];
            const index = Number(event.target.dataset.replaceUpload);
            event.target.value = "";
            if (file) upload(file, index);
            return;
        }
        if (event.target.name === "main-image") {
            images.forEach((image, index) => { image.is_main = String(index) === event.target.value; });
            renderImages();
            setDirty(true);
        }
        if (event.target.id === "f-type") {
            drafts = [];
            renderVariants();
            renderSuggestions();
        }
        if (event.target.closest("#f-categories") && event.target.checked) {
            // Marca tambien las categorias padre, igual que hara el servidor.
            let parent = event.target.dataset.parent;
            while (parent) {
                const input = document.querySelector(`#f-categories input[value="${parent}"]`);
                if (!input) break;
                input.checked = true;
                parent = input.dataset.parent;
            }
        }
        if (event.target.closest("[data-draft]")) {
            const row = event.target.closest("[data-draft]");
            drafts[Number(row.dataset.draft)] = readRow(row);
        }
    });
    form.addEventListener("click", event => {
        const team = event.target.closest("[data-team]");
        if (team) {
            team.setAttribute("aria-pressed", String(team.getAttribute("aria-pressed") !== "true"));
            setDirty(true);
            return;
        }
        const imageButton = event.target.closest("[data-edit-image]");
        if (imageButton) {
            editingImage = Number(imageButton.dataset.editImage);
            renderImages();
            $("#image-tools").scrollIntoView({ block: "nearest" });
            return;
        }
        if (event.target.closest("#image-add-trigger")) {
            const actions = $("#image-add-actions");
            actions.hidden = !actions.hidden;
            event.target.closest("#image-add-trigger").setAttribute("aria-expanded", String(!actions.hidden));
            return;
        }
        if (event.target.closest("[data-close-image-tools]")) {
            editingImage = null;
            renderImages();
            return;
        }
        if (event.target.closest("[data-replace-gallery]")) {
            openGallery(editingImage);
            return;
        }
        if (editingImage !== null && event.target.closest("[data-move]")) {
            const from = editingImage;
            const to = from + Number(event.target.closest("[data-move]").dataset.move);
            [images[from], images[to]] = [images[to], images[from]];
            editingImage = to;
            renderImages();
            setDirty(true);
            return;
        }
        if (editingImage !== null && event.target.closest("[data-remove-image]")) {
            images.splice(editingImage, 1);
            editingImage = null;
            ensureMain();
            renderImages();
            setDirty(true);
            return;
        }
        if (event.target.closest("[data-add-variant]")) {
            const row = event.target.closest("[data-new-variant]");
            const variant = readRow(row);
            const problem = checkVariant(variant);
            if (problem) return A.notify(problem, "error");
            if (!product) {
                drafts.push(variant);
                renderVariants();
                setDirty(true);
                return;
            }
            variantRequest(`/api/admin/products/${product.id}/variants`, { method: "POST", body: JSON.stringify(variant) }, "Variante añadida.");
            return;
        }
        if (event.target.closest("[data-remove-draft]")) {
            drafts.splice(Number(event.target.closest("[data-draft]").dataset.draft), 1);
            renderVariants();
            setDirty(true);
            return;
        }
        const variantRow = event.target.closest("[data-variant]");
        if (variantRow && event.target.closest("[data-save-variant]")) {
            const variant = readRow(variantRow);
            delete variant.stock;
            const problem = checkVariant(variant);
            if (problem) return A.notify(problem, "error");
            const original = product.variants.find(item => String(item.id) === variantRow.dataset.variant);
            if (original.is_active && !variant.is_active && original.in_active_carts
                && !window.confirm(`Esta variante está en ${original.in_active_carts} carritos. Al desactivarla ya no se podrá añadir a nuevos carritos. ¿Continuar?`)) return;
            variantRequest(`/api/admin/variants/${variantRow.dataset.variant}`, { method: "PUT", body: JSON.stringify(variant) }, "Variante guardada.");
            return;
        }
        const stockRow = event.target.closest("[data-stock-for]");
        if (stockRow && event.target.closest("[data-stock-apply]")) {
            const original = product.variants.find(item => String(item.id) === stockRow.dataset.stockFor);
            const mode = stockRow.querySelector("[data-stock-mode]").value;
            const quantity = Number(stockRow.querySelector("[data-stock-qty]").value);
            if (!Number.isInteger(quantity) || (mode === "add" && quantity === 0) || (mode === "set" && quantity < 0)) {
                return A.notify(mode === "add" ? "Indica cuántas unidades sumar (+) o restar (-)." : "Indica el nuevo stock (0 o más).", "error");
            }
            const body = mode === "add" ? { mode, quantity } : { mode, quantity, expected_stock: original.stock };
            variantRequest(`/api/admin/variants/${original.id}/stock`, { method: "POST", body: JSON.stringify(body) }, "Stock actualizado.");
        }
    });
    $("#open-gallery").addEventListener("click", () => openGallery());
    $("#upload-input").addEventListener("change", event => {
        const file = event.target.files[0];
        event.target.value = "";
        if (file) upload(file);
    });
    $("#sec-specs").closest("section").addEventListener("click", event => {
        let changed = true;
        if (event.target.closest("[data-add-feature]")) {
            $("#f-features").insertAdjacentHTML("beforeend", featureRow());
            $("#f-features li:last-child input").focus();
        } else if (event.target.closest("[data-add-spec]")) {
            $("#f-specs").insertAdjacentHTML("beforeend", specRow());
            $("#f-specs li:last-child input").focus();
        } else if (event.target.closest("[data-suggest]")) {
            $("#f-specs").insertAdjacentHTML("beforeend", specRow(event.target.closest("[data-suggest]").dataset.suggest));
            $("#f-specs li:last-child [data-spec-value]").focus();
        } else if (event.target.closest("[data-remove-spec]")) {
            event.target.closest(".spec-row").remove();
        } else {
            changed = false;
        }
        if (changed) {
            renderSuggestions();
            setDirty(true);
        }
    });
    $("#form-reload").addEventListener("click", () => window.location.reload());
    ["#cancel-link", "#back-link"].forEach(selector => $(selector).addEventListener("click", event => {
        if (dirty && !window.confirm("Tienes cambios sin guardar. ¿Salir sin guardarlos?")) event.preventDefault();
        else setDirty(false);
    }));
    window.addEventListener("beforeunload", event => {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
    });

    async function init() {
        try {
            catalog = (await A.api("/api/admin/catalog")).catalog;
            renderStatic();
            if (productId) product = (await A.api(`/api/admin/products/${productId}`)).product;
            fillForm();
            $("#form-loading").hidden = true;
            form.hidden = false;
            if (params.get("created")) {
                A.notify("Producto creado.");
                window.history.replaceState(null, "", `product.html?id=${productId}`);
            }
        } catch (error) {
            if (error.status === 401 || error.status === 403) return;
            $("#form-loading").hidden = true;
            alertBox(error.status === 404 ? "Ese producto no existe." : `No se pudo cargar el formulario: ${error.message}`, error.status !== 404);
        }
    }

    A.ready.then(init, () => {});
})();
