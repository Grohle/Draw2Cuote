import type { AjustesApp } from './ajustes';
import type { CamposPersonalizados } from './camposPersonalizados';
import type { Idioma } from './i18n';
import type { Tarifas } from './tarifas';
import type { SistemaUnidades } from './unidades';

/**
 * Instantánea completa de la configuración del usuario que se guarda
 * automáticamente en un único JSON en el servidor (server/datos/config.json).
 * NO incluye la clave de API: es una credencial, no una preferencia, y se
 * queda solo en el navegador (localStorage).
 */
export interface ConfigCompleta {
  version: 1;
  idioma: Idioma;
  unidades: SistemaUnidades;
  ajustes: Omit<AjustesApp, 'apiKey'>;
  tarifas: Tarifas;
  camposPersonalizados: CamposPersonalizados;
}

let temporizador: ReturnType<typeof setTimeout> | undefined;

/** Guarda la config en el archivo del servidor, con rebote para no saturar en cada tecla. */
export function guardarConfigArchivo(config: ConfigCompleta): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    }).catch(() => {
      // el guardado del archivo es best-effort; el navegador ya tiene la copia en localStorage
    });
  }, 600);
}

/** Lee la config guardada en el archivo del servidor (o null si no hay / falla). */
export async function cargarConfigArchivo(): Promise<Partial<ConfigCompleta> | null> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return null;
    const cfg = await res.json();
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : null;
  } catch {
    return null;
  }
}

/** true si el navegador aún no tiene ninguna preferencia guardada (arranque limpio). */
export function sinPreferenciasLocales(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('draw2quote.')) return false;
    }
  } catch {
    return false;
  }
  return true;
}
