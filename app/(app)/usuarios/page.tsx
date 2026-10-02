import { db } from "@/lib/db/supabase";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { cambiarEstadoUsuario, asignarRol, quitarRol } from "./actions";
import FormNuevoUsuario from "./form-nuevo";
import Badge from "@/components/app/badge";

export default async function UsuariosPage() {
  await requerirPaginaAdmin();
  const [{ data: usuarios }, { data: roles }, { data: ur }] = await Promise.all([
    db.from("Usuarios").select("IdUsuario,Rut,Nombres,Apellidos,Correo,IdEstado").order("IdUsuario"),
    db.from("Roles").select("IdRol,NombreRol").eq("IdEstado", 1).order("NombreRol"),
    db.from("UsuariosRoles").select("IdUsuario,IdRol").eq("IdEstado", 1),
  ]);
  const nombreRol = new Map((roles ?? []).map((r) => [r.IdRol, r.NombreRol]));
  return (
    <section className="space-y-6">
      <h1 className="page-title">Usuarios</h1>
      <FormNuevoUsuario roles={roles ?? []} />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>RUT</th><th>Nombre</th><th>Correo</th><th>Roles</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u) => {
              const mios = (ur ?? []).filter((x) => x.IdUsuario === u.IdUsuario);
              return (
                <tr key={u.IdUsuario} className="align-top">
                  <td>{u.Rut}</td>
                  <td>{u.Nombres} {u.Apellidos}</td>
                  <td>{u.Correo}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {mios.map((m) => (
                        <form key={m.IdRol} action={quitarRol}>
                          <input type="hidden" name="id" value={u.IdUsuario} />
                          <input type="hidden" name="idRol" value={m.IdRol} />
                          <button title="Quitar rol" aria-label={`Quitar rol ${nombreRol.get(m.IdRol)}`} className="tag">{nombreRol.get(m.IdRol)} ×</button>
                        </form>
                      ))}
                    </div>
                    <form action={asignarRol} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="id" value={u.IdUsuario} />
                      <select name="idRol" aria-label="Rol a agregar" className="input input-sm">
                        {(roles ?? []).map((r) => <option key={r.IdRol} value={r.IdRol}>{r.NombreRol}</option>)}
                      </select>
                      <button className="link link-sm">Agregar</button>
                    </form>
                  </td>
                  <td><Badge tone={u.IdEstado === 1 ? "ok" : "neutral"}>{u.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></td>
                  <td>
                    <form action={cambiarEstadoUsuario}>
                      <input type="hidden" name="id" value={u.IdUsuario} />
                      <input type="hidden" name="estado" value={u.IdEstado === 1 ? 0 : 1} />
                      <button className="link link-sm">{u.IdEstado === 1 ? "Desactivar" : "Activar"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
