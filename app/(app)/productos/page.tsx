import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { rutaVolverSegura } from "@/lib/volver";
import { cargarCatalogo, cargarUnidades } from "@/lib/catalogo-nombres";
import { productoTieneMovimientos } from "@/lib/services/productos";
import { paginar } from "@/lib/paginacion";
import { leerEstado } from "@/lib/filtro-estado";
import { filtrarProductos, type ProductoFila } from "@/lib/productos-filtro";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import FormProducto, { type Producto } from "./form";

type Params = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const tono = { Crítico: "danger", Bajo: "warn", OK: "ok" } as const;
const AVISOS: Record<string, string> = { creado: "Producto creado correctamente", editado: "Cambios guardados correctamente" };
const COLS = "IdProducto,Codigo,Nombre,UnidadBase,Formato,CostoUnitarioBase,StockMinimo,StockCritico,IdEstado";
/** Cuántas recetas (distintas) usan el producto como ingrediente. */
async function recetasQueUsan(idProducto: number): Promise<number> {
  const { data } = await db.from("RecetaDetalles").select("IdReceta").eq("IdProducto", idProducto);
  return new Set((data ?? []).map((d: any) => d.IdReceta as number)).size;
}
const idValido = (v: string | undefined) => (v && /^[1-9]\d{0,14}$/.test(v) ? Number(v) : undefined);
const clpEntero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const clpDecimal = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Precio en pesos: sin decimales si es entero («$2.500»), con dos si no («$3.500,50»). */
const clp = { format: (n: number) => (Number.isInteger(n) ? clpEntero : clpDecimal).format(n) };
const fecha = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
const clpBase = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 6 });

/** URL de /productos con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/productos?${s}` : "/productos";
}
const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

export default async function ProductosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("productos.ver");
  const puedeGestionar = tienePermiso(sesion.permisos, "productos.gestionar");
  const sp = await searchParams;
  const rutaVolver = rutaVolverSegura(texto(sp.volver));
  // Crear/editar solo con «productos.gestionar» (la acción del servidor lo exige igualmente).
  // Venir desde una factura (?volver=) abre directo la vista Crear.
  const crear = puedeGestionar && (sp.crear === "1" || !!rutaVolver);
  // Un id inválido (texto, 0, negativo) se ignora y se muestra el listado.
  const idEditar = puedeGestionar && !crear ? idValido(texto(sp.editar)) : undefined;
  const idVer = crear || idEditar ? undefined : idValido(texto(sp.ver));

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);

  const [unidades, formatos] = await Promise.all([cargarUnidades(), cargarCatalogo("Formatos")]);
  const nombreUnidad = new Map(unidades.map((i) => [i.Codigo, i.Nombre]));
  const puedeVerCompras = tienePermiso(sesion.permisos, "compras.ver");
  const nombreFormato = new Map(formatos.map((i) => [i.Codigo, i.Nombre]));

  // ===== Crear: solo el formulario, con Volver (a la factura si se vino de ella) =====
  if (crear) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Crear producto</h1>
          <Link href={rutaVolver ?? volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormProducto unidades={unidades} formatos={formatos} volver={rutaVolver ?? undefined} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
        </div>
      </section>
    );
  }

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Productos").select("*").eq("IdProducto", idPanel).maybeSingle<Producto>()
    : { data: null };

  // ===== Editar: solo el formulario del producto, con Volver =====
  if (idEditar && sel) {
    const [bloqueada, enRecetas] = await Promise.all([productoTieneMovimientos(sel.IdProducto), recetasQueUsan(sel.IdProducto)]);
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Editar producto</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormProducto key={sel.IdProducto} p={sel} unidades={unidades} formatos={formatos} unidadBaseBloqueada={bloqueada} enRecetas={enRecetas} despuesDeGuardar={href({ ...base, aviso: "editado" })} />
        </div>
      </section>
    );
  }

  // ===== Ver: datos del producto (solo lectura) y su stock por bodega, paginado =====
  if (idVer && sel) {
    const enRecetas = await recetasQueUsan(sel.IdProducto);
    const { count } = await db.from("StockBodega").select("IdBodega", { count: "exact", head: true }).eq("IdProducto", sel.IdProducto);
    const pgS = paginar({ pagina: sp.ppagina, tam: sp.ptam }, count ?? 0);
    const { data } = await db.from("StockBodega").select("IdBodega,Cantidad,Bodegas!inner(NombreBodega)")
      .eq("IdProducto", sel.IdProducto).order("IdBodega").range(pgS.from, pgS.to).returns<any[]>();
    // Historial del costo (el más reciente primero), paginado aparte del stock.
    const { count: nHist } = await db.from("HistorialPreciosProducto").select("IdHistorial", { count: "exact", head: true }).eq("IdProducto", sel.IdProducto);
    const pgH = paginar({ pagina: sp.hpagina, tam: sp.htam }, nHist ?? 0);
    const { data: dataH } = await db.from("HistorialPreciosProducto")
      .select("IdHistorial,IdCompra,Origen,Anulada,Precio,UnidadMedida,CostoBaseAnterior,CostoBaseNuevo,FechaRegistro,Compras(Folio),Usuarios!HistorialPreciosProducto_IdUsuario_fkey(Nombres,Apellidos)")
      .eq("IdProducto", sel.IdProducto).order("IdHistorial", { ascending: false }).range(pgH.from, pgH.to).returns<any[]>();
    const historial = (dataH ?? []).map((h) => ({
      id: h.IdHistorial as number, idCompra: h.IdCompra as number, folio: h.Compras?.Folio as number | undefined,
      origen: h.Origen as string, anulada: !!h.Anulada,
      precio: h.Precio === null ? null : `${clp.format(Number(h.Precio))} por ${nombreUnidad.get(h.UnidadMedida) ?? h.UnidadMedida}`,
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

  // ===== Listado de productos: filtro por código/nombre y estado, y paginación =====
  const { data: todos } = await db.from("Productos").select(COLS).returns<ProductoFila[]>();
  const estado = leerEstado(estadoPedido);
  const filtrados = filtrarProductos(todos ?? [], { q, estado });
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, filtrados.length);
  const lista = filtrados.slice(pg.from, pg.to + 1);
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      {rutaVolver && <Link href={rutaVolver} className="link">← Volver a la factura</Link>}
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Productos</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {puedeGestionar && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear producto</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/productos" etiqueta="Buscar productos" campo="Código o nombre" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Unidad</th><th>Formato</th><th className="num">Mín.</th><th className="num">Crít.</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.IdProducto}>
                  <td>{p.Codigo ?? "—"}</td><td>{p.Nombre}</td>
                  <td>{nombreUnidad.get(p.UnidadBase) ?? p.UnidadBase}</td><td>{nombreFormato.get(p.Formato) ?? p.Formato}</td>
                  <td className="num">{p.StockMinimo}</td><td className="num">{p.StockCritico}</td>
                  <td><Badge tone={p.IdEstado === 1 ? "ok" : "neutral"}>{p.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: String(p.IdProducto) })} aria-label={`Ver ${p.Nombre}`}>Ver</Link>
                      {puedeGestionar && <Link className="link link-sm" href={href({ ...base, editar: String(p.IdProducto) })} aria-label={`Editar ${p.Nombre}`}>Editar</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={8} className="text-muted">{hayFiltro ? "Sin productos que coincidan con la búsqueda." : "Sin productos."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="productos" />
      </div>
    </section>
  );
}
