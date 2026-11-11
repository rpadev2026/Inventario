"use client";

import { Fragment, useId, useState } from "react";
import Badge from "@/components/app/badge";
import type { VentaListada } from "@/lib/ventas-fudo-tipos";

const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short", timeZone: "America/Santiago" });
const cantidad = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const pesos = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const TONO = { "descontó": "ok", "sin receta": "warn", "sin bodega": "warn" } as const;
const TEXTO = { "descontó": "Descontó stock", "sin receta": "Sin receta", "sin bodega": "Receta sin bodega" } as const;

/** Fila de una venta con su detalle desplegable: productos vendidos (con receta y si descontó) e ingredientes descontados del stock. */
export default function FilaVenta({ v }: { v: VentaListada }) {
  const [abierta, setAbierta] = useState(false);
  const idDetalle = useId();
  return (
    <Fragment>
      <tr>
        <td>
          <button type="button" className="link" aria-expanded={abierta} aria-controls={idDetalle} onClick={() => setAbierta(!abierta)}>
            {abierta ? "Ocultar" : "Ver"} <span className="sr-only">detalle de la venta </span>{v.id}
          </button>
        </td>
        <td>{fechaHora(v.cierre)}</td>
        <td>{fechaHora(v.proceso)}</td>
        <td className="num">{v.lineas.length}</td>
        <td className="num">{cantidad.format(Number(v.unidades))}</td>
        <td className="num">{v.monto === null ? <span className="text-muted">—</span> : pesos.format(Number(v.monto))}</td>
      </tr>
      {abierta && (
        <tr id={idDetalle}>
          <td colSpan={6}>
            <div className="space-y-3 py-2">
              {v.lineas.length === 0 ? (
                <p className="text-muted">Esta venta se procesó antes de que se guardara el detalle de sus productos.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="text-left font-semibold">Productos vendidos</caption>
                    <thead><tr><th>Producto en Fudo</th><th>Receta vinculada</th><th className="num">Cantidad</th><th className="num">Monto</th><th>Stock</th></tr></thead>
                    <tbody>
                      {v.lineas.map((l, i) => (
                        <tr key={i}>
                          <td>{l.nombre}</td>
                          <td>{l.receta ?? <span className="text-muted">Sin receta</span>}</td>
                          <td className="num">{cantidad.format(Number(l.cantidad))}</td>
                          <td className="num">{l.monto === null ? <span className="text-muted">—</span> : pesos.format(Number(l.monto))}</td>
                          <td><Badge tone={TONO[l.estado]}>{TEXTO[l.estado]}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {v.consumos.length > 0 ? (
                <div className="table-wrap">
                  <table className="table">
                    <caption className="text-left font-semibold">Ingredientes descontados del stock</caption>
                    <thead><tr><th>Producto</th><th>Bodega</th><th className="num">Cantidad</th></tr></thead>
                    <tbody>
                      {v.consumos.map((c, i) => <tr key={i}><td>{c.producto}</td><td>{c.bodega}</td><td className="num">{cantidad.format(Number(c.cantidad))} {c.unidad}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">Esta venta no descontó ingredientes del stock.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
