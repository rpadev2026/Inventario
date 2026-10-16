import Link from "next/link";
import { Dato, estadoBadge, rolesDe, type Contexto, type UsuarioSel } from "./comun";

/** Ver: datos del usuario y sus roles (solo lectura). */
export async function VistaDetalle({ ctx, sel }: { ctx: Contexto; sel: UsuarioSel }) {
  const { volverListado, roles } = ctx;
  const { asignados } = await rolesDe(roles, sel.IdUsuario);
  return (
    <section className="space-y-6">
      <div className="page-head">
        <h1 className="page-title">{sel.Nombres} {sel.Apellidos}</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <div className="form-grid form-grid-3">
          <Dato titulo="RUT">{sel.Rut}</Dato>
          <Dato titulo="Correo">{sel.Correo}</Dato>
          <Dato titulo="Estado">{estadoBadge(sel.IdEstado)}</Dato>
          <Dato titulo="Nombres">{sel.Nombres}</Dato>
          <Dato titulo="Apellidos">{sel.Apellidos}</Dato>
          <Dato titulo="Registrado el">{new Date(sel.FechaRegistroCreacion).toLocaleDateString("es-CL")}</Dato>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="section-title">Roles</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Rol</th></tr></thead>
            <tbody>
              {asignados.map((r) => <tr key={r.IdRol}><td>{r.NombreRol}</td></tr>)}
              {!asignados.length && <tr><td className="text-muted">Este usuario no tiene roles.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
