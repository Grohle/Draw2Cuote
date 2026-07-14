import type { Idioma } from './i18n';
import { presetDe, type IdProveedor } from './proveedores';

export interface AjustesApp {
  proveedor: IdProveedor;
  apiKey: string;
  baseUrl: string;
  modelo: string;
  /** Segunda pasada de razonamiento tras el scan (verifica coherencia y revisa lo dudoso). */
  revisar: boolean;
  /** OCR de la imagen como texto de referencia en el prompt (solo imágenes; requiere tesseract.js). */
  ocr: boolean;
}

const CLAVE_STORAGE = 'draw2quote.ajustes';

export function ajustesPorDefecto(): AjustesApp {
  return { proveedor: 'anthropic', apiKey: '', baseUrl: '', modelo: presetDe('anthropic').modeloDefecto, revisar: true, ocr: false };
}

export function cargarAjustes(): AjustesApp {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (crudo) {
      const p = JSON.parse(crudo) as Partial<AjustesApp>;
      const proveedor = (p.proveedor as IdProveedor) ?? 'anthropic'; // migración desde la versión de un solo proveedor
      return {
        proveedor,
        apiKey: p.apiKey ?? '',
        baseUrl: p.baseUrl ?? '',
        modelo: p.modelo ?? presetDe(proveedor).modeloDefecto,
        revisar: p.revisar !== false, // por defecto activo (migración)
        ocr: p.ocr === true, // por defecto desactivado (migración)
      };
    }
  } catch {
    // storage corrupto o inaccesible: se ignora
  }
  return ajustesPorDefecto();
}

export function guardarAjustes(ajustes: AjustesApp): void {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(ajustes));
}

/** Configuración que viaja al servidor con cada análisis / prueba de conexión */
export function configApi(ajustes: AjustesApp, idioma: Idioma, alias?: Record<string, string[]>, camposExtra?: string[]) {
  return {
    proveedor: ajustes.proveedor,
    apiKey: ajustes.apiKey || undefined,
    baseUrl: ajustes.baseUrl || undefined,
    modelo: ajustes.modelo || undefined,
    idioma,
    alias,
    camposExtra,
    revisar: ajustes.revisar,
    ocr: ajustes.ocr,
  };
}

/** true si con estos ajustes la app funcionará en modo demo (sin credenciales) */
export function esModoDemo(ajustes: AjustesApp, serverKey: boolean): boolean {
  return ajustes.proveedor === 'anthropic' && !ajustes.apiKey && !serverKey;
}
