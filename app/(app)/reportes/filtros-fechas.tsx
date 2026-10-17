import Link from "next/link";
import Field from "@/components/app/field";
import { atajos, paramsRango, type Rango } from "@/lib/reporte-ventas";

/** Atajos de rango y campos Desde/Hasta de los reportes de ventas (formulario GET: sin JavaScript también funciona). */
export function AtajosRango({ ruta, extra }: { ruta: string; extra?: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Rangos rápidos" className="flex flex-wrap gap-2">
      {atajos().map((a) => (
        <Link key={a.nombre} href={`${ruta}?${paramsRango(a.rango, extra)}`} className="btn btn-secondary">{a.nombre}</Link>
      ))}
    </nav>
  );
}

export function CamposRango({ rango }: { rango: Rango }) {
  return (
    <>
      <Field label="Desde"><input name="desde" type="date" defaultValue={rango.desde} required className="input" /></Field>
      <Field label="Hasta"><input name="hasta" type="date" defaultValue={rango.hasta} required className="input" /></Field>
    </>
  );
}
