import { z } from 'zod/v4';

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

/** Nombres de los campos estructurados de la extracción (sin "observaciones", que es una lista). */
export const CAMPOS = Object.keys(EsquemaExtraccion.shape).filter((c) => c !== 'observaciones');
