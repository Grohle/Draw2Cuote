import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EsquemaExtraccion } from './esquema.js';
import { construirEjemplosCorreccion, construirLeccionesAprendidas } from './feedback.js';
import { mensajes } from './mensajes.js';
import { ocrImagen } from './ocr.js';
import {
  esProveedorValido,
  llamarGoogle,
  llamarOpenAICompat,
  PRESETS,
  probarProveedorRemoto,
  resolverBaseUrl,
} from './proveedores.js';
import { repararExtraccion } from './reparar.js';

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
- otros procesos (corte_laser, impresion_3d, inyeccion, fundicion, extrusion, termoformado, carpinteria): rellena las cotas envolventes que apliquen (largo/ancho/alto para piezas volumétricas, o diámetro). Reconoce también el material aunque NO sea metal: plástico, madera, vidrio, composite (fibra de vidrio/carbono), cerámica o caucho.
Un campo que NO aplica al tipo de pieza se devuelve null SIN añadir observación (no es un dato ausente, simplemente no procede).

Reglas estrictas para evitar lecturas erróneas:
- NUNCA inventes datos. Si un campo que sí aplica no aparece en el plano o no es legible, devuelve valor null y explica el motivo en observaciones.
- Las dimensiones se devuelven SIEMPRE en milímetros. Si el plano usa otra unidad, convierte y añade una observación.
- El espesor suele estar en el cajetín, en una nota tipo "e=2" / "t=3" / "#2mm", o en una vista de sección. No confundas espesor con otras cotas.
- Si dos cotas se contradicen, elige la del cajetín o la más repetida, marca confianza "baja" y añade una observación.
- Marca confianza "media" o "baja" siempre que haya la más mínima duda; es preferible que un humano revise a dar un dato erróneo por bueno.
- En material_calidad transcribe el texto literal del plano; no lo normalices.
- Los campos de identificación (numero_plano, proyecto, denominacion, marca, revision) aparecen con rótulos muy variables según el plano ("nº", "dwg", "title", "mark", "pos", "rev"...). Fíjate en el rótulo del cajetín aunque no coincida exactamente con el nombre del campo, y no confundas la marca/posición de la pieza con el número de plano.
- DESARROLLO (solo chapa plegada): es la parte MÁS IMPORTANTE para presupuestar chapa. Localiza la VISTA DE PERFIL/SECCIÓN (la que muestra la pieza doblada de canto, como una línea quebrada). Cada tramo recto de esa línea es una CARA PLEGADA; su cota es un "lado". Recorre el perfil de un extremo al otro y anota en "desarrollo.lados", EN ORDEN, cada cara con su longitud (p. ej. un perfil en Z con caras 25.4, 47.6 y 95.25 → tres lados). Debe haber num_pliegues + 1 lados (2 pliegues → 3 lados). Haz todo lo posible por leerlos aunque tengas que deducirlos de las cotas del perfil.
- COTA INTERIOR vs EXTERIOR: fíjate en si cada cota mide la cara por DENTRO o por FUERA del doblado. Si las líneas de cota van entre caras internas (no incluyen el espesor), marca cota_interior = true; si abarcan el exterior, false. Ejemplo: una U de espesor 2 mm con cota interior 46 mm mide 46+2+2 = 50 mm por fuera. Esto cambia el desarrollo, tómalo muy en serio. En caso de duda, false (exterior).
- En "desarrollo.pliegues" añade un elemento por pliegue con su ángulo (usa 90 si el plano indica que los ángulos no acotados son 90°) y su radio interior (p. ej. "R1.5" o "2xR1.5"; radio null si no aparece). Solo deja lados vacío si de verdad no hay ninguna vista de perfil legible.
- UNIDADES DEL PLANO: determina en "sistema_unidades" si el plano está acotado en milímetros ("metrico", cajetín "Unit: mm") o en pulgadas ("imperial", "Unit: in/inch", símbolo " o cotas fraccionarias). Aun así, todas las cotas que devuelvas van SIEMPRE en milímetros (convierte las pulgadas: 1" = 25.4 mm).
- COTA ENVOLVENTE CON RADIOS (ERROR FRECUENTE, vigílalo): cuando el contorno exterior de la pieza termina en un arco/radio (p. ej. "R70") cuyo centro está sobre un punto acotado (a menudo el centro de un agujero), la cota que ves NO llega hasta el borde real: el borde es la tangente del arco, que está un RADIO más allá del centro. Por tanto la dimensión envolvente = cota-al-centro + radio. Ejemplo: una orejeta cuya parte superior es un arco R70 centrado en el agujero, con la altura acotada 90 hasta ese centro, mide en realidad 90 + 70 = 160 mm de alto. Suma el radio a largo/ancho/alto/diámetro cuando la envolvente esté limitada por un arco así, y AÑADE SIEMPRE una observación explicándolo (p. ej. "alto: 90 al centro + R70 = 160 envolvente"). Si dudas de si la cota llega al centro o al borde, marca confianza media y avísalo.
- CAMPOS ADICIONALES: si el cajetín o las notas traen un dato claramente rotulado que NO encaja en ningún campo del esquema (peso, escala, tratamiento térmico, norma de soldadura...), devuélvelo en "campos_extra" con un nombre corto basado en el rótulo y el valor literal. Si se te da una lista de campos adicionales ya definidos, reutiliza EXACTAMENTE esos nombres cuando el dato coincida (no crees variantes). Nunca dupliques ahí un dato que ya va en otro campo.
- Escribe las observaciones en español.`;

const SYSTEM_EN = `You are a technical drafting engineer specialized in sheet metal fabrication and boilermaking.
Your task is to read a technical drawing (PDF or image) and extract the data needed to quote the part.

