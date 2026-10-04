import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarUnidad } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaCatalogo cfg={CATALOGOS.unidades} accion={guardarUnidad} searchParams={searchParams} />;
}
