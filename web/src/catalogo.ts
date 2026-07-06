import type { FamiliaMaterial, TipoPieza } from './tipos';

export const TIPOS_PIEZA: { valor: TipoPieza; etiqueta: string }[] = [
  { valor: 'chapa_plegada', etiqueta: 'Chapa plegada' },
  { valor: 'torneado', etiqueta: 'Torneado' },
  { valor: 'fresado', etiqueta: 'Fresado' },
  { valor: 'tubo_perfil', etiqueta: 'Tubo / perfil' },
  { valor: 'otro', etiqueta: 'Otro' },
];

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

/** Espesores comerciales habituales de chapa (mm) */
export const ESPESORES_ESTANDAR = [
  0.5, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25,
];

export const FAMILIAS: { valor: FamiliaMaterial; etiqueta: string }[] = [
  { valor: 'acero_carbono', etiqueta: 'Acero al carbono' },
  { valor: 'acero_inoxidable', etiqueta: 'Acero inoxidable' },
  { valor: 'aluminio', etiqueta: 'Aluminio' },
  { valor: 'galvanizado', etiqueta: 'Galvanizado' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const etiquetaFamilia = (v: FamiliaMaterial | null): string =>
  FAMILIAS.find((f) => f.valor === v)?.etiqueta ?? '—';

/** Calidades habituales por familia, para el desplegable de ayuda */
export const CALIDADES: Record<FamiliaMaterial, string[]> = {
  acero_carbono: ['S235JR', 'S275JR', 'S355JR', 'DC01', 'DD11'],
  acero_inoxidable: ['AISI 304', 'AISI 316L', 'AISI 430', 'AISI 441'],
  aluminio: ['1050 H24', '5754 H22', '5083 H111', '6082 T6'],
  galvanizado: ['DX51D+Z140', 'DX52D+Z275', 'S250GD+Z275'],
  otro: [],
};

export const TOLERANCIAS = ['ISO 2768-f', 'ISO 2768-m', 'ISO 2768-c', 'ISO 2768-v'];

/** Etiquetas cortas por campo, para el panel de calibración/precisión. */
export const NOMBRES_CAMPO: Record<string, string> = {
  tipo_pieza: 'Tipo de pieza',
  numero_plano: 'Nº de plano',
  denominacion: 'Denominación',
  revision: 'Revisión',
  largo_mm: 'Largo / longitud',
  ancho_mm: 'Ancho',
  alto_mm: 'Alto',
  diametro_max_mm: 'Ø máximo',
  espesor_mm: 'Espesor',
  material_familia: 'Familia de material',
  material_calidad: 'Calidad / grado',
  acabado: 'Acabado',
  cantidad: 'Cantidad',
  tolerancia_general: 'Tolerancia general',
  tolerancias_criticas: 'Tolerancias críticas',
  num_pliegues: 'Pliegues',
  num_agujeros: 'Agujeros',
  roscas: 'Roscas',
};

export const ACABADOS = [
  'Bruto',
  'Zincado',
  'Galvanizado en caliente',
  'Pintado RAL',
  'Anodizado',
  'Granallado',
  'Pulido',
];

/** Texto de ayuda que se muestra junto a cada campo */
export const AYUDAS: Record<string, string> = {
  tipo_pieza: 'Tipo de fabricación detectado en el plano. Determina qué campos aplican: chapa (espesor, pliegues), torneado (diámetro), fresado (alto), tubo (pared).',
  numero_plano: 'Código que identifica el plano, normalmente en el cajetín (esquina inferior derecha).',
  denominacion: 'Nombre de la pieza tal y como figura en el cajetín.',
  revision: 'Índice de revisión del plano (A, B, 01...). Presupuestar siempre sobre la última revisión.',
  largo_mm: 'Longitud total o dimensión mayor de la pieza (desarrollo si es chapa plegada), en milímetros.',
  ancho_mm: 'Dimensión menor de la pieza, en milímetros.',
  alto_mm: 'Tercera dimensión de piezas prismáticas fresadas, en milímetros.',
  diametro_max_mm: 'Diámetro exterior máximo de piezas de revolución o tubo redondo, en milímetros.',
  espesor_mm: 'Espesor de la chapa o de la pared del tubo en mm. Suele indicarse en el cajetín o como nota "e=", "t=" o "#".',
  material_familia: 'Familia del material. Determina precio base, procesos posibles y consumibles.',
  material_calidad: 'Grado concreto del material (S235JR, AISI 304, 5754...). Afecta directamente al coste.',
  acabado: 'Tratamiento superficial posterior al corte/plegado: zincado, galvanizado, pintura RAL, etc.',
  cantidad: 'Número de piezas a presupuestar. Cambia el precio unitario por amortización de preparación.',
  tolerancia_general: 'Norma de tolerancias generales (ISO 2768-m es la habitual). Tolerancias finas encarecen.',
  tolerancias_criticas: 'Tolerancias más exigentes que la general: ajustes ISO (H7, g6...), geométricas (concentricidad, runout, planitud) o cotas con ±. Encarecen el mecanizado.',
  num_pliegues: 'Número de dobleces. Cada pliegue añade tiempo de plegadora al presupuesto.',
  num_agujeros: 'Número total de taladros o punzonados de la pieza.',
  roscas: 'Roscas a mecanizar (métrica y cantidad). Cada rosca añade una operación.',
};