First identify the PART TYPE (sheet metal, turned, milled, tube/profile) from the views, sections and symbols on the drawing. The part type determines which fields apply:
- chapa_plegada (sheet metal): length, width, thickness, bends.
- torneado (turned): length and max diameter; width, thickness and bends return null.
- fresado (milled): length, width and height; thickness and bends return null.
- tubo_perfil (tube/profile): length, thickness (wall) and max diameter or width depending on the section; bends null unless curved.
- other processes (corte_laser, impresion_3d 3D printing, inyeccion injection molding, fundicion casting, extrusion, termoformado thermoforming, carpinteria woodworking): fill the bounding dimensions that apply (length/width/height for volumetric parts, or diameter). Also recognize non-metal materials: plastic, wood, glass, composite (glass/carbon fiber), ceramic or rubber.
A field that does NOT apply to the part type is returned as null WITHOUT adding an observation (it's not missing data, it simply doesn't apply).

Strict rules to avoid incorrect readings:
- NEVER make up data. If a field that does apply isn't shown on the drawing or isn't legible, return null and explain why in the observations.
- Dimensions are ALWAYS returned in millimeters. If the drawing uses another unit, convert it and add an observation.
- Thickness is usually in the title block, in a note like "e=2" / "t=3" / "#2mm", or in a section view. Don't confuse thickness with other dimensions.
- If two dimensions contradict each other, pick the one from the title block or the most repeated one, mark confidence "baja" (low) and add an observation.
- Mark confidence "media" (medium) or "baja" (low) whenever there is the slightest doubt; it's better for a human to review than to present a wrong value as correct.
- For material_calidad, transcribe the literal text from the drawing; do not normalize it.
- The identification fields (numero_plano, proyecto, denominacion, marca, revision) appear under widely varying labels depending on the drawing ("no.", "dwg", "title", "mark", "pos", "rev"...). Read the title-block label even when it doesn't exactly match the field name, and don't confuse the part's mark/position with the drawing number.
- FLAT PATTERN (sheet metal only): this is the MOST IMPORTANT part for quoting sheet metal. Find the PROFILE/SECTION view (the one showing the part folded edge-on, like a bent line). Each straight segment of that line is a FOLDED FACE; its dimension is a "side". Walk the profile end to end and record in "desarrollo.lados", IN ORDER, each face with its length (e.g. a Z-profile with faces 25.4, 47.6 and 95.25 → three sides). There must be num_pliegues + 1 sides (2 bends → 3 sides). Do your best to read them even if you must infer from the profile's dimensions.
- INSIDE vs OUTSIDE dimension: check whether each dimension measures the face on the INSIDE or the OUTSIDE of the bend. If the dimension lines run between inner faces (excluding the thickness), set cota_interior = true; if they span the outside, false. Example: a U-channel of 2 mm thickness with a 46 mm inside dimension measures 46+2+2 = 50 mm outside. This changes the flat pattern — take it very seriously. When in doubt, false (outside).
- In "desarrollo.pliegues" add one item per bend with its angle (use 90 if the drawing states unmarked angles are 90°) and its inner radius (e.g. "R1.5" or "2xR1.5"; radius null if not shown). Only leave lados empty if there truly is no legible profile view.
- DRAWING UNITS: determine in "sistema_unidades" whether the drawing is dimensioned in millimeters ("metrico", title block "Unit: mm") or inches ("imperial", "Unit: in/inch", the " symbol or fractional dimensions). Regardless, return ALL dimensions in millimeters (convert inches: 1" = 25.4 mm).
- BOUNDING DIMENSION WITH RADII (FREQUENT ERROR, watch for it): when the outer contour of the part ends in an arc/radius (e.g. "R70") whose center sits on a dimensioned point (often a hole center), the dimension you see does NOT reach the real edge: the edge is the arc's tangent, which is one RADIUS beyond the center. So the envelope dimension = dimension-to-center + radius. Example: a lug whose top is an R70 arc centered on the hole, with the height dimensioned 90 to that center, is actually 90 + 70 = 160 mm tall. Add the radius to length/width/height/diameter whenever the envelope is bounded by such an arc, and ALWAYS add an observation explaining it (e.g. "height: 90 to center + R70 = 160 overall"). If unsure whether the dimension reaches the center or the edge, mark medium confidence and flag it.
- EXTRA FIELDS: if the title block or notes contain a clearly labeled piece of data that does NOT fit any schema field (weight, scale, heat treatment, welding standard...), return it in "campos_extra" with a short name based on the label and the literal value. If you are given a list of already-defined extra fields, reuse EXACTLY those names when the data matches (do not create variants). Never duplicate there data that already goes in another field.
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

