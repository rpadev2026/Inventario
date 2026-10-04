import Link from "next/link";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import { FormCatalogo, type ItemCatalogo, type OpcionPadre } from "@/components/app/catalogo-form";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { paginar } from "@/lib/paginacion";
import { leerEstado } from "@/lib/filtro-estado";
import { filtrarCatalogo } from "@/lib/catalogo-filtro";
import { cargarUso, propsFormCatalogo, type CatalogoCfg } from "@/lib/services/catalogo";

export { FormCatalogo };

type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;
type Params = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const AVISOS: Record<string, string> = { creado: "Registro creado correctamente", editado: "Cambios guardados correctamente" };
const estadoBadge = (e: number) => <Badge tone={e === 1 ? "ok" : "neutral"}>{e === 1 ? "Vigente" : "No vigente"}</Badge>;
const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

/** Opciones del padre (todas; `vigente` permite filtrar al crear): regiones «CÓDIGO — Nombre»; ciudades «Nombre (Región)». */
async function cargarOpcionesPadre(tabla: "Regiones" | "Provincias"): Promise<OpcionPadre[]> {
  if (tabla === "Regiones") {
    const { data } = await db.from("Regiones").select("Codigo, Nombre, IdEstado").order("Codigo");
    return (data ?? []).map((r) => ({ codigo: r.Codigo, etiqueta: `${r.Codigo} — ${r.Nombre}`, vigente: r.IdEstado === 1 }));
  }
  const [{ data: provs }, { data: regs }] = await Promise.all([
    db.from("Provincias").select("Codigo, Nombre, CodigoRegion, IdEstado").order("Nombre"),
    db.from("Regiones").select("Codigo, Nombre"),
  ]);
  const reg = new Map((regs ?? []).map((r) => [r.Codigo, r.Nombre]));
  return (provs ?? [])
    .map((p) => ({ codigo: p.Codigo, etiqueta: `${p.Nombre} (${reg.get(p.CodigoRegion) ?? p.CodigoRegion})`, vigente: p.IdEstado === 1 }));
}

/**
 * Página servidor genérica de un mantenedor de catálogo (solo Administrador): listado con filtros y paginación,
 * y vistas aparte para ver (con dónde se usa), editar y crear.
 */
export async function PaginaCatalogo({ cfg, accion, searchParams }: { cfg: CatalogoCfg; accion: Accion; searchParams: Promise<Params> }) {
  await requerirPaginaAdmin();
  const sp = await searchParams;
  const crear = sp.crear === "1";
  const codEditar = crear ? undefined : texto(sp.editar);
  const codVer = crear || codEditar ? undefined : texto(sp.ver);

  /** URL de este mantenedor con solo los parámetros indicados (los undefined se omiten). */
  const href = (q: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
    return s ? `${cfg.ruta}?${s}` : cfg.ruta;
  };
  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);
  const formCfg = propsFormCatalogo(cfg);

  const col = cfg.padre?.columna;
  const [{ data }, opcionesPadre] = await Promise.all([
    db.from(cfg.tabla).select(col ? `Codigo, Nombre, IdEstado, ${col}` : "Codigo, Nombre, IdEstado"),
    cfg.padre ? cargarOpcionesPadre(cfg.padre.tabla) : Promise.resolve([] as OpcionPadre[]),
  ]);
  const etiquetaPadre = new Map(opcionesPadre.map((o) => [o.codigo, o.etiqueta]));
  const crudos = (data ?? []) as unknown as ItemCatalogo[]; // tal como están en la base (para los formularios)
  const items = crudos.map((i) => ({ // con la etiqueta del padre ya resuelta (para el listado y la vista)
    Codigo: i.Codigo, Nombre: i.Nombre, IdEstado: i.IdEstado,
    padre: cfg.padre ? etiquetaPadre.get(String(i[cfg.padre.columna])) ?? String(i[cfg.padre.columna] ?? "") : undefined,
  }));

  // ===== Crear: solo el formulario, con Volver =====
  if (crear) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Crear: {cfg.titulo}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormCatalogo accion={accion} cfg={formCfg} opcionesPadre={opcionesPadre} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
        </div>
      </section>
    );
  }

  // ===== Editar: solo el formulario del registro, con Volver =====
  const enEdicion = codEditar ? crudos.find((i) => i.Codigo === codEditar) : undefined;
  if (enEdicion) {
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Editar: {cfg.titulo}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormCatalogo key={enEdicion.Codigo} item={enEdicion} accion={accion} cfg={formCfg} opcionesPadre={opcionesPadre}
            despuesDeGuardar={href({ ...base, aviso: "editado" })} />
        </div>
      </section>
    );
  }

  // ===== Ver: datos del registro y dónde se usa (solo lectura) =====
  const enVista = codVer ? items.find((i) => i.Codigo === codVer) : undefined;
  if (enVista) {
    const uso = await cargarUso(cfg, enVista.Codigo);
    return (
      <section className="space-y-6">
        <div className="page-head">
          <h1 className="page-title">{enVista.Nombre}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <div className="form-grid form-grid-3">
            {cfg.padre && <Dato titulo={cfg.padre.etiqueta}>{enVista.padre}</Dato>}
            <Dato titulo="Código">{enVista.Codigo}</Dato>
            <Dato titulo="Nombre">{enVista.Nombre}</Dato>
            <Dato titulo="Estado">{estadoBadge(enVista.IdEstado)}</Dato>
          </div>
        </div>
        {uso.length > 0 && (
          <div className="space-y-3">
            <h2 className="section-title">Dónde se usa</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Dónde</th><th>Cantidad</th></tr></thead>
                <tbody>{uso.map((u) => <tr key={u.etiqueta}><td>{u.etiqueta}</td><td>{u.texto}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="text-muted">Revise esto antes de pasar el registro a «No vigente»: lo que ya lo usa lo conserva, pero no se podrá elegir en registros nuevos.</p>
          </div>
        )}
      </section>
    );
  }

  // ===== Listado: filtro por código/nombre (y padre) y estado, y paginación =====
  const estado = leerEstado(estadoPedido);
  const filtrados = filtrarCatalogo(items, { q, estado });
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, filtrados.length);
  const lista = filtrados.slice(pg.from, pg.to + 1);
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;
  const nombrePlural = cfg.titulo.toLowerCase();

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{cfg.titulo}</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear</Link>
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta={cfg.ruta} etiqueta={`Buscar en ${nombrePlural}`} campo={cfg.padre ? `Código, nombre o ${cfg.padre.etiqueta.toLowerCase()}` : "Código o nombre"}
          q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr>{cfg.padre && <th>{cfg.padre.etiqueta}</th>}<th>Código</th><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((i) => (
                <tr key={i.Codigo}>
                  {cfg.padre && <td>{i.padre}</td>}
                  <td>{i.Codigo}</td><td>{i.Nombre}</td>
                  <td>{estadoBadge(i.IdEstado)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: i.Codigo })} aria-label={`Ver ${i.Nombre}`}>Ver</Link>
                      <Link className="link link-sm" href={href({ ...base, editar: i.Codigo })} aria-label={`Editar ${i.Nombre}`}>Editar</Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={cfg.padre ? 5 : 4} className="text-muted">{hayFiltro ? "Sin registros que coincidan con la búsqueda." : "Sin registros."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta={nombrePlural} />
      </div>
    </section>
  );
}
