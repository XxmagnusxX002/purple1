/* Carrusel de banners compartido por la portada y la vista previa del panel.
 *
 * PurpleBanners.slideMarkup(banner, { root, active })
 *   Una diapositiva: título y descripción a la izquierda, imagen a la derecha y
 *   botón «Ver más» solo si el banner tiene enlace.
 * PurpleBanners.mount(host, banners)
 *   Carrusel completo: flechas laterales e indicadores (solo con 2 o más banners),
 *   cambio automático cada 5,5 s con fundido, pausa mientras el usuario interactúa
 *   (ratón encima, foco o toque) y gestos de deslizar en pantallas táctiles.
 */
(function () {
    "use strict";

    const AUTOPLAY_MS = 5500;
    const SWIPE_PX = 40;
    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    function slideMarkup(banner, { root = "/", active = false } = {}) {
        const image = banner.image_path
            ? `<div class="banner-slide__media"><img src="${esc(root + banner.image_path)}" alt="" loading="lazy"></div>`
            : '<div class="banner-slide__media banner-slide__media--empty" aria-hidden="true"><i class="fa-regular fa-image"></i></div>';
        return `<article class="banner-slide${active ? " is-active" : ""}" aria-roledescription="diapositiva">
            <div class="banner-slide__copy">
                <h2>${esc(banner.title || "Título del banner")}</h2>
                ${banner.description ? `<p>${esc(banner.description)}</p>` : ""}
                ${banner.link_url ? `<a class="btn-primary banner-slide__cta" href="${esc(banner.link_url)}">Ver más</a>` : ""}
            </div>
            ${image}
        </article>`;
    }

    function mount(host, banners, { root = "/" } = {}) {
        if (host._stopCarousel) host._stopCarousel();
        const many = banners.length > 1;
        host.innerHTML = `<div class="banner-carousel" role="region" aria-roledescription="carrusel" aria-label="Novedades">
            <div class="banner-track" aria-live="${many ? "off" : "polite"}">${banners.map((banner, i) => slideMarkup(banner, { root, active: i === 0 })).join("")}</div>
            ${many ? `<button type="button" class="banner-arrow banner-arrow--prev" data-step="-1" aria-label="Banner anterior"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
                <button type="button" class="banner-arrow banner-arrow--next" data-step="1" aria-label="Banner siguiente"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
                <div class="banner-dots" role="group" aria-label="Elegir banner">${banners.map((banner, i) =>
                    `<button type="button" class="banner-dot${i === 0 ? " is-active" : ""}" data-go="${i}" aria-label="Ir al banner ${i + 1}: ${esc(banner.title)}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("")}</div>` : ""}
        </div>`;
        if (!many) return;

        const carousel = host.querySelector(".banner-carousel");
        const slides = [...host.querySelectorAll(".banner-slide")];
        const dots = [...host.querySelectorAll(".banner-dot")];
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        let current = 0;
        let timer = null;
        let paused = false;

        function show(index) {
            current = (index + slides.length) % slides.length;
            slides.forEach((slide, i) => {
                slide.classList.toggle("is-active", i === current);
                slide.setAttribute("aria-hidden", String(i !== current));
                slide.querySelectorAll("a").forEach((link) => { link.tabIndex = i === current ? 0 : -1; });
            });
            dots.forEach((dot, i) => {
                dot.classList.toggle("is-active", i === current);
                if (i === current) dot.setAttribute("aria-current", "true");
                else dot.removeAttribute("aria-current");
            });
        }

        function schedule() {
            clearInterval(timer);
            timer = reduced || paused ? null : setInterval(() => show(current + 1), AUTOPLAY_MS);
        }

        // Navegación manual: cambia el banner y reinicia la cuenta del cambio automático.
        function go(index) {
            show(index);
            schedule();
        }

        carousel.addEventListener("click", (event) => {
            const step = event.target.closest("[data-step]");
            const dot = event.target.closest("[data-go]");
            if (step) go(current + Number(step.dataset.step));
            if (dot) go(Number(dot.dataset.go));
        });
        carousel.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") go(current - 1);
            if (event.key === "ArrowRight") go(current + 1);
        });

        // Pausa mientras el usuario interactúa con el carrusel.
        const pause = () => { paused = true; schedule(); };
        const resume = () => { paused = false; schedule(); };
        carousel.addEventListener("mouseenter", pause);
        carousel.addEventListener("mouseleave", resume);
        carousel.addEventListener("focusin", pause);
        carousel.addEventListener("focusout", (event) => { if (!carousel.contains(event.relatedTarget)) resume(); });

        // Gestos en pantallas táctiles.
        let startX = null;
        carousel.addEventListener("touchstart", (event) => { startX = event.touches[0].clientX; pause(); }, { passive: true });
        carousel.addEventListener("touchend", (event) => {
            if (startX !== null) {
                const dx = event.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > SWIPE_PX) show(current + (dx < 0 ? 1 : -1));
            }
            startX = null;
            resume();
        });

        show(0);
        schedule();
        host._stopCarousel = () => clearInterval(timer);
    }

    window.PurpleBanners = { slideMarkup, mount };
})();
