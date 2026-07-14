import type { ArchivoPlano } from './components/Dropzone';
import type { Extraccion, TipoPieza } from './tipos';

/**
 * COLA DE PLANOS: cada archivo subido se convierte en una pieza de la cola.
 * La IA analiza las piezas de una en una (analisis), y mientras tanto un
 * segundo carril va pre-procesando las siguientes (preparacion: hoy, el OCR)
 * para que cada análisis llegue con ese trabajo ya hecho.
 */

/** Estado del análisis con IA de una pieza (el carril principal). */
export type EstadoAnalisis = 'pendiente' | 'analizando' | 'hecho' | 'error';

/** Estado del pre-procesado (OCR) de una pieza (el carril adelantado). */
export type EstadoPreparacion = 'pendiente' | 'encurso' | 'lista' | 'noaplica';

export interface ResultadoPieza {
  datos: Extraccion;
  /** Copia de la extracción tal como llegó, para el feedback (antes → después). */
  datosOriginales: Extraccion;
  demo: boolean;
  revisado: boolean;
}

export interface PiezaCola {
  id: string;
  archivo: ArchivoPlano;
  analisis: EstadoAnalisis;
  preparacion: EstadoPreparacion;
  /** Texto OCR pre-calculado (null = el OCR no dio nada); undefined = aún no pre-procesada. */
  ocrTexto?: string | null;
  resultado?: ResultadoPieza;
  error?: string;
}

export function crearPieza(archivo: ArchivoPlano): PiezaCola {
  return {
    id: crypto.randomUUID(),
    archivo,
    analisis: 'pendiente',
    // el OCR solo aplica a imágenes; los PDF van directos al análisis
    preparacion: archivo.mediaType.startsWith('image/') ? 'pendiente' : 'noaplica',
  };
}

/** Valor del filtro de la lista: todas, solo sin analizar, o un tipo de fabricación. */
export type FiltroCola = 'todas' | 'pendientes' | TipoPieza;

export function pasaFiltro(pieza: PiezaCola, filtro: FiltroCola): boolean {
  if (filtro === 'todas') return true;
  if (filtro === 'pendientes') return pieza.analisis !== 'hecho';
  return pieza.resultado?.datos.tipo_pieza.valor === filtro;
}

/** Tipos de fabricación presentes en los resultados, para poblar el filtro. */
export function tiposPresentes(piezas: PiezaCola[]): TipoPieza[] {
  const tipos = new Set<TipoPieza>();
  for (const p of piezas) {
    const tipo = p.resultado?.datos.tipo_pieza.valor;
    if (tipo) tipos.add(tipo);
  }
  return [...tipos];
}
