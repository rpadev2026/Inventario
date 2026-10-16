import Link from "next/link";
import Icon from "@/components/app/icon";
import { asignarRol, quitarRol } from "./actions";
import FormNuevoUsuario from "./form-nuevo";
import FormEditarUsuario from "./form-editar";
import FormClaveUsuario from "./form-clave";
import { href, rolesDe, type Contexto, type UsuarioSel } from "./comun";

/** Crear: solo el formulario, con Volver. */
export function VistaCrear({ ctx }: { ctx: Contexto }) {
  const { base, volverListado, roles } = ctx;
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Crear usuario</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormNuevoUsuario roles={roles} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
      </div>
    </section>
  );
}

/** Editar: datos del usuario, su clave y sus roles, con Volver. */
export async function VistaEditar({ ctx, sel }: { ctx: Contexto; sel: UsuarioSel }) {
  const { base, volverListado, uidActual, roles } = ctx;
  const { asignados, disponibles } = await rolesDe(roles, sel.IdUsuario);
  const esPropio = sel.IdUsuario === uidActual;
  return (
    <section className="space-y-6">
      <div className="page-head">
        <h1 className="page-title">Editar usuario</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <FormEditarUsuario key={sel.IdUsuario} u={sel} esPropio={esPropio} despuesDeGuardar={href({ ...base, aviso: "editado" })} />
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Clave</h2>
        <div className="card"><FormClaveUsuario key={sel.IdUsuario} id={sel.IdUsuario} /></div>
      </div>

      <div className="space-y-3">
        <h2 className="section-title">Roles</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Rol</th><th>Acciones</th></tr></thead>
            <tbody>
              {asignados.map((r) => {
                const noQuitar = esPropio && r.NombreRol === "Administrador"; // evita dejar el sistema sin gestión de usuarios
                return (
                  <tr key={r.IdRol}>
                    <td>{r.NombreRol}</td>
                    <td>
                      <form action={quitarRol}>
                        <input type="hidden" name="id" value={sel.IdUsuario} />
                        <input type="hidden" name="idRol" value={r.IdRol} />
                        <button className="link link-sm" disabled={noQuitar} title={noQuitar ? "No puede quitarse a sí mismo el rol de Administrador" : undefined}
                          aria-label={`Quitar rol ${r.NombreRol}`}>Quitar</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {!asignados.length && <tr><td colSpan={2} className="text-muted">Este usuario no tiene roles.</td></tr>}
            </tbody>
          </table>
        </div>
        {disponibles.length > 0 && (
          <form action={asignarRol} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={sel.IdUsuario} />
            <label className="field">
              <span className="field-label">Rol a agregar</span>
              <select name="idRol" className="input">{disponibles.map((r) => <option key={r.IdRol} value={r.IdRol}>{r.NombreRol}</option>)}</select>
            </label>
            <button className="btn btn-primary"><Icon name="plus" size={18} />Agregar rol</button>
          </form>
        )}
      </div>
    </section>
  );
}
