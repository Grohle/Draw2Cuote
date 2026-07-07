import type { Textos } from './i18n';

/** Claves de los campos estructurados (las mismas que en t.campos). */
export type ClaveCampo = keyof Textos['campos'];

export interface CampoPersonalizado {
  /** Nombre a mostrar en la UI, si el usuario lo ha renombrado. */
  etiqueta?: string;
  /** Rótulos con los que los planos del usuario etiquetan este campo (title, dwg, nº, mark...). */
  alias?: string[];
}

export type CamposPersonalizados = Partial<Record<ClaveCampo, CampoPersonalizado>>;

/** Orden y agrupación de los campos en el editor, coherente con Resultados. */
export const CLAVES_CAMPO: ClaveCampo[] = [
  'tipo_pieza',
  'numero_plano',
  'proyecto',
  'denominacion',
  'marca',
  'revision',
  'largo_mm',
  'ancho_mm',
  'alto_mm',
  'diametro_max_mm',
  'espesor_mm',
  'tolerancia_general',
  'tolerancias_criticas',
  'material_familia',
  'material_calidad',
  'acabado',
  'cantidad',
  'num_pliegues',
  'num_agujeros',
  'roscas',
];

const CLAVE_STORAGE = 'draw2quote.campos';

export function cargarCamposPersonalizados(): CamposPersonalizados {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (crudo) {
      const p = JSON.parse(crudo);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as CamposPersonalizados;
    }
  } catch {
    // storage corrupto o inaccesible: se ignora
  }
  return {};
}

export function guardarCamposPersonalizados(cp: CamposPersonalizados): void {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(cp));
}

/** Etiqueta a mostrar: la personalizada si existe y no está vacía, si no la de por defecto. */
export function etiquetaDe(clave: ClaveCampo, porDefecto: string, cp: CamposPersonalizados): string {
  const custom = cp[clave]?.etiqueta?.trim();
  return custom || porDefecto;
}

/** Alias de un campo como texto separado por comas, para el editor. */
export function aliasComoTexto(clave: ClaveCampo, cp: CamposPersonalizados): string {
  return (cp[clave]?.alias ?? []).join(', ');
}

/** Convierte el texto separado por comas del editor en la lista de alias limpia. */
export function textoAAlias(texto: string): string[] {
  return texto
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

/**
 * Mapa { campo: [alias...] } con solo los campos que tengan alias, tal como se
 * envía al servidor para inyectarlo en el prompt del lector. undefined si no hay.
 */
export function aliasParaServidor(cp: CamposPersonalizados): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const clave of Object.keys(cp) as ClaveCampo[]) {
    const alias = (cp[clave]?.alias ?? []).map((a) => a.trim()).filter(Boolean);
    if (alias.length) out[clave] = alias;
  }
  return Object.keys(out).length ? out : undefined;
}