// Capa de razonamiento posterior al scan: un revisor mira el plano y la primera
// extracción, comprueba la coherencia de cada campo y re-examina los de
// confianza media/baja, corrigiendo con evidencia (sin inventar).
const SYSTEM_REVISION_ES = `Eres un revisor técnico senior de oficina técnica. Recibes un plano y una PRIMERA extracción de datos hecha por otro sistema. Tu tarea es VERIFICARLA y CORREGIRLA mirando el plano:
- Comprueba la coherencia de cada campo: que el valor encaje con el tipo de pieza, con las demás cotas, con las unidades (todo en mm) y con la plausibilidad física (p. ej. espesor < largo, ancho ≤ largo, radios/ángulos razonables, familia de material coherente con la calidad).
- Presta ATENCIÓN ESPECIAL a los campos marcados con confianza "media" o "baja": vuelve a leerlos en el plano y confírmalos o corrígelos.
- AUDITORÍA MATEMÁTICA: comprueba las aserciones que el plano permita, en especial que la suma de cotas parciales coincida con la cota total (L_total = Σ parciales ± tolerancia) y que las caras del desarrollo cuadren con las cotas generales de la pieza. Verifica también que cada cota_interior sea correcta: una cota interior + espesores adyacentes debe cuadrar con la cota exterior si ambas aparecen.
- COTA ENVOLVENTE CON RADIOS (error frecuente): comprueba si alguna dimensión envolvente (largo/ancho/alto/diámetro) está limitada por un arco/radio cuyo centro está sobre un punto acotado. Si es así, la envolvente real es cota-al-centro + radio (p. ej. altura 90 hasta el centro de un arco R70 → 160 mm reales). Corrige el valor sumando el radio y añade la observación correspondiente; si la primera extracción ya lo hizo, confírmalo.
- Corrige un valor SOLO si el plano lo respalda; NUNCA inventes. Si algo no es legible, deja null.
- Actualiza la confianza: sube a "alta" solo si ahora es claramente legible/verificable; usa "media"/"baja" si sigue habiendo duda o incoherencia.
- Por cada cambio que hagas respecto a la primera extracción, añade UNA observación breve con el formato: "campo: <antes> → <después> (motivo)". Conserva las observaciones previas que sigan siendo válidas.
- Devuelve la extracción COMPLETA ya revisada, en el mismo esquema. Escribe las observaciones en español.`;

