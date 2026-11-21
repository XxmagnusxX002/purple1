/* Imágenes de respaldo de Purple One (sin archivos "placeholder").
 *
 * PurpleMedia.productImage(src, type, alt, className)
 *   <img> si hay imagen real; si no, un icono neutro según el tipo de producto.
 * PurpleMedia.raceFlag(race, size)
 *   Bandera del país del Gran Premio (SVG simplificado, sin descargas ni
 *   dependencias). El país sale de race.country o, si falta, del nombre de la
 *   carrera o del circuito. Si no se reconoce: icono neutro de bandera a cuadros.
 * PurpleMedia.countries()
 *   Países con bandera y sus zonas horarias (lista del formulario de carreras).
 * Si una imagen real falla al cargar (archivo borrado), se reemplaza por el icono.
 */
(function () {
    "use strict";

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const norm = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.\s]+/g, " ").trim();

    /* ---------------- Productos ---------------- */
    const PRODUCT_ICONS = { ropa: "fa-shirt", accesorio: "fa-bag-shopping", coleccionable: "fa-trophy", escuderia: "fa-flag-checkered" };

    function productIcon(type) {
        return PRODUCT_ICONS[norm(type)] || "fa-box-open";
    }

    function productFallback(type, className = "") {
        return `<span class="media-fallback ${esc(className)}" role="img" aria-label="Producto sin imagen"><i class="fa-solid ${productIcon(type)}" aria-hidden="true"></i></span>`;
    }

    function productImage(src, type, alt = "", className = "") {
        if (!src) return productFallback(type, className);
        return `<img src="${esc(src)}" alt="${esc(alt)}" class="${esc(className)}" loading="lazy" data-fallback-type="${esc(type || "")}">`;
    }

    // Imagen real rota -> icono neutro (nunca un "P1").
    document.addEventListener("error", (event) => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-fallback-type")) return;
        img.insertAdjacentHTML("afterend", productFallback(img.dataset.fallbackType, img.className));
        img.remove();
    }, true);

    /* ---------------- Banderas (viewBox 30 x 20) ---------------- */
    const rect = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
    const vertical = (a, b, c) => rect(0, 0, 10, 20, a) + rect(10, 0, 10, 20, b) + rect(20, 0, 10, 20, c);
    const horizontal = (a, b, c) => rect(0, 0, 30, 6.67, a) + rect(0, 6.67, 30, 6.66, b) + rect(0, 13.33, 30, 6.67, c);
    const union = () => rect(0, 0, 30, 20, "#012169")
        + '<path d="M0,0 30,20 M30,0 0,20" stroke="#fff" stroke-width="4"/>'
        + '<path d="M0,0 30,20 M30,0 0,20" stroke="#C8102E" stroke-width="1.4"/>'
        + '<path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="6"/>'
        + '<path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="3.4"/>';
    const star = (cx, cy, r, fill) => {
        const points = Array.from({ length: 10 }, (_, i) => {
            const angle = -Math.PI / 2 + (i * Math.PI) / 5;
            const radius = i % 2 ? r * 0.42 : r;
            return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
        }).join(" ");
        return `<polygon points="${points}" fill="${fill}"/>`;
    };

    const FLAGS = {
        IT: { name: "Italia", zones: [["Europe/Rome", "Monza / Imola"]], svg: () => vertical("#009246", "#fff", "#CE2B37") },
        FR: { name: "Francia", zones: [["Europe/Paris", "Paul Ricard"]], svg: () => vertical("#0055A4", "#fff", "#EF4135") },
        BE: { name: "Bélgica", zones: [["Europe/Brussels", "Spa-Francorchamps"]], svg: () => vertical("#000", "#FDDA24", "#EF3340") },
        MX: { name: "México", zones: [["America/Mexico_City", "Ciudad de México"]], svg: () => vertical("#006847", "#fff", "#CE1126") + '<circle cx="15" cy="10" r="2.6" fill="#8C5A2B"/>' },
        DE: { name: "Alemania", zones: [["Europe/Berlin", "Hockenheim / Nürburgring"]], svg: () => horizontal("#000", "#DD0000", "#FFCE00") },
        AT: { name: "Austria", zones: [["Europe/Vienna", "Red Bull Ring"]], svg: () => horizontal("#ED2939", "#fff", "#ED2939") },
        HU: { name: "Hungría", zones: [["Europe/Budapest", "Hungaroring"]], svg: () => horizontal("#CE2939", "#fff", "#477050") },
        NL: { name: "Países Bajos", zones: [["Europe/Amsterdam", "Zandvoort"]], svg: () => horizontal("#AE1C28", "#fff", "#21468B") },
        AZ: { name: "Azerbaiyán", zones: [["Asia/Baku", "Bakú"]], svg: () => horizontal("#00B5E2", "#EF3340", "#509E2F") + '<circle cx="14.4" cy="10" r="2.2" fill="#fff"/><circle cx="15.1" cy="10" r="1.8" fill="#EF3340"/>' + star(17.4, 10, 1, "#fff") },
        CO: { name: "Colombia", zones: [["America/Bogota", "Bogotá"]], svg: () => rect(0, 0, 30, 10, "#FCD116") + rect(0, 10, 30, 5, "#003893") + rect(0, 15, 30, 5, "#CE1126") },
        ES: { name: "España", zones: [["Europe/Madrid", "Barcelona / Madrid"]], svg: () => rect(0, 0, 30, 20, "#AA151B") + rect(0, 5, 30, 10, "#F1BF00") },
        MC: { name: "Mónaco", zones: [["Europe/Monaco", "Mónaco"]], svg: () => rect(0, 0, 30, 10, "#CE1126") + rect(0, 10, 30, 10, "#fff") },
        SG: { name: "Singapur", zones: [["Asia/Singapore", "Marina Bay"]], svg: () => rect(0, 0, 30, 10, "#EF3340") + rect(0, 10, 30, 10, "#fff") + '<circle cx="6.5" cy="5" r="3.2" fill="#fff"/><circle cx="7.7" cy="5" r="3" fill="#EF3340"/>' + [[10, 2.7], [8.8, 4.3], [11.2, 4.3], [9.3, 6.4], [10.7, 6.4]].map(([x, y]) => star(x, y, 0.55, "#fff")).join("") },
        JP: { name: "Japón", zones: [["Asia/Tokyo", "Suzuka"]], svg: () => rect(0, 0, 30, 20, "#fff") + '<circle cx="15" cy="10" r="6" fill="#BC002D"/>' },
        CA: { name: "Canadá", zones: [["America/Toronto", "Montreal"]], svg: () => rect(0, 0, 30, 20, "#fff") + rect(0, 0, 7.5, 20, "#D52B1E") + rect(22.5, 0, 7.5, 20, "#D52B1E") + star(15, 10, 4.6, "#D52B1E") },
        AR: { name: "Argentina", zones: [["America/Argentina/Buenos_Aires", "Buenos Aires"]], svg: () => horizontal("#74ACDF", "#fff", "#74ACDF") + '<circle cx="15" cy="10" r="1.9" fill="#F6B40E"/>' },
        BR: { name: "Brasil", zones: [["America/Sao_Paulo", "Interlagos"]], svg: () => rect(0, 0, 30, 20, "#009C3B") + '<polygon points="15,2.5 27.5,10 15,17.5 2.5,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/>' },
        US: { name: "Estados Unidos", zones: [["America/New_York", "Miami"], ["America/Chicago", "Austin"], ["America/Los_Angeles", "Las Vegas"]], svg: () => Array.from({ length: 13 }, (_, i) => rect(0, (i * 20) / 13, 30, 20 / 13 + 0.05, i % 2 ? "#fff" : "#B22234")).join("") + rect(0, 0, 12, 10.77, "#3C3B6E")
            + Array.from({ length: 20 }, (_, i) => `<circle cx="${1.4 + (i % 5) * 2.3}" cy="${1.4 + Math.floor(i / 5) * 2.6}" r="0.45" fill="#fff"/>`).join("") },
        GB: { name: "Reino Unido", zones: [["Europe/London", "Silverstone"]], svg: union },
        AU: { name: "Australia", zones: [["Australia/Melbourne", "Albert Park"]], svg: () => rect(0, 0, 30, 20, "#012169") + `<g transform="scale(0.5)">${union()}</g>` + star(7.5, 15.5, 1.8, "#fff") + star(22.5, 4.5, 1, "#fff") + star(25.5, 9, 1, "#fff") + star(22.5, 16, 1, "#fff") + star(19.5, 9.5, 1, "#fff") },
        CN: { name: "China", zones: [["Asia/Shanghai", "Shanghái"]], svg: () => rect(0, 0, 30, 20, "#EE1C25") + star(5, 5, 3, "#FFFF00") + [[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => star(x, y, 0.9, "#FFFF00")).join("") },
        PT: { name: "Portugal", zones: [["Europe/Lisbon", "Portimão"]], svg: () => rect(0, 0, 12, 20, "#006600") + rect(12, 0, 18, 20, "#FF0000") + '<circle cx="12" cy="10" r="3.3" fill="#FFCC29"/>' },
        SA: { name: "Arabia Saudita", zones: [["Asia/Riyadh", "Yeda"]], svg: () => rect(0, 0, 30, 20, "#006C35") + rect(8, 12, 14, 1.2, "#fff") + rect(9, 7, 12, 2.2, "#fff") },
        BH: { name: "Baréin", zones: [["Asia/Bahrain", "Sakhir"]], svg: () => rect(0, 0, 30, 20, "#CE1126") + '<polygon points="0,0 8,0 11,2 8,4 11,6 8,8 11,10 8,12 11,14 8,16 11,18 8,20 0,20" fill="#fff"/>' },
        QA: { name: "Catar", zones: [["Asia/Qatar", "Lusail"]], svg: () => rect(0, 0, 30, 20, "#8A1538") + '<polygon points="0,0 8,0 11,1.1 8,2.2 11,3.3 8,4.4 11,5.5 8,6.6 11,7.7 8,8.8 11,10 8,11.1 11,12.2 8,13.3 11,14.4 8,15.5 11,16.6 8,17.7 11,18.8 8,20 0,20" fill="#fff"/>' },
        MY: { name: "Malasia", zones: [["Asia/Kuala_Lumpur", "Sepang"]], svg: () => Array.from({ length: 14 }, (_, i) => rect(0, (i * 20) / 14, 30, 20 / 14 + 0.05, i % 2 ? "#fff" : "#CC0001")).join("")
            + rect(0, 0, 15, 11.43, "#010066") + '<circle cx="5.6" cy="5.7" r="3.6" fill="#FFCC00"/><circle cx="6.6" cy="5.7" r="3.1" fill="#010066"/>' + star(10.6, 5.7, 1.9, "#FFCC00") },
        AE: { name: "Emiratos Árabes Unidos", zones: [["Asia/Dubai", "Yas Marina"]], svg: () => rect(0, 0, 30, 6.67, "#00732F") + rect(0, 6.67, 30, 6.66, "#fff") + rect(0, 13.33, 30, 6.67, "#000") + rect(0, 0, 7.5, 20, "#FF0000") },
    };

    // Nombres de país (sin tildes) y lugares de circuitos conocidos -> código.
    const ALIASES = {
        italia: "IT", francia: "FR", belgica: "BE", mexico: "MX", alemania: "DE", austria: "AT", hungria: "HU", "paises bajos": "NL", holanda: "NL",
        azerbaiyan: "AZ", colombia: "CO", espana: "ES", monaco: "MC", singapur: "SG", japon: "JP", canada: "CA", argentina: "AR", brasil: "BR",
        "estados unidos": "US", "ee uu": "US", eeuu: "US", usa: "US", "reino unido": "GB", "gran bretana": "GB", inglaterra: "GB", australia: "AU",
        china: "CN", portugal: "PT", "arabia saudita": "SA", "arabia saudi": "SA", barein: "BH", bahrein: "BH", bahrain: "BH", catar: "QA", qatar: "QA",
        "emiratos arabes unidos": "AE", emiratos: "AE", "abu dabi": "AE", "abu dhabi": "AE", malasia: "MY", malaysia: "MY",
    };
    const PLACES = {
        monza: "IT", imola: "IT", mugello: "IT", "las vegas": "US", miami: "US", austin: "US", "circuit of the americas": "US", silverstone: "GB",
        suzuka: "JP", interlagos: "BR", "sao paulo": "BR", montreal: "CA", "gilles villeneuve": "CA", "albert park": "AU", melbourne: "AU",
        "marina bay": "SG", spa: "BE", zandvoort: "NL", hungaroring: "HU", "red bull ring": "AT", spielberg: "AT", barcelona: "ES", madrid: "ES",
        montmelo: "ES", baku: "AZ", jeddah: "SA", yeda: "SA", sakhir: "BH", lusail: "QA", "yas marina": "AE", shanghai: "CN", "hermanos rodriguez": "MX",
        "ciudad de mexico": "MX", "paul ricard": "FR", portimao: "PT", hockenheim: "DE", nurburgring: "DE",
    };

    function countryCode(race) {
        const country = norm(race?.country);
        if (ALIASES[country]) return ALIASES[country];
        const text = norm(`${race?.name || ""} ${race?.circuit || ""} ${race?.country || ""}`);
        const alias = Object.keys(ALIASES).find((key) => text.includes(key));
        if (alias) return ALIASES[alias];
        const place = Object.keys(PLACES).find((key) => text.includes(key));
        return place ? PLACES[place] : null;
    }

    function raceFlag(race, size = "md") {
        const code = countryCode(race);
        const flag = code && FLAGS[code];
        if (!flag) {
            return `<span class="race-flag race-flag--${esc(size)} race-flag--icon" role="img" aria-label="Gran Premio"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i></span>`;
        }
        return `<span class="race-flag race-flag--${esc(size)}" title="${esc(flag.name)}"><svg viewBox="0 0 30 20" role="img" aria-label="Bandera de ${esc(flag.name)}" preserveAspectRatio="xMidYMid slice">${flag.svg()}</svg></span>`;
    }

    // Países disponibles en el panel de carreras: cada uno tiene bandera y sus zonas horarias.
    function countries() {
        return Object.entries(FLAGS).map(([code, flag]) => ({ code, name: flag.name, zones: flag.zones || [] }))
            .sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    window.PurpleMedia = { productImage, productFallback, productIcon, raceFlag, countryCode, countries };
})();
