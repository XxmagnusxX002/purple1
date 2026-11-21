/* Carrito: líneas de producto, resumen y pago simulado.
 * Todos los importes salen del backend (GET /api/cart?currency=XXX): promociones
 * vigentes y conversión a la moneda elegida con la tasa de MySQL. El pago envía
 * esa moneda y la tasa vista; si la tasa cambió, el backend no cobra.
 * Sin imagen real se muestra un icono neutro (js/media.js). */
document.addEventListener("DOMContentLoaded", () => {
    const panel = document.querySelector(".cart-items-panel");
    const summary = document.querySelector(".summary-card");
    const checkoutBtn = document.querySelector(".checkout-btn");
    const modal = document.querySelector("#payment-modal");
    const form = document.querySelector("#payment-form");
    const errorBox = document.querySelector("#pm-error");
    const submitBtn = document.querySelector("#pm-submit");
    const pmHolder = document.querySelector("#pm-holder");
    const pmNumber = document.querySelector("#pm-number");
    const pmExpiry = document.querySelector("#pm-expiry");
    const pmCvv = document.querySelector("#pm-cvv");

    let user = null;
    let notice = null; // aviso que se muestra sobre las líneas tras una acción
    let lastCart = null; // último carrito calculado por el backend (moneda y tasa incluidas)
    let rewardId = ""; // descuento canjeado con PitCoins; el backend recalcula todo con él
    const coins = (value) => `${Number(value).toLocaleString("es-CO")} PitCoins`;
    // Evita enviar dos pagos a la vez (doble clic o Enter repetido).
    let paying = false;

    const escapeHTML = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    // Importe ya convertido por el backend en la moneda del carrito.
    const money = (value) => window.Purple1Currency.formatLocal(value, lastCart.currency);
    const LOW_STOCK = 5;

    async function request(url, options = {}) {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Error de carrito.");
        return data;
    }

    function setNotice(text, tone = "info") {
        notice = text ? { text, tone } : null;
    }

    async function changeCart(url, options, action) {
        try {
            await request(url, options);
            setNotice(null);
        } catch (error) {
            setNotice(`No se pudo ${action}: ${error.message}`, "error");
        }
        await loadCart().catch((error) => setNotice(`No se pudo consultar el carrito: ${error.message}`, "error"));
    }

    function noticeMarkup() {
        if (!notice) return "";
        const icon = notice.tone === "ok" ? "fa-circle-check" : notice.tone === "error" ? "fa-circle-exclamation" : "fa-circle-info";
        return `<div class="cart-notice cart-notice--${notice.tone}" role="${notice.tone === "error" ? "alert" : "status"}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${escapeHTML(notice.text)}</span></div>`;
    }

    function lineMarkup(item) {
        const promo = Number(item.promo_percent) > 0;
        const variant = [item.size_name && `Talla ${item.size_name}`, item.color_name].filter(Boolean);
        const stock = Number(item.stock);
        return `<article class="cart-line surface-card" data-id="${item.id}">
            <a class="cart-line__media" href="product_detail.html?id=${item.product_id}" tabindex="-1" aria-hidden="true">
                ${window.PurpleMedia.productImage(item.image_path, item.product_type, item.product_name)}</a>
            <div class="cart-line__info">
                <a class="cart-line__name" href="product_detail.html?id=${item.product_id}">${escapeHTML(item.product_name)}</a>
                ${variant.length ? `<div class="cart-line__chips">${variant.map((text) => `<span>${escapeHTML(text)}</span>`).join("")}</div>` : ""}
                <p class="cart-line__unit">${money(item.unit_price_local)} c/u${promo ? ` <s>${money(item.list_price_local)}</s> <span class="cart-line__promo">−${Number(item.promo_percent)} %</span>` : ""}</p>
                ${stock <= LOW_STOCK ? `<p class="cart-line__stock">${stock === 1 ? "Queda 1 unidad" : `Quedan ${stock} unidades`}</p>` : ""}
            </div>
            <div class="cart-line__qty" role="group" aria-label="Cantidad de ${escapeHTML(item.product_name)}">
                <button type="button" data-step="-1" aria-label="Quitar una unidad" ${item.quantity <= 1 ? "disabled" : ""}><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
                <input class="cart-qty" type="number" min="1" max="${stock}" value="${item.quantity}" aria-label="Cantidad" inputmode="numeric">
                <button type="button" data-step="1" aria-label="Agregar una unidad" ${item.quantity >= stock ? "disabled" : ""}><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            </div>
            <div class="cart-line__total">
                <strong>${money(item.subtotal_local)}</strong>
                ${promo ? `<s>${money(Number(item.list_price_local) * item.quantity)}</s>` : ""}
            </div>
            <button class="cart-line__remove" type="button" data-remove title="Quitar del carrito" aria-label="Quitar ${escapeHTML(item.product_name)} del carrito"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
        </article>`;
    }

    // Cupones de fidelización: uno por pedido, solo sobre productos.
    // Canje de PitCoins por un descuento: uno por compra, solo sobre productos.
    function couponMarkup(cart) {
        if (!cart.rewards || !cart.rewards.length) return "";
        const options = cart.rewards.map((r) => `<option value="${r.id}" ${String(r.id) === rewardId ? "selected" : ""} ${r.affordable ? "" : "disabled"}>
            ${r.applied_percent} % por ${coins(r.pitcoin_cost)}${r.affordable ? "" : ` (te faltan ${Number(r.missing).toLocaleString("es-CO")})`}</option>`).join("");
        const chosen = cart.reward;
        const detail = chosen ? `<dl class="summary-redeem">
                <div><dt>PitCoins requeridos</dt><dd>${coins(chosen.pitcoin_cost)}</dd></div>
                <div><dt>Saldo después de la compra</dt><dd>${coins(cart.pitcoins_after)}</dd></div></dl>` : "";
        const applied = chosen
            ? `<div class="summary-line summary-line--saving"><span>Descuento PitCoins ${chosen.applied_percent} %</span><span>−${money(cart.discount_local)}</span></div>` : "";
        return `<label class="summary-coupon"><span><i class="fa-solid fa-coins" aria-hidden="true"></i> Canjear PitCoins · tienes ${coins(cart.pitcoins)}</span>
                <select id="coupon-select"><option value="">Sin descuento</option>${options}</select>
                <small>Un descuento por compra, máximo 20 %. No aplica al envío. Los PitCoins se descuentan solo si el pago se aprueba.</small>${detail}</label>${applied}`;
    }

    function renderSummary(cart) {
        const units = cart.items.reduce((sum, item) => sum + Number(item.quantity), 0);
        const savings = Number(cart.savings_local);
        const rate = cart.currency.code === "EUR" ? ""
            : `<p class="summary-rate">Pagas en ${cart.currency.code} · 1 EUR = ${Number(cart.currency.rate_per_eur).toLocaleString(cart.currency.locale, { maximumFractionDigits: 6 })} ${cart.currency.code}</p>`;
        summary.querySelector(".summary-lines").innerHTML = `
            <div class="summary-line"><span>Productos (${units} ${units === 1 ? "unidad" : "unidades"})</span><span>${money(savings > 0 ? cart.list_total_local : cart.total_local)}</span></div>
            ${savings > 0 ? `<div class="summary-line summary-line--saving"><span>Ahorro por promociones</span><span>−${money(savings)}</span></div>` : ""}
            ${couponMarkup(cart)}
            <div class="summary-line"><span>Envío</span><span class="summary-free">Gratis</span></div>`;
        summary.querySelector(".summary-total").innerHTML = `<span>Total</span><strong>${money(cart.total_local)}</strong>${rate}`;
        if (checkoutBtn) checkoutBtn.disabled = !cart.items.length;
    }

    async function loadCart() {
        const sessionResponse = await fetch("/api/auth/me");
        user = sessionResponse.ok ? (await sessionResponse.json()).user : null;
        if (!user) {
            panel.innerHTML = `<div class="cart-empty surface-card"><span class="cart-empty__icon"><i class="fa-regular fa-user" aria-hidden="true"></i></span>
                <h3>Inicia sesión</h3><p>Necesitas una cuenta para ver y guardar tu carrito.</p><a href="auth.html" class="btn-primary">Iniciar sesión</a></div>`;
            summary.querySelector(".summary-lines").innerHTML = "";
            summary.querySelector(".summary-total").innerHTML = "";
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }
        await window.Purple1Currency.ready;
        const query = `currency=${encodeURIComponent(window.Purple1Currency.getCurrentCode())}${rewardId ? `&reward=${encodeURIComponent(rewardId)}` : ""}`;
        const cart = (await request(`/api/cart?${query}`)).cart;
        if (rewardId && !cart.reward) rewardId = ""; // ya no alcanza el saldo o se desactivó
        lastCart = cart;
        const lines = cart.items.length
            ? cart.items.map(lineMarkup).join("")
            : `<div class="cart-empty surface-card"><span class="cart-empty__icon"><i class="fa-solid fa-cart-shopping" aria-hidden="true"></i></span>
                <h3>Tu carrito está vacío</h3><p>Agrega productos desde la tienda para verlos aquí.</p><a href="products.html" class="btn-primary">Ir a la tienda</a></div>`;
        panel.innerHTML = `${noticeMarkup()}
            <div class="shipping-banner"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i><p><strong>El envío no tiene costo.</strong> El total es el valor de tus productos.</p></div>
            ${lines}
            ${cart.items.length ? '<div class="continue-shopping"><a href="products.html"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Seguir comprando</a></div>' : ""}`;
        renderSummary(cart);
    }

    // Delegación: los elementos se recrean en cada carga, el listener es único.
    panel.addEventListener("click", (event) => {
        const line = event.target.closest(".cart-line");
        if (!line) return;
        const id = line.dataset.id;
        if (event.target.closest("[data-remove]")) {
            void changeCart("/api/cart/remove", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart_item_id: id }) }, "quitar el producto");
            return;
        }
        const step = event.target.closest("[data-step]");
        if (step) {
            const input = line.querySelector(".cart-qty");
            const quantity = Number(input.value) + Number(step.dataset.step);
            if (quantity < 1) return;
            void changeCart("/api/cart/update", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart_item_id: id, quantity }) }, "actualizar la cantidad");
        }
    });
    panel.addEventListener("change", (event) => {
        if (!event.target.matches(".cart-qty")) return;
        const id = event.target.closest(".cart-line").dataset.id;
        const quantity = Math.max(1, Math.floor(Number(event.target.value) || 1));
        void changeCart("/api/cart/update", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart_item_id: id, quantity }) }, "actualizar la cantidad");
    });

    /* ---------- Modal de pago: sus listeners se registran una sola vez ---------- */
    function openModal() {
        if (!modal || !form) return;
        errorBox.hidden = true;
        form.reset();
        form.querySelectorAll("input").forEach((el) => el.classList.remove("field-valid"));
        modal.hidden = false;
    }

    function closeModal() {
        if (paying || !modal) return;
        modal.hidden = true;
    }

    function markValid(input, isValid) {
        input.classList.toggle("field-valid", isValid);
    }

    modal?.querySelectorAll("[data-close-modal]").forEach((el) => el.addEventListener("click", closeModal));

    pmNumber?.addEventListener("input", (event) => {
        event.target.value = event.target.value.replace(/[^\d]/g, "").replace(/(.{4})/g, "$1 ").trim().slice(0, 19);
        markValid(pmNumber, pmNumber.value.replace(/\D/g, "").length >= 13);
    });
    pmExpiry?.addEventListener("input", (event) => {
        event.target.value = event.target.value.replace(/[^\d]/g, "").replace(/(\d{2})(\d{0,2})/, (m, a, b) => (b ? `${a}/${b}` : a)).slice(0, 5);
        const match = /^(\d{2})\/(\d{2})$/.exec(pmExpiry.value);
        markValid(pmExpiry, Boolean(match && Number(match[1]) >= 1 && Number(match[1]) <= 12));
    });
    pmHolder?.addEventListener("input", () => markValid(pmHolder, pmHolder.value.trim().length >= 3));
    pmCvv?.addEventListener("input", () => markValid(pmCvv, /^\d{3,4}$/.test(pmCvv.value)));

    checkoutBtn?.addEventListener("click", () => {
        if (!user) {
            window.location.href = "auth.html";
            return;
        }
        openModal();
    });

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (paying || !user) return;
        paying = true;
        errorBox.hidden = true;
        submitBtn.disabled = true;
        submitBtn.textContent = "Procesando...";
        try {
            const result = await request("/api/payments/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shipping_address: user.address || "",
                    card_holder: pmHolder.value,
                    card_number: pmNumber.value,
                    card_expiry: pmExpiry.value,
                    card_cvv: pmCvv.value,
                    // Moneda y tasa que el cliente está viendo: el backend las vuelve a validar.
                    currency_code: lastCart?.currency.code,
                    quoted_rate: lastCart?.currency.rate_per_eur,
                    // Descuento y costo que el cliente ve: el backend los vuelve a validar.
                    reward_id: lastCart?.reward ? lastCart.reward.id : null,
                    reward_cost: lastCart?.reward ? lastCart.reward.pitcoin_cost : null,
                }),
            });
            if (!result.approved) {
                // El pago rechazado no crea pedido: se queda en el formulario para corregir.
                errorBox.textContent = `Pago rechazado (simulado): ${result.reason || "revisa los datos de la tarjeta."}`;
                errorBox.hidden = false;
                return;
            }
            paying = false;
            closeModal();
            const redeemed = Number(result.order.pitcoins_redeemed || 0);
            rewardId = "";
            setNotice(`Pago aprobado (simulado): ${window.Purple1Currency.formatLocal(result.order.total_local, lastCart.currency)} con ${result.card_brand} terminada en ${result.card_last4}. Pedido #${result.order.id} confirmado; puedes verlo en «Mis pedidos».${redeemed ? ` Canjeaste ${coins(redeemed)}; tu saldo es de ${coins(result.pitcoins_balance)}.` : ""}`, "ok");
            if (redeemed) window.dispatchEvent(new CustomEvent("purple1:coinschange"));
            loadCart().catch(() => {});
        } catch (error) {
            errorBox.textContent = error.message;
            errorBox.hidden = false;
            // Si la tasa cambió, se recalcula el carrito para mostrar el total vigente.
            if (/tasa de cambio|descuento|PitCoins/i.test(error.message)) loadCart().catch(() => {});
        } finally {
            paying = false;
            submitBtn.disabled = false;
            submitBtn.textContent = "Pagar";
        }
    });

    loadCart().catch((error) => {
        panel.innerHTML = `<div class="cart-empty surface-card" role="alert"><span class="cart-empty__icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></span>
            <h3>No pudimos cargar tu carrito</h3><p>${escapeHTML(error.message)}</p><button type="button" class="btn-primary" onclick="location.reload()">Reintentar</button></div>`;
    });

    window.addEventListener(window.Purple1Currency.EVENT_NAME, () => loadCart().catch(() => {}));
    summary.addEventListener("change", (event) => {
        if (event.target.id !== "coupon-select") return;
        rewardId = event.target.value;
        loadCart().catch((error) => setNotice(`No se pudo aplicar el descuento: ${error.message}`, "error"));
    });
});
