-- =====================================================================
-- Purple One - Actualizacion 06: fidelizacion y configuracion
--
-- Ejecutar UNA vez sobre una base que ya tenga upgrade_05_monedas.sql.
-- (Una instalacion nueva con schema.sql + seed.sql ya lo incluye.)
-- No borra ni modifica datos existentes. Agrega:
--   * app_settings: parametros que el superadministrador ajusta en
--     Configuracion (saldo inicial de PitCoins, pronostico minimo, XP por
--     pronostico y descuento maximo de los cupones).
--   * reward_rules: objetivos de compra que entregan un cupon.
--   * customer_coupons: cupones de cada cliente (obtenido / usado). Un cupon
--     por objetivo y usuario; se usa en un solo pedido (used_order_id unico).
-- Los cupones nunca dependen de PitCoins, XP ni pronosticos: solo de
-- compras con pago aprobado, sumadas en EUR (moneda base).
-- Los clientes con compras anteriores reciben sus cupones en su proxima
-- compra aprobada (el historial se evalua completo en ese momento).
-- =====================================================================

USE purple1;

CREATE TABLE app_settings (
    setting_key VARCHAR(40) PRIMARY KEY,
    int_value INT NOT NULL,
    updated_by INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    -- Limite absoluto: ningun cupon supera el 20 %.
    CONSTRAINT chk_settings_coupon_max CHECK (setting_key <> 'coupons.max_percent' OR int_value BETWEEN 1 AND 20),
    CONSTRAINT chk_settings_nonnegative CHECK (int_value >= 0)
);

INSERT INTO app_settings (setting_key, int_value) VALUES
    ('pitcoins.opening_balance', 1000),
    ('pitcoins.min_bet', 10),
    ('xp.participation', 20),
    ('xp.correct', 50),
    ('xp.first_settled', 30),
    ('coupons.max_percent', 20);

CREATE TABLE reward_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    goal_type ENUM('ORDERS_COUNT','SPENT_EUR') NOT NULL,
    threshold DECIMAL(10,2) NOT NULL,
    percent TINYINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    updated_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_reward_rules_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uq_reward_rules_goal UNIQUE (goal_type, threshold),
    CONSTRAINT chk_reward_rules_percent CHECK (percent BETWEEN 1 AND 20),
    CONSTRAINT chk_reward_rules_threshold CHECK (threshold > 0)
);

INSERT INTO reward_rules (name, goal_type, threshold, percent, display_order) VALUES
    ('Primera compra', 'ORDERS_COUNT', 1, 5, 1),
    ('Tres compras', 'ORDERS_COUNT', 3, 10, 2),
    ('150 EUR en compras', 'SPENT_EUR', 150, 15, 3),
    ('300 EUR en compras', 'SPENT_EUR', 300, 20, 4);

CREATE TABLE customer_coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    rule_id INT NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    percent TINYINT UNSIGNED NOT NULL,            -- porcentaje al obtenerlo
    status ENUM('AVAILABLE','USED') NOT NULL DEFAULT 'AVAILABLE',
    earned_order_id INT NULL,                     -- compra que lo desbloqueo
    used_order_id INT NULL UNIQUE,                -- pedido en que se uso (uno solo)
    earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME NULL,
    CONSTRAINT fk_coupons_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_coupons_rule FOREIGN KEY (rule_id) REFERENCES reward_rules(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_coupons_earned_order FOREIGN KEY (earned_order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_coupons_used_order FOREIGN KEY (used_order_id) REFERENCES orders(id),
    -- Cada objetivo entrega su cupon una sola vez por usuario.
    CONSTRAINT uq_coupons_user_rule UNIQUE (user_id, rule_id),
    CONSTRAINT chk_coupons_percent CHECK (percent BETWEEN 1 AND 20),
    CONSTRAINT chk_coupons_used CHECK ((status = 'USED') = (used_order_id IS NOT NULL)),
    INDEX idx_coupons_user_status (user_id, status)
);
