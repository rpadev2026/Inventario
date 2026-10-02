import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso, esAdmin } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";
import FormBodega from "./form";
import Badge from "@/components/app/badge";

export default async function BodegasPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const s = await requerirPaginaPermiso("bodegas.ver");
  const admin = esAdmin(s);
  const sel = Number((await searchParams).b) || undefined;
  const [{ data: bodegas }, { data: stock }, { data: prods }, unidades] = await Promise.all([
    db.from("Bodegas").select("IdBodega,NombreBodega,EsCentral,IdEstado").order("EsCentral", { ascending: false }).order("NombreBodega"),
    db.from("StockBodega").select("IdBodega,CodigoProducto,Cantidad"),
    db.from("Productos").select("CodigoProducto,NombreProducto,UnidadMedida,StockMinimo,StockCritico"),
    mapaNombres("UnidadesMedida"),
  ]);
  const lista = bodegas ?? [];
  const actual = lista.find((b) => b.IdBodega === sel) ?? lista[0];
  const pm = new Map((prods ?? []).map((p) => [p.CodigoProducto, p]));
  const filas = (stock ?? []).filter((r) => r.IdBodega === actual?.IdBodega).map((r) => {
    const p = pm.get(r.CodigoProducto)!;
    const q = Number(r.Cantidad);
    const nivel = q <= Number(p.StockCritico) ? "Crítico" : q <= Number(p.StockMinimo) ? "Bajo" : "OK";
    return { ...r, p, q, nivel };
  });
  const tono = { Crítico: "danger", Bajo: "warn", OK: "ok" } as const;
  return (
    <section className="space-y-4">
      <h1 className="page-title">Bodegas</h1>
      {admin && (
        <div className="card grid gap-4">
          <h2 className="section-title">Administrar bodegas</h2>
          {lista.map((b) => <FormBodega key={b.IdBodega} b={b} />)}
          <div className="divider-t pt-4"><FormBodega /></div>
        </div>
      )}
      <nav className="flex flex-wrap gap-2" aria-label="Bodegas">
        {lista.map((b) => (
          <a key={b.IdBodega} href={`/bodegas?b=${b.IdBodega}`} aria-current={b.IdBodega === actual?.IdBodega ? "page" : undefined}
            className={`pill ${b.IdBodega === actual?.IdBodega ? "pill-on" : ""}`}>{b.NombreBodega}</a>
        ))}
      </nav>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Mín.</th><th className="num">Crít.</th><th>Nivel</th></tr></thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.CodigoProducto}>
                <td>{r.CodigoProducto} — {r.p.NombreProducto}</td>
                <td className="num">{r.q} {unidades.get(r.p.UnidadMedida) ?? r.p.UnidadMedida}</td><td className="num">{r.p.StockMinimo}</td><td className="num">{r.p.StockCritico}</td><td><Badge tone={tono[r.nivel as keyof typeof tono]}>{r.nivel}</Badge></td>
              </tr>
            ))}
            {!filas.length && <tr><td colSpan={5} className="text-muted">Sin stock registrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
