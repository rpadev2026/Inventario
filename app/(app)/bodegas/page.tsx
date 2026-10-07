import { etiquetaProducto } from "@/lib/producto-etiqueta";
import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso, esAdmin } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import { paginar } from "@/lib/paginacion";
import { filtrarBodegas, leerEstado, type BodegaFila } from "@/lib/bodegas-filtro";
import Badge from "@/components/app/badge";
import Aviso from "@/components/app/aviso";
import Icon from "@/components/app/icon";
import FiltrosListado from "@/components/app/filtros-listado";
import Paginador from "@/components/app/paginador";
import { CrearBodega, EditarBodega } from "./editar";


type Params = Record<string, string | string[] | undefined>;
const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const tono = { Crítico: "danger", Bajo: "warn", OK: "ok" } as const;
const AVISOS: Record<string, string> = { creada: "Bodega creada correctamente", editada: "Cambios guardados correctamente" };

/** URL de /bodegas con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/bodegas?${s}` : "/bodegas";
}

export default async function BodegasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const s = await requerirPaginaPermiso("bodegas.ver");
  const admin = esAdmin(s);
  const sp = await searchParams;
  const crear = admin && sp.crear === "1"; // solo el Administrador ve los formularios de crear y editar
  const idEditar = admin && !crear ? entero(sp.editar) : undefined;
  const idVer = crear || idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);

  // ===== Crear: solo el formulario, con Volver =====
  if (crear) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Crear bodega</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <CrearBodega volverHref={href({ tam: base.tam, aviso: "creada" })} />
        </div>
      </section>
    );
  }

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Bodegas").select("IdBodega,NombreBodega,EsCentral,IdEstado").eq("IdBodega", idPanel).maybeSingle()
    : { data: null };

  // ===== Editar: solo los datos de la bodega, con Volver =====
  if (idEditar && sel) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Editar bodega</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <EditarBodega key={sel.IdBodega} b={sel} volverHref={href({ ...base, aviso: "editada" })} />
        </div>
      </section>
    );
  }

  // ===== Ver: solo la bodega y sus productos (con stock), paginados =====
  if (idVer && sel) {
    const [{ count }, unidades] = await Promise.all([
      db.from("StockBodega").select("IdProducto", { count: "exact", head: true }).eq("IdBodega", sel.IdBodega),
      mapaNombres("UnidadesMedida"),
    ]);
    const pgS = paginar({ pagina: sp.ppagina, tam: sp.ptam }, count ?? 0);
    const { data } = await db.from("StockBodega")
      .select("IdProducto,Cantidad,Productos!inner(Codigo,Nombre,UnidadMedida,StockMinimo,StockCritico)")
      .eq("IdBodega", sel.IdBodega).order("IdProducto").range(pgS.from, pgS.to).returns<any[]>();
    const stock = (data ?? []).map((r) => {
      const cant = Number(r.Cantidad);
      const nivel = cant <= Number(r.Productos.StockCritico) ? "Crítico" : cant <= Number(r.Productos.StockMinimo) ? "Bajo" : "OK";
      return { id: r.IdProducto as number, cant, nivel: nivel as keyof typeof tono, p: r.Productos };
    });
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">{sel.NombreBodega}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <p><Badge tone={sel.IdEstado === 1 ? "ok" : "neutral"}>{sel.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></p>
        <h2 className="section-title">Productos</h2>
        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Producto</th><th className="num">Stock</th><th>Unidad</th><th className="num">Mín.</th><th className="num">Crít.</th><th>Nivel</th></tr></thead>
            <tbody>
              {stock.map((r) => (
                <tr key={r.id}>
                  <td>{etiquetaProducto(r.p.Codigo, r.p.Nombre)}</td>
                  <td className="num">{r.cant}</td>
                  <td>{unidades.get(r.p.UnidadMedida) ?? r.p.UnidadMedida}</td>
                  <td className="num">{r.p.StockMinimo}</td><td className="num">{r.p.StockCritico}</td>
                  <td><Badge tone={tono[r.nivel]}>{r.nivel}</Badge></td>
                </tr>
              ))}
              {!stock.length && <tr><td colSpan={6} className="text-muted">Sin stock registrado.</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pgS} paramPagina="ppagina" paramTam="ptam" etiqueta="productos de la bodega" />
      </section>
    );
  }

  // ===== Listado de bodegas: filtro por nombre y estado, y paginación =====
  const { data: todas } = await db.from("Bodegas").select("IdBodega,NombreBodega,EsCentral,IdEstado").returns<BodegaFila[]>();
  const estado = leerEstado(estadoPedido);
  const filtradas = filtrarBodegas(todas ?? [], { q, estado });
  const pgB = paginar({ pagina: sp.pagina, tam: sp.tam }, filtradas.length);
  const lista = filtradas.slice(pgB.from, pgB.to + 1);
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Bodegas</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {admin && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear bodega</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/bodegas" etiqueta="Buscar bodegas" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>Bodega</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((b) => (
                <tr key={b.IdBodega}>
                  <td>{b.NombreBodega}</td>
                  <td><Badge tone={b.IdEstado === 1 ? "ok" : "neutral"}>{b.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: String(b.IdBodega) })} aria-label={`Ver productos de ${b.NombreBodega}`}>Ver</Link>
                      {admin && <Link className="link link-sm" href={href({ ...base, editar: String(b.IdBodega) })} aria-label={`Editar ${b.NombreBodega}`}>Editar</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={3} className="text-muted">{hayFiltro ? "Sin bodegas que coincidan con la búsqueda." : "Sin bodegas."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pgB} etiqueta="bodegas" />
      </div>
    </section>
  );
}
