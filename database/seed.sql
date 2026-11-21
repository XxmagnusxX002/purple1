USE purple1;
INSERT INTO users (username, email, password_hash, first_name, last_name, phone, address, is_staff) VALUES
('demo@purpleone.com','demo@purpleone.com','pbkdf2_sha256$600000$demo_salt$a982a37d90754ce2d08957db2bcd72213eeef710760dc8bc0c5d14a2eededcfb','Usuario','Demo','3001234567','Bogota, Colombia',0),
('admin@purpleone.com','admin@purpleone.com','pbkdf2_sha256$600000$admin_salt$30eeb89976aae901e93162f5bfe51708b4a712a3e1cd7d9b45e4c6badbac7ac2','Admin','Purple','3007654321','Oficina Purple One',1);
-- Monedas (tasas de referencia; el superadministrador las ajusta en el panel).
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
-- Parametros y descuentos canjeables con PitCoins
INSERT INTO app_settings (setting_key, int_value) VALUES
    ('pitcoins.opening_balance', 1000),
    ('pitcoins.min_bet', 10),
    ('xp.participation', 20),
    ('xp.correct', 50),
    ('xp.first_settled', 30),
    ('discounts.max_percent', 20);

INSERT INTO discount_rewards (name, percent, pitcoin_cost, display_order) VALUES
    ('Descuento del 5 %', 5, 500, 1),
    ('Descuento del 10 %', 10, 1000, 2),
    ('Descuento del 15 %', 15, 2000, 3),
    ('Descuento del 20 %', 20, 3500, 4);

