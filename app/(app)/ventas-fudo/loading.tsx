import PaginaCargando from "@/components/app/skeleton";

/** Ventas de Fudo: tarjeta de sincronización con cifras, filtros y las dos tablas. */
export default function CargandoVentasFudo() {
  return <PaginaCargando tarjetas={4} tablas={2} columnas={5} />;
}
