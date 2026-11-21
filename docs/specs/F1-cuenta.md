# F1 · Cuenta: registro, inicio de sesión y contraseña

## Historia
Como aficionado, quiero crear mi cuenta e iniciar sesión para comprar, pronosticar y tener mi avatar.

## Comportamiento
1. En `auth.html` el usuario elige **Registrarse** y escribe nombre, apellido, correo y contraseña dos veces.
2. El sistema valida los datos y crea la cuenta con **1.000 PitCoins** de bienvenida.
3. El usuario inicia sesión con correo y contraseña y la barra superior muestra su saldo.
4. Si olvida la contraseña, pide un enlace en `forgot_password.html` (vale 30 minutos y un solo uso); con sesión iniciada, la cambia en `change_password.html`.

## Criterios de aceptación
- [ ] Si falta un campo obligatorio, aparece "Completa todos los campos obligatorios." y no se crea la cuenta.
- [ ] Un correo sin formato válido muestra "Correo electronico invalido.".
- [ ] Si las dos contraseñas no coinciden, aparece "Las contrasenas no coinciden.".
- [ ] Una contraseña de menos de 8 caracteres se rechaza.
- [ ] No se puede registrar dos veces el mismo correo.
- [ ] Una cuenta nueva empieza con 1.000 PitCoins.
- [ ] Con correo o contraseña incorrectos aparece "Correo o contrasena incorrectos." y no inicia sesión.
- [ ] Al cerrar sesión, la barra vuelve a mostrar "Iniciar sesión".

## Criterios de aceptación del back
Cada criterio se comprueba por fuera del formulario (curl o pestaña de red) con un **sí** o un **no**.
- Dado un correo ya registrado, cuando se llama `POST /api/auth/register` con ese correo, entonces responde 400 "Ya existe una cuenta con ese correo." y no se crea otra fila en `users`.
- Dada una cuenta nueva, cuando se registra, entonces `users.coins` = 1.000 y existe un movimiento `OPENING_BALANCE` en `pitcoin_movements`.
- Dada una contraseña de 7 caracteres enviada con curl (sin el formulario), cuando se registra, entonces responde 400.
- Dado un login correcto, cuando responde, entonces la cookie `purple1_session` es `HttpOnly` y `SameSite=Strict`, y la contraseña nunca aparece en la respuesta.
- Dados 5 intentos fallidos seguidos de la misma cuenta, cuando se intenta otra vez, entonces responde 429 "Demasiados intentos. Espera 15 minutos." aunque la contraseña sea correcta.
- Dado un usuario A con sesión, cuando llama `PUT /api/users/{id de B}`, entonces no cambia nada de B (403).
- Dado un correo que no existe, cuando se pide recuperar contraseña, entonces la respuesta es la misma que para uno que existe (no revela cuentas).

## Fuera de alcance
Inicio de sesión con Google, verificación del correo al registrarse.

## Archivos relacionados
- Front: `frontend/auth.html`, `js/auth.js`, `forgot_password.html`, `change_password.html`
- API: `backend/auth.py` (`/api/auth/register`, `/login`, `/forgot-password`, `/change-password`)
