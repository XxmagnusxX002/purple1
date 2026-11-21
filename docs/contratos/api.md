# Contrato de la API · Purple One

> El acuerdo entre el front y el back. Si el código y este documento no coinciden, uno de los dos está mal.
> Servidor: `backend/server.py` (Python 3 + MySQL). Formato: JSON.

## Reglas comunes

| Regla | Detalle |
|---|---|
| Base | `/api` (en producción, Vercel la reenvía a Render: el navegador ve el mismo dominio) |
| Sesión | Cookie `purple1_session` (`HttpOnly`, `SameSite=Strict`, `Secure` en la nube), 7 días. El token se guarda con hash en `auth_sessions`. |
| Usuario | Siempre sale de la sesión. Si el cuerpo trae `user_id`, el servidor lo reemplaza por el de la sesión. |
| Origen | Todo POST/PUT/DELETE debe venir del mismo sitio (`Origin`/`Referer` = `Host` o un dominio de `PURPLE1_ALLOWED_ORIGINS`). Si no: **403 "Origen no permitido."** |
| Respuesta correcta | `{"success": true, ...datos}` |
| Respuesta de error | `{"success": false, "error": "mensaje claro"}` |
| Datos mal formados | **400 "Solicitud inválida."** |
| Fallo inesperado | **500 "Error interno."** (el detalle va solo al log del servidor, sin SQL ni datos) |

### Códigos de estado

| Código | Significa | Ejemplo en Purple One |
|---|---|---|
| 200 | Todo bien | Ver catálogo, pronosticar, pagar |
| 201 | Creado | Registro de cuenta |
| 400 | Datos inválidos | Correo mal escrito, carrito vacío, pronóstico bajo el mínimo |
| 401 | Sin sesión o credenciales malas | Ver el carrito sin entrar; contraseña incorrecta |
| 403 | Sesión válida pero sin permiso | Un cliente llamando `/api/admin/*`; un admin en ruta de superadmin |
| 404 | No existe (o no es tuyo) | Carrera, piloto o ítem de carrito inexistente |
| 409 | Conflicto con el estado actual | La tasa de cambio cambió; referencia de PitCoins repetida |
| 429 | Demasiados intentos | 5 fallos de login en 15 min |
| 503 | Servicio no configurado | Recuperar contraseña sin SMTP |

---

## 1. Cuenta y sesión (F1)

### POST /api/auth/register
- **Quién:** cualquiera (sin sesión).
- **Entrada:** `{ "first_name", "last_name", "email", "phone"?, "password", "confirm_password" }`
- **Éxito 201:** `{ "success": true, "user": { "id", "first_name", "email", "coins": 1000 } }` (saldo inicial = `pitcoins.opening_balance`). No inicia sesión: después se llama a login.

| Situación | Código | Mensaje |
|---|---|---|
| Falta un campo | 400 | "Completa todos los campos obligatorios." |
| Correo inválido | 400 | "Correo electronico invalido." |
| Teléfono con más de 10 números | 400 | "El telefono debe tener maximo 10 numeros." |
| Contraseñas distintas | 400 | "Las contrasenas no coinciden." |
| Contraseña de menos de 8 caracteres | 400 | "La contrasena debe tener minimo 8 caracteres." |
| Correo ya registrado | 400 | "Ya existe una cuenta con ese correo." |

### POST /api/auth/login
- **Quién:** cualquiera.
- **Entrada:** `{ "email", "password" }`
- **Éxito 200:** `{ "success": true, "user": {...} }` + cookie de sesión.

| Situación | Código | Mensaje |
|---|---|---|
| Correo o contraseña incorrectos | 401 | "Correo o contrasena incorrectos." (no dice cuál falló) |
| 5 fallos seguidos de esa cuenta e IP | 429 | "Demasiados intentos. Espera 15 minutos." |

### POST /api/auth/logout
- **Quién:** con sesión. Borra la sesión en la base y la cookie. **200.**

### GET /api/auth/me
- **Quién:** con sesión. **200** `{ "user": { id, first_name, email, coins, xp_total, level, is_staff } }`. Sin sesión: **401**.

### POST /api/auth/change-password
- **Entrada:** `{ "current_password", "new_password", "confirm_password" }`

