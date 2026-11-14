# Tareas

> El cronograma: pasos pequeños, cada uno verificable en el navegador.
> Ciclo: pedir tareas → revisar → implementar UNA → probar → commit → marcar [x].

## Front (U3)

- [x] 1.1 Layout base con la identidad visual (tokens en `global.css`, navbar, pie de página)
- [x] 1.2 Intro con carro 3D al hacer scroll y halo morado del cursor
- [x] 1.3 F1 · Registro e inicio de sesión con validaciones
- [x] 1.4 F1 · Recuperar y cambiar contraseña
- [x] 1.5 F2 · Catálogo con búsqueda y filtros
- [x] 1.6 F2 · Selector de moneda (9 monedas) sin recargar
- [x] 1.7 F2 · Detalle de producto con tallas y colores
- [x] 1.8 F3 · Carrito: agregar, cambiar cantidad, quitar
- [x] 1.9 F3 · Pago simulado con validación de tarjeta
- [x] 1.10 F4 · Lista de carreras, pronóstico y cuotas en vivo
- [x] 1.11 F4 · Panel de staff para cerrar carreras y ranking
- [x] 1.12 F5 · Avatar en el perfil: vestir, desbloquear y comprar prendas
- [x] 1.13 Datos mock que imitan la API (`js/mock-data.js` + `js/mock-api.js`)
- [x] 1.14 Quitar la contraseña de MySQL del código (`.env`)
- [x] 1.15 Subir el repositorio a GitHub
- [x] 1.16 Publicar el front en Vercel y probar la URL pública
- [ ] 1.17 Verificar F1 a F5 en la URL pública a 390 px y a 1280 px

## Back (U4)

El proyecto ya tiene API en Python y base MySQL funcionando en local.

- [x] 2.1 API REST con rutas por módulo (`backend/server.py`)
- [x] 2.2 Esquema y datos iniciales (`database/schema.sql`, `database/seed.sql`)
- [ ] 2.3 Documentar los contratos de la API en `docs/contratos/api.md`

## Pruebas (U5)

- [ ] 3.1 Revisar cada criterio de aceptación de F1 a F5 (cumple / no cumple)
- [ ] 3.2 Subir el contraste de los textos de estado (verde y rojo) a AA

## Nube (U6)

- [ ] 4.1 Publicar la API y la base de datos para que la URL pública use datos reales
