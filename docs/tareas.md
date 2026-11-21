# Tareas

> El cronograma: pasos pequeños, cada uno verificable.
> Ciclo: pedir tareas → revisar → implementar UNA → probar → commit → marcar [x].

## Front (U3)

- [x] 1.1 Layout base con la identidad visual (tokens en `global.css`, navbar, pie de página)
- [x] 1.2 Intro 3D al hacer scroll y halo morado del cursor
- [x] 1.3 F1 · Registro, inicio de sesión, recuperar y cambiar contraseña
- [x] 1.4 F2 · Catálogo con búsqueda, filtros y 11 monedas sin recargar
- [x] 1.5 F3 · Carrito, descuentos con PitCoins y pago simulado
- [x] 1.6 F4 · Carreras, pronóstico, bolsa en vivo y ranking
- [x] 1.7 F5 · Avatar: vestir, desbloquear y comprar prendas
- [x] 1.8 F6 · Barra de XP, niveles y rangos
- [x] 1.9 F7 · Panel administrativo (23 pantallas)
- [x] 1.10 Repositorio en GitHub y front en Vercel

## Back (U4)

- [x] T-B1 Escribir `docs/datos/modelo.md` (ER, reglas por capa, dueño de cada fila)
- [x] T-B2 Escribir `docs/contratos/api.md` (cada operación con entradas, salidas, errores y códigos)
- [x] T-B3 Agregar "Criterios de aceptación del back" a cada spec (F1 a F7)
- [x] T-B4 Crear la skill `backend-seguro` y la sección Backend de `CLAUDE.md`
- [x] T-B5 Migraciones y semilla: `schema.sql`, `upgrade_02` a `upgrade_08`, `seed.sql`, `demo_data.sql`
- [x] T-B6 Preparar el servidor para la nube: `PORT`, `PURPLE1_HOST`, `PURPLE1_ALLOWED_ORIGINS`, `PURPLE1_TRUST_PROXY`
- [x] T-B7 `render.yaml`, `vercel.json` con rewrites y `.vercelignore` que deja el panel en Render
- [x] T-B8 Quitar el modo mock: el front usa solo la API real
- [x] T-B9 Reemplazar el repositorio de GitHub por esta versión (ver `DESPLIEGUE.md`, paso 1)
- [x] T-B10 Crear MySQL en Railway e importar `purple1_completo.sql`
- [x] T-B11 Crear el servicio en Render desde GitHub y poner las variables de entorno
- [x] T-B12 Cambiar `TU-BACKEND` en `vercel.json` por el dominio de Render y volver a publicar en Vercel
- [ ] T-B13 Pruebas de fuego en la URL pública (ver `DESPLIEGUE.md`, paso 4)
- [x] T-B16 CI con GitHub Actions (`.github/workflows/ci.yml`)
- [x] T-B14 Auditoría del back (`docs/auditoria-u4.md`)
- [ ] T-B15 Corregir los hallazgos de severidad media de la auditoría (A-01, A-02; A-03 va con N-1)

## Pruebas (U5)

- [x] P-0 Pruebas de integración de punta a punta (`tests/integracion/`, workflow "Pruebas de integración")
- [ ] P-1 Revisar cada criterio de aceptación de F1 a F7 (cumple / no cumple)
- [ ] P-2 Subir el contraste de los textos de estado (verde y rojo) a AA

## Nube (U6)

- [ ] N-1 Guardar las imágenes subidas en un almacenamiento persistente (disco de Render o bucket)
- [ ] N-2 Respaldo automático de la base de datos
