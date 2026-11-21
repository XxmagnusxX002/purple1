# Identidad visual · Purple 1

> El render: cómo se ve y cómo habla la marca. Toda pantalla nueva sigue este documento.
> Los valores salen de `frontend/css/global.css` (tokens en `:root`).

## Marca

- **Nombre:** Purple 1 (en la interfaz aparece como **PURPLE1**, en cursiva y en morado).
- **Idea central:** "La velocidad es morada". La Fórmula 1 vista con una identidad propia, no con los colores de una escudería.
- **Personalidad:** rápida, moderna, cercana y sin exagerar.

## Tono de voz

- Tutea al usuario: "Pronostica quién gana cada Gran Premio".
- Frases cortas y directas, con lenguaje de carreras: Gran Premio, piloto, paddock, pit wall.
- Los errores dicen **qué corregir**: "Te faltan 50 PitCoins para comprar…", no "Error".
- Nunca habla de "apostar" ni de dinero: se dice **pronosticar** y **PitCoins**.

## Paleta

| Rol | Token | HEX | Uso |
|---|---|---|---|
| Primario | `--color-brand` | `#7B2CFF` | Botones, enlaces, estado activo |
| Primario fuerte | `--color-brand-strong` | `#5F18D6` | Degradado de botones, hover |
| Primario suave | `--color-brand-soft` | `#EFE5FB` | Chips, fondos de tarjetas destacadas |
| Texto | `--color-text` | `#1B1733` | Títulos y texto principal |
| Texto secundario | `--color-text-soft` | `#6D6885` | Descripciones |
| Fondo | `--color-surface-alt` | `#FAF8FD` | Fondo de página |
| Tarjetas | `--color-surface` | `#FFFFFF` | Tarjetas y paneles |
| Bordes | `--color-border` | `#E9E2F3` | Separadores y bordes |
| Éxito | `--color-success` | `#2F8B3F` | Pago aprobado, pronósticos abiertos |
| Error | `--color-danger` | `#EF3B5D` | Errores de formulario |
| Fondo oscuro | `--color-dark-bg` | `#0B0718` | Intro 3D y pantallas de acceso |

### Contraste (WCAG AA pide 4,5:1 para texto normal)

| Combinación | Contraste | ¿Pasa AA? |
|---|---|---|
| Texto `#1B1733` sobre blanco | 17,3:1 | Sí |
| Texto secundario `#6D6885` sobre blanco | 5,3:1 | Sí |
| Blanco sobre botón `#7B2CFF` | 5,8:1 | Sí |
| Morado `#7B2CFF` sobre chip `#EFE5FB` | 4,7:1 | Sí |
| Texto claro `#F0EAFF` sobre `#0B0718` | 16,9:1 | Sí |
| Texto tenue `#8F89A6` sobre blanco | 3,3:1 | Solo texto grande |
| Verde `#2F8B3F` sobre `#EDF7EF` | 3,9:1 | No: pendiente (tarea P-2) |
| Rojo `#EF3B5D` sobre blanco | 3,9:1 | No: pendiente (tarea P-2) |

## Tipografía (Google Fonts)

| Uso | Fuente | Pesos |
|---|---|---|
| Texto del sitio | **Inter** | 400, 500, 600, 700, 800 |
| Pantallas de acceso | **Barlow** y **Barlow Condensed** | 400–700 |
| Titulares de impacto (intro) | **Bebas Neue** | 400 |

## Estilo de componentes

- Tarjetas blancas con bordes redondeados, borde `#E9E2F3` y sombras suaves.
- Botón principal con degradado morado (`#8D43FF → #5F18D6`), texto blanco y esquinas redondeadas.
- Chips y etiquetas en forma de píldora con fondo lavanda.
- Íconos lineales de Font Awesome 6.5.
- Mucho espacio en blanco; un solo acento morado por bloque.
- Movimiento con propósito: intro 3D al hacer scroll y halo morado que sigue al cursor (sin destellos). Se respeta "reducir movimiento" del sistema.
- Diseño adaptable: funciona desde 390 px de ancho.

## Referencias

- Pantalla principal (escritorio): `referencias/pantalla-principal.png`
- Pantalla principal (celular, 390 px): `referencias/pantalla-principal-390.png`
- Tienda: `referencias/tienda.png`
- Intro 3D: `referencias/intro-3d.png`

## Panel administrativo

- Mismos tokens de `global.css`; 23 pantallas en `frontend/admin/` con barra lateral y tablas.
- Estados de carrera con chip de color: Programada (gris), Abierta (verde), Cerrada (ámbar `#936000`), Finalizada (morado), Cancelada (rojo).
- Las acciones que mueven PitCoins piden confirmación y muestran una vista previa antes de aplicarse.
