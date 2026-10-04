import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarRegion } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaCatalogo cfg={CATALOGOS.regiones} accion={guardarRegion} searchParams={searchParams} />;
}
