export interface AjustesApp {
  apiKey: string;
  modelo: string;
}

const CLAVE_STORAGE = 'draw2quote.ajustes';
export const MODELO_DEFECTO = 'claude-opus-4-8';

export function cargarAjustes(): AjustesApp {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (crudo) {
      const parseado = JSON.parse(crudo) as Partial<AjustesApp>;
      return { apiKey: parseado.apiKey ?? '', modelo: parseado.modelo ?? MODELO_DEFECTO };
    }
  } catch {
    // storage corrupto o inaccesible: se ignora
  }
  return { apiKey: '', modelo: MODELO_DEFECTO };
}

export function guardarAjustes(ajustes: AjustesApp): void {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(ajustes));
}

/** Cabeceras a añadir a las llamadas de análisis según los ajustes guardados */
export function cabecerasApi(ajustes: AjustesApp): Record<string, string> {
  const cabeceras: Record<string, string> = {};
  if (ajustes.apiKey) cabeceras['x-draw2quote-key'] = ajustes.apiKey;
  if (ajustes.modelo) cabeceras['x-draw2quote-model'] = ajustes.modelo;
  return cabeceras;
}