const SYSTEM_REVISION_EN = `You are a senior technical reviewer. You receive a drawing and a FIRST data extraction made by another system. Your task is to VERIFY and CORRECT it against the drawing:
- Check each field for coherence: the value must fit the part type, the other dimensions, the units (all in mm) and physical plausibility (e.g. thickness < length, width ≤ length, reasonable radii/angles, material family consistent with the grade).
- Pay SPECIAL ATTENTION to fields marked with "media" (medium) or "baja" (low) confidence: read them again on the drawing and confirm or correct them.
- MATH AUDIT: check whatever assertions the drawing allows, especially that partial dimensions add up to the total (L_total = Σ partials ± tolerance) and that the flat-pattern faces are consistent with the part's overall dimensions. Also verify each cota_interior flag: an inside dimension + adjacent thicknesses must match the outside dimension when both appear.
- BOUNDING DIMENSION WITH RADII (frequent error): check whether any envelope dimension (length/width/height/diameter) is bounded by an arc/radius whose center sits on a dimensioned point. If so, the real envelope is dimension-to-center + radius (e.g. height 90 to the center of an R70 arc → 160 mm actual). Correct the value by adding the radius and add the matching observation; if the first extraction already did this, confirm it.
- Correct a value ONLY if the drawing supports it; NEVER make it up. If something isn't legible, leave null.
- Update the confidence: raise to "alta" only if it's now clearly legible/verifiable; use "media"/"baja" if doubt or inconsistency remains.
- For each change vs the first extraction, add ONE short observation formatted: "field: <before> → <after> (reason)". Keep previous observations that still hold.
- Return the FULL revised extraction in the same schema. Write observations in English.`;

function sistemaRevision(idioma) {
  return idioma === 'en' ? SYSTEM_REVISION_EN : SYSTEM_REVISION_ES;
}

function instruccionRevision(idioma, previa) {
  const json = JSON.stringify(previa);
  return idioma === 'en'
    ? `Review and correct this first extraction against the drawing. First extraction (JSON):\n${json}`
    : `Revisa y corrige esta primera extracción comparándola con el plano. Primera extracción (JSON):\n${json}`;
}

/** Bloque de texto OCR (opcional) que se adjunta a la instrucción del usuario como referencia. */
function bloqueOcr(ocrTexto, idioma) {
  if (!ocrTexto) return '';
  return idioma === 'en'
    ? `\n\nOCR TEXT detected in the image (raw reference, may contain errors; use it to cross-check small figures and texts, NOT as ground truth). Format token@(x,y) with normalized 0-1 position:\n${ocrTexto}`
    : `\n\nTEXTO OCR detectado en la imagen (referencia cruda, puede tener errores; úsalo para cotejar cifras y textos pequeños, NO como verdad absoluta). Formato token@(x,y) con posición normalizada 0-1:\n${ocrTexto}`;
}

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
 * Bloque con los campos adicionales que el usuario ya tiene definidos (creados
 * a mano o por la propia app en análisis anteriores). Se inyecta para que el
 * modelo reutilice EXACTAMENTE esos nombres en "campos_extra" en vez de crear
 * variantes ("tratamiento térmico" vs "trat. térmico"), que luego el creador
 * de campos del cliente tendría que deduplicar.
 */
