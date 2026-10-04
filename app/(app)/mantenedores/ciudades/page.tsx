import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarCiudad } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaCatalogo cfg={CATALOGOS.ciudades} accion={guardarCiudad} searchParams={searchParams} />;
}
