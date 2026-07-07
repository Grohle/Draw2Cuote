import { calcularDesarrollo, radioPorDefecto, type MetodoDesplegado, type OpcionesDesplegado } from '../desplegado';
import type { Textos } from '../i18n';
import type { DesarrolloGeom, Extraccion } from '../tipos';
import {
  etiquetaLongitud,
  formatearLongitud,
  mmAUnidadMostrada,
  unidadMostradaAMm,
  type SistemaUnidades,
} from '../unidades';

interface Props {
  datos: Extraccion;
  onCambio: (datos: Extraccion) => void;
  unidades: SistemaUnidades;
  opciones: OpcionesDesplegado;
  onCambioOpciones: (o: OpcionesDesplegado) => void;
  t: Textos;
}

const DEC: Record<SistemaUnidades, number> = { metrico: 2, imperial: 3 };
const mostrarMm = (mm: number | null | undefined, u: SistemaUnidades) =>
  mm == null || mm <= 0 ? '' : String(Number(mmAUnidadMostrada(mm, u).toFixed(DEC[u])));

/** Panel de desarrollo de chapa: geometría de plegado (lados, ángulos, radios) + resultado a×b. */
export function Desarrollo({ datos, onCambio, unidades, opciones, onCambioOpciones, t }: Props) {
  const d = t.desarrollo;
  const espesor = datos.espesor_mm.valor;
  const res = calcularDesarrollo(datos, opciones);
  const numPliegues = res.numPliegues;
  const numLados = numPliegues + 1;

  const setDesarrollo = (nuevo: DesarrolloGeom) => onCambio({ ...datos, desarrollo: nuevo });

  const setLado = (i: number, mostrado: string) => {
    const mm = mostrado === '' ? 0 : unidadMostradaAMm(Number(mostrado), unidades);
    const lados = Array.from({ length: numLados }, (_, j) => (j === i ? mm : datos.desarrollo.lados_mm[j] ?? 0));
    setDesarrollo({ ...datos.desarrollo, lados_mm: lados });
  };

  const setPliegue = (i: number, parcial: { angulo_grados?: number | null; radio_mm?: number | null }) => {
    const pliegues = Array.from({ length: numPliegues }, (_, j) => {
      const cur = datos.desarrollo.pliegues[j] ?? { angulo_grados: null, radio_mm: null };
      return j === i ? { ...cur, ...parcial } : cur;
    });
    setDesarrollo({ ...datos.desarrollo, pliegues });
  };

  const radioDefectoMostrado = mostrarMm(radioPorDefecto(espesor, opciones), unidades);

  return (
    <fieldset className="grupo">
      <legend>{d.titulo}</legend>
      <p className="desarrollo__pliegues">{d.numPliegues(numPliegues)}</p>

      <div className="desarrollo__opciones">
        <label className="desarrollo__campo">
          <span>{d.metodo}</span>
          <select value={opciones.metodo} onChange={(e) => onCambioOpciones({ ...opciones, metodo: e.target.value as MetodoDesplegado })}>
            <option value="fibra_neutra">{d.metodoFibraNeutra}</option>
            <option value="factor_k">{d.metodoFactorK}</option>
          </select>
        </label>
        {opciones.metodo === 'factor_k' && (
          <label className="desarrollo__campo">
            <span>{d.factorK}</span>
            <input type="number" step="0.01" min="0" max="1" value={opciones.factorK} onChange={(e) => onCambioOpciones({ ...opciones, factorK: Number(e.target.value) })} />
          </label>
        )}
      </div>

      {/* Lados (tramos rectos) leídos del plano */}
      <p className="desarrollo__subtitulo">{`${d.lados} (${etiquetaLongitud(unidades)})`}</p>
      <div className="desarrollo__lados">
        {Array.from({ length: numLados }, (_, i) => (
          <input
            key={i}
            type="number"
            step="0.1"
            min="0"
            aria-label={`${d.lado} ${i + 1}`}
            placeholder="—"
            value={mostrarMm(datos.desarrollo.lados_mm[i], unidades)}
            onChange={(e) => setLado(i, e.target.value)}
          />
        ))}
      </div>

      {/* Geometría por pliegue: ángulo y radio (del plano, o por defecto) */}
      <div className="desarrollo__pliegues-tabla">
        <div className="desarrollo__pliegue-cab">
          <span>{d.pliegue}</span>
          <span>{`${d.angulo} (°)`}</span>
          <span>{`${d.radio} (${etiquetaLongitud(unidades)})`}</span>
          <span>{d.baPorPliegue}</span>
          <span>{d.bdPorPliegue}</span>
        </div>
        {res.pliegues.map((p) => {
          const geom = datos.desarrollo.pliegues[p.indice];
          return (
            <div className="desarrollo__pliegue-fila" key={p.indice}>
              <span className="desarrollo__pliegue-n">{p.indice + 1}</span>
              <span className="desarrollo__con-origen">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="180"
                  placeholder={String(opciones.anguloDefecto)}
                  value={geom?.angulo_grados ?? ''}
                  onChange={(e) => setPliegue(p.indice, { angulo_grados: e.target.value === '' ? null : Number(e.target.value) })}
                />
                <em className={p.anguloExtraido ? 'origen origen--plano' : 'origen'}>{p.anguloExtraido ? d.delPlano : d.porDefecto}</em>
              </span>
              <span className="desarrollo__con-origen">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder={radioDefectoMostrado}
                  value={geom?.radio_mm != null ? mostrarMm(geom.radio_mm, unidades) : ''}
                  onChange={(e) => setPliegue(p.indice, { radio_mm: e.target.value === '' ? null : unidadMostradaAMm(Number(e.target.value), unidades) })}
                />
                <em className={p.radioExtraido ? 'origen origen--plano' : 'origen'}>{p.radioExtraido ? d.delPlano : d.porDefecto}</em>
              </span>
              <span>{formatearLongitud(p.baMm, unidades)}</span>
              <span>{formatearLongitud(p.bdMm, unidades)}</span>
            </div>
          );
        })}
      </div>

      {res.calculable ? (
        <div className="desarrollo__resultado">
          <div className="desarrollo__linea desarrollo__linea--total">
            <span>{d.desarrolloAB}</span>
            <strong>
              {res.largoDesarrolladoMm == null ? '—' : formatearLongitud(res.largoDesarrolladoMm, unidades)}
              {' × '}
              {res.anchoMm == null ? '—' : formatearLongitud(res.anchoMm, unidades)}
            </strong>
          </div>
          {!res.tieneLados && <p className="desarrollo__aviso">ℹ {d.faltanLados}</p>}
        </div>
      ) : (
        <p className="desarrollo__aviso">ℹ {d.sinEspesor}</p>
      )}

      <p className="desarrollo__nota">{d.nota}</p>
    </fieldset>
  );
}
