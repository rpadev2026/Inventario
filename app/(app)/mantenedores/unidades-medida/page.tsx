import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarUnidad } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  return <PaginaCatalogo cfg={CATALOGOS.unidades} accion={guardarUnidad} searchParams={searchParams} />;
}
