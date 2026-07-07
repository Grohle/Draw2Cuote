import type { Idioma } from './i18n';
import { presetDe, type IdProveedor } from './proveedores';

export interface AjustesApp {
  proveedor: IdProveedor;
  apiKey: string;
  baseUrl: string;
  modelo: string;
}

const CLAVE_STORAGE = 'draw2quote.ajustes';

export function ajustesPorDefecto(): AjustesApp {
  return { proveedor: 'anthropic', apiKey: '', baseUrl: '', modelo: presetDe('anthropic').modeloDefecto };
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
export function configApi(ajustes: AjustesApp, idioma: Idioma) {
  return {
    proveedor: ajustes.proveedor,
    apiKey: ajustes.apiKey || undefined,
    baseUrl: ajustes.baseUrl || undefined,
    modelo: ajustes.modelo || undefined,
    idioma,
  };
}

/** true si con estos ajustes la app funcionará en modo demo (sin credenciales) */
export function esModoDemo(ajustes: AjustesApp, serverKey: boolean): boolean {
  return ajustes.proveedor === 'anthropic' && !ajustes.apiKey && !serverKey;
}
