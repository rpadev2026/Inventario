# Motivo del rechazo y aviso de recepción — diseño (aprobado)

## Intención
1. Rechazar una solicitud exige un motivo corto (1 a 100 caracteres) que el solicitante pueda ver.
2. Al recepcionar (parcial o total) se avisa por push a quienes gestionan solicitudes.

## Decisiones del usuario
- Aviso de recepción: en AMBAS (parcial y total).
- El motivo se ve en la bandeja del Inicio: una solicitud rechazada permanece **7 días** en la bandeja del solicitante (con su motivo) y luego sale sola. Elegido entre 7 días / hasta que la abra / no entra.

## Diseño
- Migración `0048`: `"Solicitudes"."MotivoRechazo" text` (null; check 1–100 sin espacios en los extremos) y RPC `rechazar_solicitud(p_usuario, p_solicitud, p_motivo)` (definer, solo `app_servidor`): motivo obligatorio (mensaje «Indique el motivo del rechazo (máximo 100 caracteres)»), solo desde Enviada, nadie rechaza la suya, guarda motivo, aprobador y fecha, deja historial. `cambiar_estado_solicitud` deja de aceptar 5: el rechazo sin motivo no es posible por ningún camino. Las rechazadas anteriores quedan sin motivo (null) y se muestran sin él.
- App: `rechazarSolicitud` pasa a server action con resultado `{error|ok}` y Zod (`motivo` trim, 1–100); formulario cliente con etiqueta «Motivo del rechazo», contador y error visible. El motivo se muestra en el detalle, en el listado `/solicitudes` (bajo el estado) y en la bandeja. Va también en el push y en el correo de «rechazada».
- Bandeja: `armarBandeja(filas, usuario, limite, ahora)`; estado 5 solo para el solicitante dueño y dentro de 7 días desde `FechaAprobacion` (que se fija al rechazar); espera «Rechazada», sin pedir acción. La consulta suma ese caso (solicitante: propias rechazadas con fecha ≥ ahora−7 d; gestor: también las propias).
- Push de recepción: `notificarPushRecepcionada(numero, solicitante, bodega, token, idSolicitante, total)` a `solicitudes.gestionar` (menos al solicitante); título «Solicitud #N recepcionada» o «recepcionada parcialmente». `recepcionar_solicitud` ya devuelve el estado nuevo (3 total, 4 parcial). Sin correo.

## No objetivos
Motivo en aprobaciones; editar el motivo; historial de motivos; correo de recepción.
