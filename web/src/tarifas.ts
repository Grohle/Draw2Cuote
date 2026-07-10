import type { FamiliaMaterial } from './tipos';

export interface Tarifas {
  precioKgPorFamilia: Record<FamiliaMaterial, number>;
  costeCortePorMetroA1mm: number;
  costePorAgujeroChapa: number;
  costePorAgujeroMecanizado: number;
  costePorPliegue: number;
  costePorRosca: number;
  tarifaTorneadoPorMin: number;
  tarifaFresadoPorMin: number;
  minutosPorCm3Torneado: number;
  minutosPorCm3Fresado: number;
  factorDesperdicioStock: number;
  costeAcabadoPorM2: number;
  costeSetup: number;
  recargoToleranciaCritica: number;
  margen: number;
}

export const TARIFAS_DEFECTO: Tarifas = {
  precioKgPorFamilia: {
    acero_carbono: 1.2,
    acero_inoxidable: 4.5,
    aluminio: 3.8,
    galvanizado: 1.4,
    cobre_laton: 8.0,
    titanio: 35.0,
    plastico: 3.0,
    madera: 2.0,
    vidrio: 4.0,
    composite: 18.0,
    ceramica: 8.0,
    caucho: 4.0,
    otro: 2.0,
  },
  costeCortePorMetroA1mm: 1.5,
  costePorAgujeroChapa: 0.15,
  costePorAgujeroMecanizado: 1.0,
  costePorPliegue: 1.5,
  costePorRosca: 1.2,
  tarifaTorneadoPorMin: 0.9,
  tarifaFresadoPorMin: 1.1,
  minutosPorCm3Torneado: 0.06,
  minutosPorCm3Fresado: 0.09,
  factorDesperdicioStock: 1.2,
  costeAcabadoPorM2: 12,
  costeSetup: 15,
  recargoToleranciaCritica: 1.3,
  margen: 1.0,
};

const CLAVE_STORAGE = 'draw2quote.tarifas';

export function cargarTarifas(): Tarifas {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE);
    if (crudo) {
      const p = JSON.parse(crudo) as Partial<Tarifas>;
      return {
        ...TARIFAS_DEFECTO,
        ...p,
        precioKgPorFamilia: { ...TARIFAS_DEFECTO.precioKgPorFamilia, ...p.precioKgPorFamilia },
      };
    }
  } catch {
    // storage corrupto o inaccesible: se ignora, se usan valores por defecto
  }
  return TARIFAS_DEFECTO;
}

export function guardarTarifas(tarifas: Tarifas): void {
  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(tarifas));
}
