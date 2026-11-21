# Producto · Purple 1

> La necesidad del cliente: qué construimos, para quién y qué **no** entra.
> Si el alcance cambia, este documento se actualiza **antes** que el código.

## 1. Problemática

Comprar ropa y accesorios de Fórmula 1 desde Latinoamérica es incómodo:

- **Precios en otra moneda.** Las tiendas muestran dólares o euros. El comprador tiene que convertir cada precio antes de decidir, y esa duda hace que abandone la compra.
- **Nada que haga volver.** Las tiendas solo venden: el aficionado entra, compra y se va. No hay forma de vivir el calendario de carreras ni de tener una identidad propia dentro del sitio.

> El problema lo identificamos como aficionadas y usuarias de estas tiendas. Todavía no lo hemos validado con una encuesta formal: es el primer paso de la siguiente etapa.

## 2. Usuario

Aficionados a la Fórmula 1 en Latinoamérica que compran por internet y siguen las carreras de cada fin de semana.

## 3. Solución

**Purple 1** es una plataforma web que junta tres experiencias en un solo lugar:

| Experiencia | Qué resuelve |
|---|---|
| **Tienda** | Catálogo con filtros y precios en la moneda del comprador (11 monedas, sin recargar la página). Descuentos de 5 % a 20 % canjeables con PitCoins. |
| **Pronósticos** | Elegir quién gana cada Gran Premio con **PitCoins**, una moneda virtual **sin valor real**. Da una razón para volver cada carrera. |
| **Progresión** | XP y niveles (Novato, Amateur, Profesional, Leyenda) por participar y acertar; cada nivel da PitCoins. |
| **Panel administrativo** | Admin y superadmin gestionan catálogo, inventario, carreras, liquidaciones, monedas, descuentos y usuarios, con registro de auditoría. |
| **Avatar** | Un piloto propio en el perfil que se viste con prendas ganadas al acertar o compradas con PitCoins. |

## 4. Objetivo del MVP

Que un aficionado pueda, en una sola visita: ver los precios en su moneda, comprar con un pago simulado, hacer un pronóstico y ver su recompensa en el avatar.

## 5. Funcionalidades (ver `docs/specs/`)

| Spec | Funcionalidad | Estado |
|---|---|---|
| [F1](specs/F1-cuenta.md) | Cuenta: registro, inicio de sesión y contraseña | Hecha |
| [F2](specs/F2-catalogo-y-moneda.md) | Catálogo con filtros y precios en tu moneda | Hecha |
| [F3](specs/F3-carrito-y-pago.md) | Carrito y pago simulado | Hecha |
| [F4](specs/F4-pronosticos.md) | Pronósticos con PitCoins y ranking | Hecha |
| [F5](specs/F5-avatar.md) | Avatar del perfil | Hecha |

## 6. Fuera del MVP

- Pagos reales (el pago es simulado y no guarda datos de la tarjeta).
- Tasas de cambio en vivo (se usan tasas fijas).
- Dinero real en los pronósticos: los PitCoins no se compran ni se cambian por dinero.
- Resultados automáticos de las carreras (el administrador elige al ganador desde el panel).
- App móvil nativa (es web, adaptada al celular).
- Envíos e inventario reales (sin transportadoras ni bodega).
- Minijuego 2D (se reemplazó por el avatar; ver `decisiones.md`).

## 7. Cómo sabremos que funciona

- Un usuario nuevo completa el recorrido del MVP (registro → compra → pronóstico → avatar) sin ayuda.
- Los profesores y compañeros pueden probarlo desde la URL pública de Vercel **con datos reales** (API en Render y MySQL en Railway).
- Siguiente paso: validar con aficionados reales si volverían por los pronósticos.

## 8. Contexto legal

- Los pronósticos usan una moneda virtual sin valor monetario, para no ser un juego de suerte y azar con dinero (Ley 643 de 2001).
- Los datos personales se tratan según la Ley 1581 de 2012.
