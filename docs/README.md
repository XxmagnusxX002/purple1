# Documentación de Purple One (SDD)

Primero se define, después se construye. Orden de lectura:

| # | Documento | Qué responde |
|---|---|---|
| 1 | [producto.md](producto.md) | ¿Qué problema resolvemos, para quién y cuál es la solución? ¿Qué NO entra? |
| 2 | [arquitectura.md](arquitectura.md) | ¿Con qué se construye, dónde corre y cómo se conectan las capas? |
| 3 | [diseno/identidad-visual.md](diseno/identidad-visual.md) | ¿Cómo se ve y cómo habla la marca? |
| 4 | [specs/](specs/) | ¿Qué hace cada funcionalidad y cómo se comprueba en el front y en el back? (F1 a F7) |
| 5 | [datos/modelo.md](datos/modelo.md) | ¿Qué tablas hay, qué reglas protegen los datos y de quién es cada fila? |
| 6 | [contratos/api.md](contratos/api.md) | ¿Qué recibe y qué responde cada operación de la API? |
| 7 | [auditoria-u4.md](auditoria-u4.md) | ¿Qué revisamos del back, qué encontramos y qué corregimos? |
| 8 | [decisiones.md](decisiones.md) | ¿Por qué se decidió cada cosa? |
| 9 | [tareas.md](tareas.md) | ¿Qué está hecho y qué sigue? |

Fuera de `docs/`: [CLAUDE.md](../CLAUDE.md) (reglas para el agente), [BITACORA_IA.md](../BITACORA_IA.md) (prompts y errores), [DESPLIEGUE.md](../DESPLIEGUE.md) (cómo publicarlo) y las skills [`ui-componentes`](../.claude/skills/ui-componentes/SKILL.md) y [`backend-seguro`](../.claude/skills/backend-seguro/SKILL.md).

**Regla de oro:** si algo cambia, primero se actualiza el documento y después el código.
