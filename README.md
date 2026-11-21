# Purple One

Tienda en línea de merchandising de Fórmula 1 con pronósticos de carreras (PitCoins, una moneda virtual sin valor real), progresión por niveles, avatar personalizable y panel administrativo.

Es un proyecto universitario hecho con tecnologías básicas:

- **Backend:** Python puro (`http.server`), sin frameworks ni ORM.
- **Frontend:** HTML, CSS y JavaScript puro.
- **Base de datos:** MySQL 8.0.16 o superior, administrada con MySQL Workbench.

> **Fines académicos.** Los pagos y los pronósticos son simulados: no hay dinero real. Los PitCoins no se compran con dinero, no se retiran, no se transfieren ni se convierten en efectivo. Los clientes, ventas y pronósticos de demostración son ficticios; las escuderías, pilotos, calendario, participantes y ganadores de la temporada 2026 de Fórmula 1 son datos oficiales (formula1.com).

**Versión en la nube (Diplomado IA, U4):** [purple1-seven.vercel.app](https://purple1-seven.vercel.app/). La tienda está en Vercel y la API, el panel y MySQL en Railway. Pasos en [DESPLIEGUE.md](DESPLIEGUE.md). Documentación SDD en [docs/](docs/README.md).

**¿Instalar en otro computador con los mismos datos?** Sigue [INSTALACION_OTRO_PC.md](INSTALACION_OTRO_PC.md): basta con importar `database/purple1_completo.sql`.

---

## 1. Estructura

```text
purple1/
├── backend/        # Servidor y lógica (un módulo por tema)
│   ├── server.py         # Rutas HTTP y archivos estáticos
│   ├── database.py       # Conexión a MySQL
│   ├── auth.py, security.py, users.py           # Registro, login y sesiones
│   ├── products.py, categories.py, cart.py      # Tienda y carrito
│   ├── orders.py, payments_sim.py               # Pedidos y pago simulado
│   ├── bets.py, coins.py, progression.py        # Pronósticos, PitCoins y XP
│   ├── avatar.py                                # Avatar del perfil
│   └── admin_*.py, audit.py, uploads.py         # Panel administrativo
├── database/
│   ├── schema.sql        # Esquema completo (instalación nueva)
│   ├── seed.sql          # Datos iniciales (instalación nueva)
│   ├── upgrade.sql       # Actualiza una base de la versión anterior
│   ├── upgrade_02_superadmin.sql   # Rol de superadministrador
│   ├── upgrade_03_catalogo.sql     # Catálogo dinámico, promociones y especificaciones
│   ├── upgrade_04_home.sql         # Portada dinámica y limpieza de imágenes provisionales
│   ├── upgrade_05_monedas.sql      # Monedas y tasas de cambio; moneda de cada pedido
│   ├── upgrade_06_fidelizacion.sql # Parámetros administrables (app_settings)
│   ├── upgrade_07_f1_2026.sql      # Datos oficiales de F1 2026 (escuderías, pilotos, calendario y resultados)
│   ├── upgrade_08_canje_pitcoins.sql # Economía definitiva: descuentos canjeables con PitCoins
│   ├── upgrade_09_clasificacion.sql  # Clasificación oficial de cada carrera disputada
│   ├── demo_data.sql     # Datos de DEMOSTRACIÓN simulados (clientes, ventas, pronósticos)
│   └── purple1_completo.sql        # Copia completa de la base (para otro computador)
├── frontend/
│   ├── *.html, css/, js/, img/   # Tienda
│   └── admin/                    # Panel administrativo
├── main.py           # Punto de entrada
├── requirements.txt
├── INSTALACION_OTRO_PC.md   # Guía para instalar en otro equipo
└── README.md
```

## 2. Requisitos

- Python 3.10 o superior.
- MySQL Server 8.0.16 o superior y MySQL Workbench.
- Dependencias de Python:

```powershell
python -m pip install -r requirements.txt
```

`requirements.txt` instala `mysql-connector-python` y `tzdata`. **`tzdata` es obligatorio en Windows**: aporta las zonas horarias de los circuitos (por ejemplo `Europe/Monaco`). Si falta, el servidor lo avisa al arrancar.

## 3. Base de datos

Hay dos formas de tener la base:

| Opción | Archivos | Resultado |
|---|---|---|
| **A. Copia completa** (recomendada para la exposición) | `purple1_completo.sql` | La base exactamente igual a la original, con todos los datos. Ver [INSTALACION_OTRO_PC.md](INSTALACION_OTRO_PC.md) |
| **B. Instalación desde cero** | `schema.sql` → `seed.sql` → (opcional) `demo_data.sql` | Estructura, catálogo y datos oficiales de F1 2026; con `demo_data.sql`, además los datos de demostración |

| Archivo | Contenido |
|---|---|
| `schema.sql` | Estructura: tablas, claves, restricciones e índices |
| `seed.sql` | Configuración inicial y catálogos oficiales: monedas, parámetros, descuentos con PitCoins, categorías, tallas, colores, productos base, escuderías, pilotos, calendario 2026 con participantes y ganadores |
| `demo_data.sql` | **Datos simulados para fines académicos**: 30 clientes ficticios de Latinoamérica, 2 cuentas del equipo, 37 productos más, 150 pedidos (junio–noviembre de 2026), 268 pronósticos en las 20 carreras oficiales ya disputadas, PitCoins, XP, niveles, canjes y 3 banners |
| `upgrade_*.sql` | Actualizan una base existente de una versión anterior |
| `purple1_completo.sql` | Copia completa de la base `purple1` (estructura + datos) |

### 3.1 Instalación nueva desde cero (equipo sin la base `purple1`)

En MySQL Workbench, conéctate a tu instancia local y ejecuta, en este orden:

1. `database/schema.sql`: crea la base `purple1` con todas sus tablas.
2. `database/seed.sql`: carga la configuración, el catálogo base, los datos oficiales de F1 2026 y dos cuentas de ejemplo.
3. *(Opcional)* `database/demo_data.sql`: carga los datos de demostración simulados. Ejecútalo una sola vez.

Para ejecutar cada archivo: *File → Open SQL Script*, y después el botón del rayo (*Execute*).

`schema.sql` no borra nada. Si la base ya tiene tablas, se detiene con un error en lugar de sobrescribirlas.

### 3.2 Actualizar una base existente

Si ya tenías la base `purple1` de una versión anterior:

1. Detén el servidor.
2. Haz un respaldo: *Server → Data Export*, base `purple1`, *Export to Self-Contained File*. Guárdalo **fuera** de la carpeta del proyecto.
3. Ejecuta, **en orden y una sola vez cada uno**, los scripts que tu base todavía no tenga:

| Script | Qué agrega | Cómo saber si ya está aplicado |
|---|---|---|
| `upgrade.sql` | Panel administrativo, sesiones, historial de PitCoins, XP, pilotos y banners | Existe la tabla `pitcoin_movements` |
| `upgrade_02_superadmin.sql` | Rol de superadministrador | Existe la columna `users.is_superadmin` |
| `upgrade_03_catalogo.sql` | Promociones reales, características y especificaciones por producto, plantillas por tipo, administración de categorías, tallas y colores | Existe la tabla `product_specs` |
| `upgrade_04_home.sql` | Imagen de categoría para la portada y retiro de las referencias a imágenes provisionales | Existe la columna `categories.image_path` |
| `upgrade_05_monedas.sql` | Tabla `currencies` con 11 monedas y tasas manuales; moneda, tasa e importes locales en pedidos, líneas y pagos (los pedidos anteriores quedan en EUR con tasa 1) | Existe la tabla `currencies` |
| `upgrade_06_fidelizacion.sql` | Tabla `app_settings` (parámetros de PitCoins, XP y descuentos) y primera versión de recompensas | Existe la tabla `app_settings` |
| `upgrade_07_f1_2026.sql` | 11 escuderías, 25 pilotos, calendario de 23 Grandes Premios, participantes y ganadores oficiales. Se puede ejecutar más de una vez; no crea PitCoins ni XP | Existe la carrera «Gran Premio de Baréin en Malasia» |
| `upgrade_08_canje_pitcoins.sql` | Economía definitiva: tabla `discount_rewards`, descuento canjeado en cada pedido y tipo de movimiento `DISCOUNT_REDEMPTION` (retira los cupones por objetivos de la versión anterior) | Existe la tabla `discount_rewards` |
| `upgrade_09_clasificacion.sql` | Posición oficial de cada participante (NC = no clasificado) en las carreras disputadas | Existe la columna `race_options.finish_position` |

Una instalación nueva con `schema.sql` ya incluye todo: no ejecutes estos scripts en ella.

El script añade las tablas nuevas (sesiones, historial de PitCoins, XP, auditoría, pilotos y banners), las columnas y las restricciones. **Conserva** usuarios, productos, pedidos, saldos, pronósticos y prendas del avatar. A cada usuario le registra su saldo actual como saldo inicial de PitCoins y crea los pilotos a partir de las carreras existentes. No borra ni vacía ninguna tabla.

## 4. Configuración de la conexión

Por defecto el proyecto se conecta a la instancia local de MySQL Workbench:

| Dato | Valor por defecto | Variable para cambiarlo |
|---|---|---|
| Host | `127.0.0.1` | `PURPLE1_DB_HOST` |
| Puerto | `3306` | `PURPLE1_DB_PORT` |
| Usuario | `root` | `PURPLE1_DB_USER` |
| Base de datos | `purple1` | `PURPLE1_DB_NAME` |
| Contraseña | *(se pide al arrancar)* | `PURPLE1_DB_PASSWORD` |

**La contraseña nunca se guarda en el código.** No hace falta ningún archivo `.env`.

## 5. Ejecutar

Desde la carpeta `purple1`:

```powershell
python main.py
```

El programa pide la contraseña de MySQL (no se ve al escribirla) y muestra:

```text
Contrasena de MySQL para root@127.0.0.1:3306 (base purple1):
Probando conexion a MySQL...
Conexion MySQL exitosa: database=purple1 version=... host=127.0.0.1 user=root port=3306
Progresion XP: activa.
Servidor Python puro iniciado
Frontend: http://127.0.0.1:8000/index.html
```

Para no escribir la contraseña cada vez, en PowerShell (solo dura esa ventana):

```powershell
$env:PURPLE1_DB_PASSWORD = "<tu contraseña local>"
python main.py
```

Después abre:

- Tienda: <http://127.0.0.1:8000/index.html>
- Panel administrativo: <http://127.0.0.1:8000/admin/>

Para detener el servidor: `Ctrl + C`.

### Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `Access denied for user 'root'` | La contraseña de MySQL no es correcta |
| `Can't connect to MySQL server` | El servicio de MySQL no está iniciado (Workbench → *Server → Startup/Shutdown*) |
| `Unknown database 'purple1'` | Falta ejecutar `schema.sql` y `seed.sql` |
| `Faltan las zonas horarias de Python` | `python -m pip install -r requirements.txt` |
| `El XP esta activo pero falta ...` | La base es de la versión anterior: ejecuta `upgrade.sql` |

## 6. Roles, cuentas y acceso al panel

| Rol | Columnas en `users` | Puede |
|---|---|---|
| Cliente | `is_staff = FALSE` | Usar la tienda, pronosticar, avatar |
| Administrador | `is_staff = TRUE` | Operar el panel: productos, equipos, pilotos, carreras, pronósticos, pedidos, banners y consulta de usuarios |
| Superadministrador | `is_staff = TRUE`, `is_superadmin = TRUE` | Todo lo anterior, más: roles y activación de cuentas, PitCoins (movimientos y ajustes manuales) y auditoría |

Los permisos se validan **en el backend** en cada petición (`SUPERADMIN_API` en `backend/server.py`); el menú del panel solo oculta lo que el rol no puede usar. Nadie puede cambiar su propio rol ni desactivarse, y siempre debe quedar al menos un administrador y un superadministrador activo.

**Primer superadministrador.** No se asigna automáticamente. Elige la cuenta y ejecútalo en MySQL Workbench:

```sql
SELECT id, email, first_name, last_name FROM purple1.users WHERE is_staff = TRUE AND is_active = TRUE;
UPDATE purple1.users SET is_superadmin = TRUE WHERE email = '<correo elegido>';
```

Desde ese momento, los demás roles se gestionan en *Panel → Usuarios → Ver detalle → Acceso*.

### Cuentas de demostración (con `demo_data.sql` o `purple1_completo.sql`)

Exclusivas para la exposición (correos `@demo.purpleone.test`, inexistentes). No son credenciales reales: cámbialas si el proyecto sigue en uso.

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | `valentina.rios@demo.purpleone.test` (y los otros 29 clientes) | `PurpleDemo2026` |
| Administrador | `admin.demo@demo.purpleone.test` | `AdminDemo#2026` |
| Superadministrador | `superadmin.demo@demo.purpleone.test` | `SuperDemo#2026` |

### Cuentas de ejemplo

`seed.sql` crea dos cuentas de ejemplo con contraseñas **públicas** (documentadas solo para la instalación local):

| Cuenta | Contraseña inicial | Rol |
|---|---|---|
| `demo@purpleone.com` | `Demo1234` | Cliente |
| `admin@purpleone.com` | `Admin1234` | Staff |

Por seguridad, mientras una cuenta staff conserve su contraseña pública **no obtiene permisos de staff** y no puede entrar al panel. Para habilitarla:

1. Inicia sesión en la tienda (`auth.html`) con esa cuenta.
2. La tienda te lleva a *Cambiar contraseña*: escribe la actual y una nueva.
3. Entra al panel con la contraseña nueva: <http://127.0.0.1:8000/admin/>.

Para convertir en staff cualquier otra cuenta, desde MySQL Workbench:

```sql
UPDATE purple1.users SET is_staff = TRUE WHERE email = 'correo@ejemplo.com';
```

## 7. Funcionalidades

### Tienda

- Catálogo con búsqueda y filtros por categoría, equipo, talla, color y precio.
- Detalle de producto con variantes (talla y color) y stock.
- Carrito por usuario y pago simulado con tarjeta. Los datos de la tarjeta **no se guardan**: solo se valida su formato. Al aprobarse el pago se crea el pedido, se registra el pago y se descuenta el stock en una sola transacción.
- **Multimoneda:** EUR, USD, COP, MXN, ARS, CLP, PEN, BRL, UYU, PYG y BOB. Los precios se guardan en EUR (moneda base) y las tasas están en la tabla `currencies` (no hay tasas escritas en JavaScript). El carrito y el pago los calcula el backend en la moneda elegida; si la tasa cambia mientras el cliente paga, el pago se rechaza sin cobrar y el carrito muestra el total nuevo.
- **Mis pedidos** (`orders.html`, en el menú de la cuenta): historial con la moneda, la tasa y los importes originales de cada compra.
- Intro 3D con scroll (WebGL sin librerías). Para verla otra vez: `index.html?intro=1`.

### Pronósticos y PitCoins

- Cada usuario recibe **1000 PitCoins** al registrarse (configurable). Es una moneda virtual simulada: no se compra con dinero, no se retira, no se transfiere ni se convierte en efectivo.
- **Ciclo de la economía.** Entran PitCoins por el saldo inicial y las recompensas por nivel; los premios de pronósticos solo reparten lo apostado (bote parimutuel). Salen por el avatar y por los **descuentos de la tienda**.
- **Descuentos con PitCoins** (economía definitiva): en el carrito se elige un descuento del 5 % (500 PitCoins), 10 % (1.000), 15 % (2.000) o 20 % (3.500). Uno por pedido, solo sobre productos (nunca el envío), máximo absoluto 20 %, compatible con todas las monedas. Los PitCoins se descuentan solo si el pago se aprueba, en la misma transacción (movimiento `DISCOUNT_REDEMPTION`); si el pago se rechaza no se toca el saldo. El perfil muestra los descuentos alcanzables y los últimos canjes. Porcentajes, costos, disponibilidad y tope se administran en *Configuración*.
- En `races.html` se elige el ganador de cada Gran Premio. Hay un pronóstico por carrera y se puede cambiar mientras esté abierta. Los pronósticos se cierran solos a la hora de salida (guardada en UTC).
- El staff liquida la carrera desde el panel. El bote se reparte entre quienes acertaron y, si nadie acierta, se devuelven los PitCoins. Cancelar una carrera también devuelve los PitCoins.
- Cada cambio de saldo queda en `pitcoin_movements`, y `users.coins` siempre coincide con la suma de ese historial.

### Experiencia, niveles y recompensas

- Por cada carrera liquidada se obtiene: **20 XP** por participar, **50 XP** más por acertar y **30 XP** una sola vez con el primer pronóstico liquidado. Una carrera cancelada no da XP.
- Pasar del nivel *n* al *n + 1* cuesta `50 + 12·(n − 1)` XP.
- Rangos: Novato (niveles 1–5), Amateur (6–10), Profesional (11–20) y Leyenda (21+).
- Cada nivel alcanzado paga una vez 50, 75, 100 o 150 PitCoins, según el rango.
- El perfil muestra el nivel, el rango, la barra de progreso, el último XP ganado y los movimientos de PitCoins.
- Se puede desactivar con la variable `PURPLE1_XP_ENABLED=0` (activo por defecto).

### Avatar

- En `profile.html` el avatar se viste por partes. Hay prendas gratis, prendas que se desbloquean al acertar pronósticos y prendas que se compran con PitCoins.
- El catálogo de prendas está en `backend/avatar.py` (lista `CATALOG`).

### Panel administrativo (`/admin/`)

- **Dashboard:** usuarios, compras, ingresos aprobados en EUR, pedidos por estado, más vendidos, poco inventario y gráfico de ventas.
- **Productos:** datos, precio, categorías, equipos, imágenes (galería o subida de PNG, JPEG o WebP de hasta 2 MB), variantes y stock.
- **Equipos y pilotos:** colores, logos, números y nacionalidad.
- **Carreras:** calendario con hora local del circuito, participantes, apertura y cierre de pronósticos, liquidación con vista previa y cancelación con devolución.
- **Pronósticos y pedidos:** consulta y estadísticas de ventas. Informes consolidados en EUR; el detalle del pedido muestra además lo que pagó el cliente en su moneda y la tasa usada.
- **Banners de la portada** y **consulta de usuarios**.
- Solo superadministrador: **roles de usuarios**, **PitCoins** (movimientos con búsqueda por nombre o correo, ingresos/egresos, detalle y ajustes manuales), **Configuración** (`/admin/settings.html`: monedas y tasas, descuentos con PitCoins, parámetros de PitCoins y XP) y **auditoría** (`/admin/audit.html`, acciones traducidas y detalle de solo lectura).
- Nada se borra físicamente: productos, equipos y pilotos se desactivan. Cada acción queda en `admin_audit_log`.
- Las rutas `/api/admin/*` responden 401 sin sesión y 403 sin permisos. Los permisos se validan en el backend en cada petición.

### Seguridad

- Contraseñas con PBKDF2-SHA256.
- Sesiones con cookie `HttpOnly` y `SameSite=Strict`, guardadas como hash en `auth_sessions`.
- 5 intentos fallidos por IP y correo bloquean esa combinación 15 minutos.
- La recuperación de contraseña por correo necesita un servidor SMTP: `PURPLE1_SMTP_HOST`, `PURPLE1_SMTP_PORT`, `PURPLE1_SMTP_FROM` y `PURPLE1_RESET_BASE_URL`. Para pruebas locales puede usarse un capturador como Mailpit en el puerto 1025.

## 8. Prueba manual recomendada

1. `python main.py` y abrir <http://127.0.0.1:8000/index.html>.
2. Registrarse en `auth.html`. El usuario empieza con 1000 PitCoins.
3. Buscar y filtrar en `products.html`, abrir un producto y agregarlo al carrito.
4. En `cart.html`, cambiar cantidades y pagar con datos de tarjeta de prueba (por ejemplo `4111 1111 1111 1111`, `12/30`, `123`).
5. En `profile.html`, comprar una prenda con PitCoins y revisar la progresión.
6. Con una cuenta staff, crear una carrera en `/admin/races.html`, agregar pilotos y abrirla.
7. Hacer un pronóstico en `races.html`. Después de la hora de salida, cerrar y liquidar la carrera desde el panel.
8. Revisar en el perfil el XP, el nivel, la recompensa y la prenda desbloqueada.

## 9. Imágenes

- Fotografías de pilotos (`frontend/img/drivers/`) y de los monoplazas 2026 (`frontend/img/teams/`): Wikimedia Commons, con autor y licencia de cada archivo en `frontend/img/CREDITOS.md`.
- Escudos de escudería: `frontend/img/teams/*-logo.jpeg` (los que traía el proyecto).
- Imágenes subidas desde el panel: `frontend/img/uploads/`.

### Imágenes que faltan

**Por conseguir para la exposición** (formato JPEG o WebP, menos de 2 MB; se suben desde el panel):

- *Productos* (1000 × 1250 px, 4:5, producto centrado sobre fondo blanco o gris muy claro): Hoodie McLaren Papaya, Hoodie Aston Martin Racing Green, Camiseta Williams Grove, Camiseta Cadillac Debut Season, Camiseta Audi R26, Chaqueta Red Bull Softshell, Chaqueta Mercedes Impermeable, Gorra Haas F1 Team, Gorra Alonso 14, Mochila Ferrari Commuter, Mochila Racing Travel, Riñonera McLaren, Llavero Volante F1, Termo Paddock, Miniatura Mercedes W17 1:43, Miniatura McLaren MCL40 1:43, Miniatura F1 Ferrari SF-24, Casco Réplica Leclerc 1:2, Póster Calendario 2026, Póster Circuitos Icónicos, Pack Escudería Ferrari, Pack Escudería McLaren (y Camiseta Temporada 2025, inactiva).
- *Banners* (1600 × 900 px, 16:9, sin texto en la imagen, motivo a la derecha; guardarlos en `frontend/img/banners/`): `banner-tienda.jpg` (hoodie, gorra y miniatura sobre fondo lavanda #F3ECFF con acentos #7B2CFF; hoy usa `img/ropa.png`) y `banner-pronosticos.jpg` (casco y monoplaza en pista nocturna con luces moradas; hoy usa `img/escuderia.png`).

Mientras tanto la tienda muestra el icono neutro, sin imágenes provisionales.

La tienda nunca muestra imágenes provisionales. Cuando un producto no tiene imagen real se ve un **icono neutro** según su tipo (prenda, bolso, trofeo, bandera a cuadros o caja) sobre un fondo lavanda; si un archivo de imagen se borra, la tienda pasa sola a ese icono. Cada Gran Premio se identifica con la **bandera de su país** (SVG simplificado incluido en `frontend/js/media.js`, sin descargas): se resuelve con el campo *País* de la carrera y, si falta, con el nombre de la carrera o del circuito. Si no se reconoce, se muestra un icono de bandera a cuadros.

