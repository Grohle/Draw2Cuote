import { useMemo } from 'react';
import { calcularPresupuesto } from '../presupuesto';
import type { Tarifas } from '../tarifas';
import type { Extraccion } from '../tipos';

const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface Props {
  datos: Extraccion;
  tarifas: Tarifas;
  onAbrirTarifas: () => void;
}

export function Presupuesto({ datos, tarifas, onAbrirTarifas }: Props) {
  const resultado = useMemo(() => calcularPresupuesto(datos, tarifas), [datos, tarifas]);

  return (
    <fieldset className="grupo">
      <legend>💰 Presupuesto estimado</legend>
      {!resultado.calculable ? (
        <p className="presupuesto__incompleto">
          No se puede estimar todavía: completa{' '}
          {resultado.camposFaltantes.map((c, i) => (
            <strong key={c}>
              {i > 0 && ', '}
              {c}
            </strong>
          ))}
          .
        </p>
      ) : (
        <>
          <div className="presupuesto__lineas">
            {resultado.lineas.map((l, i) => (
              <div className="presupuesto__linea" key={i}>
                <span>{l.concepto}</span>
                <span>{euros(l.importe)}</span>
              </div>
            ))}
          </div>
          <div className="presupuesto__total">
            <div>
              <span>Total del lote</span>
              <strong>{euros(resultado.totalLote)}</strong>
            </div>
            <div>
              <span>Precio unitario</span>
              <strong>{euros(resultado.precioUnitario)}</strong>
            </div>
          </div>
          {resultado.avisos.map((a, i) => (
            <p className="presupuesto__aviso" key={i}>
              ℹ {a}
            </p>
          ))}
        </>
      )}
      <p className="presupuesto__nota">
        Estimación orientativa con geometría simplificada y tarifas configurables — no sustituye un presupuesto de
        nesting real.{' '}
        <button className="enlace" type="button" onClick={onAbrirTarifas}>
          Ajustar tarifas
        </button>
      </p>
    </fieldset>
  );
}
