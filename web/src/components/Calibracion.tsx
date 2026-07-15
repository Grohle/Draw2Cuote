import { useEffect, useState } from 'react';
import { copiarJson, descargarJson } from '../descargas';
import type { Textos } from '../i18n';
import type { Estadisticas, Extraccion } from '../tipos';
import { IconoCopiar, IconoDescargar } from './Iconos';

interface Props {
  onCerrar: () => void;
  t: Textos;
  /** Pieza actualmente a la vista, para exportar su JSON desde aquí (o null si no hay). */
  datos: Extraccion | null;
}

function colorTasa(tasa: number): string {
  if (tasa >= 0.3) return 'barra--baja';
  if (tasa >= 0.1) return 'barra--media';
  return 'barra--alta';
}

export function Calibracion({ onCerrar, t, datos }: Props) {
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = t.calibracion;

  useEffect(() => {
    fetch('/api/estadisticas')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setError(c.errorCarga));
  }, [c.errorCarga]);

  const conDatos = (stats?.campos ?? []).filter((cc) => cc.vecesVisto > 0);

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal modal--ancho" role="dialog" aria-label={t.app.tituloPrecision} onClick={(e) => e.stopPropagation()}>
        <h2>{t.app.botonPrecision}</h2>
        <p className="modal__nota">{c.nota}</p>

        {error && <p className="modal__prueba modal__prueba--error">{error}</p>}

        {stats && stats.totalAnalisisConFeedback === 0 && <p className="modal__nota">{c.sinDatos}</p>}

        {stats && stats.totalAnalisisConFeedback > 0 && (
          <>
            <p className="modal__nota">{c.totalAnalisis(stats.totalAnalisisConFeedback)}</p>
            <div className="tabla-calibracion">
              <div className="tabla-calibracion__cabecera">
                <span>{c.columnaCampo}</span>
                <span>{c.columnaCorreccion}</span>
                <span>{c.columnaAlta}</span>
                <span>{c.columnaMedia}</span>
                <span>{c.columnaBaja}</span>
              </div>
              {conDatos.map((cc) => (
                <div className="tabla-calibracion__fila" key={cc.campo}>
                  <span>{t.campos[cc.campo as keyof Textos['campos']] ?? cc.campo}</span>
                  <span className="tabla-calibracion__tasa">
                    <span className={`barra ${colorTasa(cc.tasaCorreccion)}`} style={{ width: `${Math.round(cc.tasaCorreccion * 100)}%` }} />
                    {Math.round(cc.tasaCorreccion * 100)}% ({cc.vecesCorregido}/{cc.vecesVisto})
                  </span>
                  <span>{cc.porConfianza.alta.visto ? `${cc.porConfianza.alta.corregido}/${cc.porConfianza.alta.visto}` : '—'}</span>
                  <span>{cc.porConfianza.media.visto ? `${cc.porConfianza.media.corregido}/${cc.porConfianza.media.visto}` : '—'}</span>
                  <span>{cc.porConfianza.baja.visto ? `${cc.porConfianza.baja.corregido}/${cc.porConfianza.baja.visto}` : '—'}</span>
                </div>
              ))}
            </div>
            <p className="modal__nota">{c.notaFinal}</p>
          </>
        )}

        {datos && (
          <>
            <h3 className="campos-extra__titulo">{c.jsonTitulo}</h3>
            <p className="modal__nota">{c.jsonNota}</p>
            <div className="modal__acciones modal__acciones--izquierda">
              <button className="btn" type="button" onClick={() => copiarJson(datos)}>
                <IconoCopiar tamano={15} />
                {t.resultados.copiarJson}
              </button>
              <button className="btn" type="button" onClick={() => descargarJson(`${datos.numero_plano.valor?.trim() || 'pieza'}-draw2quote.json`, datos)}>
                <IconoDescargar tamano={15} />
                {t.resultados.descargarJson}
              </button>
            </div>
          </>
        )}

        <div className="modal__acciones">
          <button className="btn btn--primario" type="button" onClick={onCerrar}>
            {c.cerrar}
          </button>
        </div>
      </div>
    </div>
  );
}
