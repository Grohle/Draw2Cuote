import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

export const MODELOS_PERMITIDOS = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];
export const MODELO_DEFECTO = 'claude-opus-4-8';

const confianza = z
  .enum(['alta', 'media', 'baja'])
  .describe(
    'alta: el dato aparece explícito y legible en el plano. media: se deduce de forma razonable. baja: es dudoso o parcialmente legible.'
  );

const campoTexto = (descripcion) =>
  z.object({
    valor: z.string().nullable().describe(`${descripcion} null si no aparece en el plano o no es legible. NUNCA inventes un valor.`),
    confianza,
  });

const campoNumero = (descripcion) =>
  z.object({
    valor: z.number().nullable().describe(`${descripcion} null si no aparece en el plano o no es legible. NUNCA inventes un valor.`),
    confianza,
  });

export const EsquemaExtraccion = z.object({
  tipo_pieza: z.object({
    valor: z
      .enum(['chapa_plegada', 'torneado', 'fresado', 'tubo_perfil', 'otro'])
      .nullable()
      .describe(
        'Tipo de fabricación de la pieza: chapa_plegada (corte láser/punzonado y plegado), torneado (pieza de revolución), fresado (pieza prismática mecanizada), tubo_perfil (tubo o perfil cortado/curvado). null solo si es imposible determinarlo.'
      ),
    confianza,
  }),
  numero_plano: campoTexto('Número o código de plano, normalmente en el cajetín.'),
  denominacion: campoTexto('Denominación o nombre de la pieza según el cajetín.'),
  revision: campoTexto('Índice de revisión del plano (p. ej. "A", "01").'),
  largo_mm: campoNumero('Longitud total o dimensión mayor de la pieza en milímetros. En chapa plegada, el desarrollo si está indicado.'),
  ancho_mm: campoNumero('Dimensión menor / anchura en milímetros. En piezas de revolución (torneado) devuelve null: usa diametro_max_mm.'),
  alto_mm: campoNumero('Altura o tercera dimensión en milímetros, para piezas prismáticas fresadas. null si no aplica.'),
  diametro_max_mm: campoNumero('Diámetro exterior máximo en milímetros (torneado o tubo redondo). null si no aplica.'),
  espesor_mm: campoNumero('Espesor de la chapa o de la pared del tubo en milímetros (cajetín, sección o nota tipo "e=", "t=", "#"). En piezas macizas torneadas o fresadas devuelve null.'),
  material_familia: z.object({
    valor: z
      .enum(['acero_carbono', 'acero_inoxidable', 'aluminio', 'galvanizado', 'otro'])
      .nullable()
      .describe('Familia de material. null si el plano no lo indica.'),
    confianza,
  }),
  material_calidad: campoTexto('Calidad o grado del material tal como figura en el plano (p. ej. "S235JR", "AISI 304", "5754 H22").'),
  acabado: campoTexto('Acabado superficial o tratamiento indicado (galvanizado, zincado, pintado RAL, anodizado...).'),
  cantidad: campoNumero('Cantidad de piezas indicada en el plano o pedido.'),
  tolerancia_general: campoTexto('Tolerancia general indicada (p. ej. "ISO 2768-m").'),
  tolerancias_criticas: campoTexto('Resumen breve de tolerancias más exigentes que la general: ajustes ISO (H7, g6...), geométricas (concentricidad, planitud, runout) o cotas con ±. null si no hay.'),
  num_pliegues: campoNumero('Número de pliegues o dobleces. Solo aplica a chapa plegada; en otros tipos devuelve null.'),
  num_agujeros: campoNumero('Número total de agujeros/taladros visibles o indicados.'),
  roscas: campoTexto('Roscas indicadas, con métrica y cantidad si es posible (p. ej. "M4 (x1), M6 (x4)"). null si no hay.'),
  observaciones: z
    .array(z.string())
    .describe(
      'Avisos para el presupuestista: cotas contradictorias o ilegibles, unidades distintas de mm, datos que faltan, símbolos no interpretados, o cualquier lectura dudosa. Lista vacía si no hay nada que señalar.'
    ),
});

const SYSTEM = `Eres un técnico de oficina técnica especializado en fabricación de chapa y calderería.
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

/** Valida unas credenciales con una llamada gratuita a count_tokens. */
export async function probarClave(apiKey) {
  const client = crearCliente(apiKey);
  await client.messages.countTokens({
    model: MODELO_DEFECTO,
    messages: [{ role: 'user', content: 'ping' }],
  });
}

export async function extraerDatosPlano({ mediaType, dataBase64, apiKey, model }) {
  if (!apiKey && !hayClaveServidor()) {
    return { demo: true, datos: DATOS_DEMO };
  }

  const client = crearCliente(apiKey);
  const response = await client.messages.parse({
    model: MODELOS_PERMITIDOS.includes(model) ? model : MODELO_DEFECTO,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          bloqueDocumento(mediaType, dataBase64),
          {
            type: 'text',
            text: 'Extrae los datos de este plano para presupuestarlo. Sigue las reglas del sistema al pie de la letra.',
          },
        ],
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
  return { demo: false, datos: response.parsed_output };
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
