import { useEffect, useState } from 'react';
import { NOMBRES_CAMPO } from '../catalogo';
import type { Estadisticas } from '../tipos';

interface Props {
  onCerrar: () => void;
}

function colorTasa(tasa: number): string {
  if (tasa >= 0.3) return 'barra--baja';
  if (tasa >= 0.1) return 'barra--media';
  return 'barra--alta';
}

export function Calibracion({ onCerrar }: Props) {
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/estadisticas')
      .then((r) => r.json())
      .then(setDatos)
      .catch(() => setError('No se pudieron cargar las estadísticas.'));
  }, []);

  const conDatos = (datos?.campos ?? []).filter((c) => c.vecesVisto > 0);

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal modal--ancho" role="dialog" aria-label="Precisión del modelo" onClick={(e) => e.stopPropagation()}>
        <h2>📊 Precisión del modelo</h2>
        <p className="modal__nota">
          Cada vez que confirmas o corriges un análisis con <strong>Guardar corrección</strong>, ese dato alimenta este
          panel y ajusta el criterio del modelo en próximos análisis (ver observaciones del sistema). Ningún dato sale
          de tu servidor.
        </p>

        {error && <p className="modal__prueba modal__prueba--error">{error}</p>}

        {datos && datos.totalAnalisisConFeedback === 0 && (
          <p className="modal__nota">
            Aún no hay feedback registrado. Analiza un plano, revisa los datos y pulsa <strong>Guardar corrección</strong>{' '}
            para empezar a calibrar el modelo con tu propio uso.
          </p>
        )}

        {datos && datos.totalAnalisisConFeedback > 0 && (
          <>
            <p className="modal__nota">
              <strong>{datos.totalAnalisisConFeedback}</strong> análisis revisados por usuarios hasta ahora.
            </p>
            <div className="tabla-calibracion">
              <div className="tabla-calibracion__cabecera">
                <span>Campo</span>
                <span>Corrección</span>
                <span>Alta→corr.</span>
                <span>Media→corr.</span>
                <span>Baja→corr.</span>
              </div>
              {conDatos.map((c) => (
                <div className="tabla-calibracion__fila" key={c.campo}>
                  <span>{NOMBRES_CAMPO[c.campo] ?? c.campo}</span>
                  <span className="tabla-calibracion__tasa">
                    <span className={`barra ${colorTasa(c.tasaCorreccion)}`} style={{ width: `${Math.round(c.tasaCorreccion * 100)}%` }} />
                    {Math.round(c.tasaCorreccion * 100)}% ({c.vecesCorregido}/{c.vecesVisto})
                  </span>
                  <span>
                    {c.porConfianza.alta.visto ? `${c.porConfianza.alta.corregido}/${c.porConfianza.alta.visto}` : '—'}
                  </span>
                  <span>
                    {c.porConfianza.media.visto ? `${c.porConfianza.media.corregido}/${c.porConfianza.media.visto}` : '—'}
                  </span>
                  <span>
                    {c.porConfianza.baja.visto ? `${c.porConfianza.baja.corregido}/${c.porConfianza.baja.visto}` : '—'}
                  </span>
                </div>
              ))}
            </div>
            <p className="modal__nota">
              "Alta→corr." indica cuántas veces un valor marcado con confianza alta por el modelo tuvo que corregirse
              luego: idealmente cercano a 0. Con pocos análisis los porcentajes no son representativos todavía.
            </p>
          </>
        )}

        <div className="modal__acciones">
          <button className="btn btn--primario" type="button" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
