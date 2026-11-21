-- =====================================================================
-- Purple One - Actualizacion de una base `purple1` EXISTENTE (version anterior)
--
-- Usalo SOLO si ya tenias la base de la version anterior del proyecto.
-- Para una instalacion nueva usa schema.sql + seed.sql (no este archivo).
--
-- Antes de ejecutarlo:
--   1. Deten el servidor (python main.py).
--   2. Haz un respaldo: MySQL Workbench > Server > Data Export.
--   3. Ejecuta las consultas de comprobacion; todas deben devolver 0.
-- Ejecuta el archivo UNA sola vez. No borra tablas ni datos existentes.
-- Requiere MySQL 8.0.16 o superior.
-- =====================================================================

USE purple1;

-- Comprobacion previa (cada consulta debe devolver 0):
-- SELECT COUNT(*) FROM users WHERE coins < 0;
-- SELECT COUNT(*) FROM inventory WHERE stock < 0;
-- SELECT COUNT(*) FROM cart_items WHERE quantity <= 0;
-- SELECT COUNT(*) FROM bets b JOIN race_options o ON o.id = b.option_id WHERE b.race_id <> o.race_id;
-- SELECT COUNT(*) FROM (SELECT user_id FROM carts WHERE status = 'ACTIVE' GROUP BY user_id HAVING COUNT(*) > 1) x;
-- SELECT COUNT(*) FROM (SELECT race_id FROM race_options GROUP BY race_id, TRIM(driver_name) HAVING COUNT(*) > 1) x;

-- ---------------------------------------------------------------------
-- 001_auth.sql: Sesiones seguras, recuperacion de contrasena y bloqueo de intentos de login
-- ---------------------------------------------------------------------
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
-- 002_pitcoins.sql: Historial de PitCoins (saldo inicial de cada usuario existente)
-- ---------------------------------------------------------------------
CREATE TABLE pitcoin_movements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    kind ENUM('OPENING_BALANCE','BET_STAKE','BET_ADJUSTMENT','BET_PRIZE','BET_REFUND','AVATAR_PURCHASE','STAFF_ADJUSTMENT') NOT NULL,
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

INSERT INTO pitcoin_movements (user_id, amount, balance_after, kind, reference)
SELECT id, coins, coins, 'OPENING_BALANCE', CONCAT('opening:', id)
FROM users;

ALTER TABLE users ADD CONSTRAINT chk_users_coins_nonnegative CHECK (coins >= 0);

-- ---------------------------------------------------------------------
-- 003_race_utc.sql: Hora UTC y zona horaria de las carreras
-- ---------------------------------------------------------------------
ALTER TABLE races ADD COLUMN race_date_utc DATETIME NULL;
ALTER TABLE races ADD COLUMN circuit_timezone VARCHAR(64) NULL;

ALTER TABLE races ADD CONSTRAINT chk_race_utc_timezone_pair
    CHECK ((race_date_utc IS NULL AND circuit_timezone IS NULL)
        OR (race_date_utc IS NOT NULL AND circuit_timezone IS NOT NULL));

CREATE INDEX idx_races_utc_status ON races (status, race_date_utc);

-- ---------------------------------------------------------------------
-- 004_integrity.sql: Integridad: opcion de la misma carrera, un carrito activo, cantidades y stock validos
-- ---------------------------------------------------------------------
ALTER TABLE race_options ADD UNIQUE KEY uq_race_option (race_id, id);
ALTER TABLE bets ADD CONSTRAINT fk_bets_option_same_race
    FOREIGN KEY (race_id, option_id) REFERENCES race_options(race_id, id) ON DELETE CASCADE;

-- MySQL no admite una columna calculada STORED cuya columna base tenga una
-- clave foranea con CASCADE. Los usuarios nunca se borran (solo se desactivan),
-- asi que la clave de carts.user_id pasa a RESTRICT. carts_ibfk_1 es el nombre
-- que MySQL le dio al crear la tabla con el schema.sql anterior.
ALTER TABLE carts DROP FOREIGN KEY carts_ibfk_1;
ALTER TABLE carts ADD CONSTRAINT fk_carts_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE carts ADD COLUMN active_user_id INT
    GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN user_id ELSE NULL END) STORED;
CREATE UNIQUE INDEX uq_one_active_cart_per_user ON carts (active_user_id);

ALTER TABLE cart_items ADD CONSTRAINT chk_cart_quantity CHECK (quantity > 0);
ALTER TABLE inventory ADD CONSTRAINT chk_inventory_stock CHECK (stock >= 0);

