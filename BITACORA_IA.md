# Bitácora de IA · Purple One

> Prompts clave, errores del agente y cómo los corregimos.
> Agente usado: Claude. Regla: si no podemos explicar el código generado, no lo aceptamos.

## Prompts clave

| Para qué | Prompt (resumen) | Resultado |
|---|---|---|
| Avatar en el perfil | "Quita los juegos 2D y pon un avatar en el perfil cuya ropa se desbloquee al acertar pronósticos y algunas prendas se compren" | `backend/avatar.py` (catálogo de prendas) y `js/avatar.js` (avatar en SVG) |
| Intro 3D | "Al abrir la página, haz un scroll donde un carro se mueva en 3D y luego se abra la tienda" | `js/intro.js` con WebGL directo, sin librerías 3D |
| Efecto del cursor | "Que el cursor muestre solo lo morado, sin destellos de estrellas" | `js/fx.js` quedó solo con el halo morado |
| Cierre de carreras | "¿Cómo sé si gané un pronóstico?" | Se explicó que el staff cierra la carrera desde el panel; se documentaron los comandos SQL de apoyo |
| Diseño en Figma | "Haz la interfaz para Figma y que sea funcional" | 6 pantallas en SVG con las conexiones entre ellas |
| Documentación SDD | "Organiza la documentación de problema y solución para el diplomado" | `docs/` con producto, arquitectura, identidad, specs, decisiones y tareas |
| Publicar en Vercel (U3) | "Necesito el front desplegado en Vercel" | Modo mock que respondía como la API real (eliminado en U4) |
| Reemplazar la versión (U4) | "La página ahora es distinta, ¿cómo elimino la que tenía y pongo esta funcionando?" | Repositorio reemplazado, back en Render, MySQL en Railway y rewrites en Vercel (`DESPLIEGUE.md`) |
| Modelo de datos (U4) | "Lee schema.sql y las specs y escribe docs/datos/modelo.md con ER, reglas por capa y dueño de cada fila" | `docs/datos/modelo.md` |
| Cambio de versión (U4) | "Este es el zip que tiene que quedar: front en GitHub/Vercel y back en Render" | El agente avisó que era una versión anterior (sin clasificación de carreras); el equipo confirmó usarla. Se pasó el back de Railway a Render (`render.yaml`) |
| Contrato (U4) | "Escribe el contrato de cada operación con entradas, salidas, errores y códigos, igual a lo que hace server.py" | `docs/contratos/api.md` |
| Seguridad (U4) | "Crea la skill backend-seguro adaptada a Python + MySQL sin RLS" | `.claude/skills/backend-seguro/SKILL.md` |
| Auditoría (U4) | "Audita el back con la skill y dame hallazgo, archivo:línea, severidad, cómo comprobar y corrección" | `docs/auditoria-u4.md` |

## Errores del agente y del proceso, y cómo se corrigieron

| Qué pasó | Causa | Corrección |
|---|---|---|
| La contraseña real de MySQL estaba escrita en `backend/database.py` | Se configuró rápido para que funcionara en local | Se movió a `.env` (en `.gitignore`) con `.env.example` de guía, antes de subir a GitHub |
| A la compañera le salía "Access denied" en MySQL | Usaba la contraseña de otra instalación | Cada quien pone la contraseña de su propio MySQL |
| La terminal no encontraba `main.py` | El zip venía con carpetas anidadas | Entrar con `cd` a la carpeta interna antes de `python main.py` |
| Un `UPDATE` en Workbench cambió el registro equivocado | Se usó un `id` incorrecto | Consultar primero con `SELECT` y luego actualizar por `id` |
| El resultado del pronóstico "no aparecía" | La carrera no se había cerrado | El staff debe cerrar la carrera eligiendo al ganador |
| Vercel no puede correr el servidor Python ni MySQL | Vercel publica el front; la base de datos es local | Datos mock en el navegador con la misma forma que la API real |
| El contrato decía que registrarse dejaba la sesión iniciada | El agente lo supuso sin leer `server.py` | Se revisó la ruta: el registro devuelve 201 sin cookie; se corrigió el contrato |
| El contrato tenía mensajes de error inventados ("Debes iniciar sesión.") | Se escribieron de memoria | Se sacaron los mensajes reales con `grep` del código |
| Detrás de Vercel, todos los POST respondían 403 "Origen no permitido." | El control de origen comparaba con el Host, que ahora es el del back | Lista explícita `PURPLE1_ALLOWED_ORIGINS` (sin comodines) |
| El panel `/admin` quedaba publicado como archivos estáticos en Vercel | Vercel publica toda la carpeta `frontend/` | `.vercelignore` excluye `frontend/admin/` y el rewrite lo manda a Render |
| La guía pide RLS de Supabase y Purple One usa MySQL | MySQL no tiene RLS | La autorización por fila vive en el servidor; documentado en `decisiones.md` y en la skill |
| Instalar una librería de íconos por npm falló | Restricción de red del entorno del agente | Se dibujaron los íconos a mano en SVG; no se insistió con otros comandos |

## Qué aprendimos

- Con documentos claros (producto, specs, identidad) el agente inventa menos.
- Pedir una tarea pequeña a la vez y revisar el cambio antes de aceptarlo.
- Las llaves nunca van en el código, aunque el proyecto sea académico.
- El contrato se escribe leyendo el código, no de memoria: el agente inventa mensajes y comportamientos que suenan bien.
- "Funciona en local" no es "funciona en la nube": proxies, dominios y discos cambian las reglas.
