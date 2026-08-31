/**
 * Bucle de aprendizaje por feedback: cada vez que un usuario revisa y
 * confirma/corrige una extracción, ese par (predicción, valor correcto)
 * se guarda como dato de entrenamiento. Con él:
 *  1) calculamos estadísticas de calibración reales (precisión por campo),
 *  2) destilamos "lecciones aprendidas" que se inyectan en el prompt de la
 *     siguiente extracción, para que el modelo mejore sin reentrenar pesos.
 *
 * Almacenamiento: JSONL en disco (server/datos/feedback.jsonl). Suficiente
 * para el volumen de un despliegue pequeño/demo; para producción a más
 * escala, sustituir por una base de datos sin cambiar la API de este módulo.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dirDatos } from './almacen.js';
import { CAMPOS } from './esquema.js';

export function archivoFeedback() {
  return path.join(dirDatos(), 'feedback.jsonl');
}

const MIN_MUESTRAS_LECCION = 5;
const TASA_MINIMA_AVISO = 0.2;
const MAX_LECCIONES = 6;

function valorDe(extraccion, campo) {
  return extraccion?.[campo]?.valor ?? null;
}

function confianzaDe(extraccion, campo) {
  return extraccion?.[campo]?.confianza ?? null;
}

function calcularCamposCorregidos(original, final, camposCalculados = []) {
  return CAMPOS.filter(
    (campo) =>
      !camposCalculados.includes(campo) &&
      JSON.stringify(valorDe(original, campo)) !== JSON.stringify(valorDe(final, campo))
  );
}

/**
 * Campos cuyo valor final NO lo leyó el modelo sino que lo calculó la app (hoy,
 * el desarrollo de chapa volcado a su cota). No son correcciones humanas:
 * contarlos como tales falsearía la calibración, que mide aciertos de LECTURA.
 * Si el humano lo corrigió después lleva `editado` y vuelve a contar.
 *
 * Se leen del cuerpo tal cual llega, porque estas marcas son del cliente y no
 * forman parte del esquema del modelo (Zod las descarta al validar).
 */
export function camposCalculados(extraccion) {
  if (!extraccion || typeof extraccion !== 'object') return [];
  return CAMPOS.filter((campo) => {
    const c = extraccion[campo];
    return Boolean(c && typeof c === 'object' && c.origen && !c.editado);
  });
}

/**
 * Registra un evento de feedback (corrección humana) tras revisar una extracción.
 * `imagen` es opcional (el usuario decide si incluirla) — solo con imagen el
 * evento sirve para un futuro fine-tuning multimodal real; sin ella, solo
 * alimenta las lecciones aprendidas en contexto y la calibración.
 */
export function registrarFeedback({ extraccionOriginal, extraccionFinal, calculados, proveedor, modelo, imagen, idioma }) {
  if (!existsSync(dirDatos())) mkdirSync(dirDatos(), { recursive: true });
  const camposCorregidos = calcularCamposCorregidos(extraccionOriginal, extraccionFinal, calculados);
  const evento = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    proveedor: proveedor || 'desconocido',
    modelo: modelo || 'desconocido',
    idioma: idioma === 'en' ? 'en' : 'es',
    extraccion_original: extraccionOriginal,
    extraccion_final: extraccionFinal,
    campos_corregidos: camposCorregidos,
    imagen: imagen && imagen.mediaType && imagen.dataBase64 ? { mediaType: imagen.mediaType, dataBase64: imagen.dataBase64 } : null,
  };
  appendFileSync(archivoFeedback(), JSON.stringify(evento) + '\n', 'utf8');
  return { id: evento.id, camposCorregidos };
}

function leerEventos() {
  if (!existsSync(archivoFeedback())) return [];
  const lineas = readFileSync(archivoFeedback(), 'utf8').split('\n');
  const eventos = [];
  for (const linea of lineas) {
    const l = linea.trim();
    if (!l) continue;
    try {
      eventos.push(JSON.parse(l));
    } catch {
      // línea corrupta (p. ej. escritura interrumpida a mitad): se ignora
    }
  }
  return eventos;
}

