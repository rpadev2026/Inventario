import Link from "next/link";
import Badge from "@/components/app/badge";
import { FormCatalogo, type ItemCatalogo } from "@/components/app/catalogo-form";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import type { CatalogoCfg } from "@/lib/services/catalogo";

export { FormCatalogo };

type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;

/** Página servidor genérica de un mantenedor de catálogo (solo Administrador). */
export async function PaginaCatalogo({ cfg, accion, searchParams }: {
  cfg: CatalogoCfg; accion: Accion; searchParams: Promise<{ editar?: string }>;
}) {
  await requerirPaginaAdmin();
  const { editar } = await searchParams;
  const { data } = await db.from(cfg.tabla).select("Codigo, Nombre, IdEstado").order("Nombre");
  const lista = (data ?? []) as ItemCatalogo[];
  const enEdicion = lista.find((i) => i.Codigo === editar);
  return (
    <section className="space-y-6">
      <h1 className="page-title">{cfg.titulo}</h1>
      <div className="card">
        <h2 className="section-title mb-3">{enEdicion ? `Editar ${enEdicion.Codigo}` : "Nuevo registro"}</h2>
        <FormCatalogo key={enEdicion?.Codigo ?? "nuevo"} item={enEdicion} accion={accion} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Código</th><th>Nombre</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {lista.map((i) => (
              <tr key={i.Codigo}>
                <td>{i.Codigo}</td><td>{i.Nombre}</td>
                <td><Badge tone={i.IdEstado === 1 ? "ok" : "neutral"}>{i.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                <td><Link className="link link-sm" href={`${cfg.ruta}?editar=${encodeURIComponent(i.Codigo)}`}>Editar</Link></td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={4}>Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