INSERT INTO product_types (name, uses_size, uses_color) VALUES ('Ropa',1,1),('Accesorio',0,1),('Coleccionable',0,0),('Escuderia',0,0);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (1, 'Ropa', 'ropa', NULL, 'Categoria Ropa de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (2, 'Hoodies', 'hoodies', 1, 'Categoria Hoodies de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (3, 'Camisetas', 'camisetas', 1, 'Categoria Camisetas de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (4, 'Accesorios', 'accesorios', NULL, 'Categoria Accesorios de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (5, 'Gorras', 'gorras', 4, 'Categoria Gorras de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (6, 'Mochilas', 'mochilas', 4, 'Categoria Mochilas de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (7, 'Escuderias', 'escuderias', NULL, 'Categoria Escuderias de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (8, 'Ferrari', 'ferrari', 7, 'Categoria Ferrari de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (9, 'Leclerc', 'leclerc', 8, 'Categoria Leclerc de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (10, 'Red Bull', 'red-bull', 7, 'Categoria Red Bull de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (11, 'Verstappen', 'verstappen', 10, 'Categoria Verstappen de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (12, 'Mercedes', 'mercedes', 7, 'Categoria Mercedes de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (13, 'McLaren', 'mclaren', 7, 'Categoria McLaren de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (14, 'Coleccionables', 'coleccionables', NULL, 'Categoria Coleccionables de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (15, 'Miniaturas', 'miniaturas', 14, 'Categoria Miniaturas de Purple One.', 1);
INSERT INTO categories (id, name, slug, parent_id, description, is_active) VALUES (16, 'Posters', 'posters', 14, 'Categoria Posters de Purple One.', 1);
-- Escuderias 2026 (11). Se actualizan por slug: no se duplican y conservan su id.
INSERT INTO teams (name, slug, description, logo_path, country, primary_color, secondary_color, image_path, is_active) VALUES
('Ferrari', 'ferrari', 'Scuderia Ferrari HP. Sede: Maranello. Jefe de equipo: Frédéric Vasseur. Motor Ferrari, monoplaza SF-26.', 'img/teams/ferrari-logo.jpeg', 'Italia', '#DC0000', '#FFF200', 'img/teams/ferrari.jpg', 1),
('Red Bull Racing', 'red-bull', 'Oracle Red Bull Racing. Sede: Milton Keynes. Jefe de equipo: Laurent Mekies. Motor Red Bull Ford, monoplaza RB22.', 'img/teams/red-bull-logo.jpeg', 'Reino Unido', '#1E41FF', '#FFC906', 'img/teams/red-bull.jpg', 1),
('Mercedes', 'mercedes', 'Mercedes-AMG PETRONAS Formula One Team. Sede: Brackley. Jefe de equipo: Toto Wolff. Motor Mercedes, monoplaza W17.', 'img/teams/mercedes-logo.jpeg', 'Reino Unido', '#00D7B6', '#000000', 'img/teams/mercedes.jpg', 1),
('McLaren', 'mclaren', 'McLaren Mastercard F1 Team. Sede: Woking. Jefe de equipo: Andrea Stella. Motor Mercedes, monoplaza MCL40.', 'img/teams/mclaren-logo.jpeg', 'Reino Unido', '#FF8000', '#47C7FC', 'img/teams/mclaren.jpg', 1),
('Alpine', 'alpine', 'BWT Alpine Formula One Team. Sede: Enstone. Jefe de equipo: Flavio Briatore. Motor Mercedes, monoplaza A526.', 'img/teams/alpine-logo.jpeg', 'Reino Unido', '#0093CC', '#FF87BC', 'img/teams/alpine.jpg', 1),
('Cadillac', 'cadillac', 'Cadillac Formula 1 Team. Sede: Silverstone. Jefe de equipo: Marcin Budkowski. Motor Ferrari, monoplaza MAC-26.', 'img/teams/cadillac-logo.jpeg', 'Estados Unidos', '#1C1C1C', '#C9A13B', 'img/teams/cadillac.jpg', 1),
('Racing Bulls', 'racing-bulls', 'Visa Cash App Racing Bulls Formula One Team. Sede: Faenza. Jefe de equipo: Alan Permane. Motor Red Bull Ford, monoplaza VCARB 03.', NULL, 'Italia', '#6692FF', '#FFFFFF', 'img/teams/racing-bulls.jpg', 1),
('Haas', 'haas', 'TGR Haas F1 Team. Sede: Kannapolis. Jefe de equipo: Ayao Komatsu. Motor Ferrari, monoplaza VF-26.', NULL, 'Estados Unidos', '#B6BABD', '#DA291C', 'img/teams/haas.jpg', 1),
('Audi', 'audi', 'Audi Revolut F1 Team. Sede: Hinwil. Jefe de equipo: Mattia Binotto. Motor Audi, monoplaza R26.', NULL, 'Suiza', '#BB0A30', '#1A1A1A', 'img/teams/audi.jpg', 1),
('Williams', 'williams', 'Atlassian Williams F1 Team. Sede: Grove. Jefe de equipo: James Vowles. Motor Mercedes, monoplaza FW48.', NULL, 'Reino Unido', '#1868DB', '#00A0DE', 'img/teams/williams.jpg', 1),
('Aston Martin', 'aston-martin', 'Aston Martin Aramco Formula One Team. Sede: Silverstone. Jefe de equipo: Adrian Newey. Motor Honda, monoplaza AMR26.', NULL, 'Reino Unido', '#229971', '#CEDC00', 'img/teams/aston-martin.jpg', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), logo_path = COALESCE(VALUES(logo_path), logo_path),
    country = VALUES(country), primary_color = VALUES(primary_color), secondary_color = VALUES(secondary_color),
    image_path = VALUES(image_path), is_active = 1;
INSERT INTO sizes (name, visual_order) VALUES ('XS',1),('S',2),('M',3),('L',4),('XL',5);
INSERT INTO colors (name, hex_code) VALUES ('Negro','#000000'),('Blanco','#FFFFFF'),('Morado','#7B2CFF'),('Rojo Ferrari','#E10600'),('Azul Racing','#1E41FF');
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (1, 1, 'Hoodie Leclerc', 'hoodie-leclerc', 'Hoodie premium inspirada en Charles Leclerc con acentos Ferrari.', 89.90, 1, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (1, 'img/hoodie-leclerc.jpeg', 'Hoodie Leclerc', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (1, 2);
INSERT INTO product_categories (product_id, category_id) VALUES (1, 8);
INSERT INTO product_categories (product_id, category_id) VALUES (1, 9);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-S-1', 2, 1, NULL, 12, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-S-2', 2, 2, NULL, 13, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-S-4', 2, 4, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-M-1', 3, 1, NULL, 13, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-M-2', 3, 2, NULL, 14, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-M-4', 3, 4, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-L-1', 4, 1, NULL, 14, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-L-2', 4, 2, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (1, 'HOODIE-LECLERC-L-4', 4, 4, NULL, 17, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (2, 1, 'Hoodie Red Bull', 'hoodie-red-bull', 'Sudadera tecnica con presencia Red Bull y detalle Verstappen.', 92.90, 1, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (2, 'img/sweater-redbull.jpeg', 'Hoodie Red Bull', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (2, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (2, 2);
INSERT INTO product_categories (product_id, category_id) VALUES (2, 10);
INSERT INTO product_categories (product_id, category_id) VALUES (2, 11);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-S-1', 2, 1, NULL, 13, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-S-2', 2, 2, NULL, 14, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-S-4', 2, 4, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-M-1', 3, 1, NULL, 14, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-M-2', 3, 2, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-M-4', 3, 4, NULL, 17, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-L-1', 4, 1, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-L-2', 4, 2, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (2, 'HOODIE-RED-BULL-L-4', 4, 4, NULL, 18, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (3, 1, 'Camiseta Ferrari Race Day', 'camiseta-ferrari-race-day', 'Camiseta ligera para dias de carrera con identidad Ferrari.', 44.90, 0, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (3, 'img/polo-ferrari.jpeg', 'Camiseta Ferrari Race Day', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (3, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (3, 3);
INSERT INTO product_categories (product_id, category_id) VALUES (3, 8);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-S-1', 2, 1, NULL, 14, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-S-2', 2, 2, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-S-4', 2, 4, NULL, 17, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-M-1', 3, 1, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-M-2', 3, 2, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-M-4', 3, 4, NULL, 18, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-L-1', 4, 1, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-L-2', 4, 2, NULL, 17, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (3, 'CAMISETA-FERRARI-R-L-4', 4, 4, NULL, 19, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (4, 1, 'Camiseta Mercedes Pitwall', 'camiseta-mercedes-pitwall', 'Camiseta limpia y tecnica con guinos al pitwall de Mercedes.', 46.90, 0, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (4, 'img/shirt-mercedes.jpeg', 'Camiseta Mercedes Pitwall', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (4, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (4, 3);
INSERT INTO product_categories (product_id, category_id) VALUES (4, 12);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--S-1', 2, 1, NULL, 15, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--S-2', 2, 2, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--S-4', 2, 4, NULL, 18, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--M-1', 3, 1, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--M-2', 3, 2, NULL, 17, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--M-4', 3, 4, NULL, 19, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--L-1', 4, 1, NULL, 17, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--L-2', 4, 2, NULL, 18, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (4, 'CAMISETA-MERCEDES--L-4', 4, 4, NULL, 8, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (5, 2, 'Gorra McLaren Apex', 'gorra-mclaren-apex', 'Gorra estructurada McLaren para paddock y calle.', 29.90, 1, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (5, 'img/cap-maclaren.jpeg', 'Gorra McLaren Apex', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (5, 4);
INSERT INTO product_categories (product_id, category_id) VALUES (5, 5);
INSERT INTO product_categories (product_id, category_id) VALUES (5, 13);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (5, 'GORRA-MCLAREN-APEX-C1', NULL, 1, NULL, 16, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (5, 'GORRA-MCLAREN-APEX-C3', NULL, 3, NULL, 18, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (5, 'GORRA-MCLAREN-APEX-C5', NULL, 5, NULL, 20, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (6, 2, 'Gorra Red Bull Champion', 'gorra-red-bull-champion', 'Gorra inspirada en el dominio de Red Bull en Formula 1.', 31.90, 0, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (6, 'img/cap-redbull.jpeg', 'Gorra Red Bull Champion', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (6, 4);
INSERT INTO product_categories (product_id, category_id) VALUES (6, 5);
INSERT INTO product_categories (product_id, category_id) VALUES (6, 10);
INSERT INTO product_categories (product_id, category_id) VALUES (6, 11);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (6, 'GORRA-RED-BULL-CHAMP-C1', NULL, 1, NULL, 17, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (6, 'GORRA-RED-BULL-CHAMP-C3', NULL, 3, NULL, 19, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (6, 'GORRA-RED-BULL-CHAMP-C5', NULL, 5, NULL, 21, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (7, 2, 'Mochila Racing Travel', 'mochila-racing-travel', 'Mochila amplia para viajes de carrera y uso diario.', 64.90, 1, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (7, 'img/sack-redbull.jpeg', 'Mochila Racing Travel', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (7, 4);
INSERT INTO product_categories (product_id, category_id) VALUES (7, 6);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (7, 'MOCHILA-RACING-TRAVE-C1', NULL, 1, NULL, 18, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (7, 'MOCHILA-RACING-TRAVE-C3', NULL, 3, NULL, 20, 1);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (7, 'MOCHILA-RACING-TRAVE-C5', NULL, 5, NULL, 22, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (8, 3, 'Miniatura F1 Ferrari SF-24', 'miniatura-f1-ferrari-sf-24', 'Miniatura de exhibicion para fanaticos de Ferrari.', 59.90, 1, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (8, 'img/carro-redbull.jpeg', 'Miniatura F1 Ferrari SF-24', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (8, 14);
INSERT INTO product_categories (product_id, category_id) VALUES (8, 15);
INSERT INTO product_categories (product_id, category_id) VALUES (8, 8);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (8, 'MINIATURA-F1-FERRARI-SF--STD', NULL, NULL, NULL, 14, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (9, 3, 'Poster Formula 1 Night Race', 'poster-formula-1-night-race', 'Poster decorativo con energia de gran premio nocturno.', 19.90, 0, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (9, 14);
INSERT INTO product_categories (product_id, category_id) VALUES (9, 16);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (9, 'POSTER-FORMULA-1-NIGHT-R-STD', NULL, NULL, NULL, 15, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (10, 4, 'Pack Escuderia Mercedes', 'pack-escuderia-mercedes', 'Pack fan con piezas esenciales para seguidores de Mercedes.', 74.90, 0, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (10, 'img/polo-mercedez.jpeg', 'Pack Escuderia Mercedes', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (10, 7);
INSERT INTO product_categories (product_id, category_id) VALUES (10, 12);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (10, 'PACK-ESCUDERIA-MERCEDES-STD', NULL, NULL, NULL, 16, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (11, 4, 'Pack Escuderia McLaren', 'pack-escuderia-mclaren', 'Pack fan con visual McLaren para tribuna y coleccion.', 72.90, 0, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (11, 'img/cap-maclaren.jpeg', 'Pack Escuderia McLaren', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (11, 7);
INSERT INTO product_categories (product_id, category_id) VALUES (11, 13);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (11, 'PACK-ESCUDERIA-MCLAREN-STD', NULL, NULL, NULL, 17, 1);
INSERT INTO products (id, product_type_id, name, slug, description, base_price, is_featured, is_active) VALUES (12, 3, 'Miniatura Red Bull RB20', 'miniatura-red-bull-rb20', 'Miniatura de coleccion con silueta dominante de Red Bull.', 61.90, 1, 1);
INSERT INTO product_images (product_id, image_path, alt_text, display_order, is_main) VALUES (12, 'img/carro-redbull.jpeg', 'Miniatura Red Bull RB20', 1, 1);
INSERT INTO product_categories (product_id, category_id) VALUES (12, 14);
INSERT INTO product_categories (product_id, category_id) VALUES (12, 15);
INSERT INTO product_categories (product_id, category_id) VALUES (12, 10);
INSERT INTO product_categories (product_id, category_id) VALUES (12, 11);
INSERT INTO inventory (product_id, sku, size_id, color_id, price_override, stock, is_active) VALUES (12, 'MINIATURA-RED-BULL-RB20-STD', NULL, NULL, NULL, 6, 1);

INSERT INTO product_teams (product_id, team_id) VALUES
(1, 1),
(2, 2),
(3, 1),
(4, 3),
(5, 4),
(6, 2),
(8, 1),
(10, 3),
(11, 4),
(12, 2);

-- ---------------------------------------------------------------------
-- PitCoins: saldo inicial de las cuentas de ejemplo (cada usuario empieza
-- con 1000). users.coins siempre debe coincidir con la suma del historial.
-- ---------------------------------------------------------------------
INSERT INTO pitcoin_movements (user_id, amount, balance_after, kind, reference)
SELECT id, coins, coins, 'OPENING_BALANCE', CONCAT('opening:', id) FROM users;

-- ---------------------------------------------------------------------
-- Formula 1, temporada 2026: datos oficiales de formula1.com (consultados el
-- 19-nov-2026). Pilotos, calendario completo, participantes y ganadores de las
-- carreras disputadas. Se administran desde /admin/drivers.html y /admin/races.html.
-- Imagenes: Wikimedia Commons (autor y licencia en frontend/img/CREDITOS.md).
-- ---------------------------------------------------------------------
-- Pilotos 2026 (22 titulares + 3 que corrieron alguna carrera). Se actualizan por nombre.
INSERT INTO drivers (name, number, nationality, team_id, image_path, is_active)
SELECT * FROM (
    SELECT 'George Russell', 63, 'Reino Unido', (SELECT id FROM teams WHERE slug = 'mercedes'), 'img/drivers/george-russell.jpg', 1
    UNION ALL SELECT 'Kimi Antonelli', 12, 'Italia', (SELECT id FROM teams WHERE slug = 'mercedes'), 'img/drivers/kimi-antonelli.jpg', 1
    UNION ALL SELECT 'Charles Leclerc', 16, 'Mónaco', (SELECT id FROM teams WHERE slug = 'ferrari'), 'img/drivers/charles-leclerc.jpg', 1
    UNION ALL SELECT 'Lewis Hamilton', 44, 'Reino Unido', (SELECT id FROM teams WHERE slug = 'ferrari'), 'img/drivers/lewis-hamilton.jpg', 1
    UNION ALL SELECT 'Max Verstappen', 3, 'Países Bajos', (SELECT id FROM teams WHERE slug = 'red-bull'), 'img/drivers/max-verstappen.jpg', 1
    UNION ALL SELECT 'Isack Hadjar', 6, 'Francia', (SELECT id FROM teams WHERE slug = 'red-bull'), 'img/drivers/isack-hadjar.jpg', 1
    UNION ALL SELECT 'Lando Norris', 1, 'Reino Unido', (SELECT id FROM teams WHERE slug = 'mclaren'), 'img/drivers/lando-norris.jpg', 1
    UNION ALL SELECT 'Oscar Piastri', 81, 'Australia', (SELECT id FROM teams WHERE slug = 'mclaren'), 'img/drivers/oscar-piastri.jpg', 1
    UNION ALL SELECT 'Liam Lawson', 30, 'Nueva Zelanda', (SELECT id FROM teams WHERE slug = 'racing-bulls'), 'img/drivers/liam-lawson.jpg', 1
    UNION ALL SELECT 'Arvid Lindblad', 41, 'Reino Unido', (SELECT id FROM teams WHERE slug = 'racing-bulls'), 'img/drivers/arvid-lindblad.jpg', 1
    UNION ALL SELECT 'Pierre Gasly', 10, 'Francia', (SELECT id FROM teams WHERE slug = 'alpine'), 'img/drivers/pierre-gasly.jpg', 1
    UNION ALL SELECT 'Franco Colapinto', 43, 'Argentina', (SELECT id FROM teams WHERE slug = 'alpine'), 'img/drivers/franco-colapinto.jpg', 1
    UNION ALL SELECT 'Oliver Bearman', 87, 'Reino Unido', (SELECT id FROM teams WHERE slug = 'haas'), 'img/drivers/oliver-bearman.jpg', 1
    UNION ALL SELECT 'Rafael Câmara', 51, 'Brasil', (SELECT id FROM teams WHERE slug = 'haas'), 'img/drivers/rafael-camara.jpg', 1
    UNION ALL SELECT 'Nico Hülkenberg', 27, 'Alemania', (SELECT id FROM teams WHERE slug = 'audi'), 'img/drivers/nico-hulkenberg.jpg', 1
    UNION ALL SELECT 'Gabriel Bortoleto', 5, 'Brasil', (SELECT id FROM teams WHERE slug = 'audi'), 'img/drivers/gabriel-bortoleto.jpg', 1
    UNION ALL SELECT 'Carlos Sainz', 55, 'España', (SELECT id FROM teams WHERE slug = 'williams'), 'img/drivers/carlos-sainz.jpg', 1
    UNION ALL SELECT 'Alexander Albon', 23, 'Tailandia', (SELECT id FROM teams WHERE slug = 'williams'), 'img/drivers/alexander-albon.jpg', 1
    UNION ALL SELECT 'Fernando Alonso', 14, 'España', (SELECT id FROM teams WHERE slug = 'aston-martin'), 'img/drivers/fernando-alonso.jpg', 1
    UNION ALL SELECT 'Lance Stroll', 18, 'Canadá', (SELECT id FROM teams WHERE slug = 'aston-martin'), 'img/drivers/lance-stroll.jpg', 1
    UNION ALL SELECT 'Sergio Pérez', 11, 'México', (SELECT id FROM teams WHERE slug = 'cadillac'), 'img/drivers/sergio-perez.jpg', 1
    UNION ALL SELECT 'Valtteri Bottas', 77, 'Finlandia', (SELECT id FROM teams WHERE slug = 'cadillac'), 'img/drivers/valtteri-bottas.jpg', 1
    UNION ALL SELECT 'Esteban Ocon', 31, 'Francia', (SELECT id FROM teams WHERE slug = 'haas'), 'img/drivers/esteban-ocon.jpg', 0
    UNION ALL SELECT 'Yuki Tsunoda', 22, 'Japón', (SELECT id FROM teams WHERE slug = 'racing-bulls'), 'img/drivers/yuki-tsunoda.jpg', 0
    UNION ALL SELECT 'Ryo Hirakawa', 50, 'Japón', (SELECT id FROM teams WHERE slug = 'haas'), 'img/drivers/ryo-hirakawa.jpg', 0
) AS official
ON DUPLICATE KEY UPDATE name = VALUES(name), number = VALUES(number), nationality = VALUES(nationality), team_id = VALUES(team_id),
    image_path = VALUES(image_path), is_active = VALUES(is_active);

-- Calendario 2026 (23 rondas). La hora es la salida oficial en UTC; la hora local
-- se calcula con la zona del circuito. Una carrera ya registrada (mismo nombre y
-- misma fecha UTC) no se vuelve a insertar.
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Australia', 'Albert Park Circuit, Melbourne', 'Australia', '2026-03-08 04:00:00', '2026-03-08 04:00:00', 'Australia/Melbourne', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Australia' AND race_date_utc = '2026-03-08 04:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de China', 'Shanghai International Circuit', 'China', '2026-03-15 07:00:00', '2026-03-15 07:00:00', 'Asia/Shanghai', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de China' AND race_date_utc = '2026-03-15 07:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Japón', 'Suzuka Circuit', 'Japón', '2026-03-29 05:00:00', '2026-03-29 05:00:00', 'Asia/Tokyo', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Japón' AND race_date_utc = '2026-03-29 05:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Miami', 'Miami International Autodrome', 'Estados Unidos', '2026-05-03 17:00:00', '2026-05-03 17:00:00', 'America/New_York', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Miami' AND race_date_utc = '2026-05-03 17:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Canadá', 'Circuit Gilles-Villeneuve, Montreal', 'Canadá', '2026-05-24 20:00:00', '2026-05-24 20:00:00', 'America/Toronto', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Canadá' AND race_date_utc = '2026-05-24 20:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Mónaco', 'Circuit de Monaco', 'Mónaco', '2026-06-07 13:00:00', '2026-06-07 13:00:00', 'Europe/Monaco', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Mónaco' AND race_date_utc = '2026-06-07 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Barcelona-Cataluña', 'Circuit de Barcelona-Catalunya', 'España', '2026-06-14 13:00:00', '2026-06-14 13:00:00', 'Europe/Madrid', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Barcelona-Cataluña' AND race_date_utc = '2026-06-14 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Austria', 'Red Bull Ring, Spielberg', 'Austria', '2026-06-28 13:00:00', '2026-06-28 13:00:00', 'Europe/Vienna', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Austria' AND race_date_utc = '2026-06-28 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Gran Bretaña', 'Silverstone Circuit', 'Reino Unido', '2026-07-05 14:00:00', '2026-07-05 14:00:00', 'Europe/London', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Gran Bretaña' AND race_date_utc = '2026-07-05 14:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Bélgica', 'Circuit de Spa-Francorchamps', 'Bélgica', '2026-07-19 13:00:00', '2026-07-19 13:00:00', 'Europe/Brussels', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Bélgica' AND race_date_utc = '2026-07-19 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Hungría', 'Hungaroring, Budapest', 'Hungría', '2026-07-26 13:00:00', '2026-07-26 13:00:00', 'Europe/Budapest', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Hungría' AND race_date_utc = '2026-07-26 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de los Países Bajos', 'Circuit Zandvoort', 'Países Bajos', '2026-08-23 13:00:00', '2026-08-23 13:00:00', 'Europe/Amsterdam', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de los Países Bajos' AND race_date_utc = '2026-08-23 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Italia', 'Autodromo Nazionale Monza', 'Italia', '2026-09-06 13:00:00', '2026-09-06 13:00:00', 'Europe/Rome', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Italia' AND race_date_utc = '2026-09-06 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de España', 'Madring, Madrid', 'España', '2026-09-13 13:00:00', '2026-09-13 13:00:00', 'Europe/Madrid', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de España' AND race_date_utc = '2026-09-13 13:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Azerbaiyán', 'Baku City Circuit', 'Azerbaiyán', '2026-09-26 11:00:00', '2026-09-26 11:00:00', 'Asia/Baku', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Azerbaiyán' AND race_date_utc = '2026-09-26 11:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Baréin en Malasia', 'Sepang International Circuit, Kuala Lumpur', 'Malasia', '2026-10-04 07:00:00', '2026-10-04 07:00:00', 'Asia/Kuala_Lumpur', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Baréin en Malasia' AND race_date_utc = '2026-10-04 07:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Singapur', 'Marina Bay Street Circuit', 'Singapur', '2026-10-11 12:00:00', '2026-10-11 12:00:00', 'Asia/Singapore', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Singapur' AND race_date_utc = '2026-10-11 12:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Estados Unidos', 'Circuit of The Americas, Austin', 'Estados Unidos', '2026-10-25 20:00:00', '2026-10-25 20:00:00', 'America/Chicago', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Estados Unidos' AND race_date_utc = '2026-10-25 20:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de la Ciudad de México', 'Autódromo Hermanos Rodríguez', 'México', '2026-11-01 20:00:00', '2026-11-01 20:00:00', 'America/Mexico_City', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de la Ciudad de México' AND race_date_utc = '2026-11-01 20:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de São Paulo', 'Autódromo José Carlos Pace (Interlagos)', 'Brasil', '2026-11-08 17:00:00', '2026-11-08 17:00:00', 'America/Sao_Paulo', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de São Paulo' AND race_date_utc = '2026-11-08 17:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Las Vegas', 'Las Vegas Strip Circuit', 'Estados Unidos', '2026-11-22 04:00:00', '2026-11-22 04:00:00', 'America/Los_Angeles', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Las Vegas' AND race_date_utc = '2026-11-22 04:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Catar', 'Lusail International Circuit', 'Catar', '2026-11-29 16:00:00', '2026-11-29 16:00:00', 'Asia/Qatar', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Catar' AND race_date_utc = '2026-11-29 16:00:00');
INSERT INTO races (name, circuit, country, race_date, race_date_utc, circuit_timezone, image_path, status)
SELECT 'Gran Premio de Abu Dabi', 'Yas Marina Circuit', 'Emiratos Árabes Unidos', '2026-12-06 13:00:00', '2026-12-06 13:00:00', 'Asia/Dubai', NULL, 'SCHEDULED' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM races WHERE name = 'Gran Premio de Abu Dabi' AND race_date_utc = '2026-12-06 13:00:00');

-- Participantes: clasificacion oficial de cada carrera disputada, con la
-- escuderia de ese dia (p. ej. Lawson con Red Bull en Zandvoort, Monza y Madrid).
-- Las Vegas: alineacion vigente de la pagina oficial de pilotos. Catar y Abu Dabi
-- quedan sin participantes hasta que se confirme la lista de inscritos.
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Australia' AND r.race_date_utc = '2026-03-08 04:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de China' AND r.race_date_utc = '2026-03-15 07:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Japón' AND r.race_date_utc = '2026-03-29 05:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Miami' AND r.race_date_utc = '2026-05-03 17:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Canadá' AND r.race_date_utc = '2026-05-24 20:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Mónaco' AND r.race_date_utc = '2026-06-07 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Barcelona-Cataluña' AND r.race_date_utc = '2026-06-14 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Austria' AND r.race_date_utc = '2026-06-28 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Gran Bretaña' AND r.race_date_utc = '2026-07-05 14:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Bélgica' AND r.race_date_utc = '2026-07-19 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Hungría' AND r.race_date_utc = '2026-07-26 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Yuki Tsunoda' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de los Países Bajos' AND r.race_date_utc = '2026-08-23 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Yuki Tsunoda' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Italia' AND r.race_date_utc = '2026-09-06 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Yuki Tsunoda' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de España' AND r.race_date_utc = '2026-09-13 13:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Azerbaiyán' AND r.race_date_utc = '2026-09-26 11:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Baréin en Malasia' AND r.race_date_utc = '2026-10-04 07:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Singapur' AND r.race_date_utc = '2026-10-11 12:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Esteban Ocon' AS driver, 'haas' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Estados Unidos' AND r.race_date_utc = '2026-10-25 20:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Ryo Hirakawa' AS driver, 'haas' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de la Ciudad de México' AND r.race_date_utc = '2026-11-01 20:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Rafael Câmara' AS driver, 'haas' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de São Paulo' AND r.race_date_utc = '2026-11-08 17:00:00';
INSERT IGNORE INTO race_options (race_id, driver_name, team_id, image_path, driver_id)
SELECT r.id, d.name, t.id, d.image_path, d.id
FROM (
    SELECT 'George Russell' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Kimi Antonelli' AS driver, 'mercedes' AS team
    UNION ALL SELECT 'Charles Leclerc' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Lewis Hamilton' AS driver, 'ferrari' AS team
    UNION ALL SELECT 'Max Verstappen' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Isack Hadjar' AS driver, 'red-bull' AS team
    UNION ALL SELECT 'Lando Norris' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Oscar Piastri' AS driver, 'mclaren' AS team
    UNION ALL SELECT 'Liam Lawson' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Arvid Lindblad' AS driver, 'racing-bulls' AS team
    UNION ALL SELECT 'Pierre Gasly' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Franco Colapinto' AS driver, 'alpine' AS team
    UNION ALL SELECT 'Oliver Bearman' AS driver, 'haas' AS team
    UNION ALL SELECT 'Rafael Câmara' AS driver, 'haas' AS team
    UNION ALL SELECT 'Nico Hülkenberg' AS driver, 'audi' AS team
    UNION ALL SELECT 'Gabriel Bortoleto' AS driver, 'audi' AS team
    UNION ALL SELECT 'Carlos Sainz' AS driver, 'williams' AS team
    UNION ALL SELECT 'Alexander Albon' AS driver, 'williams' AS team
    UNION ALL SELECT 'Fernando Alonso' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Lance Stroll' AS driver, 'aston-martin' AS team
    UNION ALL SELECT 'Sergio Pérez' AS driver, 'cadillac' AS team
    UNION ALL SELECT 'Valtteri Bottas' AS driver, 'cadillac' AS team
) AS p
JOIN drivers d ON d.name = p.driver JOIN teams t ON t.slug = p.team
JOIN races r ON r.name = 'Gran Premio de Las Vegas' AND r.race_date_utc = '2026-11-22 04:00:00';

-- Resultados: ganador oficial y estado finalizado. Solo carreras sin pronosticos
-- (no se reparten PitCoins ni XP: es historial, no una liquidacion).
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'George Russell'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Australia' AND r.race_date_utc = '2026-03-08 04:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de China' AND r.race_date_utc = '2026-03-15 07:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Japón' AND r.race_date_utc = '2026-03-29 05:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Miami' AND r.race_date_utc = '2026-05-03 17:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Canadá' AND r.race_date_utc = '2026-05-24 20:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Mónaco' AND r.race_date_utc = '2026-06-07 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Lewis Hamilton'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Barcelona-Cataluña' AND r.race_date_utc = '2026-06-14 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'George Russell'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Austria' AND r.race_date_utc = '2026-06-28 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Charles Leclerc'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Gran Bretaña' AND r.race_date_utc = '2026-07-05 14:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Bélgica' AND r.race_date_utc = '2026-07-19 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Lando Norris'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Hungría' AND r.race_date_utc = '2026-07-26 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Lando Norris'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de los Países Bajos' AND r.race_date_utc = '2026-08-23 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Italia' AND r.race_date_utc = '2026-09-06 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de España' AND r.race_date_utc = '2026-09-13 13:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'George Russell'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Azerbaiyán' AND r.race_date_utc = '2026-09-26 11:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Max Verstappen'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Baréin en Malasia' AND r.race_date_utc = '2026-10-04 07:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Max Verstappen'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Singapur' AND r.race_date_utc = '2026-10-11 12:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Kimi Antonelli'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de Estados Unidos' AND r.race_date_utc = '2026-10-25 20:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Max Verstappen'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de la Ciudad de México' AND r.race_date_utc = '2026-11-01 20:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);
UPDATE races r JOIN race_options o ON o.race_id = r.id AND o.driver_name = 'Lando Norris'
SET r.winner_option_id = o.id, r.status = 'FINISHED'
WHERE r.name = 'Gran Premio de São Paulo' AND r.race_date_utc = '2026-11-08 17:00:00' AND r.status IN ('SCHEDULED', 'FINISHED')
  AND NOT EXISTS (SELECT 1 FROM bets b WHERE b.race_id = r.id);

-- ---------------------------------------------------------------------
-- Banner de la portada (se administran desde /admin/banners.html)
-- ---------------------------------------------------------------------
INSERT INTO banners (title, description, image_path, link_url, display_order, is_active) VALUES
('Pronostica y gana PitCoins', 'Elige al ganador de cada Gran Premio, sube de nivel y desbloquea prendas para tu avatar.', 'img/car.png', '/races.html', 1, 1);

-- ---------------------------------------------------------------------
-- Catalogo dinamico: orden de categorias y etiquetas SUGERIDAS por tipo.
-- ---------------------------------------------------------------------
UPDATE categories SET display_order = id;
UPDATE categories SET image_path = 'img/ropa.png' WHERE slug = 'ropa';
UPDATE categories SET image_path = 'img/accesorios.png' WHERE slug = 'accesorios';
UPDATE categories SET image_path = 'img/escuderia.png' WHERE slug = 'escuderias';
UPDATE categories SET image_path = 'img/coleccionables.png' WHERE slug = 'coleccionables';

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

-- Datos de DEMOSTRACION (instalacion nueva): un producto de cada tipo con sus
-- caracteristicas. El resto queda sin especificaciones y la ficha las oculta.
INSERT INTO product_specs (product_id, kind, label, value, display_order) VALUES
(1, 'FEATURE', NULL, 'Capucha con cordón ajustable', 1),
(1, 'FEATURE', NULL, 'Bolsillo canguro frontal', 2),
(1, 'SPEC', 'Material', 'Felpa perchada', 1),
(1, 'SPEC', 'Composición', '80 % algodón, 20 % poliéster', 2),
(1, 'SPEC', 'Corte', 'Regular', 3),
(1, 'SPEC', 'Cuidado', 'Lavar a máquina en frío, del revés', 4),
(5, 'FEATURE', NULL, 'Visera curva preformada', 1),
(5, 'SPEC', 'Material', 'Sarga de algodón', 1),
(5, 'SPEC', 'Tipo de ajuste', 'Ajustable, talla única', 2),
(5, 'SPEC', 'Cierre', 'Correa trasera con hebilla metálica', 3),
(7, 'FEATURE', NULL, 'Compartimiento acolchado para portátil', 1),
(7, 'SPEC', 'Capacidad', '25 L', 1),
(7, 'SPEC', 'Dimensiones', '45 × 30 × 18 cm', 2),
(7, 'SPEC', 'Material', 'Poliéster resistente al agua', 3),
(7, 'SPEC', 'Compartimientos', '3 compartimientos y bolsillo lateral', 4),
(8, 'FEATURE', NULL, 'Base de exhibición incluida', 1),
(8, 'SPEC', 'Escala', '1:43', 1),
(8, 'SPEC', 'Fabricante', 'Purple One Collectibles', 2),
(8, 'SPEC', 'Material', 'Metal fundido y plástico ABS', 3),
(8, 'SPEC', 'Dimensiones', '13 × 5 × 3 cm', 4);
