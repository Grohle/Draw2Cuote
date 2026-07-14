import { calcularDesarrollo, ladoExteriorMm, radioPorDefecto, type MetodoDesplegado, type OpcionesDesplegado } from '../desplegado';
import type { Textos } from '../i18n';
import type { DesarrolloGeom, Extraccion, LadoGeom } from '../tipos';
import { etiquetaLongitud, formatearLongitud, mmAUnidadMostrada, unidadMostradaAMm, type SistemaUnidades } from '../unidades';
import { IconoDesarrollo } from './Iconos';

interface Props {
  datos: Extraccion;
  onCambio: (datos: Extraccion) => void;
  unidades: SistemaUnidades;
  opciones: OpcionesDesplegado;
  onCambioOpciones: (o: OpcionesDesplegado) => void;
  t: Textos;
}

const DEC: Record<SistemaUnidades, number> = { metrico: 2, imperial: 3 };

/** mm → texto en la unidad mostrada (vacío si no hay valor). */
const mostrarMm = (mm: number | null | undefined, u: SistemaUnidades) =>
  mm == null || mm <= 0 ? '' : String(Number(mmAUnidadMostrada(mm, u).toFixed(DEC[u])));

const LADO_VACIO: LadoGeom = { longitud_mm: 0, cota_interior: false };

/**
 * Panel de desarrollo de chapa. El perfil se lista en vertical y en orden:
 * por cada cara, una fila con su largo (y si la cota es interior o exterior);
 * después una fila con el ángulo y otra con el radio del pliegue que le sigue.
 * El cálculo convierte las cotas interiores a exteriores antes de sumar.
 */
export function Desarrollo({ datos, onCambio, unidades, opciones, onCambioOpciones, t }: Props) {
  const d = t.desarrollo;
  const u = etiquetaLongitud(unidades);
  const espesor = datos.espesor_mm.valor;
  const res = calcularDesarrollo(datos, opciones);
  const numPliegues = res.numPliegues;
  const numLados = numPliegues + 1;

  const setDesarrollo = (nuevo: DesarrolloGeom) => onCambio({ ...datos, desarrollo: nuevo });

  const setLado = (i: number, parcial: Partial<LadoGeom>) => {
    const lados = Array.from({ length: numLados }, (_, j) => {
      const actual = datos.desarrollo.lados[j] ?? LADO_VACIO;
      return j === i ? { ...actual, ...parcial } : actual;
    });
    setDesarrollo({ ...datos.desarrollo, lados });
  };

  const setPliegue = (i: number, parcial: { angulo_grados?: number | null; radio_mm?: number | null }) => {
    const pliegues = Array.from({ length: numPliegues }, (_, j) => {
      const actual = datos.desarrollo.pliegues[j] ?? { angulo_grados: null, radio_mm: null };
      return j === i ? { ...actual, ...parcial } : actual;
    });
    setDesarrollo({ ...datos.desarrollo, pliegues });
  };

  const radioDefectoMostrado = mostrarMm(radioPorDefecto(espesor, opciones), unidades);

  /** Fila de una cara: largo + selector de cota interior/exterior (+ exterior calculado si es interior). */
  const filaLado = (i: number) => {
    const lado = datos.desarrollo.lados[i] ?? LADO_VACIO;
    const exterior = espesor != null && lado.cota_interior && lado.longitud_mm > 0
      ? ladoExteriorMm(lado, i, numLados, espesor)
      : null;
    return (
      <div className="desarrollo__fila desarrollo__fila--lado" key={`lado-${i}`}>
        <span className="desarrollo__etq">{`${d.lado} ${i + 1}`}</span>
        <input
          type="number"
          step="0.1"
          min="0"
          aria-label={`${d.lado} ${i + 1}`}
          placeholder="—"
          value={mostrarMm(lado.longitud_mm, unidades)}
          onChange={(e) => setLado(i, { longitud_mm: e.target.value === '' ? 0 : unidadMostradaAMm(Number(e.target.value), unidades) })}
        />
        <span className="desarrollo__u">{u}</span>
        <select
          aria-label={`${d.lado} ${i + 1} — ${d.tipoCota}`}
          value={lado.cota_interior ? 'interior' : 'exterior'}
          onChange={(e) => setLado(i, { cota_interior: e.target.value === 'interior' })}
        >
          <option value="exterior">{d.cotaExterior}</option>
          <option value="interior">{d.cotaInterior}</option>
        </select>
        {exterior != null && <span className="desarrollo__ext">{d.exteriorCalculado(formatearLongitud(exterior, unidades))}</span>}
      </div>
    );
  };

  /** Filas del pliegue i: una para el ángulo y otra para el radio interior. */
  const filasPliegue = (i: number) => {
    const p = res.pliegues[i];
    const geom = datos.desarrollo.pliegues[i];
    return [
      <div className="desarrollo__fila desarrollo__fila--pliegue" key={`ang-${i}`}>
        <span className="desarrollo__etq desarrollo__etq--pliegue">{`${d.angulo} ${i + 1}`}</span>
        <input
          type="number"
          step="1"
          min="0"
          max="180"
          aria-label={`${d.angulo} ${i + 1}`}
          placeholder={String(opciones.anguloDefecto)}
          value={geom?.angulo_grados ?? ''}
          onChange={(e) => setPliegue(i, { angulo_grados: e.target.value === '' ? null : Number(e.target.value) })}
        />
        <span className="desarrollo__u">°</span>
        <em className={p?.anguloExtraido ? 'origen origen--plano' : 'origen'}>{p?.anguloExtraido ? d.delPlano : d.porDefecto}</em>
      </div>,
      <div className="desarrollo__fila desarrollo__fila--pliegue" key={`rad-${i}`}>
        <span className="desarrollo__etq desarrollo__etq--pliegue">{`${d.radio} ${i + 1}`}</span>
        <input
          type="number"
          step="0.1"
          min="0"
          aria-label={`${d.radio} ${i + 1}`}
          placeholder={radioDefectoMostrado}
          value={geom?.radio_mm != null ? mostrarMm(geom.radio_mm, unidades) : ''}
          onChange={(e) => setPliegue(i, { radio_mm: e.target.value === '' ? null : unidadMostradaAMm(Number(e.target.value), unidades) })}
        />
        <span className="desarrollo__u">{u}</span>
        <em className={p?.radioExtraido ? 'origen origen--plano' : 'origen'}>{p?.radioExtraido ? d.delPlano : d.porDefecto}</em>
        {p && <span className="desarrollo__babd">{`${d.baPorPliegue} ${formatearLongitud(p.baMm, unidades)} · ${d.bdPorPliegue} ${formatearLongitud(p.bdMm, unidades)}`}</span>}
      </div>,
    ];
  };

  return (
    <fieldset className="grupo">
      <legend>
        <IconoDesarrollo tamano={14} /> {d.titulo}
      </legend>
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

      {/* Perfil en orden: cara 1, ángulo 1, radio 1, cara 2, ... */}
      <div className="desarrollo__lista">
        {Array.from({ length: numLados }, (_, i) => [filaLado(i), ...(i < numPliegues ? filasPliegue(i) : [])])}
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
