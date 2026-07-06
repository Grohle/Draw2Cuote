import { useMemo } from 'react';
import {
  ACABADOS,
  AYUDAS,
  CALIDADES,
  campoAplica,
  ESPESORES_ESTANDAR,
  FAMILIAS,
  TIPOS_PIEZA,
  TOLERANCIAS,
} from '../catalogo';
import type { Tarifas } from '../tarifas';
import type { Aviso, Extraccion, FamiliaMaterial, TipoPieza } from '../tipos';
import { validar } from '../validaciones';
import { Campo } from './Campo';
import { Presupuesto } from './Presupuesto';

export type EstadoFeedback = 'inactivo' | 'guardando' | 'guardado' | 'error';

interface Props {
  datos: Extraccion;
  onCambio: (datos: Extraccion) => void;
  demo: boolean;
  onGuardarFeedback: () => void;
  estadoFeedback: EstadoFeedback;
  mensajeFeedback: string | null;
  incluirImagenFeedback: boolean;
  onCambiarIncluirImagen: (v: boolean) => void;
  tarifas: Tarifas;
  onAbrirTarifas: () => void;
}

type ClaveCampo = Exclude<keyof Extraccion, 'observaciones'>;

export function Resultados({
  datos,
  onCambio,
  demo,
  onGuardarFeedback,
  estadoFeedback,
  mensajeFeedback,
  incluirImagenFeedback,
  onCambiarIncluirImagen,
  tarifas,
  onAbrirTarifas,
}: Props) {
  const avisos = useMemo(() => validar(datos), [datos]);
  const avisosDe = (campo: keyof Extraccion) => avisos.filter((a) => a.campo === campo).map((a) => a.mensaje);

  const setTexto = (clave: ClaveCampo, valor: string) =>
    onCambio({ ...datos, [clave]: { valor: valor === '' ? null : valor, confianza: datos[clave].confianza, editado: true } });

  const setNumero = (clave: ClaveCampo, valor: string) =>
    onCambio({
      ...datos,
      [clave]: { valor: valor === '' ? null : Number(valor), confianza: datos[clave].confianza, editado: true },
    });

  const campoTexto = (clave: ClaveCampo, etiqueta: string, lista?: string[]) => {
    const campo = datos[clave];
    return (
      <Campo etiqueta={etiqueta} ayuda={AYUDAS[clave]} confianza={campo.confianza} editado={campo.editado} avisos={avisosDe(clave)}>
        <input
          type="text"
          value={(campo.valor as string | null) ?? ''}
          placeholder="—"
          list={lista ? `lista-${clave}` : undefined}
          onChange={(e) => setTexto(clave, e.target.value)}
        />
        {lista && (
          <datalist id={`lista-${clave}`}>
            {lista.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        )}
      </Campo>
    );
  };

  const campoNumero = (clave: ClaveCampo, etiqueta: string, unidad?: string, lista?: number[]) => {
    const campo = datos[clave];
    return (
      <Campo etiqueta={unidad ? `${etiqueta} (${unidad})` : etiqueta} ayuda={AYUDAS[clave]} confianza={campo.confianza} editado={campo.editado} avisos={avisosDe(clave)}>
        <input
          type="number"
          inputMode="decimal"
          value={(campo.valor as number | null) ?? ''}
          placeholder="—"
          list={lista ? `lista-${clave}` : undefined}
          onChange={(e) => setNumero(clave, e.target.value)}
        />
        {lista && (
          <datalist id={`lista-${clave}`}>
            {lista.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        )}
      </Campo>
    );
  };

  const familia = datos.material_familia;
  const calidadesSugeridas = familia.valor ? CALIDADES[familia.valor] : Object.values(CALIDADES).flat();

  const tipo = datos.tipo_pieza.valor;
  const aplica = (clave: ClaveCampo) => campoAplica(clave, tipo);

  const exportar = () => {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datos.numero_plano.valor ?? 'plano'}-draw2quote.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copiar = () => navigator.clipboard.writeText(JSON.stringify(datos, null, 2));

  return (
    <section className="resultados">
      {demo && (
        <div className="banner-demo">
          Modo demo: sin credenciales de la API se muestran datos de ejemplo. Exporta <code>ANTHROPIC_API_KEY</code> y
          reinicia el servidor para analizar planos reales.
        </div>
      )}

      <ResumenAvisos avisos={avisos} />

      <fieldset className="grupo">
        <legend>Identificación</legend>
        <div className="grupo__campos">
          <Campo
            etiqueta="Tipo de pieza"
            ayuda={AYUDAS.tipo_pieza}
            confianza={datos.tipo_pieza.confianza}
            editado={datos.tipo_pieza.editado}
            avisos={avisosDe('tipo_pieza')}
          >
            <select
              value={tipo ?? ''}
              onChange={(e) =>
                onCambio({
                  ...datos,
                  tipo_pieza: {
                    valor: (e.target.value || null) as TipoPieza | null,
                    confianza: datos.tipo_pieza.confianza,
                    editado: true,
                  },
                })
              }
            >
              <option value="">—</option>
              {TIPOS_PIEZA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          {campoTexto('numero_plano', 'Nº de plano')}
          {campoTexto('denominacion', 'Denominación')}
          {campoTexto('revision', 'Revisión')}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Geometría</legend>
        <div className="grupo__campos">
          {campoNumero('largo_mm', tipo === 'torneado' || tipo === 'tubo_perfil' ? 'Longitud' : 'Largo', 'mm')}
          {aplica('ancho_mm') && campoNumero('ancho_mm', 'Ancho', 'mm')}
          {aplica('alto_mm') && campoNumero('alto_mm', 'Alto', 'mm')}
          {aplica('diametro_max_mm') && campoNumero('diametro_max_mm', 'Ø máximo', 'mm')}
          {aplica('espesor_mm') &&
            campoNumero('espesor_mm', tipo === 'tubo_perfil' ? 'Espesor pared' : 'Espesor', 'mm', ESPESORES_ESTANDAR)}
          {campoTexto('tolerancia_general', 'Tolerancia general', TOLERANCIAS)}
          {campoTexto('tolerancias_criticas', 'Tolerancias críticas')}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Material y acabado</legend>
        <div className="grupo__campos">
          <Campo
            etiqueta="Familia de material"
            ayuda={AYUDAS.material_familia}
            confianza={familia.confianza}
            editado={familia.editado}
            avisos={avisosDe('material_familia')}
          >
            <select
              value={familia.valor ?? ''}
              onChange={(e) =>
                onCambio({
                  ...datos,
                  material_familia: {
                    valor: (e.target.value || null) as FamiliaMaterial | null,
                    confianza: familia.confianza,
                    editado: true,
                  },
                })
              }
            >
              <option value="">—</option>
              {FAMILIAS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          {campoTexto('material_calidad', 'Calidad / grado', calidadesSugeridas)}
          {campoTexto('acabado', 'Acabado', ACABADOS)}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>Fabricación</legend>
        <div className="grupo__campos">
          {campoNumero('cantidad', 'Cantidad', 'uds')}
          {aplica('num_pliegues') && campoNumero('num_pliegues', 'Pliegues')}
          {campoNumero('num_agujeros', 'Agujeros')}
          {campoTexto('roscas', 'Roscas')}
        </div>
      </fieldset>

      <Presupuesto datos={datos} tarifas={tarifas} onAbrirTarifas={onAbrirTarifas} />

      {datos.observaciones.length > 0 && (
        <fieldset className="grupo">
          <legend>Observaciones del análisis</legend>
          <ul className="observaciones">
            {datos.observaciones.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="acciones acciones--feedback">
        <div className="acciones__feedback-info">
          {estadoFeedback === 'guardado' && <span className="feedback-mensaje feedback-mensaje--ok">✓ {mensajeFeedback}</span>}
          {estadoFeedback === 'error' && <span className="feedback-mensaje feedback-mensaje--error">⚠ {mensajeFeedback}</span>}
          {(estadoFeedback === 'inactivo' || estadoFeedback === 'guardando') && (
            <label className="feedback-imagen">
              <input
                type="checkbox"
                checked={incluirImagenFeedback}
                onChange={(e) => onCambiarIncluirImagen(e.target.checked)}
              />
              Incluir imagen del plano en el dataset de mejora (útil para un futuro fine-tuning)
            </label>
          )}
        </div>
        <button
          className="btn btn--aprender"
          onClick={onGuardarFeedback}
          disabled={estadoFeedback === 'guardando' || estadoFeedback === 'guardado'}
          title="Confirma o corrige antes de guardar: esto ayuda a calibrar y mejorar el modelo con el uso real"
        >
          {estadoFeedback === 'guardando' ? 'Guardando…' : estadoFeedback === 'guardado' ? '✓ Guardado' : '🧠 Guardar corrección'}
        </button>
      </div>

      <div className="acciones">
        <button className="btn" onClick={copiar}>
          Copiar JSON
        </button>
        <button className="btn btn--primario" onClick={exportar}>
          Descargar JSON
        </button>
      </div>
    </section>
  );
}

function ResumenAvisos({ avisos }: { avisos: Aviso[] }) {
  if (avisos.length === 0) {
    return <div className="resumen resumen--ok">✓ Sin incidencias: los datos parecen coherentes y completos.</div>;
  }
  return (
    <div className="resumen resumen--avisos">
      ⚠ {avisos.length === 1 ? '1 punto requiere revisión' : `${avisos.length} puntos requieren revisión`} antes de
      presupuestar (marcados abajo).
    </div>
  );
}
