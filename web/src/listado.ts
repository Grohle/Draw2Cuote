import { calcularPresupuesto, type ResultadoPresupuesto } from './presupuesto';
import type { Textos } from './i18n';
import { normalizarExtraccion } from './normalizar';
import type { Tarifas } from './tarifas';
import type { Extraccion } from './tipos';
import { etiquetaLongitud, mmAUnidadMostrada, type SistemaUnidades } from './unidades';

/** Un elemento del listado = una pieza analizada (instantánea de su extracción). */
export interface ItemListado {
  id: string;
  datos: Extraccion;
}

const CLAVE_STORAGE = 'draw2quote.listado';

export function cargarListado(): ItemListado[] {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (crudo) {
      const arr = JSON.parse(crudo);
      if (Array.isArray(arr)) {
        return arr
          .filter((it) => it && typeof it === 'object' && it.datos)
          .map((it) => ({ id: String(it.id ?? crypto.randomUUID()), datos: normalizarExtraccion(it.datos) }));
      }
    }
  } catch {
    // storage corrupto o inaccesible: se ignora
  }
  return [];
}

export function guardarListado(items: ItemListado[]): void {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(items));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ColumnaExport {
  id: string;
  cabecera: string;
  /** Valor de la celda: string, number o null (celda vacía). */
  valor: (datos: Extraccion, pres: ResultadoPresupuesto) => string | number | null;
}

/** Definición de columnas del export, en orden. Los valores de dimensión se dan en la unidad mostrada. */
function columnas(t: Textos, unidades: SistemaUnidades): ColumnaExport[] {
  const u = etiquetaLongitud(unidades);
  const texto = (clave: keyof Extraccion) => (d: Extraccion) => {
    const campo = d[clave] as { valor?: unknown } | undefined;
    const v = campo?.valor;
    return typeof v === 'string' && v.trim() ? v : null;
  };
  const numero = (clave: keyof Extraccion) => (d: Extraccion) => {
    const campo = d[clave] as { valor?: unknown } | undefined;
    return typeof campo?.valor === 'number' ? (campo.valor as number) : null;
  };
  const longitud = (clave: keyof Extraccion) => (d: Extraccion) => {
    const campo = d[clave] as { valor?: unknown } | undefined;
    return typeof campo?.valor === 'number' ? round2(mmAUnidadMostrada(campo.valor as number, unidades)) : null;
  };

  return [
    { id: 'numero_plano', cabecera: t.campos.numero_plano, valor: texto('numero_plano') },
    { id: 'proyecto', cabecera: t.campos.proyecto, valor: texto('proyecto') },
    { id: 'denominacion', cabecera: t.campos.denominacion, valor: texto('denominacion') },
    { id: 'marca', cabecera: t.campos.marca, valor: texto('marca') },
    { id: 'revision', cabecera: t.campos.revision, valor: texto('revision') },
    { id: 'tipo_pieza', cabecera: t.campos.tipo_pieza, valor: (d) => (d.tipo_pieza.valor ? t.tiposPieza[d.tipo_pieza.valor] : null) },
    { id: 'material_familia', cabecera: t.campos.material_familia, valor: (d) => (d.material_familia.valor ? t.familias[d.material_familia.valor] : null) },
    { id: 'material_calidad', cabecera: t.campos.material_calidad, valor: texto('material_calidad') },
    { id: 'acabado', cabecera: t.campos.acabado, valor: texto('acabado') },
    { id: 'largo_mm', cabecera: `${t.campos.largo_mm} (${u})`, valor: longitud('largo_mm') },
    { id: 'ancho_mm', cabecera: `${t.campos.ancho_mm} (${u})`, valor: longitud('ancho_mm') },
    { id: 'alto_mm', cabecera: `${t.campos.alto_mm} (${u})`, valor: longitud('alto_mm') },
    { id: 'diametro_max_mm', cabecera: `${t.campos.diametro_max_mm} (${u})`, valor: longitud('diametro_max_mm') },
    { id: 'espesor_mm', cabecera: `${t.campos.espesor_mm} (${u})`, valor: longitud('espesor_mm') },
    { id: 'tolerancia_general', cabecera: t.campos.tolerancia_general, valor: texto('tolerancia_general') },
    { id: 'tolerancias_criticas', cabecera: t.campos.tolerancias_criticas, valor: texto('tolerancias_criticas') },
    { id: 'num_pliegues', cabecera: t.campos.num_pliegues, valor: numero('num_pliegues') },
    { id: 'num_agujeros', cabecera: t.campos.num_agujeros, valor: numero('num_agujeros') },
    { id: 'roscas', cabecera: t.campos.roscas, valor: texto('roscas') },
    { id: 'cantidad', cabecera: t.campos.cantidad, valor: numero('cantidad') },
    { id: 'precio_unitario', cabecera: t.listado.precioUnitario, valor: (_d, pres) => (pres.calculable ? round2(pres.precioUnitario) : null) },
    { id: 'total', cabecera: t.listado.totalPieza, valor: (_d, pres) => (pres.calculable ? round2(pres.totalLote) : null) },
  ];
}

export interface TablaExport {
  cabeceras: string[];
  filas: (string | number)[][];
  totalGeneral: number;
}

/**
 * Construye la tabla de export incluyendo SOLO las columnas con algún valor en
 * alguna fila (las columnas totalmente vacías se omiten). Devuelve también el
 * total general (suma de los totales de lote de cada pieza calculable).
 */
export function construirTabla(items: ItemListado[], tarifas: Tarifas, t: Textos, unidades: SistemaUnidades): TablaExport {
  const cols = columnas(t, unidades);
  const presPorItem = items.map((it) => calcularPresupuesto(it.datos, tarifas, t, unidades));
  const valores = items.map((it, i) => cols.map((c) => c.valor(it.datos, presPorItem[i])));

  // columnas con contenido: al menos una fila con valor no nulo/no vacío
  const indicesConContenido = cols
    .map((_, ci) => ci)
    .filter((ci) => valores.some((fila) => fila[ci] !== null && fila[ci] !== ''));

  const cabeceras = indicesConContenido.map((ci) => cols[ci].cabecera);
  const filas = valores.map((fila) => indicesConContenido.map((ci) => fila[ci] ?? ''));
  const totalGeneral = presPorItem.reduce((s, pres) => s + (pres.calculable ? pres.totalLote : 0), 0);
  return { cabeceras, filas, totalGeneral };
}

function escaparCsv(valor: string | number): string {
  const s = String(valor);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con delimitador coma y decimales con punto (portable). */
export function tablaACsv(tabla: TablaExport): string {
  const lineas = [tabla.cabeceras.map(escaparCsv).join(',')];
  for (const fila of tabla.filas) lineas.push(fila.map(escaparCsv).join(','));
  return lineas.join('\n');
}

function escaparHtml(valor: string | number): string {
  return String(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Tabla HTML que Excel abre como hoja de cálculo (.xls, application/vnd.ms-excel). */
export function tablaAExcelHtml(tabla: TablaExport, titulo: string): string {
  const th = tabla.cabeceras.map((c) => `<th>${escaparHtml(c)}</th>`).join('');
  const filas = tabla.filas
    .map((fila) => `<tr>${fila.map((v) => `<td>${escaparHtml(v)}</td>`).join('')}</tr>`)
    .join('');
  return `<html><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title></head><body><table border="1">
<thead><tr>${th}</tr></thead><tbody>${filas}</tbody></table></body></html>`;
}
