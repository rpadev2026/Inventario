"use client";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registrarFactura } from "../actions";
import Field from "@/components/app/field";
import Combobox from "@/components/app/combobox";
import Icon from "@/components/app/icon";
import { aplicarPreProducto, guardarBorrador, leerBorrador, limpiarBorrador, type Borrador } from "@/lib/borrador-factura";
import { etiquetaProducto } from "@/lib/producto-etiqueta";
import { filtrarDecimal, filtrarDecimal2, parseCantidad, parseDecimal2, soloDigitos } from "@/lib/numeros";

type Prov = { id: number; rut: string; nombre: string };
type Prod = { id: number; codigo: string | null; nombre: string };
type FormaPago = { codigo: string; nombre: string };
type Linea = Borrador["lineas"][number];

const IVA = 0.19;
const MSG_RECEPCION = "La fecha de recepción no puede ser anterior a la fecha de factura";
const lineaVacia = (): Linea => ({ producto: "", precio: "", cantidad: "" });
const clp = (n: number) => n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default function FormFactura(props: {
  proveedores: Prov[]; productos: Prod[]; formasPago: FormaPago[]; preProveedor?: string; preProducto?: string;
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

  const opcionesProv = useMemo(
    () => props.proveedores.map((p) => ({ valor: String(p.id), etiqueta: `${p.rut} — ${p.nombre}`, busqueda: `${p.rut} ${p.nombre}` })),
    [props.proveedores],
  );
  const opcionesProd = useMemo(
    () => props.productos.map((p) => ({ valor: String(p.id), etiqueta: etiquetaProducto(p.codigo, p.nombre), busqueda: `${p.codigo ?? ""} ${p.nombre}` })),
    [props.productos],
  );

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
      setIdProv(b.idProv); setFolio(b.folio); setFechaFactura(b.fechaFactura);
      setFechaRecepcion(b.fechaRecepcion); setFormaPago(b.formaPago);
      if (b.lineas.length > 0) ls = b.lineas;
    }
    const prov = props.preProveedor;
    if (prov && props.proveedores.some((p) => String(p.id) === prov)) setIdProv(prov);
    const prod = props.preProducto;
    if (prod && props.productos.some((p) => String(p.id) === prod)) ls = aplicarPreProducto(ls, prod);
    setLineas(ls);
  }, [props.preProveedor, props.preProducto, props.proveedores, props.productos]);

  const neto = lineas.reduce((a, l) => a + Math.round((parseDecimal2(l.precio) ?? 0) * (parseCantidad(l.cantidad) ?? 0) * 100) / 100, 0);
  const iva = Math.round(neto * IVA);
  const total = Math.round(neto) + iva;

  const recepcionAnterior = fechaFactura !== "" && fechaRecepcion !== "" && fechaRecepcion < fechaFactura;

  const setLinea = (i: number, k: keyof Linea, v: string) =>
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

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
      if (parseDecimal2(l.precio) === null) return setError(`Línea ${i + 1}: el precio debe ser un número con hasta 2 decimales`);
      if (parseCantidad(l.cantidad) === null) return setError(`Línea ${i + 1}: la cantidad debe ser un número mayor que 0 (hasta 3 decimales)`);
    }
    start(async () => {
      const r = await registrarFactura({
        idProveedor: idProv, folio, fechaFactura, fechaRecepcion, formaPago,
        neto: Math.round(neto), iva, total,
        detalle: lineas.map((l) => ({ producto: l.producto, precio: l.precio, cantidad: parseCantidad(l.cantidad) })),
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
          <Combobox label="Proveedor" required opciones={opcionesProv} valor={idProv} onCambio={setIdProv} placeholder="Busque por RUT o razón social" />
          <Link href="/proveedores?volver=/compras/nueva" onClick={guardarAntesDeSalir} className="link link-sm justify-self-start">+ Crear proveedor nuevo</Link>
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
          <Link href="/productos?volver=/compras/nueva" onClick={guardarAntesDeSalir} className="link link-sm">+ Crear producto nuevo</Link>
        </div>
        {lineas.map((l, i) => (
          <div key={i} className="line-grid line-grid-4">
            <Combobox label="Producto" required opciones={opcionesProd} valor={l.producto} onCambio={(v) => setLinea(i, "producto", v)} placeholder="Busque por código o nombre" />
            <Field label="Precio unitario">
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

      <dl className="ml-auto grid w-full max-w-xs gap-1 rounded-lg p-4 text-sm" style={{ background: "var(--surface-2)" }} aria-live="polite">
        <div className="flex justify-between"><dt className="text-muted">Neto</dt><dd className="num">{clp(Math.round(neto))}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">IVA 19%</dt><dd>{clp(iva)}</dd></div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold" style={{ borderColor: "var(--border-strong)" }}><dt>Total</dt><dd>{clp(total)}</dd></div>
      </dl>

      {error && <p role="alert" className="alert alert-error">{error}</p>}
      <div><button disabled={pending} className="btn btn-primary">{pending ? "Registrando…" : "Registrar factura"}</button></div>
    </form>
  );
}
