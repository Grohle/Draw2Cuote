/**
 * Reparación de la respuesta cruda de un proveedor SIN structured outputs
 * nativos (Gemini, Ollama, LM Studio, vLLM, compatibles OpenAI). Estos modelos
 * redactan el JSON "a ojo" a partir del esquema incrustado en el prompt y se
 * desvían en detalles de FORMA: lados como números sueltos en vez de objetos,
 * cota_interior ausente, un escalar donde va { valor, confianza }, "acero
 * inoxidable" con espacio en vez de "acero_inoxidable", "25.4 mm" como texto...
 * Sin esta capa, cualquiera de esas desviaciones hacía fallar la validación y
 * con ella TODO el análisis, aunque el resto de la lectura fuese correcta.
 *
 * Aquí se corrige la forma, NUNCA el contenido: lo que no se puede interpretar
 * queda en null con confianza baja, y todo valor descartado se anota en las
 * observaciones para que el humano lo vea. Es la contraparte en el servidor de
 * web/src/normalizar.ts, que hace lo mismo al recibir los datos en el cliente.
 */
import {
  CAMPOS,
  CONFIANZAS,
  EsquemaExtraccion,
  FAMILIAS_MATERIAL,
  SISTEMAS_UNIDADES,
  TIPOS_PIEZA,
} from './esquema.js';
import { mensajes } from './mensajes.js';

/** Campos escalares cuyo `valor` es numérico, deducidos del propio esquema. */
const CAMPOS_NUMERICOS = new Set(
  CAMPOS.filter((campo) => EsquemaExtraccion.shape[campo].safeParse({ valor: 1, confianza: 'alta' }).success)
);

// Mapas y no objetos: la clave sale de lo que devuelva el modelo, y en un objeto
// literal un "constructor" o un "__proto__" resolverían contra el prototipo.
/** Enum acotado de cada campo con valores cerrados (los demás son texto libre). */
const OPCIONES = new Map([
  ['tipo_pieza', TIPOS_PIEZA],
  ['material_familia', FAMILIAS_MATERIAL],
]);

const SINONIMOS_CONFIANZA = new Map([
  ['high', 'alta'], ['medium', 'media'], ['low', 'baja'],
  ['alto', 'alta'], ['medio', 'media'], ['bajo', 'baja'],
]);

const SINONIMOS_UNIDADES = new Map([
  ['metric', 'metrico'], ['mm', 'metrico'], ['milimetros', 'metrico'], ['millimeters', 'metrico'],
  ['in', 'imperial'], ['inch', 'imperial'], ['inches', 'imperial'], ['pulgadas', 'imperial'],
]);

/** Recorta un valor descartado para que la observación siga siendo legible. */
function resumir(valor) {
  const texto = JSON.stringify(valor) ?? String(valor);
  return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto;
}

const esObjeto = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Minúsculas sin acentos y con separadores unificados: "Acero Inoxidable" → "acero_inoxidable". */
function clave(texto) {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');
}

/**
 * Número a partir de lo que devuelva el modelo. Acepta el número tal cual y
 * también las formas con las que suele adornarlo: "25.4 mm", "Ø25,4", "R2".
 * Devuelve null si no hay ninguna cifra que leer.
 */
function aNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== 'string') return null;
  const cifra = valor.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  if (!cifra) return null;
  const n = Number(cifra[0]);
  return Number.isFinite(n) ? n : null;
}

function aConfianza(valor) {
  if (CONFIANZAS.includes(valor)) return valor;
  return SINONIMOS_CONFIANZA.get(clave(valor ?? '')) ?? 'media';
}

/**
 * Campo escalar { valor, confianza }. Si el modelo devolvió el escalar pelado
 * (`espesor_mm: 3`) lo envuelve; si el valor no encaja con el tipo del campo,
 * lo descarta a null y lo deja anotado en `descartes`.
 */
