-- =====================================================================
-- Purple One - Esquema completo para una instalacion NUEVA (MySQL 8.0.16+)
--
-- Ejecutar en MySQL Workbench sobre un servidor sin la base `purple1`,
-- y despues ejecutar seed.sql.
-- No borra nada: si las tablas ya existen, MySQL se detiene con un error.
-- Para actualizar una base `purple1` existente usa los scripts upgrade*.sql (ver README).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS purple1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE purple1;

-- ---------------------------------------------------------------------
-- Usuarios, sesiones y seguridad
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(10),
    address VARCHAR(200),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,      -- administrador del panel
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE, -- ademas: roles, PitCoins, monedas, configuracion y auditoria
    coins INT NOT NULL DEFAULT 1000,          -- saldo de PitCoins (cache de pitcoin_movements)
    xp_total INT NOT NULL DEFAULT 0,          -- experiencia acumulada (cache de xp_events)
    avatar_config TEXT NULL,                  -- prendas puestas del avatar (JSON)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_xp_rank (is_active, xp_total),
    CONSTRAINT chk_users_superadmin_is_staff CHECK (is_superadmin = FALSE OR is_staff = TRUE),
    CONSTRAINT chk_users_coins_nonnegative CHECK (coins >= 0),
    CONSTRAINT chk_users_xp_nonnegative CHECK (xp_total >= 0)
);

CREATE TABLE auth_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_auth_sessions_expiry (expires_at)
);

CREATE TABLE password_reset_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_reset_expiry (expires_at)
);

CREATE TABLE auth_login_attempts (
    identifier_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    failures INT NOT NULL DEFAULT 0,
    blocked_until DATETIME NULL
);

-- ---------------------------------------------------------------------
-- Catalogo de la tienda
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    parent_id INT NULL,
    description VARCHAR(200),
    image_path VARCHAR(255) NULL,            -- ilustracion de la categoria en la portada (opcional)
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(200),
    logo_path VARCHAR(255),
    country VARCHAR(100) NULL,
    primary_color CHAR(7) NULL,
    secondary_color CHAR(7) NULL,
    image_path VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_teams_primary_color CHECK (primary_color IS NULL OR primary_color REGEXP '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT chk_teams_secondary_color CHECK (secondary_color IS NULL OR secondary_color REGEXP '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE product_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    uses_size BOOLEAN NOT NULL DEFAULT FALSE,
    uses_color BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_type_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    promo_percent TINYINT UNSIGNED NULL,     -- promocion real: % de descuento (NULL = sin promocion)
    promo_starts_at DATETIME NULL,           -- vigencia en UTC (NULL = sin limite)
    promo_ends_at DATETIME NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_products_active (is_active),
    FULLTEXT INDEX ft_products_search (name, description),
    CONSTRAINT chk_products_promo_percent CHECK (promo_percent IS NULL OR promo_percent BETWEEN 1 AND 90),
    CONSTRAINT chk_products_promo_period CHECK (promo_starts_at IS NULL OR promo_ends_at IS NULL OR promo_starts_at < promo_ends_at)
);

-- Caracteristicas (FEATURE: vinetas) y especificaciones (SPEC: etiqueta-valor) de cada producto.
CREATE TABLE product_specs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    kind ENUM('FEATURE','SPEC') NOT NULL,
    label VARCHAR(80) NULL,
    value VARCHAR(255) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_specs_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_product_specs_label CHECK (kind = 'FEATURE' OR (label IS NOT NULL AND label <> '')),
    INDEX idx_product_specs_product (product_id, kind, display_order)
);

-- Etiquetas sugeridas por tipo de producto (solo sugerencias, no campos obligatorios).
CREATE TABLE product_type_spec_templates (
    product_type_id INT NOT NULL,
    label VARCHAR(80) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_type_id, label),
    CONSTRAINT fk_spec_templates_type FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON DELETE CASCADE
);

