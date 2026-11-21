# Despliegue · Purple One en la nube

> **Tienda en Vercel · API y panel en Render · MySQL en Railway.** Es el esquema de clase: Frontend → Backend → Base de datos, con GitHub y GitHub Actions en el centro.
> El navegador solo ve el dominio de Vercel (`purple1-seven.vercel.app`); Vercel reenvía `/api`, `/admin` e `/img/uploads` a Render.
> Nunca pegues contraseñas en el chat, en el código ni en GitHub: solo en las variables de Render y en Workbench.

```
GitHub (main) ──push──► GitHub Actions (revisa) 
      │                         
      ├──► Vercel  (frontend/)            purple1-seven.vercel.app
      └──► Render  (python main.py) ──►  MySQL en Railway
```

Cada `git push` a `main` vuelve a publicar Vercel y Render solos.

---

## Paso 1 · Base de datos MySQL en Railway

Render solo ofrece Postgres, así que la base MySQL vive en Railway.

1. Entra a https://railway.com con tu cuenta de GitHub → **New Project → Database → MySQL** (no conectes el repositorio aquí: el back va en Render).
2. En el servicio **MySQL → Settings → Networking**, copia el **TCP Proxy**: un host como `xxxx.proxy.rlwy.net` y un puerto como `12345`.
3. En **MySQL → Variables** está `MYSQL_ROOT_PASSWORD`. Cópiala directo a Workbench.
4. En Workbench: **+** (nueva conexión) → Hostname = host del proxy, Port = puerto del proxy, Username = `root` → **Store in Vault** → contraseña → **Test Connection**.
5. Abre la conexión → **Server → Data Import → Import from Self-Contained File** → `database/purple1_completo.sql` (el de tu zip; no está en GitHub) → **Start Import**.
6. Comprueba: `SELECT COUNT(*) FROM purple1.users;` debe dar más de 0.

---

## Paso 2 · API y panel en Render

1. Entra a https://render.com con tu cuenta de GitHub.
2. **New → Blueprint** → elige el repositorio `purple1`. Render lee `render.yaml` y crea el servicio **purple1-api** (plan gratis).
3. Te pide 4 valores que no van en el código. Escríbelos con los datos del paso 1:

| Variable | Valor |
|---|---|
| `PURPLE1_DB_HOST` | el host del TCP Proxy de Railway (`xxxx.proxy.rlwy.net`) |
| `PURPLE1_DB_PORT` | el puerto del TCP Proxy (`12345`) |
| `PURPLE1_DB_USER` | `root` |
| `PURPLE1_DB_PASSWORD` | `MYSQL_ROOT_PASSWORD` de Railway |

   Las demás (`PURPLE1_HOST`, `PURPLE1_TRUST_PROXY`, `PURPLE1_COOKIE_SECURE`, `PURPLE1_ALLOWED_ORIGINS`, `PURPLE1_DB_NAME`) ya vienen en `render.yaml`.
4. **Apply**. Espera a que el despliegue diga **Live**.
5. Arriba aparece tu dominio, algo como `purple1-api.onrender.com`. Prueba: `https://purple1-api.onrender.com/api/currencies` → JSON con las 11 monedas.

> **Plan gratis de Render:** si nadie entra en 15 minutos, el servicio se duerme. La primera visita después tarda cerca de un minuto en responder; luego va normal. Antes de presentar, abre la página una vez para "despertarlo".

---

## Paso 3 · Conectar Vercel con Render

1. En `vercel.json`, cambia las **4** veces que dice `TU-BACKEND.onrender.com` por tu dominio de Render.
2. Sube el cambio:

```bash
git add vercel.json
git commit -m "Conecta Vercel con el back en Render"
git push
```

3. GitHub Actions revisa el cambio (pestaña **Actions**, en verde) y Vercel publica solo.
4. Abre `https://purple1-seven.vercel.app`: el catálogo, las monedas y las carreras salen de la base real.

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

## Cambiar el nombre de la dirección

- **Vercel** (`purple1-seven.vercel.app`): proyecto → **Settings → Domains** → **Edit** → nombre nuevo (si está tomado, avisa). Después cambia `PURPLE1_ALLOWED_ORIGINS` en Render (**Environment**) y en `render.yaml`.
- **Render** (`purple1-api.onrender.com`): servicio → **Settings → Name**. Si cambia el dominio, actualiza `vercel.json`.
- **Repositorio de GitHub**: **Settings → General → Repository name → Rename**. Vercel y Render siguen conectados.

---

## Si algo falla

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Al iniciar sesión o pagar sale "Origen no permitido." | `PURPLE1_ALLOWED_ORIGINS` no coincide con tu dominio de Vercel | Copia el dominio exacto de la barra del navegador, sin `https://` ni `/` final |
| Render: "Access denied" o "Can't connect to MySQL" | Host, puerto o contraseña de Railway mal copiados | Revisa el TCP Proxy (paso 1.2) y las variables (paso 2.3) |
| Render: "Unknown database 'purple1'" | No importaste el `.sql` en Railway | Paso 1.5 |
| La tienda carga pero sin productos | `vercel.json` aún dice `TU-BACKEND`, o Render está dormido | Paso 3, o espera un minuto y recarga |
| Inicias sesión y al recargar se cierra | Abriste la app por el dominio de Render y luego por el de Vercel | Usa siempre el de Vercel |
| Una imagen subida desde el panel desaparece | Render borra el disco en cada redespliegue (hallazgo A-03) | Vuelve a subirla; la solución definitiva es un disco persistente (tarea N-1) |
| "Olvidé mi contraseña" responde que no está configurado | No hay servidor de correo | Es opcional: `PURPLE1_SMTP_HOST`, `PURPLE1_SMTP_FROM`, `PURPLE1_RESET_BASE_URL` |
