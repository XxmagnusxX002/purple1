# Despliegue · Purple One en la nube

> **Tienda en Vercel. API, panel y MySQL en Railway.** El navegador solo ve el dominio de Vercel; Vercel reenvía `/api`, `/admin` e `/img/uploads` a Railway.
> Nunca pegues contraseñas en el chat, en el código ni en GitHub: solo en las variables de Railway y en Workbench.

---

## Paso 1 · Reemplazar la versión vieja en GitHub

La idea es **conservar el mismo repositorio** (así Vercel sigue conectado) y cambiar todo su contenido.

1. Abre en VS Code la carpeta del repositorio viejo (la que tiene la carpeta oculta `.git`).
2. Borra **todo** menos la carpeta `.git`. Eso incluye lo viejo: `tools/`, `.env.example`, `frontend/js/mock-api.js`, `mock-data.js` y los `docs/` anteriores.
   - Si no ves `.git`, en el Explorador de Windows activa **Vista → Mostrar → Elementos ocultos**.
3. Copia dentro **todo el contenido** de la carpeta `purple1` de este zip, también lo oculto: `.claude/`, `.gitignore`, `.vercelignore`.
4. Copia `database/purple1_completo.sql` desde tu `purple1_Sistema.zip` a `database/`. El `.gitignore` evita que suba a GitHub, pero lo necesitas en tu computador para el paso 2.
5. En la terminal de VS Code:

```bash
git add -A
git status          # revisa que NO aparezca purple1_completo.sql ni ningún .env
git commit -m "U4: sistema completo con back en Railway, modelo de datos, contrato y auditoria"
git push
```

> **Importante:** si subes archivos arrastrándolos en la página de GitHub, el `.gitignore` no te protege. En ese caso no arrastres `purple1_completo.sql`.

Vercel va a publicar solo. Hasta terminar el paso 3, la tienda carga, pero sin datos.

---

## Paso 2 · Back y base de datos en Railway

### 2.1 Crear el proyecto
1. Entra a https://railway.com e inicia sesión con tu cuenta de GitHub.
2. **New Project → Deploy from GitHub repo** y elige el repositorio de Purple One. Railway lee `railway.json` y arranca con `python main.py`. El primer arranque va a fallar porque todavía no hay base de datos; es normal.
3. En el mismo proyecto: **+ Create → Database → MySQL**.

### 2.2 Importar los datos con MySQL Workbench
1. En el servicio **MySQL → Settings → Networking**, copia el **TCP Proxy** (algo como `xxxx.proxy.rlwy.net` y un puerto como `12345`).
2. En **MySQL → Variables**, mira `MYSQL_ROOT_PASSWORD` (cópiala directo a Workbench, no la pegues en otro lado).
3. En Workbench: **+ (nueva conexión)** → Hostname = el del proxy, Port = el del proxy, Username = `root` → **Store in Vault** → pega la contraseña → **Test Connection**.
4. Abre la conexión → **Server → Data Import → Import from Self-Contained File** → elige `database/purple1_completo.sql` → **Start Import**.
5. Comprueba: `SELECT COUNT(*) FROM purple1.users;` debe dar más de 0.

### 2.3 Variables de entorno del servicio de la app
En el servicio de **Purple One** (no en MySQL) → **Variables → Raw Editor**, pega esto y cambia solo la última línea:

```
PURPLE1_DB_HOST=${{MySQL.MYSQLHOST}}
PURPLE1_DB_PORT=${{MySQL.MYSQLPORT}}
PURPLE1_DB_USER=${{MySQL.MYSQLUSER}}
PURPLE1_DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
PURPLE1_DB_NAME=purple1
PURPLE1_HOST=0.0.0.0
PURPLE1_TRUST_PROXY=1
PURPLE1_COOKIE_SECURE=1
PURPLE1_ALLOWED_ORIGINS=purple1-seven.vercel.app
```

- `${{MySQL.…}}` hace que Railway ponga los datos de la base solo (si tu servicio de base no se llama `MySQL`, cambia esa palabra).
- `PURPLE1_ALLOWED_ORIGINS` es el dominio de tu tienda en Vercel, **sin** `https://`. Si tienes más de uno, sepáralos con coma.
- `PORT` no se pone: lo pone Railway.
- Guarda (**Deploy**). Railway reinicia la app.

### 2.4 Dominio público
1. Servicio de Purple One → **Settings → Networking → Generate Domain**.
2. Te da algo como `purple1-production-ab12.up.railway.app`.
3. Prueba en el navegador: `https://purple1-production-ab12.up.railway.app/api/currencies` → debe mostrar JSON con las 11 monedas.

---

## Paso 3 · Conectar Vercel con Railway

1. Abre `vercel.json` y reemplaza las **4** veces que dice `TU-BACKEND.up.railway.app` por tu dominio de Railway (sin `https://` repetido).
2. Sube el cambio:

```bash
git add vercel.json
git commit -m "Conecta Vercel con el back en Railway"
git push
```

3. Cuando Vercel termine, abre tu URL de Vercel: el catálogo, las monedas y las carreras ya salen de la base real.

---

## Paso 4 · Pruebas de fuego (en la URL de Vercel)

Abre las herramientas del navegador (F12 → **Red**) para ver los códigos.

| # | Prueba | Debe pasar |
|---|---|---|
| 1 | Registrarte, iniciar sesión, comprar con otra moneda y pronosticar | Todo funciona y queda guardado al recargar |
| 2 | Misma cuenta en **dos pestañas**: pronostica en dos carreras a la vez más PitCoins de los que tienes | Una se acepta y la otra dice que no alcanzan; el saldo nunca queda negativo |
| 3 | Con la cuenta A, abre `/api/users/ID-de-B` | 403, no muestra los datos de B |
| 4 | Con una cuenta de cliente, abre `/admin` y `/admin/users.html` | Te manda al login del panel |
| 5 | Con una cuenta de cliente, abre `/api/admin/users` | 403 "Acceso restringido." |
| 6 | Entra al panel con una cuenta de staff | El panel funciona en el mismo dominio de Vercel |
| 7 | Busca `' OR 1=1 --` en el catálogo | 0 resultados, sin error |

Anota el resultado en la tabla de `docs/auditoria-u4.md`.

---

## Si algo falla

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Al iniciar sesión o pagar sale "Origen no permitido." | `PURPLE1_ALLOWED_ORIGINS` no coincide con tu dominio de Vercel | Copia el dominio exacto de la barra del navegador, sin `https://` ni `/` final |
| Railway: "Access denied" o "Unknown database" | Variables de la base mal puestas o no importaste el `.sql` | Revisa el paso 2.2 y 2.3; `PURPLE1_DB_NAME` debe ser `purple1` |
| Railway se reinicia con un error de contraseña por consola | Falta `PURPLE1_DB_PASSWORD` | Agrega la variable del paso 2.3 |
| La tienda carga pero sin productos | `vercel.json` aún dice `TU-BACKEND` | Paso 3 |
| Inicias sesión y al recargar se cierra | Abriste la app por el dominio de Railway y luego por el de Vercel | Usa siempre el de Vercel |
| Una imagen subida desde el panel desaparece | Railway borra el disco en cada redespliegue (hallazgo A-03) | Vuelve a subirla; la solución definitiva es un volumen (tarea N-1) |
| "Olvidé mi contraseña" responde que no está configurado | No hay servidor de correo | Es opcional: `PURPLE1_SMTP_HOST`, `PURPLE1_SMTP_FROM`, `PURPLE1_RESET_BASE_URL` |
