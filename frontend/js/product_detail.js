/* Detalle de producto: todo lo que se muestra sale de GET /api/products/<id>.
 * - Precio tachado y etiqueta de oferta solo si el producto tiene una promoción vigente.
 * - Descripción, características y especificaciones se ocultan si no existen.
 * - El título del selector depende del tipo de producto (talla, color o ambos). */
document.addEventListener("DOMContentLoaded", async () => {
    const $ = (selector) => document.querySelector(selector);
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const title = $(".product-title");
    const priceMain = $(".price-main");
    const priceOld = $(".price-old");
    const promoBadge = $("#promo-badge");
    const stockText = $(".stock-text");
    const mainImage = $(".main-product-image");
    const thumbsRow = $(".thumbs-row");
    const sizesGrid = $(".sizes-grid");
    const addButton = $(".add-cart-btn");
    const message = $("#detail-message");
    let selectedInventory = null;
    let currentProduct = null;
    let images = [];
    let imageIndex = 0;

    const escapeHTML = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const money = (value) => window.Purple1Currency.formatMoney(value);
    const units = (n) => `${n} ${Number(n) === 1 ? "unidad disponible" : "unidades disponibles"}`;

    function setUnavailable(text) {
        addButton.setAttribute("aria-disabled", "true");
        addButton.textContent = text;
    }

    function renderPrice() {
        if (!currentProduct) return;
        const sale = selectedInventory ? selectedInventory.effective_price : currentProduct.final_price;
        const list = selectedInventory ? selectedInventory.list_price : currentProduct.list_price;
        priceMain.textContent = money(sale);
        const onSale = Number(currentProduct.promo_percent) > 0 && Number(list) > Number(sale);
        priceOld.hidden = !onSale;
        priceOld.textContent = onSale ? money(list) : "";
    }

    function renderPromo(product) {
        const percent = Number(product.promo_percent) || 0;
        if (!percent) return;
        const until = product.promo_ends_at
            ? ` <small>hasta el ${new Date(`${String(product.promo_ends_at).replace(" ", "T")}Z`).toLocaleDateString("es-CO")}</small>`
            : "";
        promoBadge.innerHTML = `<i class="fa-solid fa-tag" aria-hidden="true"></i> Promoción −${percent} %${until}`;
        promoBadge.hidden = false;
    }

    function showImage(index) {
        if (!images.length) return;
        imageIndex = (index + images.length) % images.length;
        mainImage.src = images[imageIndex].image_path;
        mainImage.alt = images[imageIndex].alt_text || currentProduct.name;
        thumbsRow.querySelectorAll(".thumb").forEach((thumb, i) => thumb.classList.toggle("active", i === imageIndex));
    }

    function renderGallery(product) {
        images = product.images.filter((image) => image.image_path);
        if (!images.length) {
            // Sin imagen real: icono neutro en lugar de una imagen provisional.
            mainImage.insertAdjacentHTML("afterend", window.PurpleMedia.productFallback(product.product_type, "detail-fallback"));
            mainImage.remove();
            thumbsRow.innerHTML = "";
            document.querySelectorAll(".nav-arrow").forEach((arrow) => { arrow.hidden = true; });
            return;
        }
        thumbsRow.innerHTML = images.length > 1
            ? images.map((image, index) => `<button class="thumb" type="button" data-index="${index}" aria-label="Ver imagen ${index + 1}"><img src="${escapeHTML(image.image_path)}" alt=""></button>`).join("")
            : "";
        document.querySelectorAll(".nav-arrow").forEach((arrow) => { arrow.hidden = images.length < 2; });
        showImage(0);
    }

    function renderContent(product) {
        if (product.description) {
            $("#product-description").textContent = product.description;
            $("#section-description").hidden = false;
        }
        if (product.features?.length) {
            $("#product-features").innerHTML = product.features.map((text) => `<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>${escapeHTML(text)}</span></li>`).join("");
            $("#section-features").hidden = false;
        }
        if (product.specs?.length) {
            $("#product-specs").innerHTML = product.specs.map((spec) => `<dt>${escapeHTML(spec.label)}</dt><dd>${escapeHTML(spec.value)}</dd>`).join("");
            $("#section-specs").hidden = false;
        }
    }

    function renderVariants(product) {
        const label = product.uses_size && product.uses_color ? "Talla y color" : product.uses_size ? "Talla" : product.uses_color ? "Color" : "Presentación";
        $("#variant-label").textContent = label;
        // Sin talla ni color y con una sola variante no hay nada que elegir.
        const choose = product.inventory.length > 1 || product.uses_size || product.uses_color;
        $("#variant-header").hidden = !choose || !product.inventory.length;
        sizesGrid.hidden = !choose;
        sizesGrid.innerHTML = product.inventory.map((item) => {
            const text = [item.size_name, item.color_name].filter(Boolean).join(" / ") || item.sku;
            const active = selectedInventory && item.id === selectedInventory.id ? "active" : "";
            return `<button class="size-btn ${active}" type="button" data-inventory="${item.id}" ${item.stock < 1 ? "disabled" : ""}>${escapeHTML(text)}</button>`;
        }).join("");
    }

    function renderStock() {
        const stock = selectedInventory ? Number(selectedInventory.stock) : 0;
        stockText.textContent = stock > 0 ? units(stock) : "Sin stock";
        if (stock > 0) {
            addButton.removeAttribute("aria-disabled");
            addButton.textContent = "Añadir al carrito";
        } else {
            setUnavailable(currentProduct.inventory.length ? "Agotado" : "Sin inventario");
        }
    }

    document.querySelectorAll(".accordion-header").forEach((trigger) => {
        trigger.addEventListener("click", () => trigger.closest(".accordion-item").classList.toggle("open"));
    });
    $(".nav-arrow.left").addEventListener("click", () => showImage(imageIndex - 1));
    $(".nav-arrow.right").addEventListener("click", () => showImage(imageIndex + 1));
    thumbsRow.addEventListener("click", (event) => {
        const thumb = event.target.closest("[data-index]");
        if (thumb) showImage(Number(thumb.dataset.index));
    });

    if (!id) {
        title.textContent = "Producto no encontrado";
        setUnavailable("No disponible");
        return;
    }

    try {
        // Producto y tasas de cambio en paralelo: el precio se dibuja una sola vez.
        const [response] = await Promise.all([fetch(`/api/products/${encodeURIComponent(id)}`), window.Purple1Currency.ready]);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "No se pudo cargar el producto.");
        const product = data.product;
        currentProduct = product;
        document.title = `Purple One | ${product.name}`;
        selectedInventory = product.inventory.find((i) => i.stock > 0) || product.inventory[0] || null;

        title.textContent = product.name;
        renderGallery(product);
        renderPromo(product);
        renderPrice();
        renderVariants(product);
        renderStock();
        renderContent(product);
        $("#detail-layout").setAttribute("aria-busy", "false");

        sizesGrid.addEventListener("click", (event) => {
            const button = event.target.closest(".size-btn");
            if (!button || button.disabled) return;
            sizesGrid.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
            button.classList.add("active");
            selectedInventory = product.inventory.find((i) => String(i.id) === button.dataset.inventory);
            renderPrice();
            renderStock();
        });

        addButton.addEventListener("click", async (event) => {
            event.preventDefault();
            message.textContent = "";
            if (!selectedInventory || selectedInventory.stock < 1) {
                message.textContent = "No hay inventario disponible para esta opción.";
                return;
            }
            try {
                const sessionResponse = await fetch("/api/auth/me");
                if (!sessionResponse.ok) {
                    window.location.href = "auth.html";
                    return;
                }
                const res = await fetch("/api/cart/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ inventory_id: selectedInventory.id, quantity: 1 }),
                });
                const cartData = await res.json();
                if (!res.ok || !cartData.success) throw new Error(cartData.error || "No se pudo agregar al carrito.");
                window.location.href = "cart.html";
            } catch (error) {
                message.textContent = error.message;
            }
        });
    } catch (error) {
        title.textContent = "Producto no disponible";
        message.textContent = error.message;
        setUnavailable("No disponible");
        thumbsRow.innerHTML = "";
    }

    window.addEventListener(window.Purple1Currency.EVENT_NAME, renderPrice);
});
