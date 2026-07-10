export type Confianza = 'alta' | 'media' | 'baja';

export interface Campo<T> {
  valor: T | null;
  confianza: Confianza;
  /** true cuando el usuario ha corregido el valor a mano */
  editado?: boolean;
}

export type FamiliaMaterial =
  | 'acero_carbono'
  | 'acero_inoxidable'
  | 'aluminio'
  | 'galvanizado'
  | 'cobre_laton'
  | 'titanio'
  | 'plastico'
  | 'madera'
  | 'vidrio'
  | 'composite'
  | 'ceramica'
  | 'caucho'
  | 'otro';

export type TipoPieza =
  | 'chapa_plegada'
  | 'corte_laser'
  | 'torneado'
  | 'fresado'
  | 'tubo_perfil'
  | 'impresion_3d'
  | 'inyeccion'
  | 'fundicion'
  | 'extrusion'
  | 'termoformado'
  | 'carpinteria'
  | 'otro';

export interface Extraccion {
  tipo_pieza: Campo<TipoPieza>;
  numero_plano: Campo<string>;
  proyecto: Campo<string>;
  denominacion: Campo<string>;
  marca: Campo<string>;
  revision: Campo<string>;
  largo_mm: Campo<number>;
  ancho_mm: Campo<number>;
  alto_mm: Campo<number>;
  diametro_max_mm: Campo<number>;
  espesor_mm: Campo<number>;
  material_familia: Campo<FamiliaMaterial>;
  material_calidad: Campo<string>;
  acabado: Campo<string>;
  cantidad: Campo<number>;
  tolerancia_general: Campo<string>;
  tolerancias_criticas: Campo<string>;
  num_pliegues: Campo<number>;
  num_agujeros: Campo<number>;
  roscas: Campo<string>;
  /** Sistema de unidades en que está acotado el plano (las cotas se guardan siempre en mm). */
  sistema_unidades: 'metrico' | 'imperial' | null;
  desarrollo: DesarrolloGeom;
  observaciones: string[];
}

export interface PliegueGeom {
  /** Ángulo de doblado en grados. null si no se leyó del plano. */
  angulo_grados: number | null;
  /** Radio interior de doblado en mm. null si no se leyó del plano. */
  radio_mm: number | null;
}

export interface DesarrolloGeom {
  /** Longitudes de los tramos rectos (lados) entre pliegues, en mm y en orden. */
  lados_mm: number[];
  /** Geometría por pliegue (ángulo y radio). */
  pliegues: PliegueGeom[];
}

export interface RespuestaExtraccion {
  demo: boolean;
  datos: Extraccion;
}

export interface Aviso {
  campo: keyof Extraccion | 'general';
  mensaje: string;
}

export interface EstadisticaCampo {
  campo: string;
  vecesVisto: number;
  vecesCorregido: number;
  tasaCorreccion: number;
  porConfianza: Record<Confianza, { visto: number; corregido: number }>;
}

export interface Estadisticas {
  totalAnalisisConFeedback: number;
  campos: EstadisticaCampo[];
}
