import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * Carpeta donde se guardan los datos del usuario (config.json, feedback.jsonl...).
 * Por defecto server/datos. La app de escritorio la redirige con la variable de
 * entorno DRAW2QUOTE_DATOS al perfil del usuario, fuera del paquete instalado
 * (que es de solo lectura).
 */
export function dirDatos() {
  return process.env.DRAW2QUOTE_DATOS || path.join(AQUI, 'datos');
}
