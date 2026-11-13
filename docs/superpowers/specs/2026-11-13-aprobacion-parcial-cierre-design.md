# Aprobación parcial y cierre de solicitudes — diseño

## Intención
Hoy, si se pide 100 y se aprueban 40, las 60 restantes se pierden sin registro ni aviso. Se formaliza: aprobar menos de lo pedido es una **aprobación parcial** que requiere motivo y una **segunda aprobación del Administrador**; si nadie la resuelve en 7 días, se cierra sola.

## Reglas (del usuario)
1. Al aprobar, si cambia la cantidad de algún producto (menos que lo pedido) la solicitud queda **«Aprobada parcialmente»** (estado 6) y permanece en la bandeja de ambos usuarios (solicitante y quien gestiona).
2. El botón de aprobación parcial se activa **solo cuando se cambia la cantidad de algún producto** y exige un **motivo** (1–100 caracteres).
3. En ese estado el **solicitante solo puede ver** la solicitud.
4. **El Administrador vuelve a aprobar** la solicitud parcial y así sigue el flujo normal (pasa a «Aprobada», se recepciona como siempre).
5. Antes de los 7 días el **rol Administrador** puede **cerrarla** (estado 7 «Cerrada») con motivo (1–100).
6. A los **7 días** en «Aprobada parcialmente» se cierra sola con el motivo «Cierre por caducidad de días» y se informa por **push y correo** a los usuarios participantes.

## Decisiones mías (a revisar)
- «Administrador» = rol Administrador (`esAdmin`), como indicaste; reforzado también en SQL. Un Administrador no puede re-aprobar una solicitud suya (regla existente: nadie aprueba la suya); sí puede cerrarla.
- Estados nuevos: 6 «Aprobada parcialmente», 7 «Cerrada». Los 7 días cuentan desde la aprobación parcial (`FechaAprobacion`).
- Participantes (aviso del cierre): el solicitante, quienes intervinieron en su historial (quien aprobó parcialmente) y los Administradores vigentes (la tienen en su bandeja). El aviso de cierre aplica al cierre manual y al automático.
- Aviso al aprobar parcialmente: push a los Administradores (deben actuar) y push + correo al solicitante (con el motivo). Al re-aprobar: los avisos de «aprobada» de siempre.
- `aprobar_solicitud` rechaza cantidades menores a las pedidas (hay que usar la aprobación parcial con motivo); no hay forma de aprobar menos sin motivo. Al re-aprobar se vuelve a validar el stock de la Bodega Central.
- Cierre automático: función SQL `cerrar_solicitudes_caducadas` (idempotente) llamada por `GET|POST /api/solicitudes/cerrar-caducadas` (`CRON_SECRET`, para un cron) y, como respaldo sin cron, al abrir el Inicio quien gestiona. No se crea `vercel.json`: el despliegue no está definido.
- La Cerrada NO entra a la bandeja (se informa por push/correo y se ve en el listado y el detalle con su motivo).

## No objetivos
Aprobar más cantidad después (el saldo se pide con una solicitud nueva); reabrir una solicitud cerrada; configurar los días de caducidad.
