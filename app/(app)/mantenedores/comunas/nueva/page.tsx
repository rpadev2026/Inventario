import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarComuna } from "../actions";

/** Crear (ruta propia, como /compras/nueva): solo el Administrador; Volver conserva página y filtros del listado. */
export default function NuevaComunaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaCatalogo cfg={CATALOGOS.comunas} accion={guardarComuna} searchParams={searchParams} modo="crear" />;
}
