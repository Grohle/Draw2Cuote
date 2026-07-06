import { useState } from 'react';
import { FAMILIAS } from '../catalogo';
import { cargarTarifas, guardarTarifas, TARIFAS_DEFECTO, type Tarifas as TTarifas } from '../tarifas';

interface Props {
  onCerrar: (tarifas: TTarifas) => void;
}

interface CampoNumericoProps {
  etiqueta: string;
  unidad: string;
  valor: number;
  onCambio: (v: number) => void;
}

function CampoNumerico({ etiqueta, unidad, valor, onCambio }: CampoNumericoProps) {
  return (
    <label className="tarifa-campo">
      <span>
        {etiqueta} <small>({unidad})</small>
      </span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={valor}
        onChange={(e) => onCambio(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </label>
  );
}

export function Tarifas({ onCerrar }: Props) {
  const [tarifas, setTarifas] = useState<TTarifas>(() => cargarTarifas());

  const guardar = () => {
    guardarTarifas(tarifas);
    onCerrar(tarifas);
  };

  const restaurar = () => setTarifas(TARIFAS_DEFECTO);

  return (
    <div className="modal-fondo" onClick={() => onCerrar(cargarTarifas())}>
      <div className="modal modal--ancho" role="dialog" aria-label="Tarifas de presupuesto" onClick={(e) => e.stopPropagation()}>
        <h2>💶 Tarifas de presupuesto</h2>
        <p className="modal__nota">
          El presupuesto estimado usa geometría simplificada (rectángulo/cilindro envolvente) y estas tarifas — ajústalas
          a los costes reales de tu taller. Se guardan solo en este navegador.
        </p>

        <h3 className="tarifa-seccion">Material (€/kg)</h3>
        <div className="tarifa-grupo">
          {FAMILIAS.map((f) => (
            <CampoNumerico
              key={f.valor}
              etiqueta={f.etiqueta}
              unidad="€/kg"
              valor={tarifas.precioKgPorFamilia[f.valor]}
              onCambio={(v) => setTarifas((t) => ({ ...t, precioKgPorFamilia: { ...t.precioKgPorFamilia, [f.valor]: v } }))}
            />
          ))}
        </div>

        <h3 className="tarifa-seccion">Chapa / corte</h3>
        <div className="tarifa-grupo">
          <CampoNumerico
            etiqueta="Corte por metro a 1 mm de espesor"
            unidad="€/m"
            valor={tarifas.costeCortePorMetroA1mm}
            onCambio={(v) => setTarifas((t) => ({ ...t, costeCortePorMetroA1mm: v }))}
          />
          <CampoNumerico
            etiqueta="Agujero (chapa/punzonado)"
            unidad="€/ud"
            valor={tarifas.costePorAgujeroChapa}
            onCambio={(v) => setTarifas((t) => ({ ...t, costePorAgujeroChapa: v }))}
          />
          <CampoNumerico
            etiqueta="Pliegue"
            unidad="€/ud"
            valor={tarifas.costePorPliegue}
            onCambio={(v) => setTarifas((t) => ({ ...t, costePorPliegue: v }))}
          />
          <CampoNumerico
            etiqueta="Acabado superficial"
            unidad="€/m²"
            valor={tarifas.costeAcabadoPorM2}
            onCambio={(v) => setTarifas((t) => ({ ...t, costeAcabadoPorM2: v }))}
          />
        </div>

        <h3 className="tarifa-seccion">Mecanizado (torneado / fresado)</h3>
        <div className="tarifa-grupo">
          <CampoNumerico
            etiqueta="Tarifa torno"
            unidad="€/min"
            valor={tarifas.tarifaTorneadoPorMin}
            onCambio={(v) => setTarifas((t) => ({ ...t, tarifaTorneadoPorMin: v }))}
          />
          <CampoNumerico
            etiqueta="Tarifa fresadora"
            unidad="€/min"
            valor={tarifas.tarifaFresadoPorMin}
            onCambio={(v) => setTarifas((t) => ({ ...t, tarifaFresadoPorMin: v }))}
          />
          <CampoNumerico
            etiqueta="Minutos por cm³ (torneado)"
            unidad="min/cm³"
            valor={tarifas.minutosPorCm3Torneado}
            onCambio={(v) => setTarifas((t) => ({ ...t, minutosPorCm3Torneado: v }))}
          />
          <CampoNumerico
            etiqueta="Minutos por cm³ (fresado)"
            unidad="min/cm³"
            valor={tarifas.minutosPorCm3Fresado}
            onCambio={(v) => setTarifas((t) => ({ ...t, minutosPorCm3Fresado: v }))}
          />
          <CampoNumerico
            etiqueta="Agujero mecanizado"
            unidad="€/ud"
            valor={tarifas.costePorAgujeroMecanizado}
            onCambio={(v) => setTarifas((t) => ({ ...t, costePorAgujeroMecanizado: v }))}
          />
          <CampoNumerico
            etiqueta="Rosca"
            unidad="€/ud"
            valor={tarifas.costePorRosca}
            onCambio={(v) => setTarifas((t) => ({ ...t, costePorRosca: v }))}
          />
          <CampoNumerico
            etiqueta="Desperdicio de material en bruto"
            unidad="factor ×"
            valor={tarifas.factorDesperdicioStock}
            onCambio={(v) => setTarifas((t) => ({ ...t, factorDesperdicioStock: v }))}
          />
        </div>

        <h3 className="tarifa-seccion">General</h3>
        <div className="tarifa-grupo">
          <CampoNumerico
            etiqueta="Preparación / puesta a punto"
            unidad="€/lote"
            valor={tarifas.costeSetup}
            onCambio={(v) => setTarifas((t) => ({ ...t, costeSetup: v }))}
          />
          <CampoNumerico
            etiqueta="Recargo por tolerancias críticas"
            unidad="factor ×"
            valor={tarifas.recargoToleranciaCritica}
            onCambio={(v) => setTarifas((t) => ({ ...t, recargoToleranciaCritica: v }))}
          />
          <CampoNumerico
            etiqueta="Margen sobre el total"
            unidad="factor × (1 = sin margen)"
            valor={tarifas.margen}
            onCambio={(v) => setTarifas((t) => ({ ...t, margen: v }))}
          />
        </div>

        <div className="modal__acciones">
          <button className="btn" type="button" onClick={restaurar}>
            Restaurar valores por defecto
          </button>
          <button className="btn btn--primario" type="button" onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
