# F3 · Carrito y pago simulado

## Historia
Como comprador, quiero guardar productos en un carrito y pagarlos de forma clara para completar mi compra con confianza.

## Comportamiento
1. Desde el detalle, el usuario elige talla y color y toca **Añadir al carrito**.
2. En `cart.html` ve sus productos, cambia cantidades o los quita, y ve el total.
3. Puede elegir la moneda de pago y un descuento (5 %, 10 %, 15 % o 20 %) que se canjea con PitCoins.
4. Al finalizar escribe los datos de la tarjeta; el sistema los valida, crea el pedido y aprueba o rechaza el pago.

## Criterios de aceptación
- [ ] Sin sesión iniciada, el carrito pide iniciar sesión.
- [ ] Al añadir un producto, aparece en el carrito con su talla, color y precio.
- [ ] Cambiar la cantidad actualiza el subtotal y el total.
- [ ] No se puede pedir más unidades de las que hay en stock.
- [ ] Con el carrito vacío no se puede pagar.
- [ ] Una tarjeta vencida o un CVV de menos de 3 dígitos rechaza el pago con el motivo.
- [ ] Un pago aprobado muestra la marca (Visa, Mastercard…) y solo los últimos 4 dígitos.
- [ ] Después de pagar, el carrito queda vacío.

## Criterios de aceptación del back
Cada criterio se comprueba por fuera del formulario (curl o pestaña de red) con un **sí** o un **no**.
- Dado un usuario sin sesión, cuando llama `GET /api/cart`, entonces responde 401.
- Dado el usuario A, cuando llama `PUT /api/cart/update` con un `item_id` del carrito de B, entonces responde 404 "Item no encontrado." y el carrito de B no cambia.
- Dado un cuerpo con `"price": 1` o `"total": 1` enviado con curl, cuando se paga, entonces el servidor lo ignora y cobra el precio de la base.
- Dada una tasa que el superadmin cambió después de que el cliente vio el total, cuando paga con la tasa vieja, entonces responde 409 y no se crea el pedido.
- Dada una variante con stock 1 y dos pestañas pagándola a la vez, cuando ambas pagan, entonces solo una se aprueba y el stock queda en 0, nunca -1.
- Dado un pago aprobado con descuento, cuando se revisa la base, entonces `orders` tiene el porcentaje, `pitcoins_redeemed` y hay un movimiento de canje en `pitcoin_movements`.
- Dado un pago aprobado, cuando se revisa `payments`, entonces solo están los 4 últimos dígitos y la marca; nunca el número completo ni el CVV.

## Fuera de alcance
Pagos reales, pasarela de pago, envíos con transportadora. Ningún dato de la tarjeta se guarda.

## Archivos relacionados
- Front: `frontend/cart.html`, `js/cart.js`, `js/product_detail.js`
- API: `backend/cart.py`, `backend/orders.py`, `backend/payments_sim.py`
