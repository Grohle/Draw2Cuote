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
      .enum([
        'chapa_plegada',
        'corte_laser',
        'torneado',
        'fresado',
        'tubo_perfil',
        'impresion_3d',
        'inyeccion',
        'fundicion',
        'extrusion',
        'termoformado',
        'carpinteria',
        'otro',
      ])
      .nullable()
      .describe(
        'Método/proceso de fabricación de la pieza: chapa_plegada (corte y plegado de chapa), corte_laser (chapa/plancha cortada plana, sin plegar), torneado (revolución), fresado (mecanizado CNC/prismático), tubo_perfil (tubo o perfil cortado/curvado), impresion_3d (fabricación aditiva), inyeccion (moldeo por inyección de plástico), fundicion (fundición/colada de metal), extrusion (perfil extruido), termoformado (conformado de lámina plástica), carpinteria (madera/tablero, CNC de madera). Usa "otro" solo si no encaja en ninguno. null solo si es imposible determinarlo.'
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
      .enum([
        'acero_carbono',
        'acero_inoxidable',
        'aluminio',
        'galvanizado',
        'cobre_laton',
        'titanio',
        'plastico',
        'madera',
        'vidrio',
        'composite',
        'ceramica',
        'caucho',
        'otro',
      ])
      .nullable()
      .describe(
        'Familia del material: metales (acero_carbono, acero_inoxidable, aluminio, galvanizado, cobre_laton, titanio) o no metales (plastico, madera, vidrio, composite —fibra de vidrio/carbono—, ceramica, caucho). "otro" si no encaja. null si el plano no lo indica.'
      ),
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
  sistema_unidades: z
    .enum(['metrico', 'imperial'])
    .nullable()
    .describe(
      'Sistema de unidades EN EL QUE ESTÁ ACOTADO EL PLANO: "metrico" si las cotas están en milímetros (cajetín "Unit: mm/mm", sin comillas de pulgada), "imperial" si están en pulgadas (Unit: in/inch, símbolo " o cotas fraccionarias tipo 1-1/2"). IMPORTANTE: independientemente de esto, DEVUELVE SIEMPRE todas las dimensiones convertidas a milímetros. null solo si el plano no permite determinarlo.'
    ),
  desarrollo: z
    .object({
      lados: z
        .array(
          z.object({
            longitud_mm: z.number().describe('Longitud de la cara tal como está acotada en el plano, en mm.'),
            cota_interior: z
              .boolean()
              .describe(
                'true si la cota mide la cara por el INTERIOR del doblado (entre caras internas, sin incluir el espesor); false si es la medida EXTERIOR. Mira las líneas de cota: si van de cara interna a cara interna es interior. En caso de duda usa false (exterior).'
              ),
          })
        )
        .describe(
          'SOLO chapa plegada. Caras (tramos rectos) del perfil de plegado, en orden a lo largo del perfil, leídas de la vista de perfil/sección (p. ej. 25.4, 47.6, 95.25). Debe haber tantas caras como (num_pliegues + 1). Lista vacía si no se pueden leer del plano.'
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
export const CAMPOS = Object.keys(EsquemaExtraccion.shape).filter(
  (c) => c !== 'observaciones' && c !== 'desarrollo' && c !== 'sistema_unidades'
);
