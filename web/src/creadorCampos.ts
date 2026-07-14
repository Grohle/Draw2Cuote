import { CLAVES_CAMPO, type CamposPersonalizados } from './camposPersonalizados';
import { obtenerTextos } from './i18n';

/**
 * CREADOR DE CAMPOS — skill compartida por la IA y el humano.
 *
 * Cuando un análisis devuelve datos rotulados que no encajan en ningún campo
 * del esquema (peso, escala, tratamiento térmico...), esta skill decide si se
 * crea un campo adicional. La usa la app automáticamente tras cada análisis
 * (propuestas del modelo en "campos_extra") y el usuario a mano desde 🏷 Campos.
 * Ambos caminos pasan por los MISMOS guardarraíles:
 *
 *  1. Normalización: minúsculas, sin acentos, espacios colapsados; el id es la
 *     forma snake_case ("Tratamiento Térmico" → "tratamiento_termico").
 *  2. Anti-duplicados: se rechaza si el nombre coincide (normalizado) con un
 *     campo del esquema, con su etiqueta en español o inglés, con la etiqueta
 *     personalizada del usuario, con un alias configurado, o con un campo
 *     adicional ya existente.
 *  3. Límites: nombre de 2 a 40 caracteres tras normalizar, solo letras,
 *     números y espacios, y un máximo de MAX_CAMPOS_EXTRA campos en total.
 *
 * El resultado nunca lanza: devuelve qué se creó y qué se rechazó (con motivo),
 * para que la UI o el registro puedan mostrarlo.
 */

export interface CampoExtra {
  /** Identificador estable en snake_case (también clave de deduplicación). */
  id: string;
  /** Nombre a mostrar, tal como se creó ("tratamiento térmico"). */
  nombre: string;
}

export type MotivoRechazo = 'duplicado' | 'invalido' | 'limite';

export interface Rechazo {
  nombre: string;
  motivo: MotivoRechazo;
  /** Con qué campo existente choca, cuando el motivo es 'duplicado'. */
  conflicto?: string;
}

export interface ResultadoCreacion {
  /** Campos nuevos aceptados (aún no incorporados: el llamante decide guardarlos). */
  creados: CampoExtra[];
  rechazados: Rechazo[];
}

export const MAX_CAMPOS_EXTRA = 30;
const MIN_LARGO = 2;
const MAX_LARGO = 40;

/** Forma canónica para comparar y deduplicar: minúsculas, sin acentos, un solo espacio. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita las tildes ya separadas por NFD
    .toLowerCase()
    .replace(/[_\-./]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Id snake_case a partir del nombre ya normalizado. */
function idDe(nombreNormalizado: string): string {
  return nombreNormalizado.replace(/ /g, '_');
}

/**
 * Universo de nombres ya ocupados (normalizados) contra el que se comprueba la
 * duplicidad: claves del esquema, sus etiquetas ES y EN, las etiquetas y alias
 * personalizados del usuario, y los campos adicionales ya creados. El valor del
 * mapa es el nombre "humano" del campo con el que choca, para el mensaje.
 */
function nombresOcupados(cp: CamposPersonalizados): Map<string, string> {
  const ocupados = new Map<string, string>();
  const apuntar = (texto: string | undefined, dueno: string) => {
    const n = normalizarNombre(texto ?? '');
    if (n && !ocupados.has(n)) ocupados.set(n, dueno);
  };
  for (const idioma of ['es', 'en'] as const) {
    const etiquetas = obtenerTextos(idioma).campos;
    for (const clave of CLAVES_CAMPO) {
      apuntar(clave, etiquetas[clave]);
      apuntar(etiquetas[clave], etiquetas[clave]);
      apuntar(cp[clave]?.etiqueta, etiquetas[clave]);
      for (const alias of cp[clave]?.alias ?? []) apuntar(alias, etiquetas[clave]);
    }
  }
  for (const extra of cp.extra ?? []) {
    apuntar(extra.id, extra.nombre);
    apuntar(extra.nombre, extra.nombre);
  }
  return ocupados;
}

/**
 * Evalúa una lista de nombres propuestos (del modelo o del usuario) y devuelve
 * los campos nuevos a crear y los rechazos con su motivo. No modifica nada:
 * el llamante añade `creados` a camposPersonalizados.extra y los guarda.
 */
export function procesarPropuestas(nombres: string[], cp: CamposPersonalizados): ResultadoCreacion {
  const ocupados = nombresOcupados(cp);
  const creados: CampoExtra[] = [];
  const rechazados: Rechazo[] = [];
  let total = (cp.extra ?? []).length;

  for (const bruto of nombres) {
    const nombre = String(bruto ?? '').trim();
    const normalizado = normalizarNombre(nombre);
    if (normalizado.length < MIN_LARGO || normalizado.length > MAX_LARGO) {
      rechazados.push({ nombre, motivo: 'invalido' });
      continue;
    }
    const conflicto = ocupados.get(normalizado);
    if (conflicto) {
      rechazados.push({ nombre, motivo: 'duplicado', conflicto });
      continue;
    }
    if (total >= MAX_CAMPOS_EXTRA) {
      rechazados.push({ nombre, motivo: 'limite' });
      continue;
    }
    const campo: CampoExtra = { id: idDe(normalizado), nombre: normalizado };
    creados.push(campo);
    ocupados.set(normalizado, campo.nombre); // evita duplicados dentro del mismo lote
    total += 1;
  }
  return { creados, rechazados };
}

/** Camino manual (modal 🏷 Campos): un solo nombre, mismos guardarraíles. */
export function crearCampoManual(nombre: string, cp: CamposPersonalizados): ResultadoCreacion {
  return procesarPropuestas([nombre], cp);
}
