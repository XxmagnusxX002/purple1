/* Portada dinámica: todo sale de GET /api/home (banners, destacados, más
 * vendidos, novedades, categorías, carreras y ranking).
 * index.html trae una sola estructura con tarjetas de carga (skeleton) del
 * mismo tamaño que el contenido: nada se oculta ni salta mientras se consulta.
 * La portada y las tasas de cambio se piden a la vez y se dibuja una sola vez
 * (los precios salen ya en la moneda elegida). Si la API falla, cada sección
 * conserva su espacio con un aviso y «Reintentar». */
(function () {
    "use strict";

    const $ = (selector) => document.querySelector(selector);
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const money = (value) => window.Purple1Currency.formatMoney(value);
    const number = (value) => Number(value || 0).toLocaleString("es-CO");
    let home = null;

    function productCard(product, badge) {
        const promo = Number(product.promo_percent) > 0 && Number(product.list_price) > Number(product.final_price);
        const label = promo ? `<span class="badge top-badge promo-badge">−${Number(product.promo_percent)} %</span>` : badge ? `<span class="badge top-badge">${esc(badge)}</span>` : "";
        return `<article class="product-card">
            ${label}
            <div class="product-image">${window.PurpleMedia.productImage(product.main_image, product.product_type, product.name)}</div>
            <div class="product-info"><h3>${esc(product.name)}</h3>
                <p class="price">${money(product.final_price)}${promo ? ` <span class="old-price">${money(product.list_price)}</span>` : ""}</p>
                ${product.units_sold ? `<p class="home-sold">${number(product.units_sold)} ${product.units_sold === 1 ? "unidad vendida" : "unidades vendidas"}</p>` : ""}
                <a href="product_detail.html?id=${product.id}" class="btn-card">Ver producto</a></div>
        </article>`;
    }

    function fillProducts(section, grid, products, badge) {
        $(section).hidden = !products.length;
        $(grid).innerHTML = products.map((product) => productCard(product, badge)).join("");
    }

    function renderCategories(categories) {
        const visible = categories.filter((category) => category.image_path);
        $("#home-categories").hidden = !visible.length;
        $("#categories-grid").innerHTML = visible.map((category) => `
            <a class="category-card surface-card" href="products.html?category=${encodeURIComponent(category.slug)}">
                <img src="${esc(category.image_path)}" alt="" loading="lazy">
                <span class="home-category-text"><span>${esc(category.name)}</span>
                    <small class="home-category-count">${number(category.products)} ${category.products === 1 ? "producto" : "productos"}</small></span>
            </a>`).join("");
    }

    function raceDate(race) {
        if (race.local_display) return `${esc(race.local_display)} (hora del circuito)`;
        return new Date(String(race.race_date).replace(" ", "T")).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
    }

    function renderRaces(nextRace, openRaces, leaderboard) {
        const hasRaces = Boolean(nextRace) || openRaces.length;
        $("#home-races").hidden = !hasRaces && !leaderboard.length;
        const STATUS = { SCHEDULED: "Programada", OPEN: "Pronósticos abiertos", LOCKED: "Pronósticos cerrados" };
        let main = "";
        if (nextRace) {
            main += `<article class="surface-card home-next-race">
                <div class="home-next-race__head">${window.PurpleMedia.raceFlag(nextRace, "md")}<div>
                <span class="home-eyebrow">Próxima carrera</span>
                <h3>${esc(nextRace.name)}</h3></div></div>
                <p class="home-muted"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc(nextRace.circuit)}${nextRace.country ? ` · ${esc(nextRace.country)}` : ""}</p>
                <p class="home-muted"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ${raceDate(nextRace)}</p>
                <div class="home-race-facts"><span class="home-chip">${esc(STATUS[nextRace.status] || nextRace.status)}</span>
                    <span><strong>${number(nextRace.drivers)}</strong> pilotos</span><span><strong>${number(nextRace.participants)}</strong> participantes</span></div>
            </article>`;
        }
        if (openRaces.length) {
            main += `<div class="surface-card home-open-races"><h3>Pronósticos disponibles</h3><ul>${openRaces.map((race) => `
                <li>${window.PurpleMedia.raceFlag(race, "sm")}<span><strong>${esc(race.name)}</strong><small>${number(race.participants)} participantes · bote de ${number(race.pool)} PitCoins</small></span>
                    <a class="btn-card" href="races.html">Pronosticar</a></li>`).join("")}</ul></div>`;
        } else if (hasRaces) {
            main += `<p class="surface-card home-empty">No hay pronósticos abiertos en este momento. Se abrirán antes de la próxima carrera.</p>`;
        } else {
            main += `<p class="surface-card home-empty">No hay carreras programadas por ahora.</p>`;
        }
        $("#races-main").innerHTML = main;
        $("#ranking-list").innerHTML = leaderboard.length
            ? leaderboard.map((row) => `<li><span class="home-rank">${row.position}</span><span class="home-rank-name">${esc(row.name)}</span><span class="home-rank-coins"><i class="fa-solid fa-coins" aria-hidden="true"></i> ${number(row.coins)}</span></li>`).join("")
            : '<li class="home-empty">Todavía no hay participantes.</li>';
    }

    /* ---------- Banners: carrusel compartido (js/banners.js) ---------- */
    function renderBanners(banners) {
        const host = $("#home-banners");
        host.removeAttribute("aria-busy");
        if (!banners.length) {
            // Sin banners publicados la portada empieza directamente en Destacados.
            host.innerHTML = "";
            host.hidden = true;
            return;
        }
        window.PurpleBanners.mount(host, banners);
        host.hidden = false;
    }

    function render() {
        if (!home) return;
        document.querySelectorAll("main [aria-busy]").forEach((node) => node.removeAttribute("aria-busy"));
        renderBanners(home.banners);
        fillProducts("#home-featured", "#featured-grid", home.featured, "Destacado");
        renderCategories(home.categories);
        fillProducts("#home-best", "#best-grid", home.best_sellers, "Más vendido");
        // Novedades: sin repetir lo que ya aparece en destacados.
        const featuredIds = new Set(home.featured.map((product) => product.id));
        fillProducts("#home-new", "#new-grid", home.new_arrivals.filter((product) => !featuredIds.has(product.id)).slice(0, 4), "Nuevo");
        renderRaces(home.next_race, home.open_races, home.leaderboard);
    }

    async function load() {
        $("#home-alert").hidden = true;
        try {
            // En paralelo: contenido de la portada y tasas de cambio.
            const [response] = await Promise.all([fetch("/api/home", { credentials: "same-origin" }), window.Purple1Currency.ready]);
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || "No disponible");
            home = data.home;
            render();
        } catch (error) {
            // Sin datos de respaldo: cada sección mantiene su lugar con un aviso.
            $("#home-banners").hidden = true;
            ["#featured-grid", "#best-grid", "#new-grid", "#categories-grid"].forEach((id) => {
                $(id).innerHTML = '<p class="surface-card home-empty">Este contenido no está disponible ahora.</p>';
            });
            $("#races-main").innerHTML = '<p class="surface-card home-empty">Las carreras no están disponibles ahora.</p>';
            $("#ranking-list").innerHTML = "";
            $("#home-alert").hidden = false;
        }
    }

    $("#home-retry").addEventListener("click", () => location.reload());
    // Solo se vuelve a dibujar si el cliente cambia de moneda después de cargar.
    window.addEventListener(window.Purple1Currency.EVENT_NAME, () => { if (home) render(); });
    load();
})();