CREATE TABLE product_categories (
    product_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE product_teams (
    product_id INT NOT NULL,
    team_id INT NOT NULL,
    PRIMARY KEY (product_id, team_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    alt_text VARCHAR(150),
    display_order INT NOT NULL DEFAULT 1,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_product_images_main (product_id, is_main)
);

CREATE TABLE sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    visual_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    hex_code VARCHAR(7),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_colors_hex CHECK (hex_code IS NULL OR hex_code REGEXP '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    sku VARCHAR(60) NOT NULL UNIQUE,
    size_id INT NULL,
    color_id INT NULL,
    price_override DECIMAL(10,2) NULL,
    stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_inventory_product (product_id),
    INDEX idx_inventory_stock (is_active, stock),
    CONSTRAINT chk_inventory_stock CHECK (stock >= 0)
);

-- ---------------------------------------------------------------------
-- Carrito, pedidos y pagos (pago simulado)
-- ---------------------------------------------------------------------
CREATE TABLE carts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status ENUM('ACTIVE','CLOSED','ABANDONED') NOT NULL DEFAULT 'ACTIVE',
    -- Solo un carrito ACTIVE por usuario: columna calculada con indice unico.
    active_user_id INT GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN user_id ELSE NULL END) STORED,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- RESTRICT (no CASCADE): MySQL lo exige por la columna calculada active_user_id.
    -- Los usuarios nunca se borran, solo se desactivan.
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    INDEX idx_carts_user_status (user_id, status),
    UNIQUE INDEX uq_one_active_cart_per_user (active_user_id)
);

CREATE TABLE cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_cart_inventory (cart_id, inventory_id),
    CONSTRAINT chk_cart_quantity CHECK (quantity > 0)
);

-- Monedas: los precios estan en EUR (base); rate_per_eur = unidades por 1 EUR.
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
    CONSTRAINT chk_currency_base CHECK (code <> 'EUR' OR (rate_per_eur = 1 AND is_active = TRUE)),
    CONSTRAINT fk_currency_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Descuentos que el cliente canjea con PitCoins en el carrito (uno por pedido).
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

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status ENUM('PENDING','PAID','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    -- Moneda elegida por el cliente, tasa del momento e importes finales en esa moneda.
    currency_code CHAR(3) NOT NULL DEFAULT 'EUR',
    exchange_rate DECIMAL(16,6) NOT NULL DEFAULT 1.000000,
    subtotal_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    discount_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    shipping_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    total_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    -- Descuento canjeado con PitCoins (0 si no hubo) y PitCoins descontados.
    discount_reward_id INT NULL,
    discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
    pitcoins_redeemed INT NOT NULL DEFAULT 0,
    shipping_address VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orders_currency FOREIGN KEY (currency_code) REFERENCES currencies(code) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_orders_rate CHECK (exchange_rate > 0),
    CONSTRAINT fk_orders_discount_reward FOREIGN KEY (discount_reward_id) REFERENCES discount_rewards(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_orders_discount_percent CHECK (discount_percent BETWEEN 0 AND 20),
    CONSTRAINT chk_orders_pitcoins_redeemed CHECK (pitcoins_redeemed >= 0),
    INDEX idx_orders_user (user_id)
);

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    inventory_id INT NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    size_name VARCHAR(20),
    color_name VARCHAR(50),
    unit_price DECIMAL(10,2) NOT NULL,
    unit_price_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    quantity INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    subtotal_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    method ENUM('CARD','PSE','NEQUI','DAVIPLATA','TRANSFER') NOT NULL,
    status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    amount DECIMAL(10,2) NOT NULL,                 -- en EUR (informes)
    currency_code CHAR(3) NOT NULL DEFAULT 'EUR',  -- moneda en la que pago el cliente
    amount_local DECIMAL(16,2) NOT NULL DEFAULT 0.00,
    reference VARCHAR(100),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_payments_currency FOREIGN KEY (currency_code) REFERENCES currencies(code) ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_payments_order (order_id)
);

-- ---------------------------------------------------------------------
-- Pronosticos de carreras con PitCoins (sin dinero real)
-- ---------------------------------------------------------------------
-- Fidelizacion y configuracion (Fase 6)
CREATE TABLE app_settings (
    setting_key VARCHAR(40) PRIMARY KEY,
    int_value INT NOT NULL,
    updated_by INT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    -- Limite absoluto: ningun descuento supera el 20 %.
    CONSTRAINT chk_settings_discount_max CHECK (setting_key <> 'discounts.max_percent' OR int_value BETWEEN 1 AND 20),
    CONSTRAINT chk_settings_nonnegative CHECK (int_value >= 0)
);



CREATE TABLE drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    number TINYINT UNSIGNED NULL,
    nationality VARCHAR(100) NULL,
    team_id INT NULL,
    image_path VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Dos pilotos activos no pueden tener el mismo numero.
    active_number TINYINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN is_active THEN number ELSE NULL END) STORED,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_drivers_name UNIQUE (name),
    CONSTRAINT uq_drivers_active_number UNIQUE (active_number),
    CONSTRAINT fk_drivers_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
    CONSTRAINT chk_drivers_number CHECK (number IS NULL OR number BETWEEN 1 AND 99),
    INDEX idx_drivers_team (team_id, is_active)
);

