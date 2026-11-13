# Bandeja de solicitudes en el Inicio (etapa 1)

Fecha: 2026-11-13 · Alcance: pequeño (sin migración) · Estado: aprobado por el dueño del proyecto.

## Intención y por qué
Quien usa el sistema debe ver, apenas entra, qué solicitudes de insumos le esperan, sin ir a buscarlas en «Solicitudes».
Hoy el Inicio solo muestra dos contadores («por aprobar» y «por recepcionar»). El dueño pidió una **bandeja de entrada**:
una lista de las solicitudes no finalizadas, por usuario, donde cada fila lleva directo a su solicitud.
Esta es la etapa 1 de un pedido mayor. La etapa 2 (aviso push al enviar una solicitud) tiene su propio diseño.

## Objetivos
- En `/` (Resumen), bajo los cuatro contadores, una lista «Bandeja» de solicitudes no finalizadas.
- Cada fila muestra: N°, bodega destino, solicitante («yo» si es el propio usuario), antigüedad, estado (insignia) y qué se espera («Por aprobar», «Por recepcionar», «Borrador», «En espera de aprobación», «En seguimiento»).
- Clic en la fila (o en su enlace) abre `/solicitudes/<token>`.
- Sin solicitudes: «No tienes solicitudes pendientes».

## No objetivos
- Notificaciones push o correo (etapa 2 y existente, respectivamente).
- Cambiar los contadores, el flujo de estados o los permisos.
- Actualización automática de la lista (se ve al entrar o recargar).

## Antiobjetivos (fallaría aunque «funcione»)
- Mostrar a un solicitante solicitudes ajenas, o a cualquiera los borradores de otros.
- Mostrar solicitudes finalizadas (Recepcionada, Rechazada).
- Una consulta que traiga todo el historial: la lista debe estar acotada.

## Restricciones
- Next.js de este repositorio (ver `AGENTS.md`); estilos solo con las clases de `app/tema.css` (`card`, `table`, `badge`...), sin colores sueltos.
- Autorización por permiso, no por nombre de rol: `solicitudes.gestionar` (ve todas) y `solicitudes.ver_propias` / `solicitudes.crear` (solo las suyas).
- URLs con `"Token"` (uuid), nunca el id numérico.
- Sin migración: la base de datos no se toca.
- Supabase no está conectado a esta sesión; esta etapa no lo necesita.

## Definiciones (acordadas)
- Estados (`app/(app)/solicitudes/estados.ts`): 0 Creada, 1 Enviada, 2 Aprobada, 3 Recepcionada, 4 Recepción parcial, 5 Rechazada.
- **No finalizada** = estados 0, 1, 2, 4. Finalizadas: 3 y 5.
- **Solicitante** (sin `solicitudes.gestionar`): ve las suyas en estados 0, 1, 2 y 4.
- **Quien gestiona** (`solicitudes.gestionar`): ve las Enviadas (1) de todos, arriba y marcadas «Por aprobar»; debajo, las Aprobadas y Parciales (2, 4) de los demás como seguimiento; más las suyas propias en cualquier estado no finalizado. Nunca los borradores (0) ajenos.
- Orden: primero lo que requiere acción del usuario, luego lo demás; dentro de cada grupo, la más reciente primero.
- Máximo 10 filas y un enlace «Ver todas» a `/solicitudes`.

## Enfoques considerados
1. **Consulta en el propio Inicio (server component), con filtros de PostgREST y lógica de clasificación en un módulo puro y probado.** Elegido: cero migración, se puede probar entero sin base de datos, sigue el patrón de `app/(app)/page.tsx`.
2. Una función SQL `bandeja_solicitudes(usuario)` que clasifique y ordene en la base. Descartado por ahora: exige una migración y Supabase no está conectado; para decenas de solicitudes no aporta rendimiento.
3. Un componente cliente que consulte periódicamente. Descartado: añade un endpoint y estado en el navegador para algo que se ve al entrar; el aviso en vivo es el push de la etapa 2.

## Decidido por el dueño
- Bandeja como lista tipo «inbox» en el Resumen, con clic hacia la solicitud.
- Quienes reciben las solicitudes son los usuarios con `solicitudes.gestionar` (encargados de bodega); esos usuarios se crearán después.
- Dispositivos de uso: computador y celular (la lista debe verse bien en 375 px).

## Queda al constructor
- Estructura exacta de la tabla o lista (debe apilarse bien en celular) y textos finos.
- Nombres de archivos y funciones.
- Una consecuencia a vigilar, ya conocida por el dueño: una solicitud rechazada sale de la bandeja de inmediato; el aviso al solicitante queda para la etapa 2.
