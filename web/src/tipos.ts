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
  | 'otro';

export interface Extraccion {
  numero_plano: Campo<string>;
  denominacion: Campo<string>;
  revision: Campo<string>;
  largo_mm: Campo<number>;
  ancho_mm: Campo<number>;
  espesor_mm: Campo<number>;
  material_familia: Campo<FamiliaMaterial>;
  material_calidad: Campo<string>;
  acabado: Campo<string>;
  cantidad: Campo<number>;
  tolerancia_general: Campo<string>;
  num_pliegues: Campo<number>;
  num_agujeros: Campo<number>;
  observaciones: string[];
}

export interface RespuestaExtraccion {
  demo: boolean;
  datos: Extraccion;
}

export interface Aviso {
  campo: keyof Extraccion | 'general';
  mensaje: string;
}
