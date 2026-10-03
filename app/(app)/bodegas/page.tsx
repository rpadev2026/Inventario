import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso, esAdmin } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import { paginar } from "@/lib/paginacion";
import Badge from "@/components/app/badge";
import Paginador from "@/components/app/paginador";
import PanelNuevaBodega from "./panel-nueva";
import EditarBodega from "./editar";

type Params = Record<string, string | string[] | undefined>;
const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const tono = { Crítico: "danger", Bajo: "warn", OK: "ok" } as const;
const COLS_BODEGA = "IdBodega,NombreBodega,EsCentral,IdEstado";

/** URL de /bodegas con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/bodegas?${s}` : "/bodegas";
}

export default async function BodegasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const s = await requerirPaginaPermiso("bodegas.ver");
  const admin = esAdmin(s);
  const sp = await searchParams;
  const idEditar = admin ? entero(sp.editar) : undefined; // solo el Administrador ve el formulario de edición
  const idVer = idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado que se conservan al abrir/cerrar los paneles.
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam) };
  const volverListado = href(base);

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Bodegas").select(COLS_BODEGA).eq("IdBodega", idPanel).maybeSingle()
    : { data: null };

  // ===== Ver: solo la bodega y sus productos (con stock), paginados =====
  if (idVer && sel) {
    const [{ count }, unidades] = await Promise.all([
      db.from("StockBodega").select("CodigoProducto", { count: "exact", head: true }).eq("IdBodega", sel.IdBodega),
      mapaNombres("UnidadesMedida"),
    ]);
    const pgS = paginar({ pagina: sp.ppagina, tam: sp.ptam }, count ?? 0);
    const { data } = await db.from("StockBodega")
      .select("CodigoProducto,Cantidad,Productos!inner(NombreProducto,UnidadMedida,StockMinimo,StockCritico)")
      .eq("IdBodega", sel.IdBodega).order("CodigoProducto").range(pgS.from, pgS.to).returns<any[]>();
    const stock = (data ?? []).map((r) => {
      const q = Number(r.Cantidad);
      const nivel = q <= Number(r.Productos.StockCritico) ? "Crítico" : q <= Number(r.Productos.StockMinimo) ? "Bajo" : "OK";
      return { codigo: r.CodigoProducto as string, q, nivel: nivel as keyof typeof tono, p: r.Productos };
    });
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">{sel.NombreBodega}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <p className="flex flex-wrap items-center gap-2">
          {sel.EsCentral ? <Badge tone="info">Central</Badge> : <span className="text-muted">Bodega secundaria</span>}
          <Badge tone={sel.IdEstado === 1 ? "ok" : "neutral"}>{sel.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge>
        </p>
        <h2 className="section-title">Productos</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Mín.</th><th className="num">Crít.</th><th>Nivel</th></tr></thead>
            <tbody>
              {stock.map((r) => (
                <tr key={r.codigo}>
                  <td>{r.codigo} — {r.p.NombreProducto}</td>
                  <td className="num">{r.q} {unidades.get(r.p.UnidadMedida) ?? r.p.UnidadMedida}</td>
                  <td className="num">{r.p.StockMinimo}</td><td className="num">{r.p.StockCritico}</td>
                  <td><Badge tone={tono[r.nivel]}>{r.nivel}</Badge></td>
                </tr>
              ))}
              {!stock.length && <tr><td colSpan={5} className="text-muted">Sin stock registrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pgS} paramPagina="ppagina" paramTam="ptam" etiqueta="productos de la bodega" />
      </section>
    );
  }

  // ===== Listado de bodegas paginado (Central primero, luego por nombre) =====
  const { count } = await db.from("Bodegas").select("IdBodega", { count: "exact", head: true });
  const pgB = paginar({ pagina: sp.pagina, tam: sp.tam }, count ?? 0);
  const { data: bodegas } = await db.from("Bodegas").select(COLS_BODEGA)
    .order("EsCentral", { ascending: false }).order("NombreBodega").range(pgB.from, pgB.to);
  const lista = bodegas ?? [];

  return (
    <section className="space-y-6">
      <PanelNuevaBodega puedeCrear={admin} />

      <div className="space-y-3">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Bodega</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.IdBodega} aria-current={b.IdBodega === idEditar ? "true" : undefined}>
                  <td>{b.NombreBodega}</td>
                  <td>{b.EsCentral ? <Badge tone="info">Central</Badge> : "Secundaria"}</td>
                  <td><Badge tone={b.IdEstado === 1 ? "ok" : "neutral"}>{b.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: String(b.IdBodega) })} aria-label={`Ver productos de ${b.NombreBodega}`}>Ver</Link>
                      {admin && <Link className="link link-sm" href={href({ ...base, editar: String(b.IdBodega) })} aria-label={`Editar ${b.NombreBodega}`}>Editar</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={4} className="text-muted">Sin bodegas.</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pgB} etiqueta="bodegas" />
      </div>

      {idEditar && sel && (
        <div className="card space-y-3" id="panel-editar">
          <h2 className="section-title">Editar bodega</h2>
          <EditarBodega key={sel.IdBodega} b={sel} volverHref={volverListado} />
        </div>
      )}
    </section>
  );
}
