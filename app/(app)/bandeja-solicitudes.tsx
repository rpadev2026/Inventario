import Link from "next/link";
import Badge from "@/components/app/badge";
import type { ItemBandeja } from "@/lib/bandeja-solicitudes";
import { ESTADOS, ESTADO_TONO } from "./solicitudes/estados";

/** «hace un momento», «hace 30 min», «hace 2 h», «ayer», «hace 3 d» (relativo a `ahora`, que se inyecta para poder probarlo). */
function antiguedad(iso: string, ahora: Date): string {
  const min = Math.max(0, Math.floor((ahora.getTime() - Date.parse(iso)) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} d`;
}

/**
 * Bandeja de entrada del Inicio: solicitudes no finalizadas del usuario; cada fila lleva a `/solicitudes/<token>`.
 * Presentacional: los datos los arma `cargarBandeja` (lib/services/bandeja.ts). `error` = no se pudieron leer.
 */
export default function BandejaSolicitudes({ items, total, ahora = new Date(), error = false }: {
  items: ItemBandeja[]; total: number; ahora?: Date; error?: boolean;
}) {
  return (
    <section className="space-y-3" aria-labelledby="titulo-bandeja">
      <h2 id="titulo-bandeja" className="section-title">Bandeja ({total})</h2>
      {error ? (
        <p role="alert" className="alert alert-error">No se pudo cargar la bandeja de solicitudes. Intente nuevamente en unos segundos.</p>
      ) : items.length === 0 ? (
        <p className="text-muted">No tienes solicitudes pendientes.</p>
      ) : (
        <>
          <ul className="bandeja" aria-label="Solicitudes pendientes">
            {items.map((i) => (
              <li key={i.IdSolicitud}>
                <Link href={`/solicitudes/${i.Token}`} className={`bandeja-fila${i.requiereAccion ? " bandeja-accion" : ""}`}>
                  <span className="bandeja-titulo">
                    {i.requiereAccion && <><span aria-hidden="true">● </span><span className="sr-only">Requiere su acción: </span></>}
                    #{i.NumeroSolicitud} · {i.NombreBodega}
                  </span>
                  <Badge tone={ESTADO_TONO[i.EstadoSolicitud]}>{ESTADOS[i.EstadoSolicitud]}</Badge>
                  <span className="bandeja-detalle">{i.propia ? "yo" : i.Solicitante} · {antiguedad(i.FechaSolicitud, ahora)} · {i.espera}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/solicitudes" className="link">{total > items.length ? `Ver todas (${total})` : "Ver todas"}</Link>
        </>
      )}
    </section>
  );
}
