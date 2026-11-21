-- =====================================================================
-- Purple One - Actualizacion 04: portada dinamica
--
-- Ejecutar UNA vez sobre una base que ya tenga upgrade_03_catalogo.sql.
-- (Una instalacion nueva con schema.sql + seed.sql ya lo incluye.)
-- No borra datos. Agrega la imagen opcional de cada categoria, que la portada
-- muestra en "Explora por categorias" y que se edita desde el panel.
-- =====================================================================

USE purple1;

ALTER TABLE categories ADD COLUMN image_path VARCHAR(255) NULL AFTER description;

-- Las ilustraciones que la portada ya usaba para las categorias principales.
UPDATE categories SET image_path = 'img/ropa.png' WHERE slug = 'ropa' AND image_path IS NULL;
UPDATE categories SET image_path = 'img/accesorios.png' WHERE slug = 'accesorios' AND image_path IS NULL;
UPDATE categories SET image_path = 'img/escuderia.png' WHERE slug = 'escuderias' AND image_path IS NULL;
UPDATE categories SET image_path = 'img/coleccionables.png' WHERE slug = 'coleccionables' AND image_path IS NULL;

-- ---------------------------------------------------------------------
-- Sin imagenes provisionales "P1": los archivos *placeholder* eran todos la
-- misma imagen generica. Se quitan sus referencias; la tienda muestra un
-- icono neutro (productos) o la bandera del pais (carreras) cuando falta imagen.
-- Solo afecta filas que apuntan a esos archivos.
-- ---------------------------------------------------------------------
DELETE FROM product_images WHERE image_path LIKE '%placeholder%';
UPDATE races SET image_path = NULL WHERE image_path LIKE '%placeholder%';
UPDATE race_options SET image_path = NULL WHERE image_path LIKE '%placeholder%';
UPDATE drivers SET image_path = NULL WHERE image_path LIKE '%placeholder%';
UPDATE teams SET logo_path = NULL WHERE logo_path LIKE '%placeholder%';
UPDATE teams SET image_path = NULL WHERE image_path LIKE '%placeholder%';
