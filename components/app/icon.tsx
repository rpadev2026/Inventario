/** Íconos de trazo (24×24, heredan el color del texto). Estilo lineal tipo Lucide, dibujados a mano. */
const PATHS: Record<string, React.ReactNode> = {
  home: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  receipt: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6" /></>,
  truck: <><path d="M3 6h11v10H3z" /><path d="M14 9h4l3 3v4h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
  package: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 12h6M9 16h4" /></>,
  book: <><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h10M9 8h5" /></>,
  warehouse: <><path d="M3 21V9l9-5 9 5v12" /><path d="M7 21v-8h10v8M7 17h10" /></>,
  repeat: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.7 3 5" /></>,
  settings: <><path d="M10.3 3h3.4l.5 2.3 1.6.7 2-1.2 2.4 2.4-1.2 2 .7 1.6 2.3.5v3.4l-2.3.5-.7 1.6 1.2 2-2.4 2.4-2-1.2-1.6.7-.5 2.3h-3.4l-.5-2.3-1.6-.7-2 1.2-2.4-2.4 1.2-2-.7-1.6L3 13.7v-3.4l2.3-.5.7-1.6-1.2-2 2.4-2.4 2 1.2 1.6-.7z" /><circle cx="12" cy="12" r="3" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="nav-icon">
      {PATHS[name]}
    </svg>
  );
}
