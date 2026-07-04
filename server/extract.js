import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const MODEL = 'claude-opus-4-8';

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
  numero_plano: campoTexto('Número o código de plano, normalmente en el cajetín.'),
  denominacion: campoTexto('Denominación o nombre de la pieza según el cajetín.'),
  revision: campoTexto('Índice de revisión del plano (p. ej. "A", "01").'),
  largo_mm: campoNumero('Dimensión mayor de la pieza desplegada/general, en milímetros.'),
  ancho_mm: campoNumero('Dimensión menor de la pieza desplegada/general, en milímetros.'),
  espesor_mm: campoNumero('Espesor de la chapa o material en milímetros (cajetín, sección o nota).'),
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
  num_pliegues: campoNumero('Número de pliegues o dobleces de la pieza si es de chapa plegada.'),
  num_agujeros: campoNumero('Número total de agujeros/taladros visibles o indicados.'),
  observaciones: z
    .array(z.string())
    .describe(
      'Avisos para el presupuestista: cotas contradictorias o ilegibles, unidades distintas de mm, datos que faltan, símbolos no interpretados, o cualquier lectura dudosa. Lista vacía si no hay nada que señalar.'
    ),
});

const SYSTEM = `Eres un técnico de oficina técnica especializado en fabricación de chapa y calderería.
Tu tarea es leer un plano técnico (PDF o imagen) y extraer los datos necesarios para presupuestar la pieza.

Reglas estrictas para evitar lecturas erróneas:
- NUNCA inventes datos. Si un campo no aparece en el plano o no es legible, devuelve valor null y explica el motivo en observaciones.
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

export function modoDemo() {
  if (process.env.DRAW2QUOTE_FORCE_API === '1') return false;
  return !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;
}

export async function extraerDatosPlano({ mediaType, dataBase64 }) {
  if (modoDemo()) {
    return { demo: true, datos: DATOS_DEMO };
  }

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
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
  numero_plano: { valor: 'PL-2041-03', confianza: 'alta' },
  denominacion: { valor: 'Soporte lateral bancada', confianza: 'alta' },
  revision: { valor: 'B', confianza: 'alta' },
  largo_mm: { valor: 420, confianza: 'alta' },
  ancho_mm: { valor: 185, confianza: 'alta' },
  espesor_mm: { valor: 3, confianza: 'alta' },
  material_familia: { valor: 'acero_carbono', confianza: 'media' },
  material_calidad: { valor: 'S235JR', confianza: 'media' },
  acabado: { valor: 'Zincado', confianza: 'baja' },
  cantidad: { valor: 24, confianza: 'alta' },
  tolerancia_general: { valor: 'ISO 2768-m', confianza: 'alta' },
  num_pliegues: { valor: 2, confianza: 'media' },
  num_agujeros: { valor: 6, confianza: 'alta' },
  observaciones: [
    'MODO DEMO: estos datos son de ejemplo; configura ANTHROPIC_API_KEY para analizar planos reales.',
    'El acabado aparece en una nota manuscrita poco legible; confirmar con el cliente.',
    'La cota de 185 mm figura solo en la vista lateral; no hay cota general de anchura.',
  ],
};