function repararCampo(nombre, bruto, descartes) {
  const objeto = esObjeto(bruto) ? bruto : { valor: bruto, confianza: 'baja' };
  const confianzaOriginal = aConfianza(objeto.confianza);
  const original = objeto.valor;
  if (original === null || original === undefined) return { valor: null, confianza: confianzaOriginal };

  let valor = null;
  // Reinterpretar el contenido (sacar "10" de "10 uds") sí resta fiabilidad;
  // arreglar solo la forma ("Acero Inoxidable", "25.4" como texto) no.
  let reinterpretado = false;
  if (OPCIONES.has(nombre)) {
    const normalizado = clave(original);
    valor = OPCIONES.get(nombre).includes(normalizado) ? normalizado : null;
  } else if (CAMPOS_NUMERICOS.has(nombre)) {
    valor = aNumero(original);
    reinterpretado = typeof original === 'string' && !/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(original);
  } else {
    valor = typeof original === 'string' ? original : String(original);
  }

  if (valor === null) {
    descartes.push(`${nombre}: ${resumir(original)}`);
    return { valor: null, confianza: 'baja' };
  }
  return { valor, confianza: reinterpretado ? 'baja' : confianzaOriginal };
}

/**
 * Geometría de plegado. Es donde más se desvían estos modelos, porque el prompt
 * la describe con ejemplos numéricos ("caras 25.4, 47.6 y 95.25") y muchos
 * devuelven la lista de números en vez de la lista de objetos.
 */
function repararDesarrollo(bruto) {
  const d = esObjeto(bruto) ? bruto : {};

  const lados = (Array.isArray(d.lados) ? d.lados : Array.isArray(d.lados_mm) ? d.lados_mm : [])
    .map((lado) => {
      const o = esObjeto(lado) ? lado : { longitud_mm: lado };
      return { longitud_mm: aNumero(o.longitud_mm), cota_interior: o.cota_interior === true || o.cota_interior === 'true' };
    })
    .filter((lado) => lado.longitud_mm !== null && lado.longitud_mm > 0);

  const pliegues = (Array.isArray(d.pliegues) ? d.pliegues : []).map((pliegue) => {
    const o = esObjeto(pliegue) ? pliegue : { angulo_grados: pliegue };
    return { angulo_grados: aNumero(o.angulo_grados), radio_mm: aNumero(o.radio_mm) };
  });

  return { lados, pliegues };
}

function repararCamposExtra(bruto) {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((campo) => {
      const o = esObjeto(campo) ? campo : {};
      const valor = o.valor;
      return {
        nombre: typeof o.nombre === 'string' ? o.nombre.trim() : '',
        valor: valor === null || valor === undefined ? null : String(valor),
        confianza: aConfianza(o.confianza),
      };
    })
    .filter((campo) => campo.nombre);
}

function repararObservaciones(bruto) {
  const lista = Array.isArray(bruto) ? bruto : typeof bruto === 'string' ? [bruto] : [];
  return lista.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim());
}

/**
 * Devuelve la extracción con la forma que exige el esquema. Si `bruto` no es
 * siquiera un objeto no hay nada que reparar: se devuelve tal cual para que la
 * validación falle con un mensaje honesto en vez de fabricar una lectura vacía.
 */
export function repararExtraccion(bruto, idioma) {
  if (!esObjeto(bruto)) return bruto;

  const descartes = [];
  const reparada = {};
  for (const campo of CAMPOS) {
    reparada[campo] = repararCampo(campo, bruto[campo], descartes);
  }

  const unidades = clave(bruto.sistema_unidades ?? '');
  reparada.sistema_unidades = SISTEMAS_UNIDADES.includes(unidades)
    ? unidades
    : (SINONIMOS_UNIDADES.get(unidades) ?? null);

  reparada.desarrollo = repararDesarrollo(bruto.desarrollo);
  reparada.campos_extra = repararCamposExtra(bruto.campos_extra);
  reparada.observaciones = repararObservaciones(bruto.observaciones);

  // Nada se pierde en silencio: lo que no se pudo interpretar se le dice al humano.
  if (descartes.length) {
    reparada.observaciones.push(mensajes(idioma).valoresDescartados(descartes.join('; ')));
  }
  return reparada;
}
