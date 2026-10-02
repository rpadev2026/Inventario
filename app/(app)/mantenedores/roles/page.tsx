import Badge from "@/components/app/badge";
import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import FormRol, { type RolItem } from "./form-rol";
import { guardarRol } from "./actions";

export default async function RolesPage() {
  await requerirPaginaAdmin();
  const [{ data: roles }, { data: rp }, { data: ur }] = await Promise.all([
    db.from("Roles").select("IdRol,NombreRol,DetalleRol,IdEstado,EsBase").order("IdRol"),
    db.from("RolesPermisos").select("IdRol,Permiso"),
    db.from("UsuariosRoles").select("IdRol").eq("IdEstado", 1),
  ]);
  const lista = (roles ?? []) as RolItem[];
  const permisosDe = (id: number) => (rp ?? []).filter((x) => x.IdRol === id).map((x) => x.Permiso as string);
  const usuariosDe = (id: number) => (ur ?? []).filter((x) => x.IdRol === id).length;
  return (
    <section className="space-y-6">
      <h1 className="page-title">Roles y permisos</h1>
      <div className="card">
        <h2 className="section-title mb-3">Nuevo rol</h2>
        <FormRol accion={guardarRol} />
      </div>
      <div className="space-y-3">
        {lista.map((r) => (
          <details key={r.IdRol} className="card">
            <summary className="cursor-pointer flex flex-wrap items-center gap-3">
              <strong>{r.NombreRol}</strong>
              <Badge tone={r.IdEstado === 1 ? "ok" : "neutral"}>{r.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge>
              <span className="text-muted">
                {usuariosDe(r.IdRol)} usuarios activos ·{" "}
                {r.NombreRol === "Administrador" ? "todos los permisos" : `${permisosDe(r.IdRol).length} permisos`}
              </span>
            </summary>
            <div className="mt-4">
              <FormRol rol={r} permisos={permisosDe(r.IdRol)} accion={guardarRol} />
            </div>
          </details>
        ))}
        {lista.length === 0 && <p>Sin roles</p>}
      </div>
    </section>
  );
}
