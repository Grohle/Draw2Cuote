import type { Extraccion } from './tipos';

/**
 * Cálculo de desarrollo (desplegado) de chapa plegada.
 *
 * El desarrollo de una pieza plegada = suma de los tramos rectos + el arco de
 * material de cada pliegue (bend allowance). La posición de la fibra neutra se
 * expresa con el factor K (fracción del espesor a la que queda la fibra neutra
 * desde la cara interior). Por defecto se estima K a partir de R/espesor
 * (fibra neutra); opcionalmente el usuario fija un factor K manual.
 *
 *   BA (bend allowance)  = ángulo · (R + K·T)
 *   SB (setback)         = (R + T) · tan(ángulo/2)
 *   BD (bend deduction)  = 2·SB − BA
 *
 * Todas las longitudes en milímetros (unidad canónica); la UI convierte al
 * sistema mostrado. Ángulo = ángulo de doblado (90° para un pliegue recto).
 */

export type MetodoDesplegado = 'fibra_neutra' | 'factor_k';

export interface OpcionesDesplegado {
  metodo: MetodoDesplegado;
  /** Factor K manual (0–1), usado solo con metodo = 'factor_k'. */
  factorK: number;
  /** Ángulo de doblado por defecto, en grados. */
  anguloDefecto: number;
  /** Radio interior por defecto = factorRadio × espesor. */
  factorRadio: number;
}

export const DESPLEGADO_DEFECTO: OpcionesDesplegado = {
  metodo: 'fibra_neutra',
  factorK: 0.446,
  anguloDefecto: 90,
  factorRadio: 1,
};

/**
 * Estimación de la posición de la fibra neutra (factor K) en función de R/T.
 * Aproximación monótona del comportamiento habitual (DIN 6935 / tablas de CAD):
 * K crece de ~0.33 con radios pequeños a ~0.5 con radios grandes.
 */
export function kFibraNeutra(radioMm: number, espesorMm: number): number {
  if (espesorMm <= 0) return 0.44;
  const ratio = radioMm / espesorMm;
  if (ratio <= 0.65) return 0.33;
  if (ratio >= 3.5) return 0.5;
  return 0.33 + (0.5 - 0.33) * ((ratio - 0.65) / (3.5 - 0.65));
}

export interface CalculoPliegue {
  /** Factor K efectivo aplicado. */
  k: number;
  radioMm: number;
  anguloGrados: number;
  /** Bend allowance: arco de material del pliegue, en mm. */
  baMm: number;
  /** Setback, en mm. */
  sbMm: number;
  /** Bend deduction, en mm. */
  bdMm: number;
}

const aRad = (grados: number) => (grados * Math.PI) / 180;

export function calcularPliegue(
  espesorMm: number,
  radioMm: number,
  anguloGrados: number,
  opciones: OpcionesDesplegado
): CalculoPliegue {
  const k = opciones.metodo === 'factor_k' ? opciones.factorK : kFibraNeutra(radioMm, espesorMm);
  const a = aRad(anguloGrados);
  const baMm = a * (radioMm + k * espesorMm);
  const sbMm = (radioMm + espesorMm) * Math.tan(a / 2);
  const bdMm = 2 * sbMm - baMm;
  return { k, radioMm, anguloGrados, baMm, sbMm, bdMm };
}

/** Cálculo de un pliegue con su ángulo/radio resueltos (del plano o por defecto). */
export interface PliegueCalc extends CalculoPliegue {
  indice: number;
  /** El ángulo venía acotado en el plano (no es el valor por defecto). */
  anguloExtraido: boolean;
  /** El radio venía acotado en el plano (no es el valor por defecto). */
  radioExtraido: boolean;
}

export interface Desarrollo {
  /** Pieza de chapa con al menos un pliegue: procede calcular desarrollo. */
  aplica: boolean;
  /** Además hay espesor conocido: el cálculo tiene sentido numérico. */
  calculable: boolean;
  numPliegues: number;
  /** Cálculo por pliegue (uno por doblado). */
  pliegues: PliegueCalc[];
  /** Longitudes de los lados (tramos rectos) usadas, en mm. */
  ladosMm: number[];
  /** Hay al menos un lado con longitud: se puede sumar el desarrollo. */
  tieneLados: boolean;
  /** Suma de bend deductions de todos los pliegues, en mm. */
  sumaBdMm: number;
  /** Largo desarrollado (a) = Σ lados − Σ bend deduction, en mm. null si no hay lados. */
  largoDesarrolladoMm: number | null;
  /** Ancho (b), sin pliegues en ese eje, en mm. */
  anchoMm: number | null;
}

