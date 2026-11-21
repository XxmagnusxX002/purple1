# Instalar Purple One en otro computador (Windows)

Guía paso a paso para ejecutar Purple One en otro equipo **con exactamente los mismos datos** que la base `purple1` original: usuarios, productos, inventario, ventas, carreras, pronósticos, PitCoins, banners y configuración.

Solo necesitas copiar la carpeta `purple1`, importar un archivo SQL e iniciar el servidor.

> Purple One es un proyecto universitario. Los pagos y pronósticos son **simulados**: no hay dinero real y los PitCoins no se compran ni se retiran. Los clientes, ventas y pronósticos de demostración son ficticios; los datos de Fórmula 1 2026 (escuderías, pilotos, calendario y ganadores) son oficiales.

---

## 1. Programas necesarios

| Programa | Versión | Para qué |
|---|---|---|
| **Python** | 3.11 o superior (probado con 3.14) | Ejecuta el servidor |
| **MySQL Server** | 8.0.16 o superior (probado con 9.7; recomendado 8.4 LTS o 9.x) | Base de datos |
| **MySQL Workbench** | 8.0 o superior | Crear la conexión e importar la base |
| Visual Studio Code | Opcional | Solo si quieres ver el código o usar su terminal |

Dependencias de Python (se instalan con `requirements.txt`, paso 4):

- `mysql-connector-python`: conexión con MySQL.
- `tzdata`: zonas horarias de los circuitos. **Obligatoria en Windows.**

No hace falta nada más: no hay frameworks, Node.js, archivos `.env` ni entornos virtuales incluidos.

### Instalar Python

1. Descarga Python desde <https://www.python.org/downloads/windows/>.
2. En el instalador marca **«Add python.exe to PATH»** y pulsa *Install Now*.

### Instalar MySQL

1. Descarga **MySQL Installer for Windows** desde <https://dev.mysql.com/downloads/installer/>.
2. Elige *Custom* e instala **MySQL Server** y **MySQL Workbench**.
3. En la configuración del servidor deja el puerto **3306**, define la contraseña del usuario **root** (por ejemplo, la misma que usas en tu equipo local) y deja marcado que MySQL se inicie como servicio de Windows.

---

## 2. Copiar el proyecto

Copia la carpeta completa `purple1` al otro computador (por ejemplo a `C:\Proyectos\purple1`). Debe contener, entre otros:

```text
purple1/
├── backend/
├── database/
│   └── purple1_completo.sql   ← copia completa de la base de datos
├── frontend/                  ← incluye todas las imágenes (frontend/img)
├── main.py
├── requirements.txt
└── INSTALACION_OTRO_PC.md
```

Todas las rutas de imágenes son relativas (`img/...`): funcionan en cualquier carpeta y en cualquier usuario de Windows.

---

## 3. Crear la conexión e importar la base en MySQL Workbench

### 3.1 Conexión

1. Abre **MySQL Workbench**.
2. En *MySQL Connections* pulsa el **+**.
3. Completa:
   - *Connection Name*: `Local instance`
   - *Hostname*: `127.0.0.1`
   - *Port*: `3306`
   - *Username*: `root`
4. Pulsa *Store in Vault…*, escribe la contraseña de root de **ese** computador y acepta.
5. Pulsa *Test Connection*: debe decir *Successfully made the MySQL connection*. Pulsa *OK*.

### 3.2 Importar `purple1_completo.sql` (recomendado: Data Import)

1. Abre la conexión *Local instance*.
2. Menú **Server → Data Import**.
3. Elige **Import from Self-Contained File** y selecciona `purple1\database\purple1_completo.sql`.
4. En *Default Target Schema* **no hace falta elegir nada**: el archivo crea la base `purple1` por sí mismo.
5. Abajo, en la pestaña *Import Progress*, pulsa **Start Import**.
6. Al terminar, pulsa el botón de actualizar en *Schemas* (panel izquierdo): debe aparecer **purple1** con 33 tablas.

*Alternativa:* **File → Open SQL Script**, abrir `purple1_completo.sql` y ejecutarlo con el rayo (*Execute*, Ctrl+Shift+Enter). Funciona igual, pero Data Import es más rápido con archivos grandes.

> Si ese computador ya tenía una base `purple1` antigua, el archivo **reemplaza sus tablas** por las de la copia. Si quieres conservarla, respáldala antes (*Server → Data Export*).

### 3.3 Comprobación rápida

En una pestaña de consulta de Workbench ejecuta:

```sql
SELECT COUNT(*) AS usuarios FROM purple1.users;
SELECT COUNT(*) AS productos FROM purple1.products;
SELECT COUNT(*) AS pedidos FROM purple1.orders;
SELECT COUNT(*) AS carreras FROM purple1.races;
SELECT COUNT(*) AS pronosticos FROM purple1.bets;
```

Deben salir los mismos números que en el equipo original (en la copia del 19 de noviembre de 2026: 39 usuarios, 49 productos, 160 pedidos, 23 carreras y 223 pronósticos).

---

## 4. Instalar las dependencias y ejecutar

Abre **PowerShell** (o la terminal de Visual Studio Code: *Terminal → New Terminal*) y ejecuta, uno por uno:

