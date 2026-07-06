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

/** Llamada a un servidor compatible con la API de chat de OpenAI. */
export async function llamarOpenAICompat({ baseUrl, apiKey, model, system, instruccion, mediaType, dataBase64, idioma }) {
  const url = `${baseUrl}/chat/completions`;
  const cabeceras = { 'content-type': 'application/json' };
  if (apiKey) cabeceras.authorization = `Bearer ${apiKey}`;
  const cuerpoBase = {
    model,
    temperature: 0,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${dataBase64}` } },
          { type: 'text', text: instruccion },
        ],
      },
    ],
  };

  // Primero con modo JSON; si el servidor no lo soporta (400), reintenta sin él.
  let res = await hacerFetch(
    url,
    { method: 'POST', headers: cabeceras, body: JSON.stringify({ ...cuerpoBase, response_format: { type: 'json_object' } }) },
    idioma
  );
  if (res.status === 400) {
    res = await hacerFetch(url, { method: 'POST', headers: cabeceras, body: JSON.stringify(cuerpoBase) }, idioma);
  }
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    throw errorProveedor(res.status, cuerpo?.error?.message ?? cuerpo?.message, idioma);
  }
  const texto = cuerpo?.choices?.[0]?.message?.content;
  if (!texto) {
    throw conStatus(new Error(mensajes(idioma).respuestaVacia), 502);
  }
  return extraerJson(texto, idioma);
}

/** Llamada a la API Generative Language de Google (Gemini). */
export async function llamarGoogle({ baseUrl, apiKey, model, system, instruccion, mediaType, dataBase64, idioma }) {
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await hacerFetch(
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [
          {
            role: 'user',
            parts: [{ inline_data: { mime_type: mediaType, data: dataBase64 } }, { text: instruccion }],
          },
        ],
        generationConfig: { response_mime_type: 'application/json', temperature: 0 },
      }),
    },
    idioma
  );
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
