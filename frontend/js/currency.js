/* Selector de moneda de Purple One.
 *
 * Los precios se guardan en EUR (moneda base). Las monedas y sus tasas vienen de
 * MySQL por GET /api/currencies: aquí no hay tasas escritas en el código.
 * - formatMoney(eur): precio de catálogo convertido a la moneda elegida, con la
 *   misma regla que el backend (redondeo a los decimales de la moneda).
 * - formatLocal(importe, moneda): importe que YA calculó el backend en esa moneda
 *   (carrito, checkout, historial de pedidos). Así lo que se cobra es lo que se ve.
 * Hasta que llegan las tasas se muestra EUR (el valor real, sin conversión).
 */
(function () {
    "use strict";

    const STORAGE_KEY = "purple1_currency";
    const CACHE_KEY = "purple1_currencies"; // tasas de la ultima visita (se actualizan siempre con la API)
    const EVENT_NAME = "purple1:currencychange";
    const DEFAULT_CODE = "COP";
    const BASE = { code: "EUR", name: "Euro", symbol: "€", locale: "es-ES", decimals: 2, rate_per_eur: 1 };

    let currencies = [];

    function read(key, storage = localStorage) {
        try { return storage.getItem(key); } catch (error) { return null; }
    }

    function write(key, value, storage = localStorage) {
        try { storage.setItem(key, value); } catch (error) { /* sin almacenamiento: solo esta página */ }
    }

    try {
        currencies = JSON.parse(read(CACHE_KEY) || "[]");
    } catch (error) {
        currencies = [];
    }

    function find(code) {
        return currencies.find((currency) => currency.code === code) || null;
    }

    function current() {
        return find(read(STORAGE_KEY)) || find(DEFAULT_CODE) || find("EUR") || BASE;
    }

    function getCurrentCode() {
        return current().code;
    }

    function setCurrentCode(code) {
        if (!find(code)) return;
        write(STORAGE_KEY, code);
        window.dispatchEvent(new CustomEvent(EVENT_NAME));
    }

    function formatLocal(amount, currency = current()) {
        const decimals = Number(currency.decimals);
        const text = Number(amount || 0).toLocaleString(currency.locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        return `${currency.symbol} ${text}`;
    }

    function toLocal(eurValue, currency = current()) {
        const factor = 10 ** Number(currency.decimals);
        return Math.round(Number(eurValue || 0) * Number(currency.rate_per_eur) * factor + Number.EPSILON) / factor;
    }

    function formatMoney(eurValue) {
        const currency = current();
        return formatLocal(toLocal(eurValue, currency), currency);
    }

    function applyStaticPrices(root) {
        (root || document).querySelectorAll("[data-price-eur]").forEach((el) => {
            el.textContent = formatMoney(el.dataset.priceEur);
        });
    }

    // El selector existe desde el primer momento (con su tamaño final). Mientras
    // llegan las tasas muestra la moneda guardada como estado de carga.
    function renderSwitcher() {
        const icons = document.querySelector(".nav-icons");
        if (!icons) return;
        let select = icons.querySelector(".currency-switcher");
        if (!select) {
            select = document.createElement("select");
            select.className = "currency-switcher";
            select.title = "Cambiar moneda";
            select.setAttribute("aria-label", "Moneda");
            select.addEventListener("change", () => setCurrentCode(select.value));
            icons.insertBefore(select, icons.firstChild);
        }
        if (!currencies.length) {
            const code = read(STORAGE_KEY) || DEFAULT_CODE;
            select.innerHTML = `<option value="${code}">${code}</option>`;
            select.setAttribute("aria-busy", "true");
            select.disabled = true;
            return;
        }
        select.removeAttribute("aria-busy");
        select.disabled = false;
        select.innerHTML = currencies.map((currency) => `<option value="${currency.code}">${currency.code} · ${currency.name}</option>`).join("");
        select.value = getCurrentCode();
    }

    async function load() {
        try {
            const response = await fetch("/api/currencies", { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok || !data.success) return;
            const changed = JSON.stringify(data.currencies) !== JSON.stringify(currencies);
            currencies = data.currencies;
            write(CACHE_KEY, JSON.stringify(currencies));
            renderSwitcher();
            if (changed) window.dispatchEvent(new CustomEvent(EVENT_NAME));
        } catch (error) {
            /* Sin conexión: se mantienen las tasas de la sesión o EUR. */
        }
    }

    renderSwitcher(); // los scripts van al final del <body>: la barra ya existe
    document.addEventListener("DOMContentLoaded", () => {
        renderSwitcher();
        applyStaticPrices();
    });
    window.addEventListener(EVENT_NAME, () => {
        applyStaticPrices();
        const select = document.querySelector(".currency-switcher");
        if (select) select.value = getCurrentCode();
    });
    const ready = load();

    window.Purple1Currency = { getCurrentCode, setCurrentCode, current, formatMoney, formatLocal, toLocal, applyStaticPrices, ready, EVENT_NAME };
})();
