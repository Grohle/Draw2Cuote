import type { Textos } from './i18n';
import type { Tarifas } from './tarifas';
import type { Extraccion, FamiliaMaterial } from './tipos';
import { etiquetaPeso, formatearLongitud, formatearPeso, precioPorKgAUnidadMostrada, type SistemaUnidades } from './unidades';

/** Densidades físicas (kg/m³) — no son tarifas de taller, son constantes del material. */
const DENSIDADES: Record<FamiliaMaterial, number> = {
  acero_carbono: 7850,
  acero_inoxidable: 7900,
  aluminio: 2700,
  galvanizado: 7850,
  otro: 7850,
};

/** Variantes en ambos idiomas que significan "sin acabado / material en bruto" (el texto lo escribe el modelo o el usuario). */
const SIN_ACABADO = ['bruto', 'raw', 'raw / mill finish', 'none', 'sin acabado', 'no finish', 'mill finish', 'as-is'];

function tieneAcabado(valor: string | null): boolean {
  if (!valor) return false;
  return !SIN_ACABADO.includes(valor.trim().toLowerCase());
}

export interface LineaPresupuesto {
  concepto: string;
  importe: number;
}

export interface ResultadoPresupuesto {
  calculable: boolean;
  camposFaltantes: string[];
  lineas: LineaPresupuesto[];
  totalLote: number;
  precioUnitario: number;
  avisos: string[];
}

const NO_CALCULABLE = (camposFaltantes: string[]): ResultadoPresupuesto => ({
  calculable: false,
  camposFaltantes,
  lineas: [],
  totalLote: 0,
  precioUnitario: 0,
  avisos: [],
});

/** Cuenta roscas de un texto tipo "M4 (x1), M6 (x4)"; si no hay cantidades explícitas pero hay texto, cuenta 1. */
function contarRoscas(texto: string | null): number {
  if (!texto || !texto.trim()) return 0;
  const coincidencias = [...texto.matchAll(/x\s*(\d+)/gi)];
  if (coincidencias.length === 0) return 1;
  return coincidencias.reduce((suma, m) => suma + parseInt(m[1], 10), 0);
}

function formatearPrecioKg(precioKg: number, unidades: SistemaUnidades): string {
  const valor = precioPorKgAUnidadMostrada(precioKg, unidades);
  return `${valor.toFixed(2)} €/${etiquetaPeso(unidades)}`;
}

/**
 * Presupuesto orientativo a partir de la extracción y unas tarifas configurables.
 * Usa geometría simplificada (rectángulo/cilindro envolvente, no el perfil real de
 * la pieza): es una estimación de orden de magnitud, no un presupuesto de nesting real.
 * Las tarifas y la lógica de cálculo siempre operan en unidades métricas (mm, kg);
 * `unidades` solo afecta a cómo se formatean los números en el desglose mostrado.
 */
