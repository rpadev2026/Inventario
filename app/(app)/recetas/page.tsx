import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { cargarUnidades } from "@/lib/catalogo-nombres";
import { paginar } from "@/lib/paginacion";
import { leerEstado } from "@/lib/filtro-estado";
import { filtrarRecetas, type RecetaFila } from "@/lib/recetas-filtro";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import FormReceta, { type LineaForm, type ProductoOpcion, type SubrecetaOpcion } from "./form";

type Params = Record<string, string | string[] | undefined>;
type Calculo = {
  total: number; porcion: number; incompleto: boolean; costoPorBase: number | null;
  lineas: { detalle: number; tipo: "producto" | "subreceta"; id: number; nombre: string; cantidadBruta: number; unidad: string; costo: number | null; sinCosto: boolean }[];
};
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const AVISOS: Record<string, string> = { creado: "Receta creada correctamente", editado: "Cambios guardados correctamente" };
const idValido = (v: string | undefined) => (v && /^[1-9]\d{0,14}$/.test(v) ? Number(v) : undefined);
const clpEntero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const clpDecimal = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Costo en pesos: sin decimales si es entero («$2.500»), con dos si no («$3.500,50»). */
const clp = (n: number) => (Number.isInteger(n) ? clpEntero : clpDecimal).format(n);
const num = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 4 });

/** URL de /recetas con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/recetas?${s}` : "/recetas";
}
const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);
const calcular = async (id: number): Promise<Calculo | null> => {
  const { data } = await db.rpc("calcular_receta", { p_receta: id });
  return (data as Calculo | null) ?? null;
};
/** Costos de varias recetas en una sola llamada (sin las líneas), por id. */
type Resumen = Omit<Calculo, "lineas">;
const calcularVarias = async (ids: number[]): Promise<Record<string, Resumen>> => {
  if (!ids.length) return {};
  const { data } = await db.rpc("calcular_recetas", { p_ids: ids });
  return (data as Record<string, Resumen> | null) ?? {};
};

