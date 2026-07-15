import type { TablaExport } from './listado';

/**
 * Generador de .xlsx (Excel real, OOXML) sin dependencias: un .xlsx es un ZIP
 * con varios XML dentro. Aquí se construye ese ZIP "store" (sin compresión, que
 * Excel acepta igual) y los XML mínimos de un libro con una sola hoja. Es
 * suficiente para exportar el listado de piezas y evita cargar una librería
 * pesada — respeta el principio de "solo tu clave de API, sin más infraestructura".
 *
 * Cabecera en negrita (estilo s="1"); números como número y textos como cadena
 * en línea (inlineStr) para no gestionar una tabla de cadenas compartidas.
 */

// --- CRC32 (necesario en las cabeceras del ZIP) ---
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- Utilidades de bytes ---
const u16 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

function concat(trozos: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = trozos.reduce((n, t) => n + t.length, 0);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const t of trozos) {
    salida.set(t, pos);
    pos += t.length;
  }
  return salida;
}

interface EntradaZip {
  nombre: string;
  datos: Uint8Array;
}

/** Empaqueta los ficheros en un ZIP sin compresión (método "store"), válido como .xlsx. */
function crearZip(entradas: EntradaZip[]): Uint8Array<ArrayBuffer> {
  const cod = new TextEncoder();
  const trozos: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entradas) {
    const nombre = cod.encode(e.nombre);
    const crc = crc32(e.datos);
    const tam = e.datos.length;

    const cabLocal = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(tam), ...u32(tam), ...u16(nombre.length), ...u16(0),
    ]);
    trozos.push(cabLocal, nombre, e.datos);

    central.push(
      Uint8Array.from([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(tam), ...u32(tam), ...u16(nombre.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
      ]),
      nombre
    );
    offset += cabLocal.length + nombre.length + tam;
  }

  const dirCentral = concat(central);
  const fin = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entradas.length), ...u16(entradas.length),
    ...u32(dirCentral.length), ...u32(offset), ...u16(0),
  ]);
  return concat([...trozos, dirCentral, fin]);
}

// --- Construcción de los XML de la hoja ---
const xmlEscapar = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Índice de columna 0 → "A", 25 → "Z", 26 → "AA"... */
function letraColumna(indice: number): string {
  let s = '';
  let n = indice;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function celda(ref: string, valor: string | number, cabecera: boolean): string {
  const estilo = cabecera ? ' s="1"' : '';
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${estilo}><v>${valor}</v></c>`;
  }
  return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xmlEscapar(String(valor))}</t></is></c>`;
}

function hojaXml(tabla: TablaExport): string {
  const filas = [tabla.cabeceras, ...tabla.filas].map((fila, r) => {
    const celdas = fila.map((v, c) => celda(`${letraColumna(c)}${r + 1}`, v, r === 0)).join('');
    return `<row r="${r + 1}">${celdas}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas.join('')}</sheetData></worksheet>`;
}

// --- Ficheros fijos del paquete OOXML ---
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

// dos xf en cellXfs: 0 = normal, 1 = negrita (cabecera)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function workbookXml(nombreHoja: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscapar(nombreHoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

/** Nombre de hoja válido para Excel: sin caracteres prohibidos y máx. 31 caracteres. */
function nombreHojaValido(titulo: string): string {
  const limpio = (titulo || 'Hoja1').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return limpio || 'Hoja1';
}

/** Devuelve el .xlsx (bytes) con la tabla en una sola hoja. */
export function tablaAXlsx(tabla: TablaExport, titulo: string): Uint8Array<ArrayBuffer> {
  const cod = new TextEncoder();
  const f = (s: string) => cod.encode(s);
  return crearZip([
    { nombre: '[Content_Types].xml', datos: f(CONTENT_TYPES) },
    { nombre: '_rels/.rels', datos: f(RELS) },
    { nombre: 'xl/workbook.xml', datos: f(workbookXml(nombreHojaValido(titulo))) },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: f(WORKBOOK_RELS) },
    { nombre: 'xl/styles.xml', datos: f(STYLES) },
    { nombre: 'xl/worksheets/sheet1.xml', datos: f(hojaXml(tabla)) },
  ]);
}
