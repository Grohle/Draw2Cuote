import { useMemo } from 'react';
import type { Textos } from '../i18n';
import { calcularPresupuesto } from '../presupuesto';
import type { Tarifas } from '../tarifas';
import type { Extraccion } from '../tipos';
import type { SistemaUnidades } from '../unidades';
import { IconoPresupuesto } from './Iconos';

const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface Props {
  datos: Extraccion;
  tarifas: Tarifas;
  onAbrirTarifas: () => void;
  t: Textos;
  unidades: SistemaUnidades;
}

export function Presupuesto({ datos, tarifas, onAbrirTarifas, t, unidades }: Props) {
  const resultado = useMemo(() => calcularPresupuesto(datos, tarifas, t, unidades), [datos, tarifas, t, unidades]);
  const p = t.presupuesto;

  return (
    <fieldset className="grupo">
      <legend>
        <IconoPresupuesto tamano={14} /> {p.titulo}
      </legend>
      {!resultado.calculable ? (
        <p className="presupuesto__incompleto">
          {p.incompleto}{' '}
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
              <span>{p.totalLote}</span>
              <strong>{euros(resultado.totalLote)}</strong>
            </div>
            <div>
              <span>{p.precioUnitario}</span>
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
        {p.nota}{' '}
        <button className="enlace" type="button" onClick={onAbrirTarifas}>
          {p.ajustarTarifas}
        </button>
      </p>
    </fieldset>
  );
}