export function calcularPresupuesto(
  datos: Extraccion,
  tarifas: Tarifas,
  t: Textos,
  unidades: SistemaUnidades
): ResultadoPresupuesto {
  const tipo = datos.tipo_pieza.valor;
  const familia = datos.material_familia.valor;
  const cantidad = datos.cantidad.valor;
  const p = t.presupuesto;

  const faltantesGenerales: string[] = [];
  if (!tipo) faltantesGenerales.push(t.campos.tipo_pieza);
  if (!familia) faltantesGenerales.push(t.campos.material_familia);
  if (!cantidad || cantidad <= 0) faltantesGenerales.push(t.campos.cantidad);
  if (faltantesGenerales.length > 0) return NO_CALCULABLE(faltantesGenerales);

  if (tipo === 'otro') {
    return NO_CALCULABLE([p.tipoOtroNoCalculable]);
  }

  const densidad = DENSIDADES[familia as FamiliaMaterial];
  const precioKg = tarifas.precioKgPorFamilia[familia as FamiliaMaterial];
  const avisos: string[] = [];
  const lineas: LineaPresupuesto[] = [];
  let costeVariablePorPieza = 0;

  const numAgujeros = datos.num_agujeros.valor ?? 0;
  const numRoscas = contarRoscas(datos.roscas.valor);
  const tieneToleranciaCritica = Boolean(datos.tolerancias_criticas.valor);

  if (tipo === 'chapa_plegada') {
    const largo = datos.largo_mm.valor;
    const ancho = datos.ancho_mm.valor;
    const espesor = datos.espesor_mm.valor;
    const faltan = [];
    if (!largo) faltan.push(t.campos.largo_mm);
    if (!ancho) faltan.push(t.campos.ancho_mm);
    if (!espesor) faltan.push(t.campos.espesor_mm);
    if (faltan.length) return NO_CALCULABLE(faltan);

    const areaM2 = (largo! / 1000) * (ancho! / 1000);
    const pesoKg = areaM2 * (espesor! / 1000) * densidad;
    const costeMaterial = pesoKg * precioKg;
    lineas.push({ concepto: p.material(formatearPeso(pesoKg, unidades), formatearPrecioKg(precioKg, unidades)), importe: costeMaterial });

    const perimetroM = (2 * (largo! + ancho!)) / 1000;
    const costeCorte = perimetroM * tarifas.costeCortePorMetroA1mm * espesor!;
    lineas.push({ concepto: p.corte(formatearLongitud(perimetroM * 1000, unidades)), importe: costeCorte });
    avisos.push(p.avisoCorteRectangulo);

    const costeAgujeros = numAgujeros * tarifas.costePorAgujeroChapa;
    if (numAgujeros) lineas.push({ concepto: p.agujerosChapa(numAgujeros, `${tarifas.costePorAgujeroChapa.toFixed(2)} €`), importe: costeAgujeros });

    const numPliegues = datos.num_pliegues.valor ?? 0;
    const costePliegues = numPliegues * tarifas.costePorPliegue;
    if (numPliegues) lineas.push({ concepto: p.pliegues(numPliegues, `${tarifas.costePorPliegue.toFixed(2)} €`), importe: costePliegues });

    const costeRoscas = numRoscas * tarifas.costePorRosca;
    if (numRoscas) lineas.push({ concepto: p.roscas(numRoscas, `${tarifas.costePorRosca.toFixed(2)} €`), importe: costeRoscas });

    let costeAcabado = 0;
    if (tieneAcabado(datos.acabado.valor)) {
      costeAcabado = areaM2 * 2 * tarifas.costeAcabadoPorM2;
      lineas.push({ concepto: p.acabado(datos.acabado.valor!), importe: costeAcabado });
    }

    costeVariablePorPieza = costeMaterial + costeCorte + costeAgujeros + costePliegues + costeRoscas + costeAcabado;
  } else if (tipo === 'torneado' || tipo === 'fresado') {
    let volumenM3: number;
    if (tipo === 'torneado') {
      const diametro = datos.diametro_max_mm.valor;
      const largo = datos.largo_mm.valor;
      const faltan = [];
      if (!diametro) faltan.push(t.campos.diametro_max_mm);
      if (!largo) faltan.push(t.campos.largo_mm);
      if (faltan.length) return NO_CALCULABLE(faltan);
      volumenM3 = Math.PI * (diametro! / 1000 / 2) ** 2 * (largo! / 1000);
    } else {
      const largo = datos.largo_mm.valor;
      const ancho = datos.ancho_mm.valor;
      const alto = datos.alto_mm.valor;
      const faltan = [];
      if (!largo) faltan.push(t.campos.largo_mm);
      if (!ancho) faltan.push(t.campos.ancho_mm);
      if (!alto) faltan.push(t.campos.alto_mm);
      if (faltan.length) return NO_CALCULABLE(faltan);
      volumenM3 = (largo! / 1000) * (ancho! / 1000) * (alto! / 1000);
    }

    const pesoStockKg = volumenM3 * densidad * tarifas.factorDesperdicioStock;
    const costeMaterial = pesoStockKg * precioKg;
    lineas.push({
      concepto: p.materialBruto(formatearPeso(pesoStockKg, unidades), formatearPrecioKg(precioKg, unidades)),
      importe: costeMaterial,
    });
    avisos.push(p.avisoVolumenBruto);

    const volumenCm3 = volumenM3 * 1e6;
    const minutosPorCm3 = tipo === 'torneado' ? tarifas.minutosPorCm3Torneado : tarifas.minutosPorCm3Fresado;
    const tarifaPorMin = tipo === 'torneado' ? tarifas.tarifaTorneadoPorMin : tarifas.tarifaFresadoPorMin;
    const minutos = volumenCm3 * minutosPorCm3;
    const costeMecanizado = minutos * tarifaPorMin;
    const nombreTipo = tipo === 'torneado' ? t.tiposPieza.torneado : t.tiposPieza.fresado;
    lineas.push({
      concepto: p.mecanizado(nombreTipo, minutos.toFixed(1), `${tarifaPorMin.toFixed(2)} €/min`),
      importe: costeMecanizado,
    });

    const costeAgujeros = numAgujeros * tarifas.costePorAgujeroMecanizado;
    if (numAgujeros) lineas.push({ concepto: p.agujerosMecanizado(numAgujeros, `${tarifas.costePorAgujeroMecanizado.toFixed(2)} €`), importe: costeAgujeros });

    const costeRoscas = numRoscas * tarifas.costePorRosca;
    if (numRoscas) lineas.push({ concepto: p.roscas(numRoscas, `${tarifas.costePorRosca.toFixed(2)} €`), importe: costeRoscas });

    costeVariablePorPieza = costeMaterial + costeMecanizado + costeAgujeros + costeRoscas;
  } else if (tipo === 'tubo_perfil') {
    const diametro = datos.diametro_max_mm.valor;
    const largo = datos.largo_mm.valor;
    const espesor = datos.espesor_mm.valor;
    const faltan = [];
    if (!diametro) faltan.push(t.campos.diametro_max_mm);
    if (!largo) faltan.push(t.campos.largo_mm);
    if (!espesor) faltan.push(t.campos.espesor_mm);
    if (faltan.length) return NO_CALCULABLE(faltan);

    const diametroMedioM = (diametro! - espesor!) / 1000;
    const pesoKg = Math.PI * diametroMedioM * (espesor! / 1000) * (largo! / 1000) * densidad;
    const costeMaterial = pesoKg * precioKg;
    lineas.push({ concepto: p.material(formatearPeso(pesoKg, unidades), formatearPrecioKg(precioKg, unidades)), importe: costeMaterial });
    avisos.push(p.avisoTuboPared);

    const perimetroSeccionM = (Math.PI * diametro!) / 1000;
    const costeCorte = 2 * perimetroSeccionM * tarifas.costeCortePorMetroA1mm * espesor!;
    lineas.push({ concepto: p.corteTubo, importe: costeCorte });

    const numPliegues = datos.num_pliegues.valor ?? 0;
    const costePliegues = numPliegues * tarifas.costePorPliegue;
    if (numPliegues) lineas.push({ concepto: p.curvado(numPliegues, `${tarifas.costePorPliegue.toFixed(2)} €`), importe: costePliegues });

    const costeAgujeros = numAgujeros * tarifas.costePorAgujeroChapa;
    if (numAgujeros) lineas.push({ concepto: p.agujerosChapa(numAgujeros, `${tarifas.costePorAgujeroChapa.toFixed(2)} €`), importe: costeAgujeros });

    costeVariablePorPieza = costeMaterial + costeCorte + costePliegues + costeAgujeros;
  }

  if (tieneToleranciaCritica) {
    const recargo = costeVariablePorPieza * (tarifas.recargoToleranciaCritica - 1);
    lineas.push({ concepto: p.recargoToleranciaLinea, importe: recargo });
    costeVariablePorPieza += recargo;
  }

  lineas.push({ concepto: p.setupLinea, importe: tarifas.costeSetup });
  const totalAntesMargen = costeVariablePorPieza * cantidad! + tarifas.costeSetup;

  let totalLote = totalAntesMargen;
  if (tarifas.margen !== 1) {
    const margenImporte = totalAntesMargen * (tarifas.margen - 1);
    lineas.push({ concepto: p.margenLinea(Math.round((tarifas.margen - 1) * 100)), importe: margenImporte });
    totalLote = totalAntesMargen + margenImporte;
  }

  return {
    calculable: true,
    camposFaltantes: [],
    lineas,
    totalLote,
    precioUnitario: totalLote / cantidad!,
    avisos,
  };
}
