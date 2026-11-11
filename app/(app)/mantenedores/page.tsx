import Link from "next/link";
import { requerirPaginaAdmin } from "@/lib/auth/session";
import { CATALOGOS } from "@/lib/services/catalogo";

const TARJETAS = [
  { ...CATALOGOS.formasPago, desc: "Medios con los que se pagan las facturas de compra." },
  { ...CATALOGOS.unidades, desc: "Unidades en que se miden los productos (kg, lt, un...)." },
  { ...CATALOGOS.formatos, desc: "Presentaciones de los productos (caja, bolsa, saco...)." },
  { ...CATALOGOS.regiones, desc: "Regiones de Chile (código CUT)." },
  { ...CATALOGOS.ciudades, desc: "Ciudades = provincias de cada región." },
  { ...CATALOGOS.comunas, desc: "Comunas de cada ciudad." },
  { ruta: "/mantenedores/roles", titulo: "Roles y permisos", desc: "Permisos asignados a cada rol." },
];

export default async function MantenedoresPage() {
  await requerirPaginaAdmin();
  return (
    <section className="space-y-6">
      <h1 className="page-title">Mantenedores</h1>
      <div className="form-grid form-grid-2">
        {TARJETAS.map((t) => (
          <div key={t.ruta} className="card">
            <h2 className="section-title mb-2"><Link className="link" href={t.ruta}>{t.titulo}</Link></h2>
            <p>{t.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
