import { campoAplica, ESPESORES_ESTANDAR } from './catalogo';
import type { Textos } from './i18n';
import type { Aviso, Extraccion } from './tipos';
import { formatearLongitud, type SistemaUnidades } from './unidades';

const PATRONES_INOX = /aisi|inox|1\.4\d{3}|x\d+cr/i;
const PATRONES_ALUMINIO = /^(10|30|50|60|70)\d{2}\b|al[\s-]?mg|en[\s-]?aw/i;
const PATRONES_ACERO = /^s\d{3}|^dc0|^dd1|^st\b/i;
const PATRONES_GALVA = /dx5\d|\+z\d|gd\+z/i;

/**
 * Comprobaciones de coherencia sobre los datos extraídos, adaptadas al tipo
 * de pieza. No bloquean: generan avisos para que el presupuestista revise
 * antes de dar precio. Los mensajes se traducen y formatean en la unidad
 * elegida; la lógica de validación siempre opera sobre el valor canónico (mm).
 */
export function validar(datos: Extraccion, t: Textos, unidades: SistemaUnidades): Aviso[] {
  const avisos: Aviso[] = [];
  const tipo = datos.tipo_pieza.valor;
  const v = t.validaciones;
  const long = (mm: number) => formatearLongitud(mm, unidades);

  if (tipo == null) {
    avisos.push({ campo: 'tipo_pieza', mensaje: v.tipoDesconocido });
  }

  // Espesor: solo aplica a chapa y tubo
  const esp = datos.espesor_mm.valor;
  if (campoAplica('espesor_mm', tipo)) {
    if (esp == null) {
      if (tipo === 'chapa_plegada') {
        avisos.push({ campo: 'espesor_mm', mensaje: v.faltaEspesorChapa });
      } else if (tipo === 'tubo_perfil') {
        avisos.push({ campo: 'espesor_mm', mensaje: v.faltaEspesorTubo });
      }
    } else if (esp <= 0 || esp > 100) {
      avisos.push({ campo: 'espesor_mm', mensaje: v.espesorFueraDeRango(long(esp)) });
    } else if (tipo === 'chapa_plegada' && !ESPESORES_ESTANDAR.includes(esp)) {
      avisos.push({ campo: 'espesor_mm', mensaje: v.espesorNoComercial(long(esp)) });
    }
  }

  // Dimensiones principales
  const largo = datos.largo_mm.valor;
  const ancho = datos.ancho_mm.valor;
  const diametro = datos.diametro_max_mm.valor;

  if (largo == null) {
    avisos.push({ campo: 'largo_mm', mensaje: v.faltaLongitud });
  }
  if (tipo === 'torneado' && diametro == null) {
    avisos.push({ campo: 'diametro_max_mm', mensaje: v.faltaDiametro });
  }
  if (campoAplica('ancho_mm', tipo) && largo != null && ancho != null && ancho > largo) {
    avisos.push({ campo: 'ancho_mm', mensaje: v.anchoMayorQueLargo });
  }
  for (const [campo, valorMm] of [
    ['largo_mm', largo],
    ['ancho_mm', ancho],
    ['alto_mm', datos.alto_mm.valor],
    ['diametro_max_mm', diametro],
  ] as const) {
    if (campoAplica(campo, tipo) && valorMm != null && (valorMm <= 0 || valorMm > 12000)) {
      avisos.push({ campo, mensaje: v.valorFueraDeRango(long(valorMm)) });
    }
  }
  if (esp != null && largo != null && esp > largo) {
    avisos.push({ campo: 'espesor_mm', mensaje: v.espesorMayorQueLargo });
  }
  if (diametro != null && esp != null && tipo === 'tubo_perfil' && esp * 2 >= diametro) {
    avisos.push({ campo: 'espesor_mm', mensaje: v.paredMayorQueRadio });
  }

  if (datos.cantidad.valor == null) {
    avisos.push({ campo: 'cantidad', mensaje: v.faltaCantidad });
  } else if (!Number.isInteger(datos.cantidad.valor) || datos.cantidad.valor <= 0) {
    avisos.push({ campo: 'cantidad', mensaje: v.cantidadInvalida });
  }

  // Coherencia familia ↔ calidad
  const familia = datos.material_familia.valor;
  const calidad = datos.material_calidad.valor ?? '';
  if (calidad) {
    if (PATRONES_INOX.test(calidad) && familia !== 'acero_inoxidable') {
      avisos.push({ campo: 'material_calidad', mensaje: v.calidadParece(calidad, v.nombresFamilia.inoxidable) });
    }
    if (PATRONES_ALUMINIO.test(calidad) && familia !== 'aluminio') {
      avisos.push({ campo: 'material_calidad', mensaje: v.calidadParece(calidad, v.nombresFamilia.aluminio) });
    }
    if (PATRONES_GALVA.test(calidad) && familia !== 'galvanizado') {
      avisos.push({ campo: 'material_calidad', mensaje: v.calidadParece(calidad, v.nombresFamilia.galvanizado) });
    }
    if (PATRONES_ACERO.test(calidad) && familia !== 'acero_carbono') {
      avisos.push({ campo: 'material_calidad', mensaje: v.calidadParece(calidad, v.nombresFamilia.acero_carbono) });
    }
  }
  if (familia == null && !calidad) {
    avisos.push({ campo: 'material_familia', mensaje: v.sinMaterial });
  }
  if (familia === 'acero_inoxidable' && calidad && !/\d/.test(calidad)) {
    avisos.push({ campo: 'material_calidad', mensaje: v.inoxSinGrado });
  }

  // Campos con confianza baja pendientes de revisión manual
  for (const [clave, etiqueta] of Object.entries(v.etiquetasCampo) as [Exclude<keyof Extraccion, 'observaciones' | 'desarrollo' | 'sistema_unidades' | 'campos_extra'>, string][]) {
    if (!campoAplica(clave, tipo)) continue;
    const campo = datos[clave];
    if (typeof campo === 'object' && !Array.isArray(campo) && campo.confianza === 'baja' && !campo.editado) {
      avisos.push({ campo: clave, mensaje: v.lecturaDudosa(etiqueta) });
    }
  }

  return avisos;
}
