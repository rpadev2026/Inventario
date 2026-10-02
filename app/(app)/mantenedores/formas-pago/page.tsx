import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarFormaPago } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  return <PaginaCatalogo cfg={CATALOGOS.formasPago} accion={guardarFormaPago} searchParams={searchParams} />;
}