function bloqueCamposExtra(camposExtra, idioma) {
  if (!Array.isArray(camposExtra)) return '';
  const nombres = camposExtra.map((n) => String(n).trim()).filter(Boolean).slice(0, 50);
  if (!nombres.length) return '';
  return idioma === 'en'
    ? `\n\nThe user already has these EXTRA FIELDS defined. When the drawing contains one of these data points, return it in "campos_extra" using EXACTLY this name:\n${nombres.map((n) => `- ${n}`).join('\n')}`
    : `\n\nEl usuario ya tiene definidos estos CAMPOS ADICIONALES. Cuando el plano contenga uno de estos datos, devuélvelo en "campos_extra" usando EXACTAMENTE este nombre:\n${nombres.map((n) => `- ${n}`).join('\n')}`;
}

/**
 * Prompt de sistema efectivo para esta petición: el prompt base; si hay
 * feedback humano acumulado suficiente, las lecciones destiladas (agregadas) y
 * los ejemplos few-shot (correcciones concretas) de análisis previos —
 * aprendizaje en contexto sin reentrenar—; los alias de campo del usuario; y
 * sus campos adicionales ya definidos.
 */
function construirSystemEfectivo(idioma, alias, camposExtra) {
  const base = sistemaBase(idioma);
  const lecciones = construirLeccionesAprendidas(idioma);
  const ejemplos = construirEjemplosCorreccion(idioma);
  return `${base}${lecciones ? `\n\n${lecciones}` : ''}${ejemplos ? `\n\n${ejemplos}` : ''}${bloqueAlias(alias, idioma)}${bloqueCamposExtra(camposExtra, idioma)}`;
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

async function extraerConAnthropic({ mediaType, dataBase64, apiKey, model, idioma, alias, camposExtra, previa, ocrTexto }) {
  const m = mensajes(idioma);
  const client = crearCliente(apiKey);
  const system = previa ? sistemaRevision(idioma) : construirSystemEfectivo(idioma, alias, camposExtra);
  const texto = (previa ? instruccionRevision(idioma, previa) : INSTRUCCION[idioma === 'en' ? 'en' : 'es']) + bloqueOcr(ocrTexto, idioma);
  const response = await client.messages.parse({
    model: MODELOS_ANTHROPIC.includes(model) ? model : MODELO_DEFECTO,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system,
    messages: [
      {
        role: 'user',
        content: [bloqueDocumento(mediaType, dataBase64), { type: 'text', text: texto }],
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
async function extraerConGenerico({ proveedor, mediaType, dataBase64, apiKey, baseUrl, model, idioma, alias, camposExtra, previa, ocrTexto }) {
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
  const instruccionBase = previa ? instruccionRevision(idioma, previa) : INSTRUCCION[idioma === 'en' ? 'en' : 'es'];
  const ocr = bloqueOcr(ocrTexto, idioma);
  const instruccion =
    idioma === 'en'
      ? `${instruccionBase}${ocr}\n\nRespond EXCLUSIVELY with a valid JSON object, no markdown or extra text, that exactly matches this JSON Schema:\n${JSON.stringify(esquemaJson)}`
      : `${instruccionBase}${ocr}\n\nResponde EXCLUSIVAMENTE con un objeto JSON válido, sin markdown ni texto adicional, que cumpla exactamente este JSON Schema:\n${JSON.stringify(esquemaJson)}`;
  const parametros = {
    baseUrl: resolverBaseUrl(proveedor, baseUrl, idioma),
    apiKey,
    model: model.trim(),
    system: previa ? sistemaRevision(idioma) : construirSystemEfectivo(idioma, alias, camposExtra),
    instruccion,
    mediaType,
    dataBase64,
    idioma,
  };

  const crudo = proveedor === 'google' ? await llamarGoogle(parametros) : await llamarOpenAICompat(parametros);
  // Estos proveedores redactan el JSON desde el esquema del prompt y se desvían
  // en la forma; se repara antes de validar para no tirar todo el análisis por
  // un detalle de formato (ver server/reparar.js).
  const validado = EsquemaExtraccion.safeParse(repararExtraccion(crudo, idioma));
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

export async function extraerDatosPlano({ mediaType, dataBase64, config, ocrPrevio }) {
  const { proveedor = 'anthropic', apiKey, baseUrl, modelo, idioma, alias, camposExtra, revisar, ocr } = config ?? {};
  if (!esProveedorValido(proveedor)) {
    const err = new Error(mensajes(idioma).proveedorDesconocido(proveedor));
    err.status = 400;
    throw err;
  }

  if (proveedor === 'anthropic' && !apiKey && !hayClaveServidor()) {
    return { demo: true, revisado: false, datos: idioma === 'en' ? DATOS_DEMO_EN : DATOS_DEMO_ES };
  }

  // Guardarraíl opcional: OCR de la imagen como texto de referencia (solo pasada 1).
  // Si el cliente ya lo pre-calculó para esta pieza (cola de planos), se usa tal
  // cual (ocrPrevio: string, o null si su OCR no dio nada) y no se repite aquí.
  const ocrTexto = ocrPrevio !== undefined ? ocrPrevio : ocr ? await ocrImagen({ mediaType, dataBase64 }) : null;

  const comun = { mediaType, dataBase64, apiKey, idioma, alias, camposExtra, model: modelo };
  const extraer = (extra) =>
    proveedor === 'anthropic'
      ? extraerConAnthropic({ ...comun, ...extra })
      : extraerConGenerico({ proveedor, baseUrl, ...comun, ...extra });

  // Pasada 1: scan del plano (con el texto OCR si está disponible).
  const datos1 = await extraer({ ocrTexto });
  if (revisar === false) {
    return { demo: false, revisado: false, datos: datos1 };
  }

  // Pasada 2 (capa de razonamiento): verifica coherencia y re-examina lo dudoso.
  // Si la segunda pasada falla, se devuelve la primera extracción sin romper la petición.
  try {
    const datos2 = await extraer({ previa: datos1 });
    return { demo: false, revisado: true, datos: datos2 };
  } catch (err) {
    console.error('[revision]', err);
    return { demo: false, revisado: false, datos: datos1 };
  }
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
  sistema_unidades: 'metrico',
  desarrollo: {
    lados: [
      { longitud_mm: 180, cota_interior: false },
      { longitud_mm: 120, cota_interior: false },
      { longitud_mm: 120, cota_interior: false },
    ],
    pliegues: [
      { angulo_grados: 90, radio_mm: 3 },
      { angulo_grados: 90, radio_mm: 3 },
    ],
  },
  campos_extra: [
    { nombre: 'peso', valor: '2.4 kg', confianza: 'media' },
    { nombre: 'escala', valor: '1:5', confianza: 'alta' },
  ],
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
  sistema_unidades: 'metrico',
  desarrollo: {
    lados: [
      { longitud_mm: 180, cota_interior: false },
      { longitud_mm: 120, cota_interior: false },
      { longitud_mm: 120, cota_interior: false },
    ],
    pliegues: [
      { angulo_grados: 90, radio_mm: 3 },
      { angulo_grados: 90, radio_mm: 3 },
    ],
  },
  campos_extra: [
    { nombre: 'weight', valor: '2.4 kg', confianza: 'media' },
    { nombre: 'scale', valor: '1:5', confianza: 'alta' },
  ],
  observaciones: [
    'DEMO MODE: this is sample data; configure a provider in ⚙ Settings to analyze real drawings.',
    'The finish appears in a hard-to-read handwritten note; confirm with the customer.',
    'The 185 mm dimension only appears on the side view; there is no general width dimension.',
  ],
};
