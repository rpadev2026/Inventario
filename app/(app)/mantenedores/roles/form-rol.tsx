"use client";
import { useRouter } from "next/navigation";
import { useAccion } from "@/lib/use-accion";
import Field from "@/components/app/field";
import { agruparPermisos, type PermisoCatalogo } from "@/lib/auth/permisos";

export type RolItem = { IdRol: number; NombreRol: string; DetalleRol: string | null; IdEstado: number; EsBase: boolean };
type Accion = (prev: unknown, fd: FormData) => Promise<{ error?: string; ok?: boolean }>;

export default function FormRol({ rol, permisos = [], catalogo, accion, despuesDeGuardar }: {
  rol?: RolItem; permisos?: string[]; accion: Accion;
  /** Catálogo de permisos (tabla "Permisos"). */
  catalogo: PermisoCatalogo[];
  /** Al guardar bien se va a esta ruta (el listado, con el aviso). */
  despuesDeGuardar?: string;
}) {
  const router = useRouter();
  const { state, pending, onSubmit } = useAccion(accion, {
    limpiarSiOk: !rol,
    onOk: () => { if (despuesDeGuardar) router.push(despuesDeGuardar); },
  });
  const base = !!rol?.EsBase;
  const esAdmin = rol?.NombreRol === "Administrador";
  // Un rol base vigente no se puede renombrar ni desactivar; si ya está inactivo, su estado se puede cambiar para reactivarlo.
  const estadoBloqueado = base && rol?.IdEstado === 1;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {rol && <input type="hidden" name="id" value={rol.IdRol} />}
      {/* Los campos deshabilitados no se envían: los roles base conservan su nombre (y su estado, si está bloqueado). */}
      {base && <input type="hidden" name="nombre" value={rol.NombreRol} />}
      {estadoBloqueado && <input type="hidden" name="estado" value={rol.IdEstado} />}
      <div className="form-grid form-grid-3">
        <Field label="Nombre">
          <input name={base ? undefined : "nombre"} defaultValue={rol?.NombreRol} disabled={base} required maxLength={60} className="input" />
        </Field>
        <Field label="Detalle">
          <input name="detalle" defaultValue={rol?.DetalleRol ?? ""} maxLength={200} className="input" />
        </Field>
        <Field label="Estado">
          <select name={estadoBloqueado ? undefined : "estado"} defaultValue={rol?.IdEstado ?? 1} disabled={estadoBloqueado} className="input">
            <option value={1}>Vigente</option>
            <option value={0}>No vigente</option>
          </select>
        </Field>
      </div>
      {base && (
        <p className="text-muted">
          {estadoBloqueado ? "Rol base: no se puede renombrar ni desactivar." : "Rol base inactivo: no se puede renombrar, pero puede reactivarlo cambiando el estado a «Vigente»."}
        </p>
      )}
      {esAdmin ? (
        <p className="text-muted">Tiene todos los permisos.</p>
      ) : (
        <fieldset className="grid gap-3">
          <legend className="section-title mb-1">Permisos</legend>
          <p className="text-muted">Para crear solicitudes también conviene marcar &quot;Ver y recepcionar solicitudes propias&quot;</p>
          <div className="form-grid form-grid-3">
            {agruparPermisos(catalogo).map(({ modulo, permisos: lista }) => (
              <div key={modulo} className="grid gap-2 content-start">
                <strong>{modulo}</strong>
                {lista.map((p) => (
                  <label key={p.codigo} className="flex items-center gap-2">
                    <input type="checkbox" name="permisos" value={p.codigo} defaultChecked={permisos.includes(p.codigo)} />
                    <span>{p.descripcion}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
      )}
      <div className="form-actions">
        <button disabled={pending} className="btn btn-primary">{rol ? "Guardar cambios" : "Crear rol"}</button>
        {state?.error && <span role="alert" className="msg msg-error">{state.error}</span>}
      </div>
    </form>
  );
}
