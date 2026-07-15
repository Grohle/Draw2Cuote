import { tablaACsv, type TablaExport } from './listado';
import type { Extraccion } from './tipos';
import { tablaAXlsx } from './xlsx';

/** Dispara la descarga de un Blob como archivo en el navegador. */
export function descargarBlob(nombre: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV con BOM UTF-8 (para que Excel respete los acentos al abrirlo). */
export function descargarCsv(nombre: string, tabla: TablaExport): void {
  descargarBlob(nombre, new Blob(['﻿', tablaACsv(tabla)], { type: 'text/csv;charset=utf-8' }));
}

/** XLSX (Excel real, OOXML). */
export function descargarXlsx(nombre: string, tabla: TablaExport, titulo: string): void {
  descargarBlob(nombre, new Blob([tablaAXlsx(tabla, titulo)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

/** JSON estructurado de una extracción. */
export function descargarJson(nombre: string, datos: Extraccion): void {
  descargarBlob(nombre, new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
}

/** Copia el JSON de una extracción al portapapeles. */
export function copiarJson(datos: Extraccion): void {
  navigator.clipboard.writeText(JSON.stringify(datos, null, 2));
}
