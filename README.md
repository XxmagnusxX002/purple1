# Purple 1

**La pasión por la Fórmula 1 en una sola plataforma: compra, pronostica y personaliza.**

Tienda web de merch de F1 con precios en la moneda del comprador, pronósticos de carreras con **PitCoins** (moneda virtual sin valor real) y un **avatar** en el perfil que se viste con lo que ganas.

- **Demo pública:** [purple1-seven.vercel.app](https://purple1-seven.vercel.app/)
- **Documentación (SDD):** [docs/](docs/README.md)

![Pantalla principal](docs/diseno/referencias/pantalla-principal.png)

## El problema

Comprar merch de F1 desde Latinoamérica es incómodo: los precios están en dólares o euros y las tiendas solo venden, sin nada que haga volver al aficionado. Detalle en [docs/producto.md](docs/producto.md).

## La solución

| Tienda | Pronósticos | Avatar |
|---|---|---|
| Catálogo con filtros y precios en 9 monedas | Elige quién gana cada Gran Premio con PitCoins | Prendas que se ganan acertando o se compran con PitCoins |

## Cómo probarlo

### Opción 1 · Demo en Vercel (sin instalar nada)
Abre la URL pública. Funciona con **datos de prueba** guardados en tu navegador (etiqueta "Demo · datos de prueba"; el botón **Reiniciar** la deja como nueva).

Cuentas de la demo:

| Cuenta | Correo | Contraseña |
|---|---|---|
| Cliente | demo@purpleone.com | purple2026 |
| Staff (puede cerrar carreras) | admin@purpleone.com | admin2026 |

También puedes registrar tu propia cuenta: empieza con 1.000 PitCoins.

### Opción 2 · Completo en local (con MySQL)
1. Instala Python 3 y MySQL 8.
2. Crea la base: ejecuta `database/schema.sql` y luego `database/seed.sql` en MySQL Workbench.
3. Copia `.env.example` como `.env` y escribe tu contraseña de MySQL.
4. Instala la dependencia: `pip install -r requirements.txt`
5. Arranca: `python main.py` y abre http://127.0.0.1:8000/index.html

## Estructura

```
purple1/
├── frontend/          Front (HTML, CSS, JS) · lo que publica Vercel
│   └── js/mock-api.js API simulada para la demo
├── backend/           API en Python (rutas en server.py)
├── database/          schema.sql y seed.sql (MySQL)
├── docs/              Documentación SDD: producto, arquitectura, diseño, specs, decisiones, tareas
├── tools/             generar_mock.py (datos de prueba desde seed.sql)
├── .claude/skills/    Skill ui-componentes para el agente
├── CLAUDE.md          Reglas del proyecto para el agente
├── BITACORA_IA.md     Prompts clave y errores corregidos
└── vercel.json        Publica la carpeta frontend/
```

## Tecnologías

HTML5 · CSS3 · JavaScript · WebGL · SVG · Python 3 (`http.server`) · MySQL 8.4 · `mysql-connector-python` · GitHub · Vercel

## Autoras

Weslly Gomez · Angie Rivera — Universidad Santo Tomás, sede Villavicencio.
