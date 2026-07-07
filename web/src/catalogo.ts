import type { Textos } from './i18n';
import type { FamiliaMaterial, TipoPieza } from './tipos';

const VALORES_TIPO_PIEZA: TipoPieza[] = ['chapa_plegada', 'torneado', 'fresado', 'tubo_perfil', 'otro'];
const VALORES_FAMILIA: FamiliaMaterial[] = ['acero_carbono', 'acero_inoxidable', 'aluminio', 'galvanizado', 'otro'];

export function tiposPiezaOpciones(t: Textos): { valor: TipoPieza; etiqueta: string }[] {
  return VALORES_TIPO_PIEZA.map((v) => ({ valor: v, etiqueta: t.tiposPieza[v] }));
}

export function familiasOpciones(t: Textos): { valor: FamiliaMaterial; etiqueta: string }[] {
  return VALORES_FAMILIA.map((v) => ({ valor: v, etiqueta: t.familias[v] }));
}

export function etiquetaFamilia(v: FamiliaMaterial | null, t: Textos): string {
  return v ? t.familias[v] : '—';
}

/**
 * Qué campos aplican a cada tipo de pieza. Con tipo desconocido u "otro"
 * se muestran todos para no ocultar información.
 */
export function campoAplica(campo: string, tipo: TipoPieza | null): boolean {
  if (tipo == null || tipo === 'otro') return true;
  switch (campo) {
    case 'ancho_mm':
      return tipo !== 'torneado';
    case 'alto_mm':
      return tipo === 'fresado';
    case 'diametro_max_mm':
      return tipo === 'torneado' || tipo === 'tubo_perfil';
    case 'espesor_mm':
      return tipo === 'chapa_plegada' || tipo === 'tubo_perfil';
    case 'num_pliegues':
      return tipo === 'chapa_plegada';
    default:
      return true;
  }
}

/** Espesores comerciales habituales de chapa, en milímetros (unidad canónica). */
export const ESPESORES_ESTANDAR = [0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25];

/** Calidades habituales por familia — códigos técnicos universales, no se traducen. */
export const CALIDADES: Record<FamiliaMaterial, string[]> = {
  acero_carbono: ['S235JR', 'S275JR', 'S355JR', 'DC01', 'DD11'],
  acero_inoxidable: ['AISI 304', 'AISI 316L', 'AISI 430', 'AISI 441'],
  aluminio: ['1050 H24', '5754 H22', '5083 H111', '6082 T6'],
  galvanizado: ['DX51D+Z140', 'DX52D+Z275', 'S250GD+Z275'],
  otro: [],
};

/** Norma de tolerancias — código universal, no se traduce. */
export const TOLERANCIAS = ['ISO 2768-f', 'ISO 2768-m', 'ISO 2768-c', 'ISO 2768-v'];

const ACABADOS_ES = ['Bruto', 'Zincado', 'Galvanizado en caliente', 'Pintado RAL', 'Anodizado', 'Granallado', 'Pulido'];
const ACABADOS_EN = ['Raw / mill finish', 'Zinc plated', 'Hot-dip galvanized', 'RAL painted', 'Anodized', 'Shot blasted', 'Polished'];

export function acabadosSugeridos(idioma: 'es' | 'en'): string[] {
  return idioma === 'en' ? ACABADOS_EN : ACABADOS_ES;
}
