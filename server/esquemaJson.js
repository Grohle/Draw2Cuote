/**
 * El mismo esquema de extracción, expresado en el formato que cada proveedor
 * sabe IMPONER a su modelo. La idea es no depender de que el modelo copie bien
 * un esquema escrito en el prompt: siempre que el proveedor admita structured
 * outputs, se le manda el esquema por su canal nativo y la forma deja de ser
 * negociable.
 *
 * La fuente es siempre EsquemaExtraccion (server/esquema.js), traducido por el
 * conversor propio de Zod. No se usa aquí el helper de Anthropic porque
 * codifica los enums como texto dentro de "description" en vez de emitir la
 * palabra clave `enum`, y precisamente esos enums eran lo que los modelos sin
 * structured outputs devolvían mal ("Acero Inoxidable" en vez del valor).
 */
import { z } from 'zod/v4';
import { EsquemaExtraccion } from './esquema.js';

/** JSON Schema estándar (draft 2020-12) del esquema de extracción. */
export const ESQUEMA_JSON = z.toJSONSchema(EsquemaExtraccion, { target: 'draft-2020-12', io: 'output' });

/**
 * Formato de OpenAI (`response_format: json_schema` en modo estricto), que
 * hablan también vLLM, LM Studio, Ollama, OpenRouter y demás compatibles. El
 * modo estricto exige objetos cerrados y todas las propiedades en `required`,
 * que es justo lo que ya produce Zod; solo sobra la metaclave `$schema`.
 */
export const ESQUEMA_OPENAI = (({ $schema, ...resto }) => resto)(ESQUEMA_JSON);

/** Claves del JSON Schema que Gemini entiende; el resto lo rechaza. */
const CLAVES_GEMINI = ['type', 'format', 'description', 'enum', 'items', 'properties', 'required', 'nullable'];

/**
 * Formato de Google Gemini (`generationConfig.responseSchema`): un subconjunto
 * de OpenAPI 3.0, no JSON Schema. Las diferencias que importan aquí:
 * `anyOf: [T, null]` se expresa como T con `nullable: true`, y no admite
 * `additionalProperties` ni `$schema`.
 */
function aGemini(nodo) {
  if (!nodo || typeof nodo !== 'object') return nodo;

  // Un nullable de Zod llega como anyOf entre el tipo real y "null".
  if (Array.isArray(nodo.anyOf)) {
    const alternativas = nodo.anyOf.filter((rama) => rama?.type !== 'null');
    const admiteNull = alternativas.length !== nodo.anyOf.length;
    // Nuestro esquema solo usa anyOf para nullables, así que siempre queda una
    // alternativa; si algún día hubiera una unión real, se toma la primera y la
    // capa de reparación se encarga de lo que no encaje.
    const base = aGemini(alternativas[0] ?? {});
    return {
      ...base,
      ...(nodo.description ? { description: nodo.description } : {}),
      ...(admiteNull ? { nullable: true } : {}),
    };
  }

  const salida = {};
  for (const clave of CLAVES_GEMINI) {
    if (!(clave in nodo)) continue;
    if (clave === 'items') salida.items = aGemini(nodo.items);
    else if (clave === 'properties') {
      salida.properties = Object.fromEntries(Object.entries(nodo.properties).map(([k, v]) => [k, aGemini(v)]));
    } else salida[clave] = nodo[clave];
  }
  // Gemini respeta el orden que se le indique; con él la salida es más estable.
  if (salida.properties) salida.propertyOrdering = Object.keys(salida.properties);
  return salida;
}

export const ESQUEMA_GEMINI = aGemini(ESQUEMA_JSON);
