import { redirect } from "next/navigation";
import { esAdmin, leerSesion } from "@/lib/auth/session";
import { tienePermiso } from "@/lib/auth/permisos";
import { BottomNav, SideNav, type MenuItem } from "@/components/app/nav-links";
import Icon from "@/components/app/icon";
import { logout } from "../login/actions";

const MENU: (MenuItem & { permisos: string[] | "admin" | null })[] = [
  { href: "/", label: "Inicio", icon: "home", permisos: null },
  { href: "/compras", label: "Compras", icon: "receipt", permisos: ["compras.ver"] },
  { href: "/proveedores", label: "Proveedores", icon: "truck", permisos: ["proveedores.ver"] },
  { href: "/productos", label: "Productos", icon: "package", permisos: ["productos.ver"] },
  { href: "/recetas", label: "Recetas", icon: "book", permisos: ["recetas.ver"] },
  { href: "/solicitudes", label: "Solicitudes", icon: "clipboard", permisos: ["solicitudes.ver_propias", "solicitudes.gestionar"] },
  { href: "/bodegas", label: "Bodegas", icon: "warehouse", permisos: ["bodegas.ver"] },
  { href: "/movimientos", label: "Movimientos", icon: "repeat", permisos: ["movimientos.ver"] },
  { href: "/usuarios", label: "Usuarios", icon: "users", permisos: "admin" },
  { href: "/mantenedores", label: "Mantenedores", icon: "settings", permisos: "admin" },
];

const Marca = () => (
  <span className="brand"><span className="brand-mark"><Icon name="warehouse" size={18} /></span>Inventario</span>
);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await leerSesion();
  if (!s) redirect("/login");
  if (s.cambiar) redirect("/cambiar-clave");
  const items = MENU.filter((m) => m.permisos === null || (m.permisos === "admin" ? esAdmin(s) : tienePermiso(s.permisos, ...m.permisos)));
  const salir = <form action={logout}><button className="btn btn-secondary btn-sm">Salir</button></form>;

  // PC: barra lateral. Celular/tableta: barra superior + barra inferior (máx. 5 destinos). Ver app/tema.css.
  return (
    <div className="app-root">
      <aside className="app-sidebar" aria-label="Menú lateral">
        <Marca />
        <nav className="grid gap-1" aria-label="Menú principal"><SideNav items={items} /></nav>
        <div className="app-tools">{salir}</div>
      </aside>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-inner"><Marca />{salir}</div>
        </header>
        <main className="app-main">{children}</main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}
