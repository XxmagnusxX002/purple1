/* Listado de productos (fase A3): busqueda, filtros, orden, paginacion y
   destacado rapido. Los filtros viven en la URL
   para que recargar o volver desde el formulario conserve la vista. */
(function () {
    "use strict";

    const A = window.PurpleAdmin;
    const $ = selector => document.querySelector(selector);
    const esc = A.escapeHTML;
    const VIEWS = {
        all: { status: "all" }, active: { status: "active" }, inactive: { status: "inactive" },
        featured: { featured: "1" }, low: { stock: "low" }, out: { stock: "out" },
    };

    const state = { q: "", view: "all", category: "", team: "", sort: "recent", page: 1 };
    let request = 0;
    let lastPages = 1;
    let busy = false;
    let lowThreshold = 5;
    let products = [];

    function readUrl() {
        const params = new URLSearchParams(window.location.search);
        state.q = params.get("q") || "";
        state.view = VIEWS[params.get("view")] ? params.get("view") : "all";
        state.category = params.get("category") || "";
        state.team = params.get("team") || "";
        state.sort = params.get("sort") || "recent";
        state.page = Math.max(1, Number(params.get("page")) || 1);
    }

    function writeUrl() {
        const params = new URLSearchParams();
        if (state.q) params.set("q", state.q);
        if (state.view !== "all") params.set("view", state.view);
        if (state.category) params.set("category", state.category);
        if (state.team) params.set("team", state.team);
        if (state.sort !== "recent") params.set("sort", state.sort);
        if (state.page > 1) params.set("page", state.page);
        const query = params.toString();
        window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    }

    function apiQuery() {
        const params = new URLSearchParams({ sort: state.sort, page: state.page, per_page: 20, ...VIEWS[state.view] });
        if (state.q) params.set("q", state.q);
        if (state.category) params.set("category", state.category);
        if (state.team) params.set("team", state.team);
        return params.toString();
    }

    function syncControls() {
        $("#product-search").value = state.q;
        $("#filter-category").value = state.category;
        $("#filter-team").value = state.team;
        $("#filter-sort").value = state.sort;
        document.querySelectorAll("[data-view]").forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.view === state.view)));
    }

    function stockCell(product) {
        if (!product.active_variants) return `<span class="stock-badge stock-badge--none">Sin variantes activas</span>`;
        if (product.total_stock === 0) return `<span class="stock-badge stock-badge--out">Agotado</span>`;
        const low = product.low_variants ? `<small class="stock-low">${A.formatNumber(product.low_variants)} con stock bajo</small>` : "";
        return `<strong>${A.formatNumber(product.total_stock)}</strong> <small>uds. · ${A.formatNumber(product.active_variants)} ${product.active_variants === 1 ? "variante" : "variantes"}</small>${low}`;
    }

    function row(product) {
        const meta = [product.product_type, product.teams].filter(Boolean).join(" · ");
        return `<tr data-product-id="${product.id}">
            <td data-label="Producto"><a class="product-cell" href="product.html?id=${product.id}">
                ${A.thumb(product.main_image, 40)}
                <span><strong>${esc(product.name)}</strong><small>${esc(meta || "Sin equipo")}</small></span></a></td>
            <td data-label="Precio base">${A.formatMoney(product.base_price)}</td>
            <td data-label="Stock">${stockCell(product)}</td>
            <td data-label="Vendidos">${A.formatNumber(product.units_sold)}</td>
            <td data-label="Estado">
                <span class="status-pill status-pill--${product.is_active ? "paid" : "cancelled"}">${product.is_active ? "Activo" : "Inactivo"}</span>
            </td>
            <td class="admin-table__actions" data-label="Acciones"><span class="product-actions">
                <a class="admin-button" href="product.html?id=${product.id}">Editar</a>
                <button type="button" class="admin-icon-button" data-action="featured" aria-pressed="${product.is_featured}"
                    aria-label="${product.is_featured ? "Quitar de destacados" : "Destacar"} ${esc(product.name)}"><i class="fa-${product.is_featured ? "solid" : "regular"} fa-star" aria-hidden="true"></i></button>
            </span></td>
        </tr>`;
    }

    function showError(message) {
        $("#products-alert-text").textContent = message;
        $("#products-alert").hidden = false;
    }

    async function load() {
        const current = ++request;
        $("#products-alert").hidden = true;
        writeUrl();
        try {
            const data = await A.api(`/api/admin/products?${apiQuery()}`);
            if (current !== request) return; // llego tarde: ya hay otra busqueda
            lastPages = data.pages;
            if (data.page > data.pages && data.total > 0) {
                state.page = data.pages;
                return load();
            }
            $("#products-count").textContent = `${A.formatNumber(data.total)} ${data.total === 1 ? "producto" : "productos"}`;
            $("#products-body").innerHTML = data.products.length
                ? data.products.map(row).join("")
                : `<tr><td colspan="6"><p class="admin-empty">${state.q || state.view !== "all" || state.category || state.team
                    ? "Ningún producto coincide con estos filtros." : "Todavía no hay productos. Crea el primero con «Nuevo producto»."}</p></td></tr>`;
            const pagination = $("#products-pagination");
            pagination.hidden = data.pages <= 1;
            $("#products-page").textContent = `Página ${data.page} de ${data.pages}`;
            pagination.querySelector('[data-page="prev"]').disabled = data.page <= 1;
            pagination.querySelector('[data-page="next"]').disabled = data.page >= data.pages;
            products = data.products;
        } catch (error) {
            if (current !== request || error.status === 401 || error.status === 403) return;
            showError(`No se pudieron cargar los productos: ${error.message}`);
            $("#products-body").innerHTML = "";
            $("#products-count").textContent = "";
        }
    }

    async function loadFilters() {
        try {
            const { catalog } = await A.api("/api/admin/catalog");
            lowThreshold = catalog.low_stock_threshold;
            $("#filter-category").insertAdjacentHTML("beforeend", catalog.categories.map(c =>
                `<option value="${c.id}">${"— ".repeat(c.depth)}${esc(c.name)}${c.is_active ? "" : " (inactiva)"}</option>`).join(""));
            $("#filter-team").insertAdjacentHTML("beforeend", catalog.teams.map(t =>
                `<option value="${t.id}">${esc(t.name)}${t.is_active ? "" : " (inactivo)"}</option>`).join(""));
            syncControls();
            document.querySelector('[data-view="low"]').title = `Variantes activas con ${lowThreshold} unidades o menos`;
        } catch (error) {
            // Sin catalogo los filtros quedan en "Todas"; el listado sigue funcionando.
        }
    }

    async function quickAction(button) {
        if (busy) return;
        const tr = button.closest("[data-product-id]");
        const product = products.find(item => String(item.id) === tr.dataset.productId);
        if (!product) return;
        if (button.dataset.action !== "featured") return;
        const body = { is_featured: !product.is_featured };
        busy = true;
        button.disabled = true;
        try {
            await A.api(`/api/admin/products/${product.id}/flags`, { method: "POST", body: JSON.stringify(body) });
            A.notify(body.is_featured ? "Producto destacado." : "Producto quitado de destacados.");
            await load();
        } catch (error) {
            A.notify(error.message, "error");
            button.disabled = false;
        } finally {
            busy = false;
        }
    }

    let searchTimer;
    $("#product-search").addEventListener("input", event => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.q = event.target.value.trim();
            state.page = 1;
            load();
        }, 300);
    });
    $("#product-views").addEventListener("click", event => {
        const chip = event.target.closest("[data-view]");
        if (!chip || chip.dataset.view === state.view) return;
        state.view = chip.dataset.view;
        state.page = 1;
        syncControls();
        load();
    });
    [["#filter-category", "category"], ["#filter-team", "team"], ["#filter-sort", "sort"]].forEach(([selector, key]) => {
        $(selector).addEventListener("change", event => {
            state[key] = event.target.value;
            state.page = 1;
            load();
        });
    });
    $("#products-pagination").addEventListener("click", event => {
        const button = event.target.closest("[data-page]");
        if (!button || button.disabled) return;
        state.page = Math.min(lastPages, Math.max(1, state.page + (button.dataset.page === "next" ? 1 : -1)));
        load();
        $("#products-heading").scrollIntoView({ block: "start" });
    });
    $("#products-body").addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (button) quickAction(button);
    });
    $("#products-retry").addEventListener("click", load);

    readUrl();
    syncControls();
    A.ready.then(() => Promise.all([loadFilters(), load()]), () => {});
})();
