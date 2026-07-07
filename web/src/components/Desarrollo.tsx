import { useState } from 'react';
import {
  calcularDesarrollo,
  radioPorDefecto,
  type MetodoDesplegado,
  type OpcionesDesplegado,
} from '../desplegado';
import type { Textos } from '../i18n';
import type { Extraccion } from '../tipos';
import {
  etiquetaLongitud,
  formatearLongitud,
  mmAUnidadMostrada,
  unidadMostradaAMm,
  type SistemaUnidades,
} from '../unidades';

interface Props {
  datos: Extraccion;
  unidades: SistemaUnidades;
  opciones: OpcionesDesplegado;
  onCambioOpciones: (o: OpcionesDesplegado) => void;
  t: Textos;
}

const DECIMALES: Record<SistemaUnidades, number> = { metrico: 2, imperial: 3 };

/** Panel de desarrollo (desplegado) de chapa plegada: opciones + resultado a×b. */
export function Desarrollo({ datos, unidades, opciones, onCambioOpciones, t }: Props) {
  const d = t.desarrollo;
  const espesor = datos.espesor_mm.valor;
  const numPliegues = datos.num_pliegues.valor ?? 0;

  // radio y ángulo son por pieza: se siembran de las opciones y se pueden ajustar aquí
  const [radioMm, setRadioMm] = useState(() => radioPorDefecto(espesor, opciones));
  const [angulo, setAngulo] = useState(() => opciones.anguloDefecto);

  const res = calcularDesarrollo(datos, radioMm, angulo, opciones);
  const radioMostrado = Number(mmAUnidadMostrada(radioMm, unidades).toFixed(DECIMALES[unidades]));

  return (
    <fieldset className="grupo">
      <legend>{d.titulo}</legend>
      <p className="desarrollo__pliegues">{d.numPliegues(numPliegues)}</p>

      <div className="desarrollo__opciones">
        <label className="desarrollo__campo">
          <span>{d.metodo}</span>
          <select
            value={opciones.metodo}
            onChange={(e) => onCambioOpciones({ ...opciones, metodo: e.target.value as MetodoDesplegado })}
          >
            <option value="fibra_neutra">{d.metodoFibraNeutra}</option>
            <option value="factor_k">{d.metodoFactorK}</option>
          </select>
        </label>

        {opciones.metodo === 'factor_k' && (
          <label className="desarrollo__campo">
            <span>{d.factorK}</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={opciones.factorK}
              onChange={(e) => onCambioOpciones({ ...opciones, factorK: Number(e.target.value) })}
            />
          </label>
        )}

        <label className="desarrollo__campo">
          <span>{`${d.radio} (${etiquetaLongitud(unidades)})`}</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={radioMostrado}
            onChange={(e) => setRadioMm(unidadMostradaAMm(Number(e.target.value), unidades))}
          />
        </label>

        <label className="desarrollo__campo">
          <span>{`${d.angulo} (°)`}</span>
          <input type="number" step="1" min="0" max="180" value={angulo} onChange={(e) => setAngulo(Number(e.target.value))} />
        </label>
      </div>

      {res.calculable && res.pliegue ? (
        <div className="desarrollo__resultado">
          <div className="desarrollo__linea">
            <span>{d.kEfectivo}</span>
            <strong>{res.pliegue.k.toFixed(3)}</strong>
          </div>
          <div className="desarrollo__linea">
            <span>{d.baPorPliegue}</span>
            <strong>{formatearLongitud(res.pliegue.baMm, unidades)}</strong>
          </div>
          <div className="desarrollo__linea">
            <span>{d.bdPorPliegue}</span>
            <strong>{formatearLongitud(res.pliegue.bdMm, unidades)}</strong>
          </div>
          <div className="desarrollo__linea desarrollo__linea--total">
            <span>{d.desarrolloAB}</span>
            <strong>
              {res.largoDesarrolladoMm == null ? '—' : formatearLongitud(res.largoDesarrolladoMm, unidades)}
              {' × '}
              {res.anchoMm == null ? '—' : formatearLongitud(res.anchoMm, unidades)}
            </strong>
          </div>
        </div>
      ) : (
        <p className="desarrollo__aviso">ℹ {d.sinEspesor}</p>
      )}

      <p className="desarrollo__nota">{d.nota}</p>
    </fieldset>
  );
}