export default async function RecetasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("recetas.ver");
  const puedeGestionar = tienePermiso(sesion.permisos, "recetas.gestionar");
  const sp = await searchParams;
  // Crear/editar solo con «recetas.gestionar» (la acción del servidor lo exige igualmente).
  const crear = puedeGestionar && sp.crear === "1";
  const idEditar = puedeGestionar && !crear ? idValido(texto(sp.editar)) : undefined;
  const idVer = crear || idEditar ? undefined : idValido(texto(sp.ver));

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);

  const unidades = await cargarUnidades();
  const nombreUnidad = new Map(unidades.map((u) => [u.Codigo, u.Nombre]));

  // ===== Crear / Editar: solo el formulario, con Volver =====
  if (crear || idEditar) {
    const { data: rec } = idEditar
      ? await db.from("Recetas").select("*").eq("IdReceta", idEditar).maybeSingle<any>()
      : { data: null };
    if (crear || rec) {
      const [{ data: prods }, { data: recs }, { data: dets }] = await Promise.all([
        db.from("Productos").select("IdProducto,Codigo,Nombre,UnidadBase,CostoUnitarioBase").eq("IdEstado", 1).order("Nombre").returns<any[]>(),
        db.from("Recetas").select("IdReceta,Nombre,RendimientoUnidad").eq("IdEstado", 1).not("RendimientoUnidad", "is", null).order("Nombre").returns<any[]>(),
        idEditar
          ? db.from("RecetaDetalles").select("IdProducto,IdSubReceta,Cantidad,PorcionNeta,UnidadMedida,PorcentajeMerma").eq("IdReceta", idEditar).order("IdDetalle").returns<any[]>()
          : Promise.resolve({ data: [] as any[] }),
      ]);
      // Ingredientes de la receta que ya no están vigentes: se ofrecen igual (marcados) para que la línea no quede en blanco.
      const faltanProd = (dets ?? []).filter((d) => d.IdProducto !== null && !(prods ?? []).some((p) => p.IdProducto === d.IdProducto)).map((d) => d.IdProducto as number);
      const faltanSub = (dets ?? []).filter((d) => d.IdSubReceta !== null && !(recs ?? []).some((r) => r.IdReceta === d.IdSubReceta)).map((d) => d.IdSubReceta as number);
      const [{ data: prodsExtra }, { data: subsExtra }] = await Promise.all([
        faltanProd.length ? db.from("Productos").select("IdProducto,Codigo,Nombre,UnidadBase,CostoUnitarioBase").in("IdProducto", faltanProd).returns<any[]>() : Promise.resolve({ data: [] as any[] }),
        faltanSub.length ? db.from("Recetas").select("IdReceta,Nombre,RendimientoUnidad").in("IdReceta", faltanSub).returns<any[]>() : Promise.resolve({ data: [] as any[] }),
      ]);
      const productos: ProductoOpcion[] = [...(prods ?? []), ...(prodsExtra ?? [])].map((p) => ({
        id: p.IdProducto, codigo: p.Codigo, nombre: p.Nombre, unidadBase: p.UnidadBase,
        costoBase: p.CostoUnitarioBase === null ? null : Number(p.CostoUnitarioBase),
        noVigente: faltanProd.includes(p.IdProducto),
      }));
      // Sub-recetas posibles: vigentes con rendimiento (menos la que se edita); su costo por unidad base sale del RPC.
      const candidatas = [...(recs ?? []).filter((r) => r.IdReceta !== idEditar), ...(subsExtra ?? []).filter((r) => r.RendimientoUnidad)];
      const costosSub = await calcularVarias(candidatas.map((r) => r.IdReceta as number));
      const subrecetas: SubrecetaOpcion[] = candidatas.map((r) => ({
        id: r.IdReceta as number, nombre: r.Nombre as string, rendimientoUnidad: r.RendimientoUnidad as string,
        costoPorBase: costosSub[String(r.IdReceta)]?.costoPorBase ?? null,
        noVigente: faltanSub.includes(r.IdReceta),
      }));
      const lineas: LineaForm[] = (dets ?? []).map((d) => ({
        tipo: d.IdProducto !== null ? "producto" : "subreceta", ingrediente: String(d.IdProducto ?? d.IdSubReceta),
        cantidad: String(Number(d.Cantidad)), porcion: String(Number(d.PorcionNeta)), unidad: d.UnidadMedida,
        merma: Number(d.PorcentajeMerma) === 0 ? "" : String(Math.round(Number(d.PorcentajeMerma) * 10000) / 100),
      }));
      return (
        <section className="space-y-4">
          <div className="page-head">
            <h1 className="page-title">{crear ? "Crear receta" : "Editar receta"}</h1>
            <Link href={volverListado} className="btn btn-secondary">Volver</Link>
          </div>
          <div className="card">
            <FormReceta
              key={idEditar ?? "nueva"} productos={productos} subrecetas={subrecetas} unidades={unidades} lineas={lineas}
              receta={rec ? {
                id: rec.IdReceta, codigo: rec.CodigoReceta, nombre: rec.Nombre, porciones: Number(rec.RendimientoPorciones),
                rendimientoCantidad: rec.RendimientoCantidad === null ? null : Number(rec.RendimientoCantidad),
                rendimientoUnidad: rec.RendimientoUnidad, estado: rec.IdEstado,
              } : undefined}
              despuesDeGuardar={href({ ...(crear ? { tam: base.tam } : base), aviso: crear ? "creado" : "editado" })}
            />
          </div>
        </section>
      );
    }
  }

  // ===== Ver: datos, ingredientes con su costo y resumen =====
  if (idVer) {
    const { data: rec } = await db.from("Recetas").select("*").eq("IdReceta", idVer).maybeSingle<any>();
    if (rec) {
      const [calculo, { data: detalles }] = await Promise.all([
        calcular(idVer),
        db.from("RecetaDetalles").select("IdDetalle,Cantidad,PorcionNeta,UnidadMedida,PorcentajeMerma").eq("IdReceta", idVer).returns<any[]>(),
      ]);
      const porDetalle = new Map((detalles ?? []).map((d) => [d.IdDetalle as number, d]));
      const lineas = (calculo?.lineas ?? []).map((l) => ({ ...l, d: porDetalle.get(l.detalle) }));
      const sinCosto = lineas.filter((l) => l.sinCosto).map((l) => l.nombre);
      return (
        <section className="space-y-4">
          <div className="page-head">
            <h1 className="page-title">{rec.Nombre}</h1>
            <Link href={volverListado} className="btn btn-secondary">Volver</Link>
          </div>
          <div className="card">
            <div className="form-grid form-grid-4">
              <Dato titulo="Código">{rec.CodigoReceta}</Dato>
              <Dato titulo="Porciones">{num.format(Number(rec.RendimientoPorciones))}</Dato>
              <Dato titulo="Rendimiento">{rec.RendimientoCantidad === null ? "" : `${num.format(Number(rec.RendimientoCantidad))} ${nombreUnidad.get(rec.RendimientoUnidad) ?? rec.RendimientoUnidad}`}</Dato>
              <Dato titulo="Estado"><Badge tone={rec.IdEstado === 1 ? "ok" : "neutral"}>{rec.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></Dato>
              <Dato titulo="Costo total">{calculo ? clp(calculo.total) : ""}</Dato>
              <Dato titulo="Costo por porción">{calculo ? clp(calculo.porcion) : ""}</Dato>
            </div>
          </div>
          {sinCosto.length > 0 && (
            <p role="status" className="alert alert-warn">
              Costo incompleto: aún no hay costo para {sinCosto.join(", ")}. El costo se define con la primera factura del producto.
            </p>
          )}
          <h2 className="section-title">Ingredientes</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ingrediente</th><th className="num">Cantidad</th><th className="num">Porción neta</th><th className="num">Merma</th><th className="num">Cantidad bruta</th><th className="num">Costo</th></tr></thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.detalle}>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        {l.tipo === "subreceta"
                          ? <Link className="link link-sm" href={href({ ...base, ver: String(l.id) })}>{l.nombre}</Link>
                          : l.nombre}
                        {l.tipo === "subreceta" && <Badge tone="info">Sub-receta</Badge>}
                      </div>
                    </td>
                    <td className="num">{l.d ? num.format(Number(l.d.Cantidad)) : "—"}</td>
                    <td className="num">{l.d ? `${num.format(Number(l.d.PorcionNeta))} ${nombreUnidad.get(l.d.UnidadMedida) ?? l.d.UnidadMedida}` : "—"}</td>
                    <td className="num">{l.d ? `${num.format(Number(l.d.PorcentajeMerma) * 100)} %` : "—"}</td>
                    <td className="num">{`${num.format(l.cantidadBruta)} ${nombreUnidad.get(l.unidad) ?? l.unidad}`}</td>
                    <td className="num">{l.costo === null ? <Badge tone="warn">Sin costo</Badge> : clp(l.costo)}</td>
                  </tr>
                ))}
                {!lineas.length && <tr><td colSpan={6} className="text-muted">Esta receta no tiene ingredientes.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      );
    }
  }

  // ===== Listado: filtro por código/nombre y estado, y paginación =====
  const { data: todas } = await db.from("Recetas").select("IdReceta,CodigoReceta,Nombre,RendimientoPorciones,IdEstado").returns<RecetaFila[]>();
  const estado = leerEstado(estadoPedido);
  const filtradas = filtrarRecetas(todas ?? [], { q, estado });
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, filtradas.length);
  const lista = filtradas.slice(pg.from, pg.to + 1);
  const costos = await calcularVarias(lista.map((r) => r.IdReceta));
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Recetas</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {puedeGestionar && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear receta</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/recetas" etiqueta="Buscar recetas" campo="Código o nombre" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Código</th><th>Nombre</th><th className="num">Porciones</th><th className="num">Costo por porción</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((r) => {
                const c = costos[String(r.IdReceta)];
                return (
                  <tr key={r.IdReceta}>
                    <td>{r.CodigoReceta ?? "—"}</td><td>{r.Nombre}</td>
                    <td className="num">{num.format(Number(r.RendimientoPorciones))}</td>
                    <td className="num">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {c ? clp(c.porcion) : "—"}
                        {c?.incompleto && <Badge tone="warn">Incompleto</Badge>}
                      </div>
                    </td>
                    <td><Badge tone={r.IdEstado === 1 ? "ok" : "neutral"}>{r.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                    <td>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <Link className="link link-sm" href={href({ ...base, ver: String(r.IdReceta) })} aria-label={`Ver ${r.Nombre}`}>Ver</Link>
                        {puedeGestionar && <Link className="link link-sm" href={href({ ...base, editar: String(r.IdReceta) })} aria-label={`Editar ${r.Nombre}`}>Editar</Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={6} className="text-muted">{hayFiltro ? "Sin recetas que coincidan con la búsqueda." : "Sin recetas."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="recetas" />
      </div>
    </section>
  );
}
