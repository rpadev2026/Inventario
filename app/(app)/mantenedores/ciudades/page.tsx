import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarCiudad } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  return <PaginaCatalogo cfg={CATALOGOS.ciudades} accion={guardarCiudad} searchParams={searchParams} />;
}
