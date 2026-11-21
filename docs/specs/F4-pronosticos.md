# F4 · Pronósticos con PitCoins y ranking

## Historia
Como aficionado, quiero pronosticar quién gana cada Gran Premio con PitCoins para competir con otros y tener una razón para volver cada carrera.

## Comportamiento
1. En `races.html` el usuario ve el calendario F1 2026, los pilotos de cada carrera, la bolsa y la hora de cierre en su zona horaria.
2. Elige un piloto, escribe cuántos PitCoins pone y confirma. Puede cambiar su pronóstico mientras la carrera esté abierta; se cierra solo a la hora de salida.
3. El administrador registra la clasificación en el panel, revisa la vista previa y liquida. La bolsa se reparte entre quienes acertaron (parimutuel) y todos ganan XP.
4. La tabla de posiciones ordena a los usuarios por PitCoins.

## Criterios de aceptación
- [ ] Un pronóstico de menos de 10 PitCoins se rechaza.
- [ ] No se puede poner más PitCoins de los que se tienen.
- [ ] Al pronosticar, el saldo de la barra baja en la cantidad puesta.
- [ ] Las cuotas cambian cuando otros usuarios pronostican.
- [ ] Pasada la hora de salida, el botón de pronosticar ya no aparece.
- [ ] Si nadie acierta, cada participante recupera sus PitCoins.
- [ ] Quien acierta recibe su parte del bote y su contador de aciertos sube.
- [ ] En ningún lugar se puede comprar PitCoins con dinero.

## Criterios de aceptación del back
Cada criterio se comprueba por fuera del formulario (curl o pestaña de red) con un **sí** o un **no**.
- Dado un pronóstico de 5 PitCoins enviado con curl, cuando se llama `POST /api/races/{id}/bet`, entonces responde 400 "El pronóstico mínimo es de 10 PitCoins.".
- Dado un cuerpo con `"user_id"` de otra persona, cuando se pronostica, entonces el pronóstico queda a nombre del usuario de la sesión, no del otro.
- Dada una carrera cuya hora de salida ya pasó, cuando se pronostica con curl, entonces responde 400 aunque la página siga abierta.
- Dado un piloto que no corre esa carrera, cuando se pronostica, entonces responde 404 (lo impide también la FK compuesta).
- Dado un usuario con 100 PitCoins y dos pestañas pronosticando 80 a la vez en carreras distintas, cuando ambas envían, entonces una responde 400 y el saldo nunca baja de 0.
- Dado un usuario que cambia su pronóstico, cuando se revisa `bets`, entonces sigue habiendo una sola fila suya para esa carrera.
- Dada una liquidación, cuando se suma `pitcoin_movements` de cada usuario, entonces coincide con `users.coins`.
- Dado un cliente (no staff), cuando llama `/api/admin/races/{id}/settlement`, entonces responde 403.
- Dada una carrera con pronósticos, cuando el administrador la cancela, entonces cada pronóstico queda `REFUNDED` con su movimiento `BET_REFUND`.

## Fuera de alcance
Dinero real, resultados automáticos desde una API de F1, pronósticos de posiciones distintas al ganador (la clasificación completa se guarda pero solo se pronostica el ganador).

## Archivos relacionados
- Front: `frontend/races.html`, `js/races.js`
- API: `backend/bets.py`, `backend/admin_races.py`, `backend/coins.py` (`/api/races`, `/api/races/{id}/bet`, `/api/races/leaderboard`, `/api/admin/races/{id}/settlement`)
