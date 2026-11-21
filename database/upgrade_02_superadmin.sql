-- =====================================================================
-- Purple One - Actualizacion 02: rol de superadministrador
--
-- Ejecutar UNA vez sobre una base que ya tenga aplicado upgrade.sql.
-- (Una instalacion nueva con schema.sql ya lo incluye: no la ejecutes ahi.)
-- No borra ni modifica datos: solo agrega una columna y una restriccion.
--
-- Roles resultantes:
--   Cliente            is_staff = FALSE
--   Administrador      is_staff = TRUE,  is_superadmin = FALSE
--   Superadministrador is_staff = TRUE,  is_superadmin = TRUE
-- =====================================================================

USE purple1;

ALTER TABLE users
    ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT FALSE AFTER is_staff,
    ADD CONSTRAINT chk_users_superadmin_is_staff CHECK (is_superadmin = FALSE OR is_staff = TRUE);

-- El primer superadministrador se asigna a mano, eligiendo la cuenta:
--   SELECT id, email, first_name, last_name FROM users WHERE is_staff = TRUE AND is_active = TRUE;
--   UPDATE users SET is_superadmin = TRUE WHERE email = '<correo elegido>';
-- Despues, los demas roles se gestionan desde el panel (/admin/users.html).
