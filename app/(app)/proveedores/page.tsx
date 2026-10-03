import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { rutaVolverSegura } from "@/lib/volver";
import { cargarTerritorio } from "@/lib/services/territorio";
import { paginar } from "@/lib/paginacion";
import { leerEstado } from "@/lib/filtro-estado";
import { filtrarProveedores, type ProveedorFila } from "@/lib/proveedores-filtro";
import Aviso from "@/components/app/aviso";
import Badge from "@/components/app/badge";
import FiltrosListado from "@/components/app/filtros-listado";
import Icon from "@/components/app/icon";
import Paginador from "@/components/app/paginador";
import { FormProveedor, FormSucursal, FormVendedor, type Proveedor, type Sucursal, type Vendedor } from "./forms";

type Params = Record<string, string | string[] | undefined>;
const entero = (v: unknown) => (typeof v === "string" && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined);
const texto = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);
const AVISOS: Record<string, string> = { creado: "Proveedor creado correctamente", editado: "Cambios guardados correctamente" };
const estadoBadge = (e: number) => <Badge tone={e === 1 ? "ok" : "neutral"}>{e === 1 ? "Vigente" : "No vigente"}</Badge>;

/** URL de /proveedores con solo los parámetros indicados (los undefined se omiten). */
function href(q: Record<string, string | undefined>) {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][]).toString();
  return s ? `/proveedores?${s}` : "/proveedores";
}
const Dato = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div><div className="label-block">{titulo}</div><div>{children || "—"}</div></div>
);

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sesion = await requerirPaginaPermiso("proveedores.ver");
  const puedeGestionar = tienePermiso(sesion.permisos, "proveedores.gestionar");
  const sp = await searchParams;
  const rutaVolver = rutaVolverSegura(texto(sp.volver));
  // Crear/editar solo con «proveedores.gestionar» (las acciones del servidor lo exigen igualmente).
  // Venir desde una factura (?volver=) abre directo la vista Crear.
  const crear = puedeGestionar && (sp.crear === "1" || !!rutaVolver);
  const idEditar = puedeGestionar && !crear ? entero(sp.editar) : undefined;
  const idVer = crear || idEditar ? undefined : entero(sp.ver);

  // Parámetros del listado (página, tamaño y filtros) que se conservan al ir a una vista y volver.
  const q = texto(sp.q);
  const estadoPedido = texto(sp.estado);
  const base = { pagina: texto(sp.pagina), tam: texto(sp.tam), q, estado: estadoPedido };
  const volverListado = href(base);

  // ===== Crear: solo el formulario, con Volver (a la factura si se vino de ella) =====
  if (crear) {
    const territorio = await cargarTerritorio();
    return (
      <section className="space-y-4">
        <div className="page-head">
          <h1 className="page-title">Crear proveedor</h1>
          <Link href={rutaVolver ?? volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormProveedor territorio={territorio} volver={rutaVolver ?? undefined} despuesDeGuardar={href({ tam: base.tam, aviso: "creado" })} />
        </div>
      </section>
    );
  }

  const idPanel = idEditar ?? idVer;
  const { data: sel } = idPanel
    ? await db.from("Proveedores").select("*").eq("IdProveedor", idPanel).maybeSingle<Proveedor>()
    : { data: null };

  // ===== Editar: datos del proveedor y administración de sus sucursales y vendedores, con Volver =====
  if (idEditar && sel) {
    const [territorio, { data: sucs }, { data: vens }] = await Promise.all([
      cargarTerritorio(),
      db.from("ProveedoresSucursales").select("*").eq("IdProveedor", sel.IdProveedor).order("IdSucursal"),
      db.from("ProveedoresVendedores").select("*").eq("IdProveedor", sel.IdProveedor).order("IdVendedor"),
    ]);
    return (
      <section className="space-y-6">
        <div className="page-head">
          <h1 className="page-title">Editar proveedor</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <FormProveedor key={sel.IdProveedor} p={sel} territorio={territorio} despuesDeGuardar={href({ ...base, aviso: "editado" })} />
        </div>

        <div className="card space-y-3">
          <h2 className="section-title">Sucursales</h2>
          {((sucs ?? []) as Sucursal[]).map((s) => <FormSucursal key={s.IdSucursal} idProveedor={sel.IdProveedor} s={s} territorio={territorio} />)}
          <h3 className="section-title pt-2">Nueva sucursal</h3>
          <FormSucursal idProveedor={sel.IdProveedor} territorio={territorio} />
        </div>

        <div className="card space-y-3">
          <h2 className="section-title">Vendedores</h2>
          {((vens ?? []) as Vendedor[]).map((v) => <FormVendedor key={v.IdVendedor} idProveedor={sel.IdProveedor} v={v} />)}
          <h3 className="section-title pt-2">Nuevo vendedor</h3>
          <FormVendedor idProveedor={sel.IdProveedor} />
        </div>
      </section>
    );
  }

  // ===== Ver: datos del proveedor, sus sucursales y sus vendedores (solo lectura) =====
  if (idVer && sel) {
    const [territorio, { data: sucs }, { data: vens }] = await Promise.all([
      cargarTerritorio(),
      db.from("ProveedoresSucursales").select("*").eq("IdProveedor", sel.IdProveedor).order("IdSucursal"),
      db.from("ProveedoresVendedores").select("*").eq("IdProveedor", sel.IdProveedor).order("IdVendedor"),
    ]);
    const nombre = (lista: { Codigo: string; Nombre: string }[], c: string | null) => (c ? lista.find((x) => x.Codigo === c)?.Nombre ?? c : "");
    const region = (c: string | null) => nombre(territorio.regiones, c);
    const ciudad = (c: string | null) => nombre(territorio.ciudades, c);
    const comuna = (c: string | null) => nombre(territorio.comunas, c);
    return (
      <section className="space-y-6">
        <div className="page-head">
          <h1 className="page-title">{sel.RazonSocial}</h1>
          <Link href={volverListado} className="btn btn-secondary">Volver</Link>
        </div>
        <div className="card">
          <div className="form-grid form-grid-3">
            <Dato titulo="RUT">{sel.Rut}</Dato>
            <Dato titulo="Giro">{sel.Giro}</Dato>
            <Dato titulo="Estado">{estadoBadge(sel.IdEstado)}</Dato>
            <Dato titulo="Dirección">{sel.Direccion}</Dato>
            <Dato titulo="Región">{region(sel.Region)}</Dato>
            <Dato titulo="Ciudad (provincia)">{ciudad(sel.Ciudad)}</Dato>
            <Dato titulo="Comuna">{comuna(sel.Comuna)}</Dato>
            <Dato titulo="Teléfono">{sel.Telefono}</Dato>
            <Dato titulo="Correo">{sel.Correo}</Dato>
            <Dato titulo="RUT representante legal">{sel.RutRepresentanteLegal}</Dato>
            <Dato titulo="Nombre representante legal">{sel.NombreRepresentanteLegal}</Dato>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="section-title">Sucursales</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Dirección</th><th>Región</th><th>Ciudad</th><th>Comuna</th><th>Teléfono</th><th>Correo</th><th>Encargado</th><th>Estado</th></tr></thead>
              <tbody>
                {((sucs ?? []) as Sucursal[]).map((s) => (
                  <tr key={s.IdSucursal}>
                    <td>{s.Direccion}</td><td>{region(s.Region)}</td><td>{ciudad(s.Ciudad)}</td><td>{comuna(s.Comuna)}</td>
                    <td>{s.Telefono}</td><td>{s.Correo}</td><td>{s.EncargadoSucursal}</td><td>{estadoBadge(s.IdEstado)}</td>
                  </tr>
                ))}
                {!sucs?.length && <tr><td colSpan={8} className="text-muted">Este proveedor no tiene sucursales.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="section-title">Vendedores</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>RUT</th><th>Nombres</th><th>Apellidos</th><th>Teléfono</th><th>Correo</th><th>Estado</th></tr></thead>
              <tbody>
                {((vens ?? []) as Vendedor[]).map((v) => (
                  <tr key={v.IdVendedor}>
                    <td>{v.Rut}</td><td>{v.Nombres}</td><td>{v.Apellidos}</td><td>{v.Telefono}</td><td>{v.Correo}</td><td>{estadoBadge(v.IdEstado)}</td>
                  </tr>
                ))}
                {!vens?.length && <tr><td colSpan={6} className="text-muted">Este proveedor no tiene vendedores.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  // ===== Listado de proveedores: filtro por RUT/razón social/giro y estado, y paginación =====
  const { data: todos } = await db.from("Proveedores").select("IdProveedor,Rut,RazonSocial,Giro,Telefono,Correo,IdEstado").returns<ProveedorFila[]>();
  const estado = leerEstado(estadoPedido);
  const filtrados = filtrarProveedores(todos ?? [], { q, estado });
  const pg = paginar({ pagina: sp.pagina, tam: sp.tam }, filtrados.length);
  const lista = filtrados.slice(pg.from, pg.to + 1);
  const hayFiltro = !!q || estado !== undefined;
  const aviso = typeof sp.aviso === "string" ? AVISOS[sp.aviso] : undefined;

  return (
    <section className="space-y-6">
      <div className="page-head">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">Proveedores</h1>
          {aviso && <Aviso texto={aviso} />}
        </div>
        {puedeGestionar && (
          <Link href={href({ ...base, crear: "1" })} className="btn btn-primary"><Icon name="plus" size={18} />Crear proveedor</Link>
        )}
      </div>

      <div className="space-y-3">
        <FiltrosListado ruta="/proveedores" etiqueta="Buscar proveedores" campo="RUT, razón social o giro" q={q} estado={estadoPedido} tam={base.tam} />

        <div className="table-wrap table-wrap-sticky">
          <table className="table">
            <thead><tr><th>RUT</th><th>Razón social</th><th>Giro</th><th>Teléfono</th><th>Correo</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.IdProveedor}>
                  <td>{p.Rut}</td><td>{p.RazonSocial}</td><td>{p.Giro}</td><td>{p.Telefono}</td><td>{p.Correo}</td>
                  <td>{estadoBadge(p.IdEstado)}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Link className="link link-sm" href={href({ ...base, ver: String(p.IdProveedor) })} aria-label={`Ver ${p.RazonSocial}`}>Ver</Link>
                      {puedeGestionar && <Link className="link link-sm" href={href({ ...base, editar: String(p.IdProveedor) })} aria-label={`Editar ${p.RazonSocial}`}>Editar</Link>}
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={7} className="text-muted">{hayFiltro ? "Sin proveedores que coincidan con la búsqueda." : "Sin proveedores."}</td></tr>}
            </tbody>
          </table>
        </div>
        <Paginador pg={pg} etiqueta="proveedores" />
      </div>
    </section>
  );
}
