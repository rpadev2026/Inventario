import Link from "next/link";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { construirHref } from "@/lib/href";
import { CrearBodega } from "../editar";

type Params = Record<string, string | string[] | undefined>;
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const href = (q: Record<string, string | undefined>) => construirHref("/bodegas", "/bodegas/nueva", q);

/** Crear bodega (ruta propia, como /compras/nueva): solo el Administrador; Volver conserva página y filtros del listado. */
export default async function NuevaBodegaPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaAdmin();
  const sp = await searchParams;
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Crear bodega</h1>
        <Link href={href(base)} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <CrearBodega volverHref={href({ tam: base.tam, aviso: "creada" })} />
      </div>
    </section>
  );
}
