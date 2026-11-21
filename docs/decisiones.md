# Decisiones

> La bitácora de por qué se hizo cada cosa. Una fila por decisión.

| Cuándo | Decisión | Por qué |
|---|---|---|
| Inicio del proyecto | Tienda de merch de F1 con precios en la moneda del comprador | Es el problema principal: los precios en USD/EUR frenan la compra |
| Inicio del proyecto | Pronósticos con PitCoins, sin dinero real | Dan una razón para volver cada carrera sin ser apuestas (Ley 643 de 2001) |
| Inicio del proyecto | Pago simulado que no guarda la tarjeta | Un prototipo no debe manejar datos bancarios reales |
| Inicio del proyecto | Python + MySQL sin frameworks | Entender cada capa construyéndola; una sola dependencia externa |
| Inicio del proyecto | Tasas de cambio guardadas en la base y editables por el superadmin | Evita depender de una API externa con llave; si la tasa cambia mientras el cliente paga, el servidor responde 409 |
| Durante el desarrollo | Quitar el minijuego 2D y poner un avatar en el perfil | El avatar conecta mejor con los pronósticos y la tienda: la ropa se gana acertando o se compra |
| Durante el desarrollo | Intro con carro 3D al hacer scroll (WebGL directo) | Primera impresión de marca sin cargar librerías 3D |
| Durante el desarrollo | Efecto del cursor: solo halo morado, sin destellos | Los destellos distraían; el halo mantiene la identidad sin ruido |
| Durante el desarrollo | Cuotas parimutuel calculadas en vivo | Nadie fija cuotas a mano: salen de cómo pronostica la gente |
| Módulo de IA (U3) | Publicar el front en Vercel con datos mock | Vercel no corre Python ni MySQL; el mock dejaba probar el recorrido desde una URL. **Reemplazada en U4.** |
| Módulo de IA (U3) | Contraseña de MySQL fuera del código, en `.env` | El repositorio es público; las llaves nunca van en el código |
| Módulo de IA (U3) | No migrar a Next.js por ahora | El sistema ya funciona y se sustenta así; migrar es una mejora futura |
| Módulo de IA (U4) | Reemplazar la versión anterior por el sistema completo (panel, 11 monedas, XP y descuentos) | Es la versión que se sustenta; la del mock ya no representa el producto |
| Módulo de IA (U4) | Quedarnos con Python + MySQL en lugar de Supabase | La guía admite Spring Boot + MySQL; el sistema ya funciona y tiene 33 tablas con restricciones. Migrar a Postgres sería reescribir el back |
| Módulo de IA (U4) | Sin RLS: la autorización por fila vive en el servidor | MySQL no tiene RLS. Cada consulta personal filtra por el `user_id` de la sesión y el cuerpo nunca decide el usuario (skill `backend-seguro`) |
| Módulo de IA (U4) | API y panel en Render, MySQL en Railway; la tienda en Vercel con rewrites | Es el esquema de clase (back en Render). Vercel no corre un servidor Python permanente y Render solo ofrece Postgres, por eso la base MySQL queda en Railway. Los rewrites dejan un solo dominio, así la cookie `SameSite=Strict` sigue funcionando |
| Módulo de IA (U4) | El panel `/admin` lo sirve solo Render | Sus páginas las protege el servidor; si Vercel las sirviera como estáticas, cualquiera vería el HTML del panel |
| Módulo de IA (U4) | `PURPLE1_ALLOWED_ORIGINS` explícito | El control de origen compara con el Host; detrás del rewrite el Host es el de Render y el Origin el de Vercel |
| Módulo de IA (U4) | `purple1_completo.sql` fuera de Git | Trae datos de usuarios de prueba y hashes; se importa a MySQL en Railway desde el computador |
| Módulo de IA (U4) | Eliminar el modo mock | Con back en la nube ya no hace falta y evita dos fuentes de verdad |
| Módulo de IA (U4) | GitHub Actions revisa cada push y cada PR a `main` | Es la parte de CI/CD del esquema de clase: si el back no compila o se cuela la copia de la base, el cambio se marca en rojo antes de llegar a Vercel y Railway |
| Módulo de IA (U4) | Volver a la versión del 19 nov 11:07 p. m. (`upgrade_08`), sin la clasificación completa de carreras | Decisión del equipo: es la versión que se presenta. El administrador elige solo al ganador |
