/**
 * ¿Cambió la cantidad de algún producto respecto de lo SOLICITADO? Con cambio, la aprobación es PARCIAL (exige motivo);
 * sin cambio, es una aprobación normal. Se compara con lo pedido, no con el máximo que permite el stock: si el stock no alcanza,
 * la persona ya está aprobando menos de lo pedido. Un valor vacío o no numérico cuenta como 0.
 */
export function hayCambioDeCantidades(items: { producto: number; solicitada: number }[], vals: Record<string, string>): boolean {
  return items.some((i) => (Number(vals[String(i.producto)]) || 0) !== i.solicitada);
}

/** Días que una solicitud puede estar «Aprobada parcialmente» antes de cerrarse sola (igual que `cerrar_solicitudes_caducadas` en SQL). */
export const DIAS_CADUCIDAD = 7;

/** Cuándo se cerrará sola una solicitud aprobada parcialmente en `fechaAprobacion`. */
export function fechaCaducidad(fechaAprobacion: string): Date {
  return new Date(Date.parse(fechaAprobacion) + DIAS_CADUCIDAD * 24 * 3600_000);
}

/** El motivo que corresponde al estado de la solicitud (rechazo, aprobación parcial o cierre); null en los demás, aunque la fila conserve uno anterior. */
export function motivoDeSolicitud(r: { EstadoSolicitud: number; MotivoRechazo: string | null; MotivoParcial: string | null; MotivoCierre: string | null }): string | null {
  return r.EstadoSolicitud === 5 ? r.MotivoRechazo : r.EstadoSolicitud === 6 ? r.MotivoParcial : r.EstadoSolicitud === 7 ? r.MotivoCierre : null;
}
