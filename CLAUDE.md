# Proyecto: Purple One (Purple 1)

Tienda web de merch de Fórmula 1 que muestra y cobra en la moneda del cliente (11 monedas), con pronósticos del calendario F1 2026 usando PitCoins (moneda virtual sin valor real), progresión por XP y niveles, descuentos canjeables con PitCoins, avatar personalizable y un panel administrativo con roles.

## Stack
- Front: HTML5 + CSS3 + JavaScript sin frameworks (`frontend/`, panel en `frontend/admin/`). WebGL para la intro 3D, SVG para el avatar y las banderas.
- Back: Python 3 con `http.server` (`backend/`, 35 módulos), API REST en JSON.
- Datos: MySQL 8, base `purple1`, 33 tablas (`database/schema.sql`, `seed.sql`, `demo_data.sql`, `upgrade_*.sql`).
- Despliegue: GitHub + Vercel (tienda) + Railway (API, panel y MySQL). Vercel reenvía `/api`, `/admin` e `/img/uploads` a Railway (`vercel.json`).

## Documentación (léela antes de cualquier cambio)
- Problema, usuarios y alcance: @docs/producto.md
- Capas, despliegue y decisiones técnicas: @docs/arquitectura.md
- Pantallas, colores y tono: @docs/diseno/identidad-visual.md
- Funcionalidades y criterios (front y back): docs/specs/
- Modelo de datos y reglas de negocio: @docs/datos/modelo.md
- Contrato de la API: @docs/contratos/api.md
- Por qué se decidió cada cosa: docs/decisiones.md
- Qué sigue: docs/tareas.md

## Reglas de trabajo
- Implementa UNA tarea de docs/tareas.md a la vez, muestra el diff y espera confirmación antes del commit.
- No agregues funcionalidades que no estén en docs/specs/. Si el alcance cambia, primero los docs.
- Nunca escribas contraseñas, llaves ni tokens en el código: van en variables de entorno.
- Los PitCoins nunca se compran con dinero ni se convierten en dinero.
- Al terminar cada tarea, explica cómo probarla en el navegador y por fuera del formulario (curl).

## Backend
- Fuente de verdad: docs/datos/modelo.md y docs/contratos/api.md. Si el código y el contrato no coinciden, se corrige uno de los dos a propósito, nunca se deja así.
- Aplica SIEMPRE la skill `backend-seguro` al tocar datos, rutas de la API o el esquema.
- El usuario sale de la cookie de sesión (`server.py`), nunca del cuerpo de la petición.
- Cada cambio de esquema es un archivo nuevo `database/upgrade_NN_nombre.sql` y se refleja en `schema.sql`. Nada de SQL suelto sin archivo.
- Todo cambio de saldo de PitCoins pasa por `coins.py` y queda en `pitcoin_movements`.
- Toda acción del panel queda en `admin_audit_log` dentro de la misma transacción.

## Convenciones
- Un HTML, un CSS y un JS por página. Colores y fuentes solo desde los tokens de `frontend/css/global.css`.
- Textos en español, tuteando. Nunca "apostar": se dice "pronosticar".
- Un módulo de Python por tema; SQL siempre con parámetros (`%s`).
- Errores de la API: `{"success": false, "error": "mensaje claro"}` con el código HTTP del contrato.

## Cómo correrlo
- Local: `python -m pip install -r requirements.txt`, importar `database/purple1_completo.sql` (no está en Git, pídelo al equipo) o `schema.sql` + `seed.sql` + `demo_data.sql`, y `python main.py` → http://127.0.0.1:8000
- Nube: ver DESPLIEGUE.md.
