-- =====================================================================
-- Purple One - Actualizacion 05: multimoneda
--
-- Ejecutar UNA vez sobre una base que ya tenga upgrade_04_home.sql.
-- (Una instalacion nueva con schema.sql + seed.sql ya lo incluye.)
-- No borra datos. Los precios siguen en EUR (moneda base). Agrega:
--   * Tabla currencies: monedas y tasas (unidades por 1 EUR), editables por el
--     superadministrador desde el panel.
--   * Moneda, tasa e importes en esa moneda en cada pedido, linea y pago.
-- Los pedidos existentes quedan en EUR con tasa 1 (es lo que se cobro).
-- =====================================================================

USE purple1;

CREATE TABLE currencies (
    code CHAR(3) NOT NULL PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    symbol VARCHAR(8) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    decimals TINYINT UNSIGNED NOT NULL DEFAULT 2,
    rate_per_eur DECIMAL(16,6) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    updated_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_currency_code CHECK (code REGEXP '^[A-Z]{3}$'),
    CONSTRAINT chk_currency_rate CHECK (rate_per_eur > 0),
    CONSTRAINT chk_currency_decimals CHECK (decimals <= 4),
    -- EUR es la moneda base: siempre activa y con tasa 1.
    CONSTRAINT chk_currency_base CHECK (code <> 'EUR' OR (rate_per_eur = 1 AND is_active = TRUE)),
    CONSTRAINT fk_currency_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tasas de referencia iniciales (aproximadas, no en tiempo real): se ajustan
-- a mano desde el panel del superadministrador.
INSERT INTO currencies (code, name, symbol, locale, decimals, rate_per_eur, display_order) VALUES
('EUR', 'Euro', '€', 'es-ES', 2, 1.000000, 1),
('USD', 'Dólar estadounidense', 'US$', 'en-US', 2, 1.080000, 2),
('COP', 'Peso colombiano', '$', 'es-CO', 0, 4400.000000, 3),
('MXN', 'Peso mexicano', 'MX$', 'es-MX', 2, 21.500000, 4),
('ARS', 'Peso argentino', 'AR$', 'es-AR', 0, 1450.000000, 5),
('CLP', 'Peso chileno', 'CL$', 'es-CL', 0, 1050.000000, 6),
('PEN', 'Sol peruano', 'S/', 'es-PE', 2, 4.100000, 7),
('BRL', 'Real brasileño', 'R$', 'pt-BR', 2, 6.200000, 8),
('UYU', 'Peso uruguayo', '$U', 'es-UY', 2, 46.500000, 9),
('PYG', 'Guaraní paraguayo', '₲', 'es-PY', 0, 8600.000000, 10),
('BOB', 'Boliviano', 'Bs', 'es-BO', 2, 7.450000, 11);

-- Pedido: moneda, tasa usada e importes finales en esa moneda.
ALTER TABLE orders
    ADD COLUMN currency_code CHAR(3) NOT NULL DEFAULT 'EUR' AFTER total,
    ADD COLUMN exchange_rate DECIMAL(16,6) NOT NULL DEFAULT 1.000000 AFTER currency_code,
    ADD COLUMN subtotal_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER exchange_rate,
    ADD COLUMN discount_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER subtotal_local,
    ADD COLUMN shipping_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER discount_local,
    ADD COLUMN total_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER shipping_local,
    ADD CONSTRAINT fk_orders_currency FOREIGN KEY (currency_code) REFERENCES currencies(code) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT chk_orders_rate CHECK (exchange_rate > 0);

ALTER TABLE order_items
    ADD COLUMN unit_price_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER unit_price,
    ADD COLUMN subtotal_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER subtotal;

ALTER TABLE payments
    ADD COLUMN currency_code CHAR(3) NOT NULL DEFAULT 'EUR' AFTER amount,
    ADD COLUMN amount_local DECIMAL(16,2) NOT NULL DEFAULT 0.00 AFTER currency_code,
    ADD CONSTRAINT fk_payments_currency FOREIGN KEY (currency_code) REFERENCES currencies(code) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pedidos, lineas y pagos anteriores: se cobraron en EUR.
UPDATE orders SET subtotal_local = subtotal, discount_local = discount, shipping_local = shipping_cost, total_local = total
WHERE currency_code = 'EUR';
UPDATE order_items SET unit_price_local = unit_price, subtotal_local = subtotal;
UPDATE payments SET amount_local = amount WHERE currency_code = 'EUR';
