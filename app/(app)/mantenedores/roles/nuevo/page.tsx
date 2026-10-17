import Link from "next/link";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { cargarPermisos } from "@/lib/services/permisos";
import { construirHref } from "@/lib/href";
import FormRol from "../form-rol";
import { guardarRol } from "../actions";

type Params = Record<string, string | string[] | undefined>;
const RUTA = "/mantenedores/roles";
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const href = (q: Record<string, string | undefined>) => construirHref(RUTA, `${RUTA}/nuevo`, q);

/** Crear rol (ruta propia, como /compras/nueva): solo el Administrador; Volver conserva página y filtros del listado. */
export default async function NuevoRolPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requerirPaginaAdmin();
  const [sp, catalogo] = await Promise.all([searchParams, cargarPermisos()]);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q: texto(sp.q), estado: texto(sp.estado) };
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Crear rol</h1>
        <Link href={href(base)} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormRol catalogo={catalogo} accion={guardarRol} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
      </div>
    </section>
  );
}
