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

/** Las dos cotas generales de la pieza entre las que se reparten los ejes a y b. */
export type EjeDesarrollo = 'largo_mm' | 'ancho_mm';

export interface Desarrollo {
  /** Pieza de chapa con al menos un pliegue: procede calcular desarrollo. */
  aplica: boolean;
  /** Además hay espesor conocido: el cálculo tiene sentido numérico. */
  calculable: boolean;
  numPliegues: number;
  /** Cálculo por pliegue (uno por doblado). */
  pliegues: PliegueCalc[];
  /** Longitud EXTERIOR de cada lado en mm (la interior se convierte sumando espesores adyacentes). */
  ladosExterioresMm: number[];
  /** Hay al menos un lado con longitud: se puede sumar el desarrollo. */
  tieneLados: boolean;
  /** Suma de bend deductions de todos los pliegues, en mm. */
  sumaBdMm: number;
  /** Largo desarrollado (a) = Σ lados exteriores − Σ bend deduction, en mm. null si no hay lados. */
  largoDesarrolladoMm: number | null;
  /**
   * Cota de la pieza que mide la dirección PLEGADA, y a la que por tanto le
   * corresponde el desarrollo (a). null si no se puede determinar.
   */
  ejeDesarrollo: EjeDesarrollo | null;
  /** Ancho (b): la otra cota, paralela a los pliegues, en mm. */
  anchoMm: number | null;
}

/**
 * Margen al comparar una cota con el desarrollo: absorbe los redondeos de
 * lectura del plano (46 leído frente a 46.02 calculado).
 */
const TOLERANCIA_EJE = 1.02;

/**
 * Reparte las dos cotas generales de la pieza entre los dos ejes del
 * desplegado. El desarrollo (a) mide la dirección que CRUZA los pliegues; el
 * ancho (b) es la paralela a ellos, a la que doblar no afecta.
 *
 * Para saber cuál es cuál se comparan las cotas con el desarrollo calculado:
 * doblar solo acorta, así que una cota MAYOR que el desarrollo no puede ser la
 * dirección plegada (de un fleje de 46 mm no sale una pieza de 224 mm de
 * ancho). De las que quepan, la más próxima al desarrollo es la plegada y la
 * otra es b.
 *
 * Si NINGUNA cabe, los datos se contradicen y no se señala eje plegado: sin él
 * el desarrollo no se vuelca a ningún campo, que es lo prudente cuando no
 * cuadra. Aun así b sigue siendo deducible, porque la cota mayor no puede ser
 * la plegada en ningún caso.
 */
export function repartirEjes(
  largoMm: number | null,
  anchoMm: number | null,
  desarrolloMm: number | null
): { ejeDesarrollo: EjeDesarrollo | null; anchoMm: number | null } {
  const candidatos = ([['largo_mm', largoMm], ['ancho_mm', anchoMm]] as const)
    .filter((c): c is readonly [EjeDesarrollo, number] => c[1] != null && c[1] > 0)
    .map(([clave, valor]) => ({ clave, valor }));

  if (desarrolloMm == null || candidatos.length === 0) return { ejeDesarrollo: null, anchoMm: null };

  const caben = candidatos.filter((c) => c.valor <= desarrolloMm * TOLERANCIA_EJE);
  if (caben.length === 0) {
    return { ejeDesarrollo: null, anchoMm: Math.max(...candidatos.map((c) => c.valor)) };
  }

  const plegado = caben.reduce((mejor, c) =>
    Math.abs(c.valor - desarrolloMm) < Math.abs(mejor.valor - desarrolloMm) ? c : mejor
  );
  const otro = candidatos.find((c) => c.clave !== plegado.clave);
  return { ejeDesarrollo: plegado.clave, anchoMm: otro?.valor ?? null };
}

/** Nº de pliegues que tocan el lado i: los lados de los extremos tienen 1, los intermedios 2. */
export function pliguesAdyacentes(indiceLado: number, numLados: number): number {
  return (indiceLado > 0 ? 1 : 0) + (indiceLado < numLados - 1 ? 1 : 0);
}

/**
 * Longitud exterior de un lado. Si la cota del plano es interior, se le suma
 * un espesor por cada pliegue adyacente (una U de espesor 2 con interior 46
 * mide 46+2+2 = 50 por fuera; una pata con un solo pliegue suma un espesor).
 */
export function ladoExteriorMm(lado: { longitud_mm: number; cota_interior: boolean }, indice: number, numLados: number, espesorMm: number): number {
  if (!lado.cota_interior) return lado.longitud_mm;
  return lado.longitud_mm + espesorMm * pliguesAdyacentes(indice, numLados);
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
 * Desarrollo (desplegado) a partir de la geometría extraída del plano: las
 * caras (lados) con su cota interior/exterior y, por pliegue, su ángulo y
 * radio interior.
 *   desarrollo (a) = Σ lados EXTERIORES − Σ bend deduction
 * Las cotas interiores se convierten antes a exteriores (ver ladoExteriorMm).
 * Cada pliegue usa su ángulo/radio del plano; si faltan, 90° y radio = espesor.
 */
export function calcularDesarrollo(datos: Extraccion, opciones: OpcionesDesplegado): Desarrollo {
  const numPliegues = datos.num_pliegues.valor ?? datos.desarrollo.pliegues.length;
  const espesor = datos.espesor_mm.valor;
  const lados = datos.desarrollo.lados;
  const aplica = datos.tipo_pieza.valor === 'chapa_plegada' && numPliegues >= 1;
  const calculable = aplica && espesor != null && espesor > 0;

  if (!calculable || espesor == null) {
    return {
      aplica,
      calculable: false,
      numPliegues,
      pliegues: [],
      ladosExterioresMm: [],
      tieneLados: false,
      sumaBdMm: 0,
      largoDesarrolladoMm: null,
      ejeDesarrollo: null,
      anchoMm: null,
    };
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

  const numLados = numPliegues + 1;
  const ladosExterioresMm = lados.slice(0, numLados).map((l, i) => ladoExteriorMm(l, i, numLados, espesor));

  const sumaBdMm = pliegues.reduce((s, p) => s + p.bdMm, 0);
  const sumaLados = ladosExterioresMm.reduce((s, l) => s + l, 0);
  const tieneLados = sumaLados > 0;
  const largoDesarrolladoMm = tieneLados ? sumaLados - sumaBdMm : null;
  // b no es "el ancho" sin más: es la cota que NO cruza los pliegues, que según
  // la pieza puede ser el largo o el ancho (ver repartirEjes).
  const ejes = repartirEjes(datos.largo_mm.valor, datos.ancho_mm.valor, largoDesarrolladoMm);
  return {
    aplica,
    calculable: true,
    numPliegues,
    pliegues,
    ladosExterioresMm,
    tieneLados,
    sumaBdMm,
    largoDesarrolladoMm,
    ejeDesarrollo: ejes.ejeDesarrollo,
    anchoMm: ejes.anchoMm,
  };
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
