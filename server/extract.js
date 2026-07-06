import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EsquemaExtraccion } from './esquema.js';
import { construirLeccionesAprendidas } from './feedback.js';
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

export const SYSTEM = `Eres un técnico de oficina técnica especializado en fabricación de chapa y calderería.
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
- En material_calidad transcribe el texto literal del plano; no lo normalices.`;

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

const INSTRUCCION = 'Extrae los datos de este plano para presupuestarlo. Sigue las reglas del sistema al pie de la letra.';

/**
 * Prompt de sistema efectivo para esta petición: el prompt base más, si hay
 * feedback humano acumulado suficiente, las lecciones destiladas de
 * correcciones previas de usuarios (aprendizaje en contexto sin reentrenar).
 */
function construirSystemEfectivo() {
  const lecciones = construirLeccionesAprendidas();
  return lecciones ? `${SYSTEM}\n\n${lecciones}` : SYSTEM;
}

/** Prueba de conexión según el proveedor configurado. */
export async function probarProveedor(config) {
  const { proveedor = 'anthropic', apiKey } = config ?? {};
  if (!esProveedorValido(proveedor)) {
    const err = new Error(`Proveedor desconocido: ${proveedor}`);
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

async function extraerConAnthropic({ mediaType, dataBase64, apiKey, model }) {
  const client = crearCliente(apiKey);
  const response = await client.messages.parse({
    model: MODELOS_ANTHROPIC.includes(model) ? model : MODELO_DEFECTO,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: construirSystemEfectivo(),
    messages: [
      {
        role: 'user',
        content: [bloqueDocumento(mediaType, dataBase64), { type: 'text', text: INSTRUCCION }],
      },
    ],
    output_config: { format: zodOutputFormat(EsquemaExtraccion) },
  });

  if (response.stop_reason === 'refusal') {
    const err = new Error('El modelo rechazó procesar este documento.');
    err.status = 422;
    throw err;
  }
  if (!response.parsed_output) {
    const err = new Error('No se pudo interpretar la respuesta del modelo. Vuelve a intentarlo.');
    err.status = 502;
    throw err;
  }
  return response.parsed_output;
}

/**
 * Proveedores sin structured outputs nativos: se incrusta el esquema JSON en
 * el prompt, se pide modo JSON y se valida la respuesta con Zod en el servidor.
 */
async function extraerConGenerico({ proveedor, mediaType, dataBase64, apiKey, baseUrl, model }) {
  if (!model || !model.trim()) {
    const err = new Error('Indica el modelo a usar en Ajustes (debe tener visión).');
    err.status = 400;
    throw err;
  }
  if (PRESETS[proveedor].openaiCompat && mediaType === 'application/pdf') {
    const err = new Error(
      'Este proveedor no admite PDF: sube una imagen (PNG/JPG) del plano o cambia a Anthropic o Google Gemini en Ajustes.'
    );
    err.status = 415;
    throw err;
  }
  if (proveedor === 'google' && !apiKey) {
    const err = new Error('Google Gemini necesita una clave de API (gratuita en aistudio.google.com).');
    err.status = 400;
    throw err;
  }

  const esquemaJson = zodOutputFormat(EsquemaExtraccion).schema;
  const instruccion = `${INSTRUCCION}\n\nResponde EXCLUSIVAMENTE con un objeto JSON válido, sin markdown ni texto adicional, que cumpla exactamente este JSON Schema:\n${JSON.stringify(esquemaJson)}`;
  const parametros = {
    baseUrl: resolverBaseUrl(proveedor, baseUrl),
    apiKey,
    model: model.trim(),
    system: construirSystemEfectivo(),
    instruccion,
    mediaType,
    dataBase64,
  };

  const crudo = proveedor === 'google' ? await llamarGoogle(parametros) : await llamarOpenAICompat(parametros);
  const validado = EsquemaExtraccion.safeParse(crudo);
  if (!validado.success) {
    const detalle = validado.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    const err = new Error(
      `El modelo devolvió un JSON que no cumple el esquema (${detalle}). Prueba con un modelo con visión más capaz o cambia de proveedor.`
    );
    err.status = 502;
    throw err;
  }
  return validado.data;
}

export async function extraerDatosPlano({ mediaType, dataBase64, config }) {
  const { proveedor = 'anthropic', apiKey, baseUrl, modelo } = config ?? {};
  if (!esProveedorValido(proveedor)) {
    const err = new Error(`Proveedor desconocido: ${proveedor}`);
    err.status = 400;
    throw err;
  }

  if (proveedor === 'anthropic') {
    if (!apiKey && !hayClaveServidor()) {
      return { demo: true, datos: DATOS_DEMO };
    }
    return { demo: false, datos: await extraerConAnthropic({ mediaType, dataBase64, apiKey, model: modelo }) };
  }

  return {
    demo: false,
    datos: await extraerConGenerico({ proveedor, mediaType, dataBase64, apiKey, baseUrl, model: modelo }),
  };
}

// Datos de ejemplo para poder probar la UI sin credenciales de la API.
const DATOS_DEMO = {
  tipo_pieza: { valor: 'chapa_plegada', confianza: 'alta' },
  numero_plano: { valor: 'PL-2041-03', confianza: 'alta' },
  denominacion: { valor: 'Soporte lateral bancada', confianza: 'alta' },
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
    'MODO DEMO: estos datos son de ejemplo; configura ANTHROPIC_API_KEY para analizar planos reales.',
    'El acabado aparece en una nota manuscrita poco legible; confirmar con el cliente.',
    'La cota de 185 mm figura solo en la vista lateral; no hay cota general de anchura.',
  ],
};
