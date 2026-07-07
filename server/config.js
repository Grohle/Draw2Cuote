import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// La configuración del usuario se guarda automáticamente en un único JSON.
// En la versión de escritorio (.exe) este archivo es la fuente de verdad y
// persiste entre sesiones; en la versión web es el respaldo durable de las
// preferencias guardadas también en el navegador.
const here = path.dirname(fileURLToPath(import.meta.url));
const DIR_DATOS = path.join(here, 'datos');
export const RUTA_CONFIG = path.join(DIR_DATOS, 'config.json');

export function leerConfig() {
  try {
    const crudo = fs.readFileSync(RUTA_CONFIG, 'utf8');
    const cfg = JSON.parse(crudo);
    return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
  } catch {
    // no existe todavía o está corrupto: se parte de vacío
    return {};
  }
}

export function guardarConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('config debe ser un objeto');
  }
  fs.mkdirSync(DIR_DATOS, { recursive: true });
  // escritura atómica: se escribe en un temporal y se renombra, para no dejar
  // el archivo a medias si el proceso muere durante la escritura
  const tmp = `${RUTA_CONFIG}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
  fs.renameSync(tmp, RUTA_CONFIG);
  return config;
}