/** Ángulo efectivo de un pliegue: el acotado en el plano, o el valor por defecto. */
export function anguloDePliegue(p: { angulo_grados: number | null } | undefined, opciones: OpcionesDesplegado): number {
  return p && p.angulo_grados != null ? p.angulo_grados : opciones.anguloDefecto;
}

/** Radio interior efectivo de un pliegue: el acotado en el plano, o = espesor·factorRadio. */
export function radioDePliegue(
  p: { radio_mm: number | null } | undefined,
  espesorMm: number | null,
  opciones: OpcionesDesplegado
): number {
  return p && p.radio_mm != null ? p.radio_mm : radioPorDefecto(espesorMm, opciones);
}

/**
 * Desarrollo (desplegado) a partir de la geometría extraída del plano: los
 * lados (tramos rectos) y, por pliegue, su ángulo y radio interior.
 *   desarrollo (a) = Σ lados − Σ bend deduction    (cotas exteriores)
 * Cada pliegue usa su ángulo/radio del plano; si faltan, 90° y radio = espesor.
 */
export function calcularDesarrollo(datos: Extraccion, opciones: OpcionesDesplegado): Desarrollo {
  const numPliegues = datos.num_pliegues.valor ?? datos.desarrollo.pliegues.length;
  const espesor = datos.espesor_mm.valor;
  const ladosMm = datos.desarrollo.lados_mm;
  const aplica = datos.tipo_pieza.valor === 'chapa_plegada' && numPliegues >= 1;
  const calculable = aplica && espesor != null && espesor > 0;

  if (!calculable || espesor == null) {
    return { aplica, calculable: false, numPliegues, pliegues: [], ladosMm, tieneLados: false, sumaBdMm: 0, largoDesarrolladoMm: null, anchoMm: datos.ancho_mm.valor };
  }

  const pliegues: PliegueCalc[] = [];
  for (let i = 0; i < numPliegues; i++) {
    const p = datos.desarrollo.pliegues[i];
    const anguloExtraido = !!p && p.angulo_grados != null;
    const radioExtraido = !!p && p.radio_mm != null;
    const angulo = anguloDePliegue(p, opciones);
    const radio = radioDePliegue(p, espesor, opciones);
    pliegues.push({ indice: i, anguloExtraido, radioExtraido, ...calcularPliegue(espesor, radio, angulo, opciones) });
  }

  const sumaBdMm = pliegues.reduce((s, p) => s + p.bdMm, 0);
  const sumaLados = ladosMm.reduce((s, l) => s + l, 0);
  const tieneLados = sumaLados > 0;
  const largoDesarrolladoMm = tieneLados ? sumaLados - sumaBdMm : null;
  return { aplica, calculable: true, numPliegues, pliegues, ladosMm, tieneLados, sumaBdMm, largoDesarrolladoMm, anchoMm: datos.ancho_mm.valor };
}

/** Radio interior por defecto según las opciones y el espesor. */
export function radioPorDefecto(espesorMm: number | null, opciones: OpcionesDesplegado): number {
  const t = espesorMm && espesorMm > 0 ? espesorMm : 1;
  return Number((t * opciones.factorRadio).toFixed(2));
}

const CLAVE_STORAGE = 'draw2quote.desplegado';

export function cargarDesplegado(): OpcionesDesplegado {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (crudo) {
      const p = JSON.parse(crudo) as Partial<OpcionesDesplegado>;
      return {
        metodo: p.metodo === 'factor_k' ? 'factor_k' : 'fibra_neutra',
        factorK: typeof p.factorK === 'number' ? p.factorK : DESPLEGADO_DEFECTO.factorK,
        anguloDefecto: typeof p.anguloDefecto === 'number' ? p.anguloDefecto : DESPLEGADO_DEFECTO.anguloDefecto,
        factorRadio: typeof p.factorRadio === 'number' ? p.factorRadio : DESPLEGADO_DEFECTO.factorRadio,
      };
    }
  } catch {
    // storage corrupto o inaccesible: se ignora
  }
  return DESPLEGADO_DEFECTO;
}

export function guardarDesplegado(opciones: OpcionesDesplegado): void {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(opciones));
}
