# Auditoría del back · Unidad 4

> Revisión del backend de Purple One con la skill `backend-seguro` (seis cerraduras) y el contrato `docs/contratos/api.md`.
> Hecha por: el equipo con Claude como auditor. Fecha: noviembre de 2026. Versión: sistema completo (`upgrade_08`).

## Resumen

| Severidad | Cantidad |
|---|---|
| Alta | 0 |
| Media | 3 |
| Baja | 4 |
| Corregidos en esta unidad | 4 (C-01 a C-04) |

## Lo que ya está bien (evidencia)

| Cerradura | Evidencia en el código |
|---|---|
| 1 · Secretos | La conexión a MySQL sale de variables `PURPLE1_DB_*` (`backend/database.py`). `purple1_completo.sql`, `.env` y `.vercel/` están en `.gitignore`. Nada secreto en `frontend/`. |
| 2 · Autenticado ≠ autorizado | `require_user` y `require_staff` (`server.py:124-139`) leen el rol de la base en cada petición. Rutas de superadmin en la lista `SUPERADMIN_API` (`server.py:301`). Las páginas del panel pasan por `admin_page_gate`. |
| 3 · Dueño de la fila | En las rutas con sesión el servidor reemplaza el `user_id` del cuerpo por el de la sesión. Carrito: un `item_id` ajeno responde 404 "Item no encontrado." (`cart.py:117-127`). |
| 4 · Validar en el servidor | Precios, tasas y descuentos se leen de la base (`orders.py:30-54`); si la tasa vista cambió → 409. Pronóstico mínimo, hora de cierre y saldo con `FOR UPDATE` (`bets.py:150-185`). Restricciones `UNIQUE`/`CHECK`/FK en `schema.sql`. Cuerpo JSON máximo 1 MB (`server.py:193`). |
| 5 · SQL parametrizado | Todas las consultas usan `cursor.execute(sql, params)` con `%s`. |
| 6 · Errores discretos | Excepciones → 500 "Error interno."; el detalle solo va al log sin SQL ni datos. El login no dice si falló el correo o la contraseña. Recuperar contraseña responde igual exista o no la cuenta. |
| Extra | Contraseñas PBKDF2-SHA256; sesión con token con hash; límite de 5 intentos de login por cuenta e IP; liquidación con huella (409 si algo cambió); auditoría en `admin_audit_log` dentro de la misma transacción. |

## Hallazgos

| ID | Hallazgo | Archivo:línea | Severidad | Cómo comprobarlo | Corrección |
|---|---|---|---|---|---|
| A-01 | Registro y recuperación de contraseña sin límite de intentos: se pueden crear cuentas o pedir correos en bucle | `server.py:743-752` | Media | `for i in $(seq 50); do curl -X POST .../api/auth/register ...; done` → todas responden | Reusar `auth_login_attempts` con una llave por IP para register y forgot-password (tarea T-B15) |
| A-02 | Si alguien llama directo al dominio de Render (sin pasar por Vercel), puede inventar `X-Forwarded-For` y saltarse el límite por IP del login | `server.py:142-149` | Media | `curl -H "X-Forwarded-For: 1.2.3.4" https://TU-BACKEND.onrender.com/api/auth/login` con varias IP | El límite por cuenta sigue activo. Mejora: aceptar `X-Forwarded-For` solo si trae un encabezado secreto que añada Vercel, o tomar la última IP de la lista |
| A-03 | Las imágenes subidas desde el panel se guardan en el disco del servicio de Render, que se borra en cada redespliegue | `uploads.py:16-53` | Media | Subir una imagen, hacer redeploy en Render y abrirla → 404 | Disco persistente de Render (plan pago) montado en `frontend/img/uploads` o un bucket (tarea N-1) |
| A-04 | El servidor atiende una petición a la vez (`HTTPServer`, no `ThreadingHTTPServer`) | `server.py:887` | Baja | Varias pestañas pagando a la vez: responden en fila | **Corregido (C-04):** se cambió a `ThreadingHTTPServer`; cada petición abre su propia conexión y las transacciones con `FOR UPDATE` protegen la concurrencia |
| A-05 | `GET /api/users/{id}` de otra persona responde 403 en vez de 404 (revela que el id existe) | `server.py:673-674` | Baja | Con sesión de A: `curl .../api/users/2` → 403 | Responder 404 "Usuario no encontrado." cuando no es el dueño ni staff |
| A-06 | Las rutas de la tienda usan el id en la URL (`/api/users/{id}`) en vez de `/api/users/me` | `server.py:668, 794, 820` | Baja | Revisión de código | Está protegido (se compara con la sesión), pero `/me` evita el error de raíz |
| A-07 | La página de la tienda en Vercel no tenía encabezados contra iframes (clickjacking) | `vercel.json` | Baja | `curl -I https://tu-proyecto.vercel.app` | **Corregido (C-01)** |

## Correcciones hechas en esta unidad

| ID | Qué se corrigió | Dónde |
|---|---|---|
| C-01 | Encabezados `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy` en todas las páginas de Vercel; `X-Frame-Options: DENY` también en Render | `vercel.json`, `server.py` (`end_headers`) |
| C-02 | El control de origen aceptaba solo el mismo Host; detrás del rewrite de Vercel fallaba. Se agregó la lista explícita `PURPLE1_ALLOWED_ORIGINS` (no un comodín) | `server.py` (`same_origin`) |
| C-04 | La página cargaba lenta porque el servidor atendía una petición a la vez | `server.py` línea 1 (`ThreadingHTTPServer`) |
| C-03 | El panel ya no se publica como archivos estáticos en Vercel: `.vercelignore` excluye `frontend/admin/` y el rewrite lo manda a Render, donde lo protege `admin_page_gate` | `.vercelignore`, `vercel.json` |

## Pruebas de fuego (a correr en la URL pública)

| Prueba | Resultado esperado | Resultado |
|---|---|---|
| Dos pestañas con la misma cuenta pronosticando a la vez más de lo que hay de saldo | Una responde 400; el saldo nunca baja de 0 | ☐ |
| Usuario A cambia en la pestaña Red el `item_id` por uno del carrito de B | 404 "Item no encontrado." | ☐ |
| Usuario A envía `"user_id"` de B al pronosticar | El pronóstico queda a nombre de A | ☐ |
| Un cliente abre `/admin/users.html` | Termina en el login del panel | ☐ |
| Un cliente llama `GET /api/admin/users` | 403 "Acceso restringido." | ☐ |
| Pago con el precio cambiado en el cuerpo | Se cobra el precio de la base | ☐ |
| Buscar `' OR 1=1 --` en el catálogo | 0 resultados, sin error | ☐ |
