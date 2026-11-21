-- =====================================================================
-- Purple One - Actualizacion 03: catalogo dinamico
--
-- Ejecutar UNA vez sobre una base que ya tenga upgrade_02_superadmin.sql.
-- (Una instalacion nueva con schema.sql ya lo incluye.)
-- No borra datos. Agrega:
--   * Promocion real por producto: porcentaje y vigencia (UTC).
--   * Caracteristicas y especificaciones propias de cada producto.
--   * Plantillas de etiquetas SUGERIDAS por tipo de producto (no obligatorias).
--   * Orden de categorias y activacion de tallas, colores y tipos.
-- =====================================================================

USE purple1;

-- Promocion: solo existe si promo_percent tiene valor; vigente entre las fechas.
ALTER TABLE products
    ADD COLUMN promo_percent TINYINT UNSIGNED NULL AFTER base_price,
    ADD COLUMN promo_starts_at DATETIME NULL AFTER promo_percent,
    ADD COLUMN promo_ends_at DATETIME NULL AFTER promo_starts_at,
    ADD CONSTRAINT chk_products_promo_percent CHECK (promo_percent IS NULL OR promo_percent BETWEEN 1 AND 90),
    ADD CONSTRAINT chk_products_promo_period CHECK (promo_starts_at IS NULL OR promo_ends_at IS NULL OR promo_starts_at < promo_ends_at);

-- FEATURE: viñeta destacada ("Escudo bordado"); SPEC: fila etiqueta-valor ("Material": "Algodon").
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

-- Etiquetas sugeridas al cargar especificaciones de un producto de ese tipo.
CREATE TABLE product_type_spec_templates (
    product_type_id INT NOT NULL,
    label VARCHAR(80) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_type_id, label),
    CONSTRAINT fk_spec_templates_type FOREIGN KEY (product_type_id) REFERENCES product_types(id) ON DELETE CASCADE
);

INSERT INTO product_type_spec_templates (product_type_id, label, display_order)
SELECT pt.id, t.label, t.display_order
FROM product_types pt
JOIN (
    SELECT 'Ropa' AS type_name, 'Material' AS label, 1 AS display_order UNION ALL
    SELECT 'Ropa', 'Composición', 2 UNION ALL
    SELECT 'Ropa', 'Corte', 3 UNION ALL
    SELECT 'Ropa', 'Cuidado', 4 UNION ALL
    SELECT 'Accesorio', 'Material', 1 UNION ALL
    SELECT 'Accesorio', 'Tipo de ajuste', 2 UNION ALL
    SELECT 'Accesorio', 'Cierre', 3 UNION ALL
    SELECT 'Accesorio', 'Capacidad', 4 UNION ALL
    SELECT 'Accesorio', 'Dimensiones', 5 UNION ALL
    SELECT 'Accesorio', 'Compartimientos', 6 UNION ALL
    SELECT 'Coleccionable', 'Escala', 1 UNION ALL
    SELECT 'Coleccionable', 'Fabricante', 2 UNION ALL
    SELECT 'Coleccionable', 'Material', 3 UNION ALL
    SELECT 'Coleccionable', 'Dimensiones', 4 UNION ALL
    SELECT 'Escuderia', 'Contenido', 1 UNION ALL
    SELECT 'Escuderia', 'Material', 2 UNION ALL
    SELECT 'Escuderia', 'Dimensiones', 3
) t ON t.type_name = pt.name;

-- Administracion de categorias, tallas, colores y tipos (nada se borra: se desactiva).
ALTER TABLE categories ADD COLUMN display_order INT NOT NULL DEFAULT 0 AFTER description;
ALTER TABLE product_types ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER uses_color;
ALTER TABLE sizes ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER visual_order;
ALTER TABLE colors
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER hex_code,
    ADD CONSTRAINT chk_colors_hex CHECK (hex_code IS NULL OR hex_code REGEXP '^#[0-9A-Fa-f]{6}$');

-- Orden inicial de categorias: el mismo que tenian por id.
UPDATE categories SET display_order = id WHERE display_order = 0;