| Situación | Código | Mensaje |
|---|---|---|
| Contraseña actual incorrecta | 401 | "La contrasena actual no es correcta." |
| No coinciden | 400 | "Las contrasenas no coinciden." |

### POST /api/auth/forgot-password · POST /api/auth/reset-password
- **forgot:** `{ "email" }` → **200** siempre con el mismo mensaje (no revela si el correo existe). Sin SMTP: **503** "La recuperación por correo aún no está configurada."
- **reset:** `{ "token", "password", "confirm_password" }` → **200**. Enlace vencido (30 min) o usado: **400** "El enlace venció o ya fue utilizado."

### GET / PUT / DELETE /api/users/{id}
- **Quién:** el propio usuario. GET también staff; PUT de roles solo superadmin.
- **PUT entrada:** `{ "first_name", "last_name", "phone", "address" }` (lista blanca: el resto se ignora).
- **DELETE:** desactiva la cuenta (`is_active = FALSE`), no la borra.
- Otro usuario: **403** (ver hallazgo A-05 en `docs/auditoria-u4.md`).

---

## 2. Catálogo y moneda (F2) · públicas

| Operación | Entrada | Éxito 200 |
|---|---|---|
| GET /api/currencies | — | `{ currencies: [{ code, name, symbol, rate, decimals }] }` (solo activas) |
| GET /api/home | — | banners, destacados, nuevos |
| GET /api/products | `?page&limit` | `{ products: [{ id, name, price, images, ... }] }` |
| GET /api/products/search | `?q=` | productos que coinciden |
| GET /api/products/filter | `?category&team&size&color&min&max` | productos filtrados |
| GET /api/products/{id} | — | detalle con variantes y stock. Inexistente o inactivo: **404** |
| GET /api/categories, /api/teams, /api/sizes, /api/colors, /api/banners | — | listas activas |

Los precios se guardan en EUR; el front muestra la conversión, pero **el cobro lo recalcula el servidor**.

---

## 3. Carrito y pago (F3) · con sesión

### GET /api/cart?currency=COP&reward=10
- **Éxito 200:** `{ items: [...], subtotal, discount, total, currency, rate, total_local }`. Sin sesión: **401**.

### POST /api/cart/add
- **Entrada:** `{ "inventory_id", "quantity" }`

| Situación | Código | Mensaje |
|---|---|---|
| Faltan datos o cantidad ≤ 0 | 400 | "Inventario y cantidad válidos son obligatorios." |
| Variante inexistente | 404 | "Inventario no encontrado." |
| No hay stock | 400 | "Stock insuficiente." |

### PUT /api/cart/update · DELETE /api/cart/remove
- **Entrada:** `{ "item_id", "quantity" }` / `{ "item_id" }`.
- Ítem que no está en **tu** carrito: **404** "Item no encontrado." Sin stock: **400** "Stock insuficiente."

### POST /api/payments/simulate
- **Entrada:** `{ "currency_code", "seen_rate", "discount_reward_id"?, "card_number", "card_name", "expiry", "cvv" }`
- **Éxito 200 aprobado:** `{ approved: true, payment_status: "APPROVED", order: { id, total, total_local, currency_code }, card_last4, card_brand }`
- **Éxito 200 rechazado:** `{ approved: false, payment_status: "REJECTED", reason }` (tarjeta inválida, nada se cobra ni se descuenta)
- No se guarda el número de tarjeta: solo los 4 últimos y la marca.

| Situación | Código | Mensaje |
|---|---|---|
| Carrito vacío | 400 | "El carrito esta vacio." |
| Moneda inactiva | 400 | "Esa moneda no está disponible. Elige otra para pagar." |
| La tasa cambió desde que se vio el total | 409 | "La tasa de cambio de COP se actualizó. Revisa el total del carrito antes de pagar." |
| Descuento cambió o desactivado | 409 | "Ese descuento cambió o ya no está disponible..." |
| PitCoins insuficientes para el descuento | 409 | "No tienes PitCoins suficientes para ese descuento." |
| Producto desactivado | 400 | "Ya no está disponible: …" |
| Stock agotado durante el pago | 400 | "Stock insuficiente para …" |

### GET /api/orders · GET /api/rewards
- Solo los pedidos del usuario de la sesión. `rewards`: descuentos disponibles según su saldo.

