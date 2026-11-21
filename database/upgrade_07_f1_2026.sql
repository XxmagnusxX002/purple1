-- =====================================================================
-- Purple One - Actualizacion 07: datos oficiales de Formula 1, temporada 2026
--
-- Ejecutar sobre una base que ya tenga upgrade_06_fidelizacion.sql.
-- Se puede ejecutar mas de una vez: actualiza por slug (escuderias) y por
-- nombre (pilotos) y no repite carreras ni participantes.
-- No borra nada. No crea pronosticos, PitCoins, XP ni cupones: los
-- resultados historicos solo marcan ganador y estado finalizado, y nunca se
-- tocan carreras que ya tengan pronosticos.
--
-- Fuente: formula1.com (resultados, pilotos, escuderias y calendario 2026),
-- consultada el 19 de noviembre de 2026. Imagenes: Wikimedia Commons, con
-- autor y licencia en frontend/img/CREDITOS.md.
-- =====================================================================

USE purple1;

-- Los escudos se movieron a img/teams/.
UPDATE teams SET logo_path = REPLACE(REPLACE(logo_path, 'img/escudo-redbull.jpeg', 'img/teams/red-bull-logo.jpeg'), 'img/escudo-', 'img/teams/')
WHERE logo_path LIKE 'img/escudo-%';
UPDATE teams SET logo_path = REPLACE(logo_path, '.jpeg', '-logo.jpeg')
WHERE logo_path LIKE 'img/teams/%.jpeg' AND logo_path NOT LIKE '%-logo.jpeg';

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

-- Nombre anterior del piloto (evita un duplicado) y dorsales que ahora usan pilotos oficiales.
UPDATE drivers SET name = 'Kimi Antonelli' WHERE name = 'Andrea Kimi Antonelli';
UPDATE drivers SET number = NULL WHERE number IN (63, 12, 16, 44, 3, 6, 1, 81, 30, 41, 10, 43, 87, 51, 27, 5, 55, 23, 14, 18, 11, 77, 31, 22, 50) AND name NOT IN ('George Russell', 'Kimi Antonelli', 'Charles Leclerc', 'Lewis Hamilton', 'Max Verstappen', 'Isack Hadjar', 'Lando Norris', 'Oscar Piastri', 'Liam Lawson', 'Arvid Lindblad', 'Pierre Gasly', 'Franco Colapinto', 'Oliver Bearman', 'Rafael Câmara', 'Nico Hülkenberg', 'Gabriel Bortoleto', 'Carlos Sainz', 'Alexander Albon', 'Fernando Alonso', 'Lance Stroll', 'Sergio Pérez', 'Valtteri Bottas', 'Esteban Ocon', 'Yuki Tsunoda', 'Ryo Hirakawa');
UPDATE drivers SET number = NULL WHERE name IN ('George Russell', 'Kimi Antonelli', 'Charles Leclerc', 'Lewis Hamilton', 'Max Verstappen', 'Isack Hadjar', 'Lando Norris', 'Oscar Piastri', 'Liam Lawson', 'Arvid Lindblad', 'Pierre Gasly', 'Franco Colapinto', 'Oliver Bearman', 'Rafael Câmara', 'Nico Hülkenberg', 'Gabriel Bortoleto', 'Carlos Sainz', 'Alexander Albon', 'Fernando Alonso', 'Lance Stroll', 'Sergio Pérez', 'Valtteri Bottas', 'Esteban Ocon', 'Yuki Tsunoda', 'Ryo Hirakawa');

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

