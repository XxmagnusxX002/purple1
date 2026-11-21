# F6 · Progresión (XP y niveles) y descuentos con PitCoins

## Historia
Como aficionado, quiero subir de nivel al participar y acertar, y canjear mis PitCoins por descuentos en la tienda, para que pronosticar tenga una recompensa que se note.

## Comportamiento
1. Al liquidarse una carrera, cada participante gana 20 XP; quien acierta gana 50 XP más, y su primer pronóstico liquidado da 30 XP extra.
2. Cada nivel pide un poco más de XP que el anterior (50 + 12 por nivel). Al subir, el usuario recibe PitCoins de recompensa.
3. Los rangos son Novato, Amateur, Profesional y Leyenda.
4. En el carrito puede canjear un descuento: 5 % por 500, 10 % por 1.000, 15 % por 2.000 o 20 % por 3.500 PitCoins. Uno por pedido.

## Criterios de aceptación
- [ ] La barra de XP del perfil muestra nivel, rango y cuánto falta para el siguiente.
- [ ] Después de una liquidación, el XP del usuario sube.
- [ ] Al subir de nivel aparecen los PitCoins de recompensa en el historial.
- [ ] Solo se ofrecen los descuentos que el usuario puede pagar.
- [ ] El total del carrito baja según el porcentaje elegido.

## Criterios de aceptación del back
- Dado un usuario, cuando se liquida la misma carrera dos veces, entonces el XP no se duplica (cada evento tiene referencia única en `xp_events`).
- Dado un usuario con 400 PitCoins, cuando paga con el descuento de 10 % enviando el id con curl, entonces responde 409 y no se crea el pedido.
- Dado un descuento que el superadmin desactivó, cuando se paga con él, entonces responde 409.
- Dado un porcentaje mayor a 20, cuando el superadmin intenta guardarlo, entonces la base lo rechaza (CHECK) y el servidor responde 400.
- Dado cualquier cambio de XP o PitCoins, cuando se revisa la base, entonces hay una fila en `xp_events` o `pitcoin_movements` que lo explica.

## Fuera de alcance
Comprar PitCoins o XP con dinero, cambiar PitCoins por dinero, más de un descuento por pedido.

## Archivos relacionados
- Front: `frontend/profile.html`, `js/progress.js`, `js/rewards.js`, `js/cart.js`
- API: `backend/progression.py`, `backend/rewards.py`, `backend/orders.py` (`/api/progress`, `/api/rewards`, `/api/payments/simulate`)
