import { useState } from 'react';
import { familiasOpciones } from '../catalogo';
import type { Textos } from '../i18n';
import { cargarTarifas, guardarTarifas, TARIFAS_DEFECTO, type Tarifas as TTarifas } from '../tarifas';

interface Props {
  onCerrar: (tarifas: TTarifas) => void;
  t: Textos;
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

export function Tarifas({ onCerrar, t }: Props) {
  const [tarifas, setTarifas] = useState<TTarifas>(() => cargarTarifas());
  const tt = t.tarifas;

  const guardar = () => {
    guardarTarifas(tarifas);
    onCerrar(tarifas);
  };

  const restaurar = () => setTarifas(TARIFAS_DEFECTO);

  return (
    <div className="modal-fondo" onClick={() => onCerrar(cargarTarifas())}>
      <div className="modal modal--ancho" role="dialog" aria-label={t.app.tituloTarifas} onClick={(e) => e.stopPropagation()}>
        <h2>{t.app.botonTarifas}</h2>
        <p className="modal__nota">{tt.nota}</p>

        <h3 className="tarifa-seccion">{tt.seccionMaterial}</h3>
        <div className="tarifa-grupo">
          {familiasOpciones(t).map((f) => (
            <CampoNumerico
              key={f.valor}
              etiqueta={f.etiqueta}
              unidad="€/kg"
              valor={tarifas.precioKgPorFamilia[f.valor]}
              onCambio={(v) => setTarifas((tf) => ({ ...tf, precioKgPorFamilia: { ...tf.precioKgPorFamilia, [f.valor]: v } }))}
            />
          ))}
        </div>

        <h3 className="tarifa-seccion">{tt.seccionChapa}</h3>
        <div className="tarifa-grupo">
          <CampoNumerico
            etiqueta={tt.corteMetro}
            unidad="€/m"
            valor={tarifas.costeCortePorMetroA1mm}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costeCortePorMetroA1mm: v }))}
          />
          <CampoNumerico
            etiqueta={tt.agujeroChapa}
            unidad="€/ud"
            valor={tarifas.costePorAgujeroChapa}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costePorAgujeroChapa: v }))}
          />
          <CampoNumerico
            etiqueta={tt.pliegue}
            unidad="€/ud"
            valor={tarifas.costePorPliegue}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costePorPliegue: v }))}
          />
          <CampoNumerico
            etiqueta={tt.acabadoM2}
            unidad="€/m²"
            valor={tarifas.costeAcabadoPorM2}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costeAcabadoPorM2: v }))}
          />
        </div>

        <h3 className="tarifa-seccion">{tt.seccionMecanizado}</h3>
        <div className="tarifa-grupo">
          <CampoNumerico
            etiqueta={tt.tarifaTorno}
            unidad="€/min"
            valor={tarifas.tarifaTorneadoPorMin}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, tarifaTorneadoPorMin: v }))}
          />
          <CampoNumerico
            etiqueta={tt.tarifaFresadora}
            unidad="€/min"
            valor={tarifas.tarifaFresadoPorMin}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, tarifaFresadoPorMin: v }))}
          />
          <CampoNumerico
            etiqueta={tt.minCm3Torneado}
            unidad="min/cm³"
            valor={tarifas.minutosPorCm3Torneado}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, minutosPorCm3Torneado: v }))}
          />
          <CampoNumerico
            etiqueta={tt.minCm3Fresado}
            unidad="min/cm³"
            valor={tarifas.minutosPorCm3Fresado}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, minutosPorCm3Fresado: v }))}
          />
          <CampoNumerico
            etiqueta={tt.agujeroMecanizado}
            unidad="€/ud"
            valor={tarifas.costePorAgujeroMecanizado}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costePorAgujeroMecanizado: v }))}
          />
          <CampoNumerico
            etiqueta={tt.rosca}
            unidad="€/ud"
            valor={tarifas.costePorRosca}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costePorRosca: v }))}
          />
          <CampoNumerico
            etiqueta={tt.desperdicio}
            unidad={tt.unidadFactor}
            valor={tarifas.factorDesperdicioStock}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, factorDesperdicioStock: v }))}
          />
        </div>

        <h3 className="tarifa-seccion">{tt.seccionGeneral}</h3>
        <div className="tarifa-grupo">
          <CampoNumerico
            etiqueta={tt.setup}
            unidad="€/lote"
            valor={tarifas.costeSetup}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, costeSetup: v }))}
          />
          <CampoNumerico
            etiqueta={tt.recargoTolerancia}
            unidad={tt.unidadFactor}
            valor={tarifas.recargoToleranciaCritica}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, recargoToleranciaCritica: v }))}
          />
          <CampoNumerico
            etiqueta={tt.margen}
            unidad={tt.unidadFactorSinMargen}
            valor={tarifas.margen}
            onCambio={(v) => setTarifas((tf) => ({ ...tf, margen: v }))}
          />
        </div>

        <div className="modal__acciones">
          <button className="btn" type="button" onClick={restaurar}>
            {tt.restaurar}
          </button>
          <button className="btn btn--primario" type="button" onClick={guardar}>
            {tt.guardar}
          </button>
        </div>
      </div>
    </div>
  );
}
