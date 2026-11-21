document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("catalogo");
    const searchInput = document.getElementById("catalog-search");
    const sortSelect = document.getElementById("catalog-sort");
    const sidebar = document.querySelector(".filters-sidebar");
    const totalButton = document.querySelector(".toolbar-btn");
    const totalText = document.querySelector(".toolbar-right");

    function price(value) {
        return window.Purple1Currency.formatMoney(value);
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function productCard(product) {
        const stock = Number(product.total_stock || 0);
        const categories = product.categories || "Sin categoría";
        const teams = product.teams || "Sin equipo";
        return `<article class="product-card">
            ${Number(product.promo_percent) > 0 ? `<span class="badge top-badge promo-badge">−${Number(product.promo_percent)} %</span>` : product.is_featured ? '<span class="badge top-badge">Destacado</span>' : ""}
            <div class="product-image">${window.PurpleMedia.productImage(product.main_image, product.product_type, product.name)}</div>
            <div class="product-info">
                <h3>${escapeHTML(product.name)}</h3>
                <div class="product-meta">
                    <span>${escapeHTML(categories)}</span>
                    <span>${escapeHTML(teams)}</span>
                </div>
                <p class="stock-line ${stock > 0 ? "in-stock" : "out-stock"}">${stock > 0 ? `${stock} ${stock === 1 ? "unidad disponible" : "unidades disponibles"}` : "Sin stock"}</p>
                <p class="price">${price(product.final_price)}${Number(product.promo_percent) > 0 && Number(product.list_price) > Number(product.final_price) ? ` <span class="old-price">${price(product.list_price)}</span>` : ""}</p>
                <a href="product_detail.html?id=${product.id}" class="btn-card">Ver producto</a>
            </div>
        </article>`;
    }

    async function getJSON(url) {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Error cargando datos.");
        return data;
    }

    async function loadFilters() {
        const [categories, teams, sizes, colors] = await Promise.all([
            getJSON("/api/categories"),
            getJSON("/api/teams"),
            getJSON("/api/sizes"),
            getJSON("/api/colors")
        ]);

        sidebar.innerHTML = `
            <div class="filter-group"><h3>Categorias</h3>
                <label class="radio-item active"><input type="radio" name="category" value="" checked><span class="custom-radio"></span><span>Todos</span></label>
                ${categories.categories.map(c => `<label class="radio-item"><input type="radio" name="category" value="${escapeHTML(c.slug)}"><span class="custom-radio"></span><span>${escapeHTML(c.name)}</span></label>`).join("")}
            </div><hr>
            <div class="filter-group"><h3>Escuderias</h3>
                <label class="radio-item active"><input type="radio" name="team" value="" checked><span class="custom-radio"></span><span>Todos</span></label>
                ${teams.teams.map(t => `<label class="radio-item"><input type="radio" name="team" value="${escapeHTML(t.slug)}"><span class="custom-radio"></span><span>${escapeHTML(t.name)}</span></label>`).join("")}
            </div><hr>
            <div class="filter-group"><h3>Tallas</h3>
                <select id="size-filter" class="toolbar-select"><option value="">Todas</option>${sizes.sizes.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join("")}</select>
            </div><hr>
            <div class="filter-group"><h3>Colores</h3>
                <select id="color-filter" class="toolbar-select"><option value="">Todos</option>${colors.colors.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join("")}</select>
            </div><hr>
            <div class="filter-group"><h3>Precio</h3>
                <div class="price-filter-row">
                    <input id="min-price-filter" class="filter-input" type="number" min="0" step="0.01" placeholder="Minimo">
                    <input id="max-price-filter" class="filter-input" type="number" min="0" step="0.01" placeholder="Maximo">
                </div>
            </div><hr>
            <div class="filter-group"><h3>Ordenar por</h3>
                <select id="catalog-sort" class="toolbar-select"><option value="recent">Mas recientes</option><option value="name">Nombre</option><option value="price_asc">Precio menor a mayor</option><option value="price_desc">Precio mayor a menor</option></select>
            </div>`;
        const initialParams = new URLSearchParams(window.location.search);
        ["category", "team"].forEach((name) => {
            const value = initialParams.get(name);
            if (!value) return;
            const input = [...sidebar.querySelectorAll(`input[name="${name}"]`)].find(item => item.value === value);
            if (input) input.checked = true;
        });
        if (initialParams.get("q") && searchInput) searchInput.value = initialParams.get("q");
        sidebar.addEventListener("change", loadProducts);
        sidebar.addEventListener("input", () => {
            clearTimeout(window.__purpleFilter);
            window.__purpleFilter = setTimeout(loadProducts, 300);
        });
    }

    function selected(name) {
        return document.querySelector(`[name="${name}"]:checked`)?.value || "";
    }

    let lastProducts = null;

    async function loadProducts() {
        try {
            const params = new URLSearchParams();
            const q = searchInput?.value.trim();
            if (q) params.set("q", q);
            if (selected("category")) params.set("category", selected("category"));
            if (selected("team")) params.set("team", selected("team"));
            const size = document.getElementById("size-filter")?.value;
            const color = document.getElementById("color-filter")?.value;
            const minPrice = document.getElementById("min-price-filter")?.value;
            const maxPrice = document.getElementById("max-price-filter")?.value;
            const sort = document.getElementById("catalog-sort")?.value || sortSelect?.value || "recent";
            if (size) params.set("size", size);
            if (color) params.set("color", color);
            if (minPrice) params.set("min_price", minPrice);
            if (maxPrice) params.set("max_price", maxPrice);
            if (sort) params.set("sort", sort);
            const hasFilters = [...params.keys()].some(k => k !== "sort");
            const url = hasFilters ? `/api/products/filter?${params}` : `/api/products?${params}`;
            const data = await getJSON(url);
            lastProducts = data.products;
            grid.innerHTML = data.products.length ? data.products.map(productCard).join("") : '<div class="empty-products surface-card"><h3>No encontramos productos</h3><p>Prueba cambiando los filtros.</p></div>';
            if (totalButton) totalButton.textContent = `${data.products.length} items`;
            if (totalText) totalText.textContent = `${data.products.length} productos encontrados`;
        } catch (error) {
            grid.innerHTML = `<div class="empty-products surface-card"><h3>Error</h3><p>${escapeHTML(error.message)}</p></div>`;
        }
    }

    document.querySelector(".filter-btn")?.addEventListener("click", loadProducts);
    searchInput?.addEventListener("input", () => {
        clearTimeout(window.__purpleSearch);
        window.__purpleSearch = setTimeout(loadProducts, 350);
    });
    sortSelect?.addEventListener("change", loadProducts);

    // Filtros y tasas de cambio en paralelo; los productos se dibujan una sola vez
    // con la moneda ya resuelta (sin pasar de EUR a la moneda elegida).
    Promise.all([loadFilters(), window.Purple1Currency.ready]).then(loadProducts).catch((error) => {
        grid.innerHTML = `<div class="empty-products surface-card"><h3>Error</h3><p>${escapeHTML(error.message)}</p></div>`;
    });

    // Cambio de moneda: se vuelve a dibujar lo que ya hay, sin consultar de nuevo.
    window.addEventListener(window.Purple1Currency.EVENT_NAME, () => {
        if (lastProducts) grid.innerHTML = lastProducts.length ? lastProducts.map(productCard).join("") : grid.innerHTML;
    });
});
