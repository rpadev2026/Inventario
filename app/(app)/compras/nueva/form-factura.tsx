"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registrarFactura } from "../actions";
import Field from "@/components/app/field";
import ComboboxRemoto from "@/components/app/combobox-remoto";
import Icon from "@/components/app/icon";
import { aplicarPreProducto, guardarBorrador, leerBorrador, limpiarBorrador, type Borrador } from "@/lib/borrador-factura";
import { buscarOpcionesProducto, buscarOpcionesProveedor, opcionProducto, opcionProveedor } from "@/lib/opciones-remotas";
import { productosPorId, proveedoresPorId, type ProductoHallado, type ProveedorHallado } from "../../buscar/actions";
import type { Opcion } from "@/lib/buscar";
import { calcularTotales } from "@/lib/factura-calculo";
import { unidadDeLinea, unidadesDeFamilia, type UnidadInfo } from "@/lib/unidades";
import { filtrarDecimal, filtrarDecimal2, parseCantidad, parseDecimal2, soloDigitos } from "@/lib/numeros";

type FormaPago = { codigo: string; nombre: string };
type Linea = Borrador["lineas"][number];

const MSG_RECEPCION = "La fecha de recepción no puede ser anterior a la fecha de factura";
const lineaVacia = (): Linea => ({ producto: "", unidad: "", precio: "", cantidad: "" });
const clp = (n: number) => n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function FormFactura(props: {
  unidades: UnidadInfo[]; formasPago: FormaPago[];
  /** Proveedor y producto recién creados (o pedidos por la URL), ya validados en el servidor. */
  provInicial?: ProveedorHallado | null; prodInicial?: ProductoHallado | null;
  /** Cabecera de una factura de Bsale: precarga folio y fecha, y el total sirve de referencia para cuadrar las líneas. */
  desdeBsale?: { folio: string; fecha: string; total: number };
}) {
  const router = useRouter();
  const [idProv, setIdProv] = useState("");
  const [folio, setFolio] = useState("");
  const [fechaFactura, setFechaFactura] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const iniciado = useRef(false);
  // Opciones ya elegidas por valor: la lista remota solo trae las que coinciden con lo escrito (y llevan, p. ej., la unidad base).
  const [provs, setProvs] = useState<Record<string, Opcion>>({});
  const [prods, setProds] = useState<Record<string, Opcion>>({});
  const recordarProvs = (os: Opcion[]) => setProvs((m) => ({ ...m, ...Object.fromEntries(os.map((o) => [o.valor, o])) }));
  const recordarProds = (os: Opcion[]) => setProds((m) => ({ ...m, ...Object.fromEntries(os.map((o) => [o.valor, o])) }));

  // Al montar: restaura el borrador guardado antes de salir a crear un proveedor/producto y aplica lo recién creado.
  // sessionStorage no existe en el servidor, por eso es un efecto (el primer render coincide con el SSR).
  // El ref evita aplicarlo dos veces con el doble efecto de StrictMode.
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const b = leerBorrador();
    let ls: Linea[] = [lineaVacia()];
    if (b) {
      limpiarBorrador();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage solo existe en el navegador: leerlo al inicializar el estado desfasaría la hidratación.
      setIdProv(b.idProv); setFolio(b.folio); setFechaFactura(b.fechaFactura);
      setFechaRecepcion(b.fechaRecepcion); setFormaPago(b.formaPago);
      if (b.lineas.length > 0) ls = b.lineas;
    }
    const { provInicial, prodInicial, desdeBsale } = props;
    if (desdeBsale) { setFolio(desdeBsale.folio); setFechaFactura(desdeBsale.fecha); }
    if (provInicial) { setIdProv(String(provInicial.id)); recordarProvs([opcionProveedor(provInicial)]); }
    if (prodInicial) { ls = aplicarPreProducto(ls, String(prodInicial.id)); recordarProds([opcionProducto(prodInicial)]); }
    setLineas(ls);
    // Los parámetros (token de lo recién creado, datos de Bsale) ya se aplicaron al estado: la URL queda limpia, sin tokens ni valores a la vista.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    // Del borrador solo se guardaron los id: se traen del servidor los datos de lo elegido (nombre, unidad base).
    if (b) {
      const idsProd = [...new Set(b.lineas.map((l) => Number(l.producto)).filter((n) => n > 0))];
      const idProveedor = Number(b.idProv);
      Promise.all([productosPorId(idsProd), idProveedor > 0 ? proveedoresPorId([idProveedor]) : Promise.resolve([])])
        .then(([ps, vs]) => { recordarProds(ps.map(opcionProducto)); recordarProvs(vs.map(opcionProveedor)); })
        .catch(() => { /* sin los datos, el campo queda sin texto: se vuelve a elegir */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar (el ref evita repetirlo en StrictMode); recordar* solo escriben estado.
  }, [props.provInicial, props.prodInicial]);

  // El precio de cada línea ya incluye IVA: el total es la suma y el neto/IVA se calculan hacia atrás.
  const { total, neto, iva } = calcularTotales(lineas.map((l) => ({ precio: parseDecimal2(l.precio) ?? 0, cantidad: parseCantidad(l.cantidad) ?? 0 })));

  const recepcionAnterior = fechaFactura !== "" && fechaRecepcion !== "" && fechaRecepcion < fechaFactura;

  const setLinea = (i: number, k: keyof Linea, v: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  // Unidad de la línea: la elegida o, mientras no se elija, la unidad base del producto.
  const baseDe = (producto: string) => prods[producto]?.datos?.unidadBase ?? "";
  const unidadDe = (l: Linea) => unidadDeLinea(props.unidades, baseDe(l.producto), l.unidad);
  const cambiarProducto = (i: number, producto: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, producto, unidad: "" } : l)));

  function cambiarFechaFactura(v: string) {
    setFechaFactura(v);
    if (v && fechaRecepcion && v > fechaRecepcion) setFechaRecepcion("");
  }

  function guardarAntesDeSalir() {
    guardarBorrador({ idProv, folio, fechaFactura, fechaRecepcion, formaPago, lineas });
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (recepcionAnterior) return;
    for (const [i, l] of lineas.entries()) {
      if (!unidadDe(l)) return setError(`Línea ${i + 1}: elija el producto y su unidad de medida`);
      if (parseDecimal2(l.precio) === null) return setError(`Línea ${i + 1}: el precio debe ser un número con hasta 2 decimales`);
      if (parseCantidad(l.cantidad) === null) return setError(`Línea ${i + 1}: la cantidad debe ser un número mayor que 0 (hasta 3 decimales)`);
    }
    start(async () => {
      const r = await registrarFactura({
        idProveedor: idProv, folio, fechaFactura, fechaRecepcion, formaPago,
        neto, iva, total,
        detalle: lineas.map((l) => ({ producto: l.producto, unidad: unidadDe(l), precio: l.precio, cantidad: parseCantidad(l.cantidad) })),
      });
      if (r.error) setError(r.error);
      else {
        limpiarBorrador();
        router.push("/compras");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="card grid gap-5">
      <div className="form-grid form-grid-4">
        <div className="fld-3 grid gap-1">
          <ComboboxRemoto
            label="Proveedor" required valor={idProv} buscar={buscarOpcionesProveedor} maxOpciones={20} placeholder="Busque por RUT o razón social"
            elegidas={provs[idProv] ? [provs[idProv]] : []}
            onCambio={(v, o) => { setIdProv(v); if (o) recordarProvs([o]); }}
          />
          <Link href="/compras/nueva/proveedor" onClick={guardarAntesDeSalir} className="link link-sm justify-self-start">+ Crear proveedor nuevo</Link>
        </div>
        <Field label="Folio">
          <input value={folio} onChange={(e) => setFolio(soloDigitos(e.target.value).slice(0, 15))} type="text" inputMode="numeric" autoComplete="off" required className="input" />
        </Field>
        <Field label="Fecha de factura">
          <input value={fechaFactura} onChange={(e) => cambiarFechaFactura(e.target.value)} type="date" required className="input" />
        </Field>
        <Field label="Fecha de recepción">
          <input
            value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} type="date" required min={fechaFactura || undefined}
            aria-invalid={recepcionAnterior || undefined} aria-describedby={recepcionAnterior ? "err-recepcion" : undefined} className="input"
          />
          {recepcionAnterior && <span id="err-recepcion" role="alert" className="msg msg-error">{MSG_RECEPCION}</span>}
        </Field>
        <Field label="Forma de pago" className="fld-2">
          <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} required className="input">
            <option value="">Seleccione…</option>
            {props.formasPago.map((f) => <option key={f.codigo} value={f.codigo}>{f.nombre}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Detalle de la factura</h2>
          <Link href="/compras/nueva/producto" onClick={guardarAntesDeSalir} className="link link-sm">+ Crear producto nuevo</Link>
        </div>
        {lineas.map((l, i) => (
          <div key={i} className="line-grid line-grid-5">
            <ComboboxRemoto
              label="Producto" required valor={l.producto} buscar={buscarOpcionesProducto} maxOpciones={20} placeholder="Busque por código o nombre"
              elegidas={prods[l.producto] ? [prods[l.producto]] : []}
              onCambio={(v, o) => { cambiarProducto(i, v); if (o) recordarProds([o]); }}
            />
            <Field label="Unidad de medida">
              <select value={unidadDe(l)} onChange={(e) => setLinea(i, "unidad", e.target.value)} disabled={!l.producto} required className="input">
                {!l.producto && <option value="">—</option>}
                {unidadesDeFamilia(props.unidades, baseDe(l.producto), l.unidad).map((u) => <option key={u.Codigo} value={u.Codigo}>{u.Nombre}</option>)}
              </select>
            </Field>
            <Field label="Precio unitario (IVA incl.)">
              <input type="text" inputMode="decimal" autoComplete="off" value={l.precio} onChange={(e) => setLinea(i, "precio", filtrarDecimal2(e.target.value))} required className="input" />
            </Field>
            <Field label="Cantidad">
              <input type="text" inputMode="decimal" autoComplete="off" value={l.cantidad} onChange={(e) => setLinea(i, "cantidad", filtrarDecimal(e.target.value, 3))} required className="input" />
            </Field>
            <button type="button" aria-label={`Quitar línea ${i + 1}`} disabled={lineas.length === 1} onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))} className="btn btn-danger btn-icon"><Icon name="x" size={18} /></button>
          </div>
        ))}
        <div><button type="button" onClick={() => setLineas((ls) => [...ls, lineaVacia()])} className="btn btn-secondary btn-sm"><Icon name="plus" size={16} />Agregar línea</button></div>
      </div>

      <dl className="resumen" aria-live="polite">
        <div><dt className="text-muted">Neto</dt><dd className="num">{clp(neto)}</dd></div>
        <div><dt className="text-muted">IVA 19%</dt><dd>{clp(iva)}</dd></div>
        <div className="resumen-total"><dt>Total</dt><dd>{clp(total)}</dd></div>
      </dl>
      {props.desdeBsale && (
        <p role="status" className={`alert ${Math.abs(props.desdeBsale.total - total) <= 1 ? "alert-ok" : "alert-warn"}`}>
          Total según Bsale: {clp(props.desdeBsale.total)}
          {Math.abs(props.desdeBsale.total - total) <= 1 ? " — coincide con las líneas." : ` — las líneas suman ${clp(total)}; el total debe coincidir (±$1).`}
        </p>
      )}

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <div><button disabled={pending} className="btn btn-primary">{pending ? "Registrando…" : "Registrar factura"}</button></div>
    </form>
  );
}
