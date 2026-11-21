-- =====================================================================
-- Purple One - Actualizacion 08: economia definitiva (canje de PitCoins)
--
-- Ejecutar UNA vez sobre una base que ya tenga upgrade_07_f1_2026.sql.
-- (Una instalacion nueva con schema.sql + seed.sql ya lo incluye.)
--
-- Sustituye los cupones por objetivos de compra (Fase 6, primera version)
-- por descuentos que el cliente canjea con PitCoins directamente en el
-- carrito. Proyecto academico: pagos y pronosticos son simulados; los
-- PitCoins no se compran, no se retiran, no se transfieren ni se convierten
-- en dinero.
--   * discount_rewards: descuentos canjeables (porcentaje y costo en PitCoins),
--     editables por el superadministrador en Configuracion.
--   * orders: recompensa usada, porcentaje y PitCoins descontados.
--   * pitcoin_movements: nuevo tipo DISCOUNT_REDEMPTION.
--   * app_settings: 'coupons.max_percent' pasa a 'discounts.max_percent'
--     (limite absoluto 20 %).
-- Elimina reward_rules y customer_coupons: en la base principal estaban
-- vacias de cupones (comprobado antes de escribir este script).
-- =====================================================================

USE purple1;

DROP TABLE customer_coupons;
DROP TABLE reward_rules;

CREATE TABLE discount_rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    percent TINYINT UNSIGNED NOT NULL,
    pitcoin_cost INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    updated_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_discount_rewards_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uq_discount_rewards_percent UNIQUE (percent),
    CONSTRAINT chk_discount_rewards_percent CHECK (percent BETWEEN 1 AND 20),
    CONSTRAINT chk_discount_rewards_cost CHECK (pitcoin_cost BETWEEN 1 AND 1000000)
);

INSERT INTO discount_rewards (name, percent, pitcoin_cost, display_order) VALUES
    ('Descuento del 5 %', 5, 500, 1),
    ('Descuento del 10 %', 10, 1000, 2),
    ('Descuento del 15 %', 15, 2000, 3),
    ('Descuento del 20 %', 20, 3500, 4);

ALTER TABLE orders
    ADD COLUMN discount_reward_id INT NULL AFTER total_local,
    ADD COLUMN discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER discount_reward_id,
    ADD COLUMN pitcoins_redeemed INT NOT NULL DEFAULT 0 AFTER discount_percent,
    ADD CONSTRAINT fk_orders_discount_reward FOREIGN KEY (discount_reward_id) REFERENCES discount_rewards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT chk_orders_discount_percent CHECK (discount_percent BETWEEN 0 AND 20),
    ADD CONSTRAINT chk_orders_pitcoins_redeemed CHECK (pitcoins_redeemed >= 0);

ALTER TABLE pitcoin_movements
    MODIFY kind ENUM('OPENING_BALANCE','BET_STAKE','BET_ADJUSTMENT','BET_PRIZE','BET_REFUND',
                     'AVATAR_PURCHASE','STAFF_ADJUSTMENT','LEVEL_REWARD','DISCOUNT_REDEMPTION') NOT NULL;

ALTER TABLE app_settings DROP CHECK chk_settings_coupon_max;
UPDATE app_settings SET setting_key = 'discounts.max_percent' WHERE setting_key = 'coupons.max_percent';
INSERT IGNORE INTO app_settings (setting_key, int_value) VALUES ('discounts.max_percent', 20);
ALTER TABLE app_settings ADD CONSTRAINT chk_settings_discount_max CHECK (setting_key <> 'discounts.max_percent' OR int_value BETWEEN 1 AND 20);
