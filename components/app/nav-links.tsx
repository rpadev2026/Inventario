"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "./icon";

export type MenuItem = { href: string; label: string; icon: IconName };

const activo = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Menú de la barra lateral (PC y tableta ancha). */
export function SideNav({ items }: { items: MenuItem[] }) {
  const path = usePathname();
  return (
    <>
      {items.map((m) => (
        <Link key={m.href} href={m.href} aria-current={activo(path, m.href) ? "page" : undefined} className="nav-link">
          <Icon name={m.icon} />{m.label}
        </Link>
      ))}
    </>
  );
}

/**
 * Barra inferior (celular y tableta). Muestra como máximo 5 destinos: si hay más, los 4 primeros y un botón
 * «Más» que abre una hoja con el resto (regla de UX: la navegación inferior no pasa de 5 elementos).
 */
export function BottomNav({ items }: { items: MenuItem[] }) {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const conMas = items.length > 5;
  const visibles = conMas ? items.slice(0, 4) : items;
  const resto = conMas ? items.slice(4) : [];
  const restoActivo = resto.some((m) => activo(path, m.href));

  useEffect(() => setAbierto(false), [path]); // cierra la hoja al navegar
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]);

  return (
    <>
      {abierto && (
        <>
          <div className="nav-sheet-backdrop" onClick={() => setAbierto(false)} />
          <div className="nav-sheet" role="dialog" aria-label="Más secciones">
            {resto.map((m) => (
              <Link key={m.href} href={m.href} aria-current={activo(path, m.href) ? "page" : undefined} className="nav-link">
                <Icon name={m.icon} />{m.label}
              </Link>
            ))}
          </div>
        </>
      )}
      <nav className="app-bottomnav" aria-label="Menú principal">
        {visibles.map((m) => (
          <Link key={m.href} href={m.href} aria-current={activo(path, m.href) ? "page" : undefined} className="nav-link">
            <Icon name={m.icon} size={22} />{m.label}
          </Link>
        ))}
        {conMas && (
          <button type="button" className="nav-link" aria-expanded={abierto} aria-current={restoActivo ? "page" : undefined} onClick={() => setAbierto((v) => !v)}>
            <Icon name="more" size={22} />Más
          </button>
        )}
      </nav>
    </>
  );
}