```powershell
# 1. Verificar Python (debe mostrar 3.11 o superior)
python --version

# 2. Entrar a la carpeta del proyecto (ajusta la ruta a donde la copiaste)
cd C:\Proyectos\purple1

# 3. Instalar las dependencias
python -m pip install -r requirements.txt

# 4. Iniciar Purple One
python main.py
```

El programa pide la contraseña de MySQL (no se ve al escribirla):

```text
Contrasena de MySQL para root@127.0.0.1:3306 (base purple1):
Probando conexion a MySQL...
Conexion MySQL exitosa: database=purple1 ...
Servidor Python puro iniciado
Frontend: http://127.0.0.1:8000/index.html
```

Para no escribir la contraseña cada vez (solo dura en esa ventana de PowerShell):

```powershell
$env:PURPLE1_DB_PASSWORD = "<contraseña de root de este computador>"
python main.py
```

La contraseña **nunca** se guarda en el código ni en archivos del proyecto.

### Abrir Purple One

Con el servidor en marcha, en el navegador:

- **Tienda (portal del cliente):** <http://127.0.0.1:8000/index.html>
- **Panel administrativo:** <http://127.0.0.1:8000/admin/>

Para detener el servidor: `Ctrl + C` en la ventana de PowerShell.

---

## 5. Cuentas para la exposición

Cuentas creadas **solo para la demostración** (correos `@demo.purpleone.test`, que no existen). No son credenciales personales; cámbialas después de presentar si el proyecto va a seguir en uso.

| Rol | Correo | Contraseña | Dónde entrar |
|---|---|---|---|
| Cliente | `valentina.rios@demo.purpleone.test` | `PurpleDemo2026` | Tienda → icono de usuario → Iniciar sesión |
| Administrador | `admin.demo@demo.purpleone.test` | `AdminDemo#2026` | <http://127.0.0.1:8000/admin/> |
| Superadministrador | `superadmin.demo@demo.purpleone.test` | `SuperDemo#2026` | <http://127.0.0.1:8000/admin/> |

- Los 30 clientes de demostración usan la misma contraseña `PurpleDemo2026` (por ejemplo `diego.ramirez@…`, `sofia.hernandez@…`, `gabriel.souza@…`, todos con `@demo.purpleone.test`).
- El **administrador** opera el panel (productos, equipos, pilotos, carreras, pronósticos, pedidos, banners y consulta de usuarios).
- El **superadministrador** además gestiona roles, PitCoins, **Configuración** (monedas, descuentos con PitCoins, parámetros de PitCoins y XP) y **Auditoría**.

---

## 6. Problemas frecuentes

| Problema | Causa | Solución |
|---|---|---|
| `'python' no se reconoce como un comando` | Python no está en el PATH | Reinstala Python marcando *Add python.exe to PATH*, o usa `py` en lugar de `python` |
| `Access denied for user 'root'` | Contraseña de MySQL incorrecta | Escribe la contraseña de root de **ese** computador |
| `Can't connect to MySQL server on '127.0.0.1:3306'` | MySQL no está iniciado | Workbench → *Server → Startup/Shutdown* → *Start Server*; o en PowerShell como administrador: `Get-Service MySQL*` y luego `Start-Service MySQL97` (usa el nombre que aparezca, por ejemplo `MySQL84`) |
| `Unknown database 'purple1'` | No se importó la base | Repite el paso 3.2 |
| `Faltan las zonas horarias de Python` | Falta `tzdata` | `python -m pip install -r requirements.txt` |
| `No module named 'mysql'` | Faltan las dependencias | `python -m pip install -r requirements.txt` |
| `Address already in use` / `[WinError 10048]` | El puerto 8000 está ocupado | Cierra el otro programa: `netstat -ano \| findstr :8000` muestra el PID y `Stop-Process -Id <PID>` lo detiene. O usa otro puerto: `$env:PURPLE1_PORT = "8080"` y luego `python main.py` (la tienda queda en `http://127.0.0.1:8080/index.html`) |
| MySQL usa otro puerto o usuario | Instalación distinta | `$env:PURPLE1_DB_PORT = "3307"`, `$env:PURPLE1_DB_USER = "otro_usuario"` antes de `python main.py` |
| La tienda se ve sin estilos o sin datos | El servidor no está corriendo o se abrió el HTML como archivo | Abre siempre `http://127.0.0.1:8000/...`, no el archivo con doble clic |
| No se ven los iconos | Sin internet (los iconos vienen de Font Awesome por CDN) | Conéctate a internet; el resto de la tienda funciona igual |

---

## 7. Qué incluye la copia de la base

`database/purple1_completo.sql` es una copia exacta de `purple1` (estructura, claves, restricciones, índices y datos): usuarios y roles, escuderías y pilotos, carreras y resultados oficiales de 2026, pronósticos, productos, categorías, atributos, variantes, inventario, pedidos, pagos simulados, banners, movimientos de PitCoins, XP y recompensas, monedas y tasas, configuración y registro de auditoría.

No incluye sesiones abiertas, intentos de inicio de sesión ni enlaces de recuperación de contraseña (son temporales): por eso hay que iniciar sesión de nuevo en el otro equipo.

Los demás scripts de `database/` (`schema.sql`, `seed.sql`, `upgrade_*.sql`, `demo_data.sql`) se conservan para instalaciones desde cero o para actualizar bases antiguas; **no hace falta ejecutarlos** si importas `purple1_completo.sql`.
