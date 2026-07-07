import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EsquemaExtraccion } from './esquema.js';
import { construirLeccionesAprendidas } from './feedback.js';
import { mensajes } from './mensajes.js';
import {
  esProveedorValido,
  llamarGoogle,
  llamarOpenAICompat,
  PRESETS,
  probarProveedorRemoto,
  resolverBaseUrl,
} from './proveedores.js';

export { EsquemaExtraccion };
export const MODELOS_ANTHROPIC = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];
export const MODELO_DEFECTO = 'claude-opus-4-8';

const SYSTEM_ES = `Eres un técnico de oficina técnica especializado en fabricación de chapa y calderería.
Tu tarea es leer un plano técnico (PDF o imagen) y extraer los datos necesarios para presupuestar la pieza.

Primero identifica el TIPO DE PIEZA (chapa plegada, torneado, fresado, tubo/perfil) a partir de las vistas, secciones y símbolos del plano. Del tipo depende qué campos aplican:
- chapa_plegada: largo, ancho, espesor, pliegues.
- torneado: largo (longitud) y diametro_max; ancho, espesor y pliegues devuelven null.
- fresado: largo, ancho y alto; espesor y pliegues devuelven null.
- tubo_perfil: largo (longitud), espesor (pared) y diametro_max o ancho según la sección; pliegues null salvo curvados.
Un campo que NO aplica al tipo de pieza se devuelve null SIN añadir observación (no es un dato ausente, simplemente no procede).

Reglas estrictas para evitar lecturas erróneas:
- NUNCA inventes datos. Si un campo que sí aplica no aparece en el plano o no es legible, devuelve valor null y explica el motivo en observaciones.
- Las dimensiones se devuelven SIEMPRE en milímetros. Si el plano usa otra unidad, convierte y añade una observación.
- El espesor suele estar en el cajetín, en una nota tipo "e=2" / "t=3" / "#2mm", o en una vista de sección. No confundas espesor con otras cotas.
- Si dos cotas se contradicen, elige la del cajetín o la más repetida, marca confianza "baja" y añade una observación.
- Marca confianza "media" o "baja" siempre que haya la más mínima duda; es preferible que un humano revise a dar un dato erróneo por bueno.
- En material_calidad transcribe el texto literal del plano; no lo normalices.
- Los campos de identificación (numero_plano, proyecto, denominacion, marca, revision) aparecen con rótulos muy variables según el plano ("nº", "dwg", "title", "mark", "pos", "rev"...). Fíjate en el rótulo del cajetín aunque no coincida exactamente con el nombre del campo, y no confundas la marca/posición de la pieza con el número de plano.
- Escribe las observaciones en español.`;

const SYSTEM_EN = `You are a technical drafting engineer specialized in sheet metal fabrication and boilermaking.
Your task is to read a technical drawing (PDF or image) and extract the data needed to quote the part.

First identify the PART TYPE (sheet metal, turned, milled, tube/profile) from the views, sections and symbols on the drawing. The part type determines which fields apply:
- chapa_plegada (sheet metal): length, width, thickness, bends.
- torneado (turned): length and max diameter; width, thickness and bends return null.
- fresado (milled): length, width and height; thickness and bends return null.
- tubo_perfil (tube/profile): length, thickness (wall) and max diameter or width depending on the section; bends null unless curved.
A field that does NOT apply to the part type is returned as null WITHOUT adding an observation (it's not missing data, it simply doesn't apply).

Strict rules to avoid incorrect readings:
- NEVER make up data. If a field that does apply isn't shown on the drawing or isn't legible, return null and explain why in the observations.
- Dimensions are ALWAYS returned in millimeters. If the drawing uses another unit, convert it and add an observation.
- Thickness is usually in the title block, in a note like "e=2" / "t=3" / "#2mm", or in a section view. Don't confuse thickness with other dimensions.
- If two dimensions contradict each other, pick the one from the title block or the most repeated one, mark confidence "baja" (low) and add an observation.
- Mark confidence "media" (medium) or "baja" (low) whenever there is the slightest doubt; it's better for a human to review than to present a wrong value as correct.
- For material_calidad, transcribe the literal text from the drawing; do not normalize it.
- The identification fields (numero_plano, proyecto, denominacion, marca, revision) appear under widely varying labels depending on the drawing ("no.", "dwg", "title", "mark", "pos", "rev"...). Read the title-block label even when it doesn't exactly match the field name, and don't confuse the part's mark/position with the drawing number.
- Write all observations in English.`;

export function sistemaBase(idioma) {
  return idioma === 'en' ? SYSTEM_EN : SYSTEM_ES;
}

function bloqueDocumento(mediaType, dataBase64) {
  if (mediaType === 'application/pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: dataBase64 },
    };
  }
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: dataBase64 },
  };
}

export function hayClaveServidor() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function crearCliente(apiKey) {
  return apiKey ? new Anthropic({ apiKey }) : new Anthropic();
}

export const INSTRUCCION = {
  es: 'Extrae los datos de este plano para presupuestarlo. Sigue las reglas del sistema al pie de la letra.',
  en: 'Extract the data from this drawing to quote it. Follow the system rules to the letter.',
};

