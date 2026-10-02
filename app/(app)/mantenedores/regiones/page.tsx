import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarRegion } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  return <PaginaCatalogo cfg={CATALOGOS.regiones} accion={guardarRegion} searchParams={searchParams} />;
}
