/** Gráficos sencillos de los reportes, en HTML/CSS (sin librerías): una sola serie, con el valor a la vista y un detalle al pasar o enfocar. */

export type FilaRanking = { clave: string; nombre: string; valor: number; texto: string; detalle: string };

/** Barras horizontales ordenadas de mayor a menor: la barra más larga llena la pista; el valor va en el extremo. */
export function Ranking({ filas, etiqueta }: { filas: FilaRanking[]; etiqueta: string }) {
  const max = Math.max(...filas.map((f) => f.valor), 0);
  return (
    <div className="rank" role="list" aria-label={etiqueta}>
      {filas.map((f) => (
        <div key={f.clave} className="rank-fila" role="listitem" tabIndex={0} title={f.detalle} aria-label={f.detalle}>
          <span className="rank-nombre">{f.nombre}</span>
          <span className="rank-pista">
            <span className="rank-barra" style={{ width: `${max > 0 ? Math.max((f.valor / max) * 85, 0.5) : 0.5}%` }} />
            <span className="rank-valor">{f.texto}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export type PuntoColumna = { etiqueta: string; valor: number; texto: string };

/** Columnas por período (día, semana o mes): la altura es proporcional al mayor valor; se rotulan el máximo y los extremos. */
export function Columnas({ puntos, etiqueta, maximo }: { puntos: PuntoColumna[]; etiqueta: string; maximo: string }) {
  const max = Math.max(...puntos.map((p) => p.valor), 0);
  return (
    <div className="space-y-1">
      <div className="cols-ejes"><span>{maximo}</span></div>
      <div className="cols" role="group" aria-label={etiqueta}>
        {puntos.map((p) => (
          <div key={p.etiqueta} className="col-hit" tabIndex={0} title={`${p.etiqueta}: ${p.texto}`} aria-label={`${p.etiqueta}: ${p.texto}`}>
            <div className="col-barra" style={{ height: `${max > 0 ? (p.valor / max) * 100 : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="cols-ejes"><span>{puntos[0]?.etiqueta}</span><span>{puntos.length > 1 ? puntos[puntos.length - 1].etiqueta : ""}</span></div>
    </div>
  );
}