/**
 * Bloque de alias configurados por el usuario: rótulos concretos con los que
 * sus planos etiquetan cada campo (p. ej. "title", "dwg", "nº", "mark"). Se
 * inyecta en el prompt para que el modelo sepa dónde mirar, sin cambiar el
 * esquema de datos (los campos canónicos son fijos).
 */
function bloqueAlias(alias, idioma) {
  if (!alias || typeof alias !== 'object') return '';
  const lineas = [];
  for (const [campo, etiquetas] of Object.entries(alias)) {
    if (!Array.isArray(etiquetas)) continue;
    const limpias = etiquetas.map((e) => String(e).trim()).filter(Boolean);
    if (limpias.length) lineas.push(`- ${campo}: ${limpias.join(', ')}`);
  }
  if (!lineas.length) return '';
  return idioma === 'en'
    ? `\n\nThis user's drawings label some fields with specific texts. Treat each of these labels as equivalent to the corresponding field (match case-insensitively; the value shown next to such a label is that field's value):\n${lineas.join('\n')}`
    : `\n\nLos planos de este usuario etiquetan algunos campos con textos concretos. Considera cada una de estas etiquetas equivalente al campo correspondiente (sin distinguir mayúsculas; el valor junto a esa etiqueta es el valor de ese campo):\n${lineas.join('\n')}`;
}

/**
 * Prompt de sistema efectivo para esta petición: el prompt base; si hay
 * feedback humano acumulado suficiente, las lecciones destiladas de
 * correcciones previas de usuarios (aprendizaje en contexto sin reentrenar);
 * y los alias de campo configurados por el usuario.
 */
function construirSystemEfectivo(idioma, alias) {
  const base = sistemaBase(idioma);
  const lecciones = construirLeccionesAprendidas(idioma);
  return `${base}${lecciones ? `\n\n${lecciones}` : ''}${bloqueAlias(alias, idioma)}`;
}

/** Prueba de conexión según el proveedor configurado. */
export async function probarProveedor(config) {
  const { proveedor = 'anthropic', apiKey, idioma } = config ?? {};
  if (!esProveedorValido(proveedor)) {
    const err = new Error(mensajes(idioma).proveedorDesconocido(proveedor));
    err.status = 400;
    throw err;
  }
  if (proveedor === 'anthropic') {
    // count_tokens es gratuito y valida la clave (o las credenciales del servidor)
    await crearCliente(apiKey).messages.countTokens({
      model: MODELO_DEFECTO,
      messages: [{ role: 'user', content: 'ping' }],
    });
    return;
  }
  await probarProveedorRemoto(config);
}

