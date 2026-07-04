import { ESPESORES_ESTANDAR } from './catalogo';
import type { Aviso, Extraccion } from './tipos';

const PATRONES_INOX = /aisi|inox|1\.4\d{3}|x\d+cr/i;
const PATRONES_ALUMINIO = /^(10|30|50|60|70)\d{2}\b|al[\s-]?mg|en[\s-]?aw/i;
const PATRONES_ACERO = /^s\d{3}|^dc0|^dd1|^st\b/i;
const PATRONES_GALVA = /dx5\d|\+z\d|gd\+z/i;

/**
 * Comprobaciones de coherencia sobre los datos extraídos. No bloquean:
 * generan avisos para que el presupuestista revise antes de dar precio.
 */
export function validar(datos: Extraccion): Aviso[] {
  const avisos: Aviso[] = [];

  const esp = datos.espesor_mm.valor;
  if (esp == null) {
    avisos.push({ campo: 'espesor_mm', mensaje: 'Falta el espesor: imprescindible para presupuestar.' });
  } else if (esp <= 0 || esp > 100) {
    avisos.push({ campo: 'espesor_mm', mensaje: `Espesor de ${esp} mm fuera de rango razonable.` });
  } else if (!ESPESORES_ESTANDAR.includes(esp)) {
    avisos.push({
      campo: 'espesor_mm',
      mensaje: `${esp} mm no es un espesor comercial habitual; verifica que no sea otra cota.`,
    });
  }

  const largo = datos.largo_mm.valor;
  const ancho = datos.ancho_mm.valor;
  if (largo != null && ancho != null && ancho > largo) {
    avisos.push({ campo: 'ancho_mm', mensaje: 'El ancho es mayor que el largo; revisa si las cotas están intercambiadas.' });
  }
  for (const [campo, v] of [['largo_mm', largo], ['ancho_mm', ancho]] as const) {
    if (v != null && (v <= 0 || v > 12000)) {
      avisos.push({ campo, mensaje: `Valor de ${v} mm fuera de rango razonable.` });
    }
  }
  if (esp != null && largo != null && esp > largo) {
    avisos.push({ campo: 'espesor_mm', mensaje: 'El espesor es mayor que el largo; probable confusión de cotas.' });
  }

  if (datos.cantidad.valor == null) {
    avisos.push({ campo: 'cantidad', mensaje: 'Falta la cantidad: el precio unitario depende de ella.' });
  } else if (!Number.isInteger(datos.cantidad.valor) || datos.cantidad.valor <= 0) {
    avisos.push({ campo: 'cantidad', mensaje: 'La cantidad debe ser un entero positivo.' });
  }

  // Coherencia familia ↔ calidad
  const familia = datos.material_familia.valor;
  const calidad = datos.material_calidad.valor ?? '';
  if (calidad) {
    if (PATRONES_INOX.test(calidad) && familia !== 'acero_inoxidable') {
      avisos.push({ campo: 'material_calidad', mensaje: `"${calidad}" parece inoxidable pero la familia es otra.` });
    }
    if (PATRONES_ALUMINIO.test(calidad) && familia !== 'aluminio') {
      avisos.push({ campo: 'material_calidad', mensaje: `"${calidad}" parece aluminio pero la familia es otra.` });
    }
    if (PATRONES_GALVA.test(calidad) && familia !== 'galvanizado') {
      avisos.push({ campo: 'material_calidad', mensaje: `"${calidad}" parece galvanizado pero la familia es otra.` });
    }
    if (PATRONES_ACERO.test(calidad) && familia !== 'acero_carbono') {
      avisos.push({ campo: 'material_calidad', mensaje: `"${calidad}" parece acero al carbono pero la familia es otra.` });
    }
  }
  if (familia == null && !calidad) {
    avisos.push({ campo: 'material_familia', mensaje: 'Sin material no se puede presupuestar; pídelo al cliente.' });
  }

  // Campos con confianza baja pendientes de revisión manual
  const etiquetas: Partial<Record<keyof Extraccion, string>> = {
    numero_plano: 'nº de plano', denominacion: 'denominación', revision: 'revisión',
    largo_mm: 'largo', ancho_mm: 'ancho', espesor_mm: 'espesor',
    material_familia: 'familia de material', material_calidad: 'calidad',
    acabado: 'acabado', cantidad: 'cantidad', tolerancia_general: 'tolerancia',
    num_pliegues: 'pliegues', num_agujeros: 'agujeros',
  };
  for (const [clave, etiqueta] of Object.entries(etiquetas) as [keyof Extraccion, string][]) {
    const campo = datos[clave];
    if (typeof campo === 'object' && !Array.isArray(campo) && campo.confianza === 'baja' && !campo.editado) {
      avisos.push({ campo: clave, mensaje: `Lectura dudosa de ${etiqueta}: confírmala contra el plano.` });
    }
  }

  return avisos;
}
