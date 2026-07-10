import fs from 'node:fs';
import path from 'node:path';
import { dirDatos } from './almacen.js';

// La configuración del usuario se guarda automáticamente en un único JSON.
// En la versión de escritorio (.exe) este archivo es la fuente de verdad y
// persiste entre sesiones; en la versión web es el respaldo durable de las
// preferencias guardadas también en el navegador.
export function rutaConfig() {
  return path.join(dirDatos(), 'config.json');
}

export function leerConfig() {
  try {
    const crudo = fs.readFileSync(rutaConfig(), 'utf8');
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
  fs.mkdirSync(dirDatos(), { recursive: true });
  // escritura atómica: se escribe en un temporal y se renombra, para no dejar
  // el archivo a medias si el proceso muere durante la escritura
  const ruta = rutaConfig();
  const tmp = `${ruta}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2));
  fs.renameSync(tmp, ruta);
  return config;
}
