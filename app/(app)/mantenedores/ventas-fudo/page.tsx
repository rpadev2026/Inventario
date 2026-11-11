import { redirect } from "next/navigation";

/** Ventas de Fudo pasó al menú lateral (/ventas-fudo): se mantiene este enlace por los marcadores antiguos. */
export default function VentasFudoAntigua() {
  redirect("/ventas-fudo");
}
