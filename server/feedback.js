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
import { fileURLToPath } from 'node:url';
import { CAMPOS } from './esquema.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DIR_DATOS = path.join(AQUI, 'datos');
const ARCHIVO_FEEDBACK = path.join(DIR_DATOS, 'feedback.jsonl');

const MIN_MUESTRAS_LECCION = 5;
const TASA_MINIMA_AVISO = 0.2;
const MAX_LECCIONES = 6;

function valorDe(extraccion, campo) {
  return extraccion?.[campo]?.valor ?? null;
}

function confianzaDe(extraccion, campo) {
  return extraccion?.[campo]?.confianza ?? null;
}

function calcularCamposCorregidos(original, final) {
  return CAMPOS.filter((campo) => JSON.stringify(valorDe(original, campo)) !== JSON.stringify(valorDe(final, campo)));
}

/**
 * Registra un evento de feedback (corrección humana) tras revisar una extracción.
 * `imagen` es opcional (el usuario decide si incluirla) — solo con imagen el
 * evento sirve para un futuro fine-tuning multimodal real; sin ella, solo
 * alimenta las lecciones aprendidas en contexto y la calibración.
 */
export function registrarFeedback({ extraccionOriginal, extraccionFinal, proveedor, modelo, imagen, idioma }) {
  if (!existsSync(DIR_DATOS)) mkdirSync(DIR_DATOS, { recursive: true });
  const camposCorregidos = calcularCamposCorregidos(extraccionOriginal, extraccionFinal);
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
  appendFileSync(ARCHIVO_FEEDBACK, JSON.stringify(evento) + '\n', 'utf8');
  return { id: evento.id, camposCorregidos };
}

function leerEventos() {
  if (!existsSync(ARCHIVO_FEEDBACK)) return [];
  const lineas = readFileSync(ARCHIVO_FEEDBACK, 'utf8').split('\n');
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
