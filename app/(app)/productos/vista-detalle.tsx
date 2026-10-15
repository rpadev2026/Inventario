import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { paginar } from "@/lib/paginacion";
import Badge from "@/components/app/badge";
import Paginador from "@/components/app/paginador";
import type { Producto } from "./form";
import { clp, clpBase, Dato, fecha, recetasQueUsan, tono, type Contexto } from "./comun";

/** Ver: datos del producto (solo lectura), su stock por bodega y el historial del costo, cada uno paginado aparte. */
export async function VistaDetalle({ ctx, sel }: { ctx: Contexto; sel: Producto }) {
  const { sp, volverListado, puedeVerCompras, nombreUnidad, nombreFormato } = ctx;
  const enRecetas = await recetasQueUsan(sel.IdProducto);
  const { count } = await db.from("StockBodega").select("IdBodega", { count: "exact", head: true }).eq("IdProducto", sel.IdProducto);
  const pgS = paginar({ pagina: sp.ppagina, tam: sp.ptam }, count ?? 0);
  const { data } = await db.from("StockBodega").select("IdBodega,Cantidad,Bodegas!inner(NombreBodega)")
    .eq("IdProducto", sel.IdProducto).order("IdBodega").range(pgS.from, pgS.to);
  // Historial del costo (el más reciente primero), paginado aparte del stock.
  const { count: nHist } = await db.from("HistorialPreciosProducto").select("IdHistorial", { count: "exact", head: true }).eq("IdProducto", sel.IdProducto);
  const pgH = paginar({ pagina: sp.hpagina, tam: sp.htam }, nHist ?? 0);
  const { data: dataH } = await db.from("HistorialPreciosProducto")
    .select("IdHistorial,IdCompra,Origen,Anulada,Precio,UnidadMedida,CostoBaseAnterior,CostoBaseNuevo,FechaRegistro,Compras(Folio),Usuarios!HistorialPreciosProducto_IdUsuario_fkey(Nombres,Apellidos)")
    .eq("IdProducto", sel.IdProducto).order("IdHistorial", { ascending: false }).range(pgH.from, pgH.to);
  const historial = (dataH ?? []).map((h) => ({
    id: h.IdHistorial as number, idCompra: h.IdCompra as number, folio: h.Compras?.Folio as number | undefined,
    origen: h.Origen as string, anulada: !!h.Anulada,
    precio: h.Precio === null ? null : `${clp.format(Number(h.Precio))} por ${nombreUnidad.get(h.UnidadMedida ?? "") ?? h.UnidadMedida}`,
    anterior: h.CostoBaseAnterior === null ? null : Number(h.CostoBaseAnterior), nuevo: h.CostoBaseNuevo === null ? null : Number(h.CostoBaseNuevo),
    fecha: fecha(h.FechaRegistro),
    usuario: h.Usuarios ? `${h.Usuarios.Nombres} ${h.Usuarios.Apellidos}` : "—",
  }));
  const stock = (data ?? []).map((r) => {
    const cant = Number(r.Cantidad);
    const nivel = cant <= Number(sel.StockCritico) ? "Crítico" : cant <= Number(sel.StockMinimo) ? "Bajo" : "OK";
    return { id: r.IdBodega as number, bodega: r.Bodegas.NombreBodega as string, cant, nivel: nivel as keyof typeof tono };
  });
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">{sel.Nombre}</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <div className="form-grid form-grid-4">
          <Dato titulo="Código">{sel.Codigo}</Dato>
          <Dato titulo="Unidad base">{nombreUnidad.get(sel.UnidadBase) ?? sel.UnidadBase}</Dato>
          <Dato titulo="Formato">{nombreFormato.get(sel.Formato) ?? sel.Formato}</Dato>
          <Dato titulo="Estado"><Badge tone={sel.IdEstado === 1 ? "ok" : "neutral"}>{sel.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></Dato>
          <Dato titulo="Costo unitario base (con IVA)">{sel.CostoUnitarioBase === null ? "" : `${clpBase.format(Number(sel.CostoUnitarioBase))} por ${nombreUnidad.get(sel.UnidadBase) ?? sel.UnidadBase}`}</Dato>
          <Dato titulo="Stock mínimo">{String(sel.StockMinimo)}</Dato>
          <Dato titulo="Stock crítico">{String(sel.StockCritico)}</Dato>
          <Dato titulo="Recetas que lo usan">{enRecetas === 0 ? "Ninguna" : `${enRecetas} ${enRecetas === 1 ? "receta" : "recetas"}`}</Dato>
        </div>
      </div>
      <h2 className="section-title">Stock por bodega</h2>
      <div className="table-wrap table-wrap-sticky">
        <table className="table">
          <thead><tr><th>Bodega</th><th className="num">Stock</th><th>Unidad</th><th>Nivel</th></tr></thead>
          <tbody>
            {stock.map((r) => (
              <tr key={r.id}>
                <td>{r.bodega}</td>
                <td className="num">{r.cant}</td>
                <td>{nombreUnidad.get(sel.UnidadBase) ?? sel.UnidadBase}</td>
                <td><Badge tone={tono[r.nivel]}>{r.nivel}</Badge></td>
              </tr>
            ))}
            {!stock.length && <tr><td colSpan={4} className="text-muted">Este producto no tiene stock en ninguna bodega.</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginador pg={pgS} paramPagina="ppagina" paramTam="ptam" etiqueta="stock por bodega" />
      <h2 className="section-title">Historial del costo de compra</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Origen</th><th>Factura</th><th>Precio de la línea (IVA incl.)</th><th className="num">Costo base anterior</th><th className="num">Costo base nuevo</th><th>Usuario</th></tr></thead>
          <tbody>
            {historial.map((h) => (
              <tr key={h.id}>
                <td>{h.fecha}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={h.origen === "Compra" ? "ok" : "warn"}>{h.origen}</Badge>
                    {h.anulada && <Badge tone="neutral">Anulada</Badge>}
                  </div>
                </td>
                <td>{puedeVerCompras ? <Link className="link link-sm" href={`/compras/${h.idCompra}`}>Folio {h.folio ?? h.idCompra}</Link> : `Folio ${h.folio ?? h.idCompra}`}</td>
                <td>{h.precio ?? "—"}</td>
                <td className="num">{h.anterior === null ? "—" : clpBase.format(h.anterior)}</td>
                <td className="num">{h.nuevo === null ? "—" : clpBase.format(h.nuevo)}</td>
                <td>{h.usuario}</td>
              </tr>
            ))}
            {!historial.length && <tr><td colSpan={7} className="text-muted">Sin compras registradas: el costo se define con la primera factura.</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginador pg={pgH} paramPagina="hpagina" paramTam="htam" etiqueta="historial del costo" />
    </section>
  );
}