/** Estadísticas de calibración: por campo, cuántas veces se ha corregido y con qué confianza original. */
export function calcularEstadisticas() {
  const eventos = leerEventos();
  const porCampo = Object.fromEntries(
    CAMPOS.map((campo) => [
      campo,
      {
        vecesVisto: 0,
        vecesCorregido: 0,
        porConfianza: {
          alta: { visto: 0, corregido: 0 },
          media: { visto: 0, corregido: 0 },
          baja: { visto: 0, corregido: 0 },
        },
      },
    ])
  );

  for (const ev of eventos) {
    for (const campo of CAMPOS) {
      const stats = porCampo[campo];
      const corregido = ev.campos_corregidos?.includes(campo) ?? false;
      stats.vecesVisto++;
      if (corregido) stats.vecesCorregido++;
      const conf = confianzaDe(ev.extraccion_original, campo);
      if (conf && stats.porConfianza[conf]) {
        stats.porConfianza[conf].visto++;
        if (corregido) stats.porConfianza[conf].corregido++;
      }
    }
  }

  const campos = Object.entries(porCampo)
    .map(([campo, s]) => ({ campo, ...s, tasaCorreccion: s.vecesVisto ? s.vecesCorregido / s.vecesVisto : 0 }))
    .sort((a, b) => b.tasaCorreccion - a.tasaCorreccion);

  return { totalAnalisisConFeedback: eventos.length, campos };
}

const TEXTOS_LECCION = {
  es: {
    titulo: (n) => `LECCIONES APRENDIDAS DE CORRECCIONES PREVIAS DE USUARIOS (basado en ${n} análisis revisados con feedback):`,
    tasaCorreccion: (campo, pct, corregido, visto) =>
      `- "${campo}" se ha corregido en el ${pct}% de los análisis revisados por usuarios (${corregido}/${visto}). Sé más conservador marcando confianza media o baja en este campo si hay cualquier ambigüedad.`,
    transicionNull: (campo, valor, veces, total) =>
      `- "${campo}": cuando devuelves null, los usuarios lo han corregido a "${valor}" en ${veces} de ${total} casos. Antes de devolver null, comprueba si hay indicios suficientes para inferirlo, aunque sea con confianza baja.`,
    valoresFrecuentes: (campo, familia, lista) =>
      `- "${campo}" en piezas de familia "${familia}": valores más frecuentes tras corrección humana: ${lista}.`,
    desconocida: 'desconocida',
  },
  en: {
    titulo: (n) => `LESSONS LEARNED FROM PREVIOUS USER CORRECTIONS (based on ${n} reviewed analyses):`,
    tasaCorreccion: (campo, pct, corregido, visto) =>
      `- "${campo}" has been corrected in ${pct}% of analyses reviewed by users (${corregido}/${visto}). Be more conservative marking medium/low confidence on this field if there is any ambiguity.`,
    transicionNull: (campo, valor, veces, total) =>
      `- "${campo}": when you return null, users have corrected it to "${valor}" in ${veces} of ${total} cases. Before returning null, check whether there are enough clues to infer it, even at low confidence.`,
    valoresFrecuentes: (campo, familia, lista) =>
      `- "${campo}" on parts of family "${familia}": most frequent values after human correction: ${lista}.`,
    desconocida: 'unknown',
  },
};

/**
 * Destila el histórico de correcciones en un bloque de texto para inyectar
 * en el prompt del sistema de la siguiente extracción. Es aprendizaje "en
 * contexto" (sin tocar pesos del modelo): cuantas más correcciones acumula
 * la app, más se afina el comportamiento del modelo en la próxima llamada.
 * Devuelve null si aún no hay datos suficientes para sacar conclusiones fiables.
 * El texto se genera en el idioma de la petición actual, independientemente
 * del idioma en que se registrara cada evento de feedback original.
 */
