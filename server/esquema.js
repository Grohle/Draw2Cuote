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
  numero_plano: campoTexto('Número o código de plano, normalmente en el cajetín. Puede aparecer como "nº", "no.", "dwg", "dwg no", "plano".'),
  proyecto: campoTexto('Proyecto, obra o pedido al que pertenece la pieza, si figura en el plano (cajetín, membrete o referencia). Puede aparecer como "proyecto", "project", "obra", "job", "OF", "pedido".'),
  denominacion: campoTexto('Denominación o nombre de la pieza según el cajetín. Puede aparecer como "denominación", "title", "descripción", "designación", "part name".'),
  marca: campoTexto('Marca o posición de la pieza dentro del conjunto/despiece; en muchos planos es el identificador corto de la pieza. Puede aparecer como "marca", "mark", "pos", "posición", "item", "ref".'),
  revision: campoTexto('Índice de revisión del plano (p. ej. "A", "01"). Puede aparecer como "rev", "revisión", "índice".'),
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
  desarrollo: z
    .object({
      lados_mm: z
        .array(z.number())
        .describe(
          'SOLO chapa plegada. Longitudes de los tramos rectos (lados) entre pliegues, en orden a lo largo del perfil de plegado, en mm. Léelas de la vista de perfil/sección donde se ve el doblado (p. ej. 25.4, 47.6, 95.25). Debe haber tantos lados como (num_pliegues + 1). Lista vacía si no se pueden leer del plano.'
        ),
      pliegues: z
        .array(
          z.object({
            angulo_grados: z
              .number()
              .nullable()
              .describe('Ángulo de doblado del pliegue en grados. Si el plano indica que los ángulos no acotados son 90°, usa 90. null si no se puede determinar.'),
            radio_mm: z
              .number()
              .nullable()
              .describe('Radio interior de doblado en mm (p. ej. una nota "R1.5" o "2xR1.5"). null si el plano no lo indica.'),
          })
        )
        .describe('SOLO chapa plegada. Un elemento por pliegue con su ángulo y radio interior; tantos como num_pliegues. Lista vacía si no aplica o no se lee.'),
    })
    .describe('Geometría de plegado para calcular el desarrollo (desplegado). Solo para chapa plegada; en otros tipos ambas listas van vacías.'),
  observaciones: z
    .array(z.string())
    .describe(
      'Avisos para el presupuestista: cotas contradictorias o ilegibles, unidades distintas de mm, datos que faltan, símbolos no interpretados, o cualquier lectura dudosa. Lista vacía si no hay nada que señalar.'
    ),
});

/** Nombres de los campos escalares de la extracción (los de tipo { valor, confianza }). */
export const CAMPOS = Object.keys(EsquemaExtraccion.shape).filter((c) => c !== 'observaciones' && c !== 'desarrollo');