async function extraerConAnthropic({ mediaType, dataBase64, apiKey, model, idioma, alias }) {
  const m = mensajes(idioma);
  const client = crearCliente(apiKey);
  const response = await client.messages.parse({
    model: MODELOS_ANTHROPIC.includes(model) ? model : MODELO_DEFECTO,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: construirSystemEfectivo(idioma, alias),
    messages: [
      {
        role: 'user',
        content: [bloqueDocumento(mediaType, dataBase64), { type: 'text', text: INSTRUCCION[idioma === 'en' ? 'en' : 'es'] }],
      },
    ],
    output_config: { format: zodOutputFormat(EsquemaExtraccion) },
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error(m.modeloRechazo);
    err.status = 422;
    throw err;
  }
  if (!response.parsed_output) {
    const err = new Error(m.noInterpretoRespuesta);
    err.status = 502;
    throw err;
  }
  return response.parsed_output;
}

/**
 * Proveedores sin structured outputs nativos: se incrusta el esquema JSON en
 * el prompt, se pide modo JSON y se valida la respuesta con Zod en el servidor.
 */
async function extraerConGenerico({ proveedor, mediaType, dataBase64, apiKey, baseUrl, model, idioma, alias }) {
  const m = mensajes(idioma);
  if (!model || !model.trim()) {
    const err = new Error(m.indicaModelo);
    err.status = 400;
    throw err;
  }
  if (PRESETS[proveedor].openaiCompat && mediaType === 'application/pdf') {
    const err = new Error(m.proveedorSinPdf);
    err.status = 415;
    throw err;
  }
  if (proveedor === 'google' && !apiKey) {
    const err = new Error(m.geminiNecesitaClave);
    err.status = 400;
    throw err;
  }

  const esquemaJson = zodOutputFormat(EsquemaExtraccion).schema;
  const instruccionBase = INSTRUCCION[idioma === 'en' ? 'en' : 'es'];
  const instruccion =
    idioma === 'en'
      ? `${instruccionBase}\n\nRespond EXCLUSIVELY with a valid JSON object, no markdown or extra text, that exactly matches this JSON Schema:\n${JSON.stringify(esquemaJson)}`
      : `${instruccionBase}\n\nResponde EXCLUSIVAMENTE con un objeto JSON válido, sin markdown ni texto adicional, que cumpla exactamente este JSON Schema:\n${JSON.stringify(esquemaJson)}`;
  const parametros = {
    baseUrl: resolverBaseUrl(proveedor, baseUrl, idioma),
    apiKey,
    model: model.trim(),
    system: construirSystemEfectivo(idioma, alias),
    instruccion,
    mediaType,
    dataBase64,
    idioma,
  };

  const crudo = proveedor === 'google' ? await llamarGoogle(parametros) : await llamarOpenAICompat(parametros);
  const validado = EsquemaExtraccion.safeParse(crudo);
  if (!validado.success) {
    const detalle = validado.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    const err = new Error(m.jsonNoCumpleEsquema(detalle));
    err.status = 502;
    throw err;
  }
  return validado.data;
}

export async function extraerDatosPlano({ mediaType, dataBase64, config }) {
  const { proveedor = 'anthropic', apiKey, baseUrl, modelo, idioma, alias } = config ?? {};
  if (!esProveedorValido(proveedor)) {
    const err = new Error(mensajes(idioma).proveedorDesconocido(proveedor));
    err.status = 400;
    throw err;
  }

  if (proveedor === 'anthropic') {
    if (!apiKey && !hayClaveServidor()) {
      return { demo: true, datos: idioma === 'en' ? DATOS_DEMO_EN : DATOS_DEMO_ES };
    }
    return { demo: false, datos: await extraerConAnthropic({ mediaType, dataBase64, apiKey, model: modelo, idioma, alias }) };
  }

  return {
    demo: false,
    datos: await extraerConGenerico({ proveedor, mediaType, dataBase64, apiKey, baseUrl, model: modelo, idioma, alias }),
  };
}

// Datos de ejemplo para poder probar la UI sin credenciales de la API.
const DATOS_DEMO_ES = {
  tipo_pieza: { valor: 'chapa_plegada', confianza: 'alta' },
  numero_plano: { valor: 'PL-2041-03', confianza: 'alta' },
  proyecto: { valor: 'OF-2287 Bancada montaje', confianza: 'media' },
  denominacion: { valor: 'Soporte lateral bancada', confianza: 'alta' },
  marca: { valor: 'P-14', confianza: 'alta' },
  revision: { valor: 'B', confianza: 'alta' },
  largo_mm: { valor: 420, confianza: 'alta' },
  ancho_mm: { valor: 185, confianza: 'alta' },
  alto_mm: { valor: null, confianza: 'alta' },
  diametro_max_mm: { valor: null, confianza: 'alta' },
  espesor_mm: { valor: 3, confianza: 'alta' },
  material_familia: { valor: 'acero_carbono', confianza: 'media' },
  material_calidad: { valor: 'S235JR', confianza: 'media' },
  acabado: { valor: 'Zincado', confianza: 'baja' },
  cantidad: { valor: 24, confianza: 'alta' },
  tolerancia_general: { valor: 'ISO 2768-m', confianza: 'alta' },
  tolerancias_criticas: { valor: null, confianza: 'alta' },
  num_pliegues: { valor: 2, confianza: 'media' },
  num_agujeros: { valor: 6, confianza: 'alta' },
  roscas: { valor: null, confianza: 'alta' },
  observaciones: [
    'MODO DEMO: estos datos son de ejemplo; configura un proveedor en ⚙ Ajustes para analizar planos reales.',
    'El acabado aparece en una nota manuscrita poco legible; confirmar con el cliente.',
    'La cota de 185 mm figura solo en la vista lateral; no hay cota general de anchura.',
  ],
};

const DATOS_DEMO_EN = {
  tipo_pieza: { valor: 'chapa_plegada', confianza: 'alta' },
  numero_plano: { valor: 'PL-2041-03', confianza: 'alta' },
  proyecto: { valor: 'JOB-2287 Assembly bench', confianza: 'media' },
  denominacion: { valor: 'Bench side bracket', confianza: 'alta' },
  marca: { valor: 'P-14', confianza: 'alta' },
  revision: { valor: 'B', confianza: 'alta' },
  largo_mm: { valor: 420, confianza: 'alta' },
  ancho_mm: { valor: 185, confianza: 'alta' },
  alto_mm: { valor: null, confianza: 'alta' },
  diametro_max_mm: { valor: null, confianza: 'alta' },
  espesor_mm: { valor: 3, confianza: 'alta' },
  material_familia: { valor: 'acero_carbono', confianza: 'media' },
  material_calidad: { valor: 'S235JR', confianza: 'media' },
  acabado: { valor: 'Zinc plated', confianza: 'baja' },
  cantidad: { valor: 24, confianza: 'alta' },
  tolerancia_general: { valor: 'ISO 2768-m', confianza: 'alta' },
  tolerancias_criticas: { valor: null, confianza: 'alta' },
  num_pliegues: { valor: 2, confianza: 'media' },
  num_agujeros: { valor: 6, confianza: 'alta' },
  roscas: { valor: null, confianza: 'alta' },
  observaciones: [
    'DEMO MODE: this is sample data; configure a provider in ⚙ Settings to analyze real drawings.',
    'The finish appears in a hard-to-read handwritten note; confirm with the customer.',
    'The 185 mm dimension only appears on the side view; there is no general width dimension.',
  ],
};
