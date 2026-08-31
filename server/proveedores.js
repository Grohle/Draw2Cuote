/**
 * Proveedores de IA soportados además de Anthropic:
 * - google: API Generative Language de Google (Gemini, con capa gratuita).
 * - ollama / lmstudio / vllm / personalizado: cualquier servidor que hable
 *   el protocolo de chat de OpenAI (imágenes vía data URL, JSON por prompt).
 */
import { mensajes } from './mensajes.js';

export const PRESETS = {
  anthropic: { openaiCompat: false, pdf: true },
  google: { openaiCompat: false, pdf: true, baseUrl: 'https://generativelanguage.googleapis.com' },
  ollama: { openaiCompat: true, pdf: false, baseUrl: 'http://localhost:11434/v1' },
  lmstudio: { openaiCompat: true, pdf: false, baseUrl: 'http://localhost:1234/v1' },
  vllm: { openaiCompat: true, pdf: false, baseUrl: 'http://localhost:8000/v1' },
  personalizado: { openaiCompat: true, pdf: false },
};

export function esProveedorValido(p) {
  return Object.hasOwn(PRESETS, p);
}

export function resolverBaseUrl(proveedor, baseUrl, idioma) {
  const m = mensajes(idioma);
  const url = (baseUrl || PRESETS[proveedor]?.baseUrl || '').trim().replace(/\/+$/, '');
  if (!url) {
    throw conStatus(new Error(m.faltaUrlBase), 400);
  }
  if (!/^https?:\/\//i.test(url)) {
    throw conStatus(new Error(m.urlNoValida(url)), 400);
  }
  return url;
}

function conStatus(err, status) {
  err.status = status;
  return err;
}

function errorProveedor(status, detalle, idioma) {
  const m = mensajes(idioma);
  if (status === 401 || status === 403) {
    return conStatus(new Error(m.credencialesRechazadas), 401);
  }
  if (status === 404) {
    return conStatus(new Error(m.modeloONoEncontrado(detalle)), 502);
  }
  if (status === 429) {
    return conStatus(new Error(m.limiteProveedor), 429);
  }
  return conStatus(new Error(m.errorProveedorGenerico(status, detalle)), 502);
}

function errorConexion(url, idioma) {
  return conStatus(new Error(mensajes(idioma).noConectaUrl(url)), 503);
}

async function hacerFetch(url, opciones, idioma) {
  try {
    return await fetch(url, opciones);
  } catch {
    throw errorConexion(url, idioma);
  }
}

