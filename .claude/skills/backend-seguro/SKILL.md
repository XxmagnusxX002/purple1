---
name: backend-seguro
description: Revisión de seguridad obligatoria cada vez que se toca el backend de Purple One (rutas de la API, módulos de Python, SQL o esquema de MySQL). Úsala antes de proponer o aprobar cualquier cambio de datos.
---

# Backend seguro · las seis cerraduras de Purple One

Purple One usa Python + MySQL (no Supabase). MySQL no tiene RLS, así que la regla
"cada quien ve y cambia solo lo suyo" se garantiza en el servidor. Revisa las seis
cerraduras en todo cambio y dilo explícitamente en tu respuesta.

## 1 · Secretos
- Ninguna contraseña, token ni cadena de conexión en el código ni en Git.
- La conexión a MySQL se lee de `PURPLE1_DB_HOST`, `PURPLE1_DB_PORT`, `PURPLE1_DB_USER`, `PURPLE1_DB_PASSWORD` y `PURPLE1_DB_NAME`.
- `database/purple1_completo.sql` y cualquier respaldo con datos de usuarios no se suben (están en `.gitignore`).
- Nada secreto en `frontend/`: todo lo que está ahí lo descarga cualquier visitante.

## 2 · Autenticado ≠ autorizado
- El usuario sale de la sesión (`self.require_user()` en `server.py`). Si el cuerpo trae `user_id`, se reemplaza por el de la sesión.
- Antes de leer o cambiar una fila ajena, comprueba que sea del usuario o que el rol lo permita.
- Rutas `/api/admin/*`: staff. Rutas en `SUPERADMIN_API`: solo superadministrador. El menú del panel no es seguridad.

## 3 · El dueño de cada fila (reemplazo de RLS)
- Toda consulta sobre datos personales filtra por el dueño: `WHERE user_id = %s` con el id de la sesión.
- Respuesta ante una fila ajena: 404 (no revelar que existe). Ver docs/datos/modelo.md, "Dueño de cada fila".
- Lo público a propósito (catálogo, carreras, ranking sin correos) está listado en el contrato.

## 4 · Validar en el servidor
- El formulario se salta con un curl: valida tipo, rango y obligatoriedad en Python.
- Precios, totales, tasas, descuentos, cuotas y saldos los calcula el servidor; del cliente solo se acepta la tasa "vista" para comparar y responder 409 si cambió.
- Las reglas que protegen dinero o datos ajenos también van en la base: `UNIQUE`, `CHECK`, claves foráneas.
- Operaciones que mueven saldo o stock: transacción + `SELECT … FOR UPDATE`.

## 5 · Nada de SQL con texto
- Siempre `cursor.execute(sql, params)` con `%s`. Nunca f-strings ni `+` con datos del usuario.
- Nombres de columnas u orden dinámico: solo desde una lista blanca.

## 6 · Errores discretos
- Al usuario: mensaje claro y el código HTTP del contrato (400, 401, 403, 404, 409).
- En el log: tipo de error y archivo:línea (`log_internal_error`), nunca SQL, contraseñas, tokens ni datos de pago.
- Un 500 dice solo "Error interno.".

## Antes de terminar
- [ ] ¿El cambio coincide con docs/contratos/api.md?
- [ ] ¿Probaste el caso feliz y al menos un caso de error con curl?
- [ ] ¿Un usuario A puede leer o cambiar algo de B? Debe responder 404.
- [ ] ¿Quedó registrado en `pitcoin_movements` o `admin_audit_log` si aplica?
- [ ] Nunca propongas desactivar validaciones, exponer credenciales o saltarte la sesión para "que funcione".