---

## 4. Pronósticos y PitCoins (F4) 

### GET /api/races · GET /api/races/{id} · GET /api/races/leaderboard (públicas)
- `races`: calendario con estado y hora de cierre. `{id}`: participantes y bolsa por piloto.
- `leaderboard`: `{ leaders: [{ username, coins }] }` — nunca correos.

### POST /api/races/{id}/bet
- **Quién:** con sesión.
- **Entrada:** `{ "option_id", "amount" }`
- **Éxito 200:** `{ success: true, bet: { id, option_id, amount }, user: { coins } }`. Si ya había pronóstico, lo cambia y ajusta la diferencia de PitCoins.

| Situación | Código | Mensaje |
|---|---|---|
| Sin sesión | 401 | "Inicia sesión para continuar." |
| Faltan datos | 400 | "user_id y option_id son obligatorios." |
| Menos del mínimo | 400 | "El pronóstico mínimo es de N PitCoins." |
| Carrera inexistente | 404 | "Carrera no encontrada." |
| Piloto que no corre esa carrera | 404 | "Piloto no encontrado en esta carrera." |
| Carrera cerrada o ya pasó la hora | 400 | "Los pronosticos para esta carrera no estan abiertos." |
| Saldo insuficiente | 400 | "No tienes suficientes PitCoins para este pronostico." |

### GET /api/bets · GET /api/pitcoins/movements · GET /api/progress
- Solo los del usuario de la sesión: pronósticos, historial de PitCoins (con saldo después de cada movimiento) y XP/nivel/rango.

---

## 5. Avatar (F5) · con sesión

| Operación | Entrada | Éxito | Errores |
|---|---|---|---|
| GET /api/avatar | — | `{ config, owned, catalog }` | 401 |
| PUT /api/avatar | `{ config }` | 200 | 400 "Falta la seleccion del avatar." · 400 "Esa prenda no existe." · 403 "Todavia no tienes …" |
| POST /api/avatar/buy | `{ item_id }` | 200 `{ coins }` | 404 "Esa prenda no existe." · 400 "Esta prenda no se compra: se desbloquea acertando pronosticos." · 400 "Ya tienes esta prenda." · 400 "Te faltan N PitCoins…" |

---

## 6. Panel administrativo (F7) · `/api/admin/*`

- **Sin sesión:** 401 "Inicia sesión para continuar." **Cliente:** 403 "Acceso restringido." **Admin (staff):** catálogo, inventario, carreras, pilotos, pedidos, banners.
- **Solo superadmin** (`SUPERADMIN_API`): monedas, descuentos, parámetros, usuarios y roles, auditoría, ajustes de PitCoins.
- Toda escritura queda en `admin_audit_log` en la misma transacción.

| Grupo | Rutas | Notas |
|---|---|---|
| Sesión | POST login, GET session | login propio del panel |
| Resumen | GET dashboard, sales, orders/stats | solo lectura |
| Catálogo | categories, product-types, sizes, colors, products, products/{id}/flags, variants, variants/{id}/stock, images, uploads, banners, catalog | stock negativo → 400 |
| Carreras | teams, drivers, team-options, races, races/{id}/status, participants, settlement, bets | liquidación con vista previa + huella; si cambió → 409 |
| Pedidos | orders | solo lectura |
| Superadmin | currencies, discount-rewards, settings, users, users/{id}/access, audit, pitcoins, pitcoins/adjust | ver abajo |

### POST /api/admin/pitcoins/adjust (superadmin)
- **Entrada:** `{ "user_id", "amount", "reference", "reason", "confirm": true }`

| Situación | Código | Mensaje |
|---|---|---|
| No confirmado | 400 | "Confirma el ajuste de PitCoins." |
| Faltan datos | 400 | "Indica usuario, importe, referencia única y motivo." |
| Usuario inexistente | 404 | "Usuario no encontrado." |
| Referencia repetida | 409 | "La referencia ya fue utilizada." |
| No es superadmin | 403 | — |

### Páginas del panel (`/admin/*.html`)
Las sirve Render, no Vercel. El servidor las protege: sin sesión de staff redirige al login del panel. Solo `login.html` y sus recursos son públicos.
