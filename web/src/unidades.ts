export type SistemaUnidades = 'metrico' | 'imperial';

const MM_POR_PULGADA = 25.4;
const KG_POR_LIBRA = 0.45359237;

export function mmAUnidadMostrada(mm: number, sistema: SistemaUnidades): number {
  return sistema === 'imperial' ? mm / MM_POR_PULGADA : mm;
}

export function unidadMostradaAMm(valor: number, sistema: SistemaUnidades): number {
  return sistema === 'imperial' ? valor * MM_POR_PULGADA : valor;
}

export function kgAUnidadMostrada(kg: number, sistema: SistemaUnidades): number {
  return sistema === 'imperial' ? kg / KG_POR_LIBRA : kg;
}

export function precioPorKgAUnidadMostrada(precioKg: number, sistema: SistemaUnidades): number {
  return sistema === 'imperial' ? precioKg * KG_POR_LIBRA : precioKg;
}

export function etiquetaLongitud(sistema: SistemaUnidades): string {
  return sistema === 'imperial' ? 'in' : 'mm';
}

export function etiquetaPeso(sistema: SistemaUnidades): string {
  return sistema === 'imperial' ? 'lb' : 'kg';
}

/** Redondeo razonable para mostrar: más decimales en pulgadas (valores típicamente < 20) que en mm. */
export function formatearLongitud(mm: number, sistema: SistemaUnidades): string {
  const valor = mmAUnidadMostrada(mm, sistema);
  const decimales = sistema === 'imperial' ? 3 : 1;
  return `${Number(valor.toFixed(decimales))} ${etiquetaLongitud(sistema)}`;
}

export function formatearPeso(kg: number, sistema: SistemaUnidades): string {
  const valor = kgAUnidadMostrada(kg, sistema);
  return `${valor.toFixed(2)} ${etiquetaPeso(sistema)}`;
}

/** Convierte una lista de valores canónicos en mm a la unidad mostrada, para sugerencias en <datalist>. */
export function listaLongitudMostrada(valoresMm: number[], sistema: SistemaUnidades): number[] {
  const decimales = sistema === 'imperial' ? 3 : 2;
  return valoresMm.map((mm) => Number(mmAUnidadMostrada(mm, sistema).toFixed(decimales)));
}

const CLAVE_STORAGE_UNIDADES = 'draw2quote.unidades';

export function cargarUnidades(): SistemaUnidades {
  const guardado = localStorage.getItem(CLAVE_STORAGE_UNIDADES);
  return guardado === 'imperial' ? 'imperial' : 'metrico';
}

export function guardarUnidades(sistema: SistemaUnidades): void {
  localStorage.setItem(CLAVE_STORAGE_UNIDADES, sistema);
}
