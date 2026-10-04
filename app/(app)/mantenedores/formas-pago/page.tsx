import { PaginaCatalogo } from "@/components/app/catalogo-admin";
import { CATALOGOS } from "@/lib/services/catalogo";
import { guardarFormaPago } from "./actions";

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PaginaCatalogo cfg={CATALOGOS.formasPago} accion={guardarFormaPago} searchParams={searchParams} />;
}