-- ---------------------------------------------------------------------
-- 005_progression.sql: Experiencia (XP), niveles y recompensa LEVEL_REWARD
-- ---------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN xp_total INT NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_users_xp_nonnegative CHECK (xp_total >= 0);

CREATE INDEX idx_users_xp_rank ON users (is_active, xp_total);

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

ALTER TABLE pitcoin_movements MODIFY kind ENUM('OPENING_BALANCE','BET_STAKE','BET_ADJUSTMENT','BET_PRIZE','BET_REFUND','AVATAR_PURCHASE','STAFF_ADJUSTMENT','LEVEL_REWARD') NOT NULL;

-- ---------------------------------------------------------------------
-- 006_admin_audit.sql: Auditoria del panel administrativo
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

-- ---------------------------------------------------------------------
-- 007_teams_drivers.sql: Escuderias ampliadas y tabla de pilotos (se crean a partir de race_options)
-- ---------------------------------------------------------------------
ALTER TABLE teams
    ADD COLUMN country VARCHAR(100) NULL,
    ADD COLUMN primary_color CHAR(7) NULL,
    ADD COLUMN secondary_color CHAR(7) NULL,
    ADD COLUMN image_path VARCHAR(255) NULL,
    ADD CONSTRAINT chk_teams_primary_color CHECK (primary_color IS NULL OR primary_color REGEXP '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT chk_teams_secondary_color CHECK (secondary_color IS NULL OR secondary_color REGEXP '^#[0-9A-Fa-f]{6}$');

CREATE TABLE drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    number TINYINT UNSIGNED NULL,
    nationality VARCHAR(100) NULL,
    team_id INT NULL,
    image_path VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    active_number TINYINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN is_active THEN number ELSE NULL END) STORED,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_drivers_name UNIQUE (name),
    CONSTRAINT uq_drivers_active_number UNIQUE (active_number),
    CONSTRAINT fk_drivers_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
    CONSTRAINT chk_drivers_number CHECK (number IS NULL OR number BETWEEN 1 AND 99),
    INDEX idx_drivers_team (team_id, is_active)
);

INSERT INTO drivers (name, team_id, image_path, is_active)
SELECT latest.name, latest.team_id, latest.image_path, TRUE
FROM (
    SELECT REGEXP_REPLACE(TRIM(ro.driver_name), '[[:space:]]+', ' ') COLLATE utf8mb4_unicode_ci AS name, ro.team_id, ro.image_path,
           ROW_NUMBER() OVER (PARTITION BY REGEXP_REPLACE(TRIM(ro.driver_name), '[[:space:]]+', ' ') COLLATE utf8mb4_unicode_ci
                              ORDER BY r.race_date DESC, ro.id DESC) AS position
    FROM race_options ro
    JOIN races r ON r.id = ro.race_id
    WHERE TRIM(ro.driver_name) <> ''
) latest
WHERE latest.position = 1;

ALTER TABLE race_options
    ADD COLUMN driver_id INT NULL,
    ADD CONSTRAINT fk_race_options_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE RESTRICT,
    ADD CONSTRAINT uq_race_option_driver UNIQUE (race_id, driver_id);

UPDATE race_options ro
JOIN drivers d ON d.name = REGEXP_REPLACE(TRIM(ro.driver_name), '[[:space:]]+', ' ') COLLATE utf8mb4_unicode_ci
SET ro.driver_id = d.id;

-- ---------------------------------------------------------------------
-- 008_banners.sql: Banners de la portada
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Datos de las escuderias de ejemplo (pais y colores), si existen.
-- ---------------------------------------------------------------------
UPDATE teams SET country = 'Italia', primary_color = '#DC0000', secondary_color = '#FFF200' WHERE slug = 'ferrari' AND country IS NULL;
UPDATE teams SET country = 'Austria', primary_color = '#1E41FF', secondary_color = '#FFC906' WHERE slug = 'red-bull' AND country IS NULL;
UPDATE teams SET country = 'Alemania', primary_color = '#00D2BE', secondary_color = '#000000' WHERE slug = 'mercedes' AND country IS NULL;
UPDATE teams SET country = 'Reino Unido', primary_color = '#FF8000', secondary_color = '#47C7FC' WHERE slug = 'mclaren' AND country IS NULL;
UPDATE teams SET country = 'Francia', primary_color = '#0093CC', secondary_color = '#FF87BC' WHERE slug = 'alpine' AND country IS NULL;
UPDATE teams SET country = 'Estados Unidos', primary_color = '#1C1C1C', secondary_color = '#C9A13B' WHERE slug = 'cadillac' AND country IS NULL;
