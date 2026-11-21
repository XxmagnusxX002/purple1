# F7 · Panel administrativo con roles

## Historia
Como administrador de la tienda, quiero gestionar catálogo, carreras y pedidos desde un panel, y como superadministrador controlar monedas, descuentos y usuarios, para operar Purple One sin tocar la base de datos a mano.

## Comportamiento
1. El staff entra por `/admin` con su cuenta. El servidor revisa el rol en cada petición.
2. **Admin:** productos, variantes y stock, imágenes, categorías, banners, escuderías, pilotos, carreras, clasificación y liquidación, pedidos (solo lectura).
3. **Superadmin:** además, monedas y tasas, descuentos, parámetros, usuarios y roles, ajustes de PitCoins y registro de auditoría.
4. La liquidación muestra una vista previa (quién gana, cuánto y cuánto XP) y solo se aplica si nada cambió desde esa vista.

## Criterios de aceptación
- [ ] Un cliente que abre `/admin` termina en el login del panel y no ve ninguna pantalla interna.
- [ ] Un admin no ve en el menú las secciones de superadmin.
- [ ] Cambiar el stock de una variante se refleja en la tienda.
- [ ] La vista previa de liquidación coincide con lo que se aplica.
- [ ] Cada acción aparece en la pantalla de auditoría con quién y cuándo.

## Criterios de aceptación del back
- Dado un usuario sin sesión, cuando llama cualquier `/api/admin/*`, entonces responde 401.
- Dado un cliente con sesión, cuando llama `/api/admin/products`, entonces responde 403 "Acceso restringido.".
- Dado un admin (no superadmin), cuando llama `POST /api/admin/pitcoins/adjust` o `/api/admin/currencies`, entonces responde 403 aunque conozca la ruta.
- Dado un ajuste de PitCoins con una referencia ya usada, cuando se envía, entonces responde 409 y el saldo no cambia.
- Dado que alguien pronosticó después de la vista previa, cuando el admin confirma la liquidación con la huella vieja, entonces responde 409 y no se reparte nada.
- Dado el último superadmin activo, cuando intenta quitarse el rol, entonces el servidor lo impide.
- Dada cualquier escritura del panel, cuando se revisa `admin_audit_log`, entonces hay una fila con actor, acción y objeto, creada en la misma transacción.

## Fuera de alcance
Roles personalizados, aprobación en dos pasos, edición de pedidos ya pagados.

## Archivos relacionados
- Front: `frontend/admin/` (23 páginas)
- API: `backend/server.py` (`require_staff`, `SUPERADMIN_API`, `admin_page_gate`), `backend/admin_*.py`, `backend/coins.py`