CREATE TABLE races (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    circuit VARCHAR(150) NOT NULL,
    country VARCHAR(100),
    race_date DATETIME NOT NULL,
    race_date_utc DATETIME NULL,            -- hora de salida en UTC (cierra los pronosticos)
    circuit_timezone VARCHAR(64) NULL,      -- zona IANA del circuito, p. ej. Europe/Rome
    image_path VARCHAR(255),
    status ENUM('SCHEDULED','OPEN','LOCKED','FINISHED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    winner_option_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_races_utc_status (status, race_date_utc),
    CONSTRAINT chk_race_utc_timezone_pair
        CHECK ((race_date_utc IS NULL AND circuit_timezone IS NULL)
            OR (race_date_utc IS NOT NULL AND circuit_timezone IS NOT NULL))
);

CREATE TABLE race_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    race_id INT NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    team_id INT NULL,
    image_path VARCHAR(255),
    driver_id INT NULL,
    finish_position TINYINT UNSIGNED NULL,   -- posicion oficial (NULL = no clasificado)
    finish_order TINYINT UNSIGNED NULL,      -- orden en la clasificacion oficial
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_race_options_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_race_option (race_id, id),
    CONSTRAINT uq_race_option_driver UNIQUE (race_id, driver_id)
);

CREATE TABLE bets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    race_id INT NOT NULL,
    option_id INT NOT NULL,
    amount INT NOT NULL,
    status ENUM('PENDING','WON','LOST','REFUNDED') NOT NULL DEFAULT 'PENDING',
    payout INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (option_id) REFERENCES race_options(id) ON DELETE CASCADE ON UPDATE CASCADE,
    -- La opcion elegida debe pertenecer a la misma carrera.
    CONSTRAINT fk_bets_option_same_race FOREIGN KEY (race_id, option_id) REFERENCES race_options(race_id, id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_race (user_id, race_id),
    INDEX idx_bets_race (race_id)
);

-- ---------------------------------------------------------------------
-- PitCoins, experiencia (XP) y avatar
-- ---------------------------------------------------------------------
-- Historial de cada cambio de saldo. users.coins debe ser igual a la suma.
CREATE TABLE pitcoin_movements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    kind ENUM('OPENING_BALANCE','BET_STAKE','BET_ADJUSTMENT','BET_PRIZE','BET_REFUND',
              'AVATAR_PURCHASE','STAFF_ADJUSTMENT','LEVEL_REWARD','DISCOUNT_REDEMPTION') NOT NULL,
    reference VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    actor_user_id INT NULL,
    reason VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_pitcoin_user_time (user_id, created_at),
    CONSTRAINT chk_pitcoin_amount CHECK (amount <> 0 OR kind = 'OPENING_BALANCE'),
    CONSTRAINT chk_pitcoin_balance CHECK (balance_after >= 0)
);

-- Historial de experiencia. El nivel se calcula desde users.xp_total.
CREATE TABLE xp_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bet_id INT NOT NULL,
    amount INT NOT NULL,
    xp_after INT NOT NULL,
    kind ENUM('RACE_PARTICIPATION','RACE_CORRECT','FIRST_SETTLED_PREDICTION') NOT NULL,
    reference VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_xp_reference UNIQUE (reference),
    CONSTRAINT fk_xp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_xp_bet FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE RESTRICT,
    CONSTRAINT chk_xp_amount CHECK (amount > 0),
    CONSTRAINT chk_xp_after CHECK (xp_after >= 0),
    INDEX idx_xp_user_time (user_id, created_at)
);

-- Prendas del avatar compradas con PitCoins (el catalogo esta en backend/avatar.py).
CREATE TABLE user_avatar_items (
    user_id INT NOT NULL,
    item_id VARCHAR(60) NOT NULL,
    acquired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ---------------------------------------------------------------------
-- Panel administrativo
-- ---------------------------------------------------------------------
CREATE TABLE admin_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id INT NOT NULL,
    action VARCHAR(60) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    entity VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    entity_id VARCHAR(64) NULL,
    details TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_audit_time (created_at),
    INDEX idx_audit_entity (entity, entity_id)
);

CREATE TABLE banners (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    image_path VARCHAR(255) NOT NULL,
    link_url VARCHAR(500) NULL,
    display_order INT NOT NULL DEFAULT 0,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_banner_period CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
    INDEX idx_banners_public (is_active, display_order, starts_at, ends_at)
);
