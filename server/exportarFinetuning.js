#!/usr/bin/env node
/**
 * Convierte server/datos/feedback.jsonl (correcciones humanas acumuladas) en
 * un dataset de fine-tuning listo para adaptar al proveedor/entrenador que se
 * vaya a usar (formato genérico de mensajes system/user/assistant, compatible
 * con la mayoría de pipelines de SFT).
 *
 * Uso: npm run feedback:exportar
 *
 * Los eventos sin imagen (el usuario no marcó "incluir imagen" al guardar el
 * feedback) solo sirven para ajustar el criterio textual del modelo, no para
 * reentrenar la parte de visión — se marcan con una nota en el propio dataset.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM } from './extract.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ORIGEN = path.join(AQUI, 'datos', 'feedback.jsonl');
const DESTINO = path.join(AQUI, 'datos', 'finetuning.jsonl');

const INSTRUCCION = 'Extrae los datos de este plano para presupuestarlo. Sigue las reglas del sistema al pie de la letra.';

if (!existsSync(ORIGEN)) {
  console.error(`No hay feedback registrado todavía en ${ORIGEN}.`);
  console.error('Analiza planos, corrige/confirma resultados y pulsa "Guardar corrección" en la app antes de exportar.');
  process.exit(1);
}

const eventos = readFileSync(ORIGEN, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

if (eventos.length === 0) {
  console.error('El archivo de feedback existe pero está vacío.');
  process.exit(1);
}

const lineas = eventos.map((ev) => {
  const contenidoUsuario = [];
  if (ev.imagen?.dataBase64) {
    contenidoUsuario.push({
      type: ev.imagen.mediaType === 'application/pdf' ? 'document' : 'image',
      source: { type: 'base64', media_type: ev.imagen.mediaType, data: ev.imagen.dataBase64 },
    });
  } else {
    contenidoUsuario.push({
      type: 'text',
      text: '[Imagen del plano no incluida en este evento — usuario no marcó "incluir imagen". Este ejemplo solo es útil para fine-tuning textual/de criterio, no de visión.]',
    });
  }
  contenidoUsuario.push({ type: 'text', text: INSTRUCCION });

  return JSON.stringify({
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: contenidoUsuario },
      { role: 'assistant', content: JSON.stringify(ev.extraccion_final) },
    ],
    metadata: {
      id: ev.id,
      timestamp: ev.timestamp,
      proveedor: ev.proveedor,
      modelo: ev.modelo,
      campos_corregidos: ev.campos_corregidos,
      con_imagen: Boolean(ev.imagen?.dataBase64),
    },
  });
});

writeFileSync(DESTINO, lineas.join('\n') + '\n', 'utf8');

const conImagen = eventos.filter((e) => e.imagen?.dataBase64).length;
console.log(`Exportados ${eventos.length} ejemplos a ${DESTINO}`);
console.log(`  con imagen (fine-tuning multimodal): ${conImagen}`);
console.log(`  solo texto (ajuste de criterio):      ${eventos.length - conImagen}`);
console.log('');
console.log('Formato: JSONL con mensajes system/user/assistant. Adapta el envoltorio al');
console.log('proveedor de fine-tuning que uses (job de fine-tuning, entrenador LoRA local, etc.).');
