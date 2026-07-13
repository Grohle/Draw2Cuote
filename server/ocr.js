/**
 * OCR opcional (guardarraíl para modelos menos potentes): reconoce el texto
 * crudo de la imagen del plano con tesseract.js (WASM, sin binarios de sistema)
 * y lo devuelve como un bloque de referencia para inyectar en el prompt, de modo
 * que el modelo pueda cotejar cifras y textos pequeños que suele fallar.
 *
 * tesseract.js es una dependencia OPCIONAL: se carga con import dinámico. Si no
 * está instalada, o el reconocimiento falla, se devuelve null y el análisis
 * sigue sin OCR — no rompe nada ni obliga a instalarla en la versión base.
 * Solo aplica a imágenes rasterizadas (no PDF).
 */

const TIPOS_IMAGEN = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']);
const MAX_TOKENS = 140;
const CONFIANZA_MINIMA = 40;
// Límite total del OCR por imagen. Es imprescindible: si tesseract.js no puede
// descargar los datos de idioma, su promesa de arranque se queda colgada para
// siempre (traga el error con un .catch vacío), así que sin este tope una
// petición se quedaría bloqueada. Configurable por si el equipo es lento.
const LIMITE_MS = Number(process.env.DRAW2QUOTE_OCR_TIMEOUT_MS) || 45000;

let workerPromesa = null; // el worker de tesseract se reutiliza entre peticiones

/** Rechaza si la promesa no se resuelve dentro de `ms`, para no bloquear la petición. */
function conLimite(promesa, ms, etiqueta) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`${etiqueta}: tiempo agotado (${ms} ms)`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

async function obtenerWorker() {
  const { createWorker } = await import('tesseract.js');
  // Por defecto tesseract.js descarga los datos de idioma de su CDN la primera
  // vez (requiere internet). Si el entorno no tiene salida a esa CDN, se puede
  // apuntar a una carpeta local con los .traineddata mediante DRAW2QUOTE_TESSDATA.
  const langPath = process.env.DRAW2QUOTE_TESSDATA || undefined;
  // 'eng' basta para cifras y códigos técnicos (números y letras latinas).
  // El errorHandler es imprescindible: sin él, tesseract.js relanza los fallos
  // (p. ej. de red al bajar los datos) desde el hilo del worker como excepción
  // no capturada, lo que tumbaría el servidor. Con él, el fallo se propaga por
  // la promesa y lo recogemos en el try/catch de ocrImagen.
  return createWorker('eng', undefined, {
    ...(langPath ? { langPath } : {}),
    errorHandler: (err) => console.error('[ocr] tesseract:', err?.message ?? err),
  });
}

/**
 * Devuelve el texto detectado por OCR como una lista compacta de tokens con su
 * posición normalizada (token@(x,y)), o null si no aplica / no está disponible.
 */
export async function ocrImagen({ mediaType, dataBase64 }) {
  if (!TIPOS_IMAGEN.has(mediaType)) return null;
  try {
    workerPromesa ??= obtenerWorker();
    const worker = await conLimite(workerPromesa, LIMITE_MS, 'arranque OCR');
    const { data } = await conLimite(
      worker.recognize(`data:${mediaType};base64,${dataBase64}`),
      LIMITE_MS,
      'reconocimiento OCR',
    );
    return construirBloqueOcr(data);
  } catch (err) {
    console.error('[ocr] no disponible o falló; se continúa sin OCR:', err?.message ?? err);
    workerPromesa = null; // permitir reintentar en la siguiente petición
    return null;
  }
}

/** Convierte el resultado de tesseract en tokens `texto@(x,y)`; si no hay bboxes, usa el texto plano. */
export function construirBloqueOcr(data) {
  const palabras = Array.isArray(data?.words) ? data.words : [];
  const utiles = palabras.filter((w) => w?.text?.trim() && (w.confidence ?? 0) >= CONFIANZA_MINIMA && w.bbox);
  if (utiles.length > 0) {
    const ancho = data.width || 1;
    const alto = data.height || 1;
    const tokens = utiles.slice(0, MAX_TOKENS).map((w) => {
      const x = (((w.bbox.x0 + w.bbox.x1) / 2 / ancho) || 0).toFixed(2);
      const y = (((w.bbox.y0 + w.bbox.y1) / 2 / alto) || 0).toFixed(2);
      return `${w.text.trim()}@(${x},${y})`;
    });
    return tokens.join(' ');
  }
  // sin bboxes disponibles: texto plano colapsado como referencia mínima
  const texto = (data?.text ?? '').replace(/\s+/g, ' ').trim();
  return texto ? texto.slice(0, 1200) : null;
}