export function construirLeccionesAprendidas(idioma) {
  const tx = TEXTOS_LECCION[idioma === 'en' ? 'en' : 'es'];
  const eventos = leerEventos();
  if (eventos.length < MIN_MUESTRAS_LECCION) return null;

  const lecciones = [];

  // 1) Campos que se corrigen con frecuencia: pide más cautela con su confianza.
  const { campos } = calcularEstadisticas();
  const conProblemas = campos.filter((c) => c.vecesVisto >= MIN_MUESTRAS_LECCION && c.tasaCorreccion >= TASA_MINIMA_AVISO);
  for (const c of conProblemas.slice(0, 3)) {
    lecciones.push(tx.tasaCorreccion(c.campo, Math.round(c.tasaCorreccion * 100), c.vecesCorregido, c.vecesVisto));
  }

  // 2) Transiciones null -> valor frecuentes en campos categóricos clave.
  for (const campo of ['tipo_pieza', 'material_familia']) {
    const transiciones = {};
    let totalNullCorregido = 0;
    for (const ev of eventos) {
      const original = valorDe(ev.extraccion_original, campo);
      const final = valorDe(ev.extraccion_final, campo);
      if (original == null && final != null) {
        totalNullCorregido++;
        transiciones[final] = (transiciones[final] ?? 0) + 1;
      }
    }
    const [valorTop, vecesTop] = Object.entries(transiciones).sort((a, b) => b[1] - a[1])[0] ?? [];
    if (valorTop && totalNullCorregido >= 3 && vecesTop / totalNullCorregido >= 0.5) {
      lecciones.push(tx.transicionNull(campo, valorTop, vecesTop, totalNullCorregido));
    }
  }

  // 3) Valores finales frecuentes tras corrección, agrupados por familia de material.
  for (const campo of ['material_calidad', 'acabado']) {
    const porFamilia = {};
    for (const ev of eventos) {
      if (!ev.campos_corregidos?.includes(campo)) continue;
      const familia = valorDe(ev.extraccion_final, 'material_familia') ?? tx.desconocida;
      const valorFinal = valorDe(ev.extraccion_final, campo);
      if (!valorFinal) continue;
      porFamilia[familia] ??= {};
      porFamilia[familia][valorFinal] = (porFamilia[familia][valorFinal] ?? 0) + 1;
    }
    for (const [familia, valores] of Object.entries(porFamilia)) {
      const entradas = Object.entries(valores).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const total = entradas.reduce((s, [, n]) => s + n, 0);
      if (total >= 3) {
        const lista = entradas.map(([v, n]) => `${v} (${n})`).join(', ');
        lecciones.push(tx.valoresFrecuentes(campo, familia, lista));
      }
    }
  }

  if (lecciones.length === 0) return null;
  return `${tx.titulo(eventos.length)}\n${lecciones.slice(0, MAX_LECCIONES).join('\n')}`;
}

const MAX_EJEMPLOS = 8;

const TEXTOS_EJEMPLO = {
  es: {
    titulo:
      'EJEMPLOS DE CORRECCIONES PREVIAS (few-shot). Son casos reales en los que una lectura del modelo se corrigió a mano. NO copies estos valores —cada plano es distinto— úsalos solo como recordatorio del tipo de error a vigilar y lee con más cuidado esos campos:',
    linea: (campo, antes, despues) => `- "${campo}": una lectura anterior fue ${antes} y la corrección humana fue ${despues}.`,
  },
  en: {
    titulo:
      'EXAMPLES OF PREVIOUS CORRECTIONS (few-shot). These are real cases where a model reading was corrected by hand. Do NOT copy these values —every drawing is different— use them only as a reminder of the kind of error to watch for, and read those fields more carefully:',
    linea: (campo, antes, despues) => `- "${campo}": a previous reading was ${antes} and the human correction was ${despues}.`,
  },
};

function formatearValor(valor) {
  if (valor == null) return 'null';
  return typeof valor === 'string' ? `"${valor}"` : String(valor);
}

/**
 * Inyección dinámica de ejemplos (MICL): recupera correcciones concretas
 * pasadas y las presenta como ejemplos few-shot en el prompt, para que el
 * modelo "recuerde" errores previos. Sin base vectorial: la relevancia se
 * aproxima por recencia y diversidad de campo (los ejemplos más nuevos y sin
 * repetir), no por similitud visual del recorte (eso queda como hoja de ruta
 * en ARQUITECTURA.md). Devuelve null si aún no hay muestra suficiente.
 */
export function construirEjemplosCorreccion(idioma) {
  const tx = TEXTOS_EJEMPLO[idioma === 'en' ? 'en' : 'es'];
  const eventos = leerEventos();
  if (eventos.length < MIN_MUESTRAS_LECCION) return null;

  const vistos = new Set();
  const lineas = [];
  // de los más recientes a los más antiguos, sin repetir el mismo antes→después
  for (const ev of [...eventos].reverse()) {
    for (const campo of ev.campos_corregidos ?? []) {
      const antes = formatearValor(valorDe(ev.extraccion_original, campo));
      const despues = formatearValor(valorDe(ev.extraccion_final, campo));
      const clave = `${campo}|${antes}|${despues}`;
      if (antes === despues || vistos.has(clave)) continue;
      vistos.add(clave);
      lineas.push(tx.linea(campo, antes, despues));
      if (lineas.length >= MAX_EJEMPLOS) break;
    }
    if (lineas.length >= MAX_EJEMPLOS) break;
  }

  if (lineas.length === 0) return null;
  return `${tx.titulo}\n${lineas.join('\n')}`;
}