/** Recorta la respuesta del modelo al objeto JSON (quita vallas markdown y texto suelto). */
export function extraerJson(texto, idioma) {
  const sinVallas = texto.replace(/```(?:json)?/gi, '');
  const inicio = sinVallas.indexOf('{');
  const fin = sinVallas.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) {
    throw conStatus(new Error(mensajes(idioma).respuestaSinJson), 502);
  }
  return JSON.parse(sinVallas.slice(inicio, fin + 1));
}

/**
 * Códigos con los que un servidor dice "no entiendo ese parámetro". Solo ante
 * ellos se baja un escalón de imposición del esquema; un 401 (credenciales), un
 * 404 (modelo inexistente) o un 500 son errores de verdad y se propagan tal
 * cual, sin gastar reintentos.
 */
const NO_ADMITIDO = new Set([400, 422]);

/** Descarta una respuesta que no se va a leer, para no dejar la conexión abierta. */
async function descartar(res) {
  await res.body?.cancel().catch(() => {});
}

/**
 * Llamada a un servidor compatible con la API de chat de OpenAI.
 *
 * Se intenta imponer el esquema por el canal nativo (`json_schema` en modo
 * estricto, que vLLM, LM Studio, Ollama y OpenRouter aplican con decodificación
 * guiada) y solo se degrada si el servidor lo rechaza: primero a modo JSON
 * suelto, luego a texto. En cuanto se deja de imponer el esquema, la petición
 * pasa a llevarlo escrito en el prompt, que es la única red que queda.
 */
export async function llamarOpenAICompat({
  baseUrl,
  apiKey,
  model,
  system,
  instruccion,
  instruccionConEsquema,
  esquema,
  mediaType,
  dataBase64,
  idioma,
}) {
  const url = `${baseUrl}/chat/completions`;
  const cabeceras = { 'content-type': 'application/json' };
  if (apiKey) cabeceras.authorization = `Bearer ${apiKey}`;
  const cuerpo = (texto, extra) => ({
    model,
    temperature: 0,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${dataBase64}` } },
          { type: 'text', text: texto },
        ],
      },
    ],
    ...extra,
  });

  const intentos = [
    cuerpo(instruccion, {
      response_format: { type: 'json_schema', json_schema: { name: 'extraccion_plano', strict: true, schema: esquema } },
    }),
    cuerpo(instruccionConEsquema, { response_format: { type: 'json_object' } }),
    cuerpo(instruccionConEsquema),
  ];

  let res;
  for (const [i, cuerpoIntento] of intentos.entries()) {
    res = await hacerFetch(url, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpoIntento) }, idioma);
    if (res.ok || !NO_ADMITIDO.has(res.status) || i === intentos.length - 1) break;
    await descartar(res);
  }

  const respuesta = await res.json().catch(() => null);
  if (!res.ok) {
    throw errorProveedor(res.status, respuesta?.error?.message ?? respuesta?.message, idioma);
  }
  const texto = respuesta?.choices?.[0]?.message?.content;
  if (!texto) {
    throw conStatus(new Error(mensajes(idioma).respuestaVacia), 502);
  }
  return extraerJson(texto, idioma);
}

/**
 * Llamada a la API Generative Language de Google (Gemini). Se le pasa el
 * esquema en `responseSchema`, que Gemini impone al decodificar; si lo rechaza
 * (modelo antiguo o esquema no admitido) se reintenta pidiendo solo JSON, ya
 * con el esquema escrito en el prompt.
 */
export async function llamarGoogle({
  baseUrl,
  apiKey,
  model,
  system,
  instruccion,
  instruccionConEsquema,
  esquema,
  mediaType,
  dataBase64,
  idioma,
}) {
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const peticion = (texto, generationConfig) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [
        {
          role: 'user',
          parts: [{ inline_data: { mime_type: mediaType, data: dataBase64 } }, { text: texto }],
        },
      ],
      generationConfig: { response_mime_type: 'application/json', temperature: 0, ...generationConfig },
    }),
  });

  let res = await hacerFetch(url, peticion(instruccion, { response_schema: esquema }), idioma);
  if (NO_ADMITIDO.has(res.status)) {
    await descartar(res);
    res = await hacerFetch(url, peticion(instruccionConEsquema, {}), idioma);
  }
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw errorProveedor(res.status, cuerpo?.error?.message, idioma);
  }
  const texto = (cuerpo?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (!texto) {
    throw conStatus(new Error(mensajes(idioma).geminiRespuestaVacia), 502);
  }
  return extraerJson(texto, idioma);
}

/** Prueba de conexión barata por proveedor (sin consumir tokens de salida). */
export async function probarProveedorRemoto({ proveedor, apiKey, baseUrl, idioma }) {
  if (proveedor === 'google') {
    const base = resolverBaseUrl('google', baseUrl, idioma);
    const res = await hacerFetch(`${base}/v1beta/models`, { headers: { 'x-goog-api-key': apiKey ?? '' } }, idioma);
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null);
      throw errorProveedor(res.status, cuerpo?.error?.message, idioma);
    }
    return;
  }
  // openai-compat: listar modelos confirma servidor y credenciales
  const base = resolverBaseUrl(proveedor, baseUrl, idioma);
  const cabeceras = apiKey ? { authorization: `Bearer ${apiKey}` } : {};
  const res = await hacerFetch(`${base}/models`, { headers: cabeceras }, idioma);
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw errorProveedor(res.status, cuerpo?.error?.message ?? cuerpo?.message, idioma);
  }
}
