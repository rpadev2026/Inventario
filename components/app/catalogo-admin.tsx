import Link from "next/link";
import Badge from "@/components/app/badge";
import { FormCatalogo, type ItemCatalogo, type OpcionPadre } from "@/components/app/catalogo-form";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import type { CatalogoCfg } from "@/lib/services/catalogo";

export { FormCatalogo };

type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;

/** Opciones del padre: regiones «CÓDIGO — Nombre»; ciudades «Nombre (Región)». */
async function cargarOpcionesPadre(tabla: "Regiones" | "Provincias"): Promise<OpcionPadre[]> {
  if (tabla === "Regiones") {
    const { data } = await db.from("Regiones").select("Codigo, Nombre, IdEstado").order("Codigo");
    return (data ?? []).filter((r) => r.IdEstado === 1).map((r) => ({ codigo: r.Codigo, etiqueta: `${r.Codigo} — ${r.Nombre}` }));
  }
  const [{ data: provs }, { data: regs }] = await Promise.all([
    db.from("Provincias").select("Codigo, Nombre, CodigoRegion, IdEstado").order("Nombre"),
    db.from("Regiones").select("Codigo, Nombre"),
  ]);
  const reg = new Map((regs ?? []).map((r) => [r.Codigo, r.Nombre]));
  return (provs ?? []).filter((p) => p.IdEstado === 1)
    .map((p) => ({ codigo: p.Codigo, etiqueta: `${p.Nombre} (${reg.get(p.CodigoRegion) ?? p.CodigoRegion})` }));
}

/** Página servidor genérica de un mantenedor de catálogo (solo Administrador). */
export async function PaginaCatalogo({ cfg, accion, searchParams }: {
  cfg: CatalogoCfg; accion: Accion; searchParams: Promise<{ editar?: string }>;
}) {
  await requerirPaginaAdmin();
  const { editar } = await searchParams;
  const col = cfg.padre?.columna;
  const { data } = await db.from(cfg.tabla).select(col ? `Codigo, Nombre, IdEstado, ${col}` : "Codigo, Nombre, IdEstado").order("Nombre");
  const lista = (data ?? []) as unknown as ItemCatalogo[];
  const opcionesPadre = cfg.padre ? await cargarOpcionesPadre(cfg.padre.tabla) : [];
  const etiquetaPadre = new Map(opcionesPadre.map((o) => [o.codigo, o.etiqueta]));
  const enEdicion = lista.find((i) => i.Codigo === editar);
  return (
    <section className="space-y-6">
      <h1 className="page-title">{cfg.titulo}</h1>
      <div className="card">
        <h2 className="section-title mb-3">{enEdicion ? `Editar ${enEdicion.Codigo}` : "Nuevo registro"}</h2>
        <FormCatalogo key={enEdicion?.Codigo ?? "nuevo"} item={enEdicion} accion={accion} cfg={cfg} opcionesPadre={opcionesPadre} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr>{cfg.padre && <th>{cfg.padre.etiqueta}</th>}<th>Código</th><th>Nombre</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.Codigo}>
                {cfg.padre && <td>{etiquetaPadre.get(String(i[cfg.padre.columna])) ?? String(i[cfg.padre.columna] ?? "")}</td>}
                <td>{i.Codigo}</td><td>{i.Nombre}</td>
                <td><Badge tone={i.IdEstado === 1 ? "ok" : "neutral"}>{i.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                <td><Link className="link link-sm" href={`${cfg.ruta}?editar=${encodeURIComponent(i.Codigo)}`}>Editar</Link></td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={cfg.padre ? 5 : 4}>Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
