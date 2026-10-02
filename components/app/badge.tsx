export type BadgeTone = "ok" | "warn" | "danger" | "info" | "neutral";

/** Insignia de estado (punto + texto): el color nunca es la única señal. Estilos en app/tema.css. */
export default function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
