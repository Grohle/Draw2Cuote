import { useMemo } from 'react';
import { etiquetaDe, type CamposPersonalizados } from '../camposPersonalizados';
import { acabadosSugeridos, campoAplica, CALIDADES, ESPESORES_ESTANDAR, familiasOpciones, tiposPiezaOpciones, TOLERANCIAS } from '../catalogo';
import type { OpcionesDesplegado } from '../desplegado';
import type { Idioma, Textos } from '../i18n';
import type { Tarifas } from '../tarifas';
import type { Aviso, Extraccion, FamiliaMaterial, TipoPieza } from '../tipos';
import { etiquetaLongitud, listaLongitudMostrada, mmAUnidadMostrada, unidadMostradaAMm, type SistemaUnidades } from '../unidades';
import { validar } from '../validaciones';
import { Campo } from './Campo';
import { Desarrollo } from './Desarrollo';
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
  t: Textos;
  idioma: Idioma;
  unidades: SistemaUnidades;
  camposPersonalizados: CamposPersonalizados;
  opcionesDesplegado: OpcionesDesplegado;
  onCambioDesplegado: (o: OpcionesDesplegado) => void;
}

type ClaveCampo = Exclude<keyof Extraccion, 'observaciones'>;
const DECIMALES_MOSTRADOS: Record<SistemaUnidades, number> = { metrico: 3, imperial: 4 };

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
  t,
  idioma,
  unidades,
  camposPersonalizados,
  opcionesDesplegado,
  onCambioDesplegado,
}: Props) {
  const avisos = useMemo(() => validar(datos, t, unidades), [datos, t, unidades]);
  const avisosDe = (campo: keyof Extraccion) => avisos.filter((a) => a.campo === campo).map((a) => a.mensaje);
  const r = t.resultados;
  /** Etiqueta a mostrar de un campo: la personalizada por el usuario o la de por defecto. */
  const et = (clave: ClaveCampo, porDefecto: string) => etiquetaDe(clave, porDefecto, camposPersonalizados);

  const setTexto = (clave: ClaveCampo, valor: string) =>
    onCambio({ ...datos, [clave]: { valor: valor === '' ? null : valor, confianza: datos[clave].confianza, editado: true } });

  const setNumero = (clave: ClaveCampo, valor: string) =>
    onCambio({
      ...datos,
      [clave]: { valor: valor === '' ? null : Number(valor), confianza: datos[clave].confianza, editado: true },
    });

  const setLongitudMm = (clave: ClaveCampo, mm: number | null) =>
    onCambio({ ...datos, [clave]: { valor: mm, confianza: datos[clave].confianza, editado: true } });

  const campoTexto = (clave: ClaveCampo, etiqueta: string, lista?: string[]) => {
    const campo = datos[clave];
    return (
      <Campo etiqueta={etiqueta} ayuda={t.ayudas[clave]} confianza={campo.confianza} editado={campo.editado} avisos={avisosDe(clave)} t={t}>
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

  const campoNumero = (clave: ClaveCampo, etiqueta: string, unidad?: string) => {
    const campo = datos[clave];
    return (
      <Campo etiqueta={unidad ? `${etiqueta} (${unidad})` : etiqueta} ayuda={t.ayudas[clave]} confianza={campo.confianza} editado={campo.editado} avisos={avisosDe(clave)} t={t}>
        <input
          type="number"
          inputMode="decimal"
          value={(campo.valor as number | null) ?? ''}
          placeholder="—"
          onChange={(e) => setNumero(clave, e.target.value)}
        />
      </Campo>
    );
  };

  /** Campo de dimensión: el valor se guarda siempre en mm; se muestra y edita en la unidad elegida. */
  const campoLongitud = (clave: ClaveCampo, etiqueta: string, listaMm?: number[]) => {
    const campo = datos[clave];
    const mm = campo.valor as number | null;
    const mostrado = mm == null ? '' : Number(mmAUnidadMostrada(mm, unidades).toFixed(DECIMALES_MOSTRADOS[unidades]));
    const lista = listaMm ? listaLongitudMostrada(listaMm, unidades) : undefined;
    return (
      <Campo
        etiqueta={`${etiqueta} (${etiquetaLongitud(unidades)})`}
        ayuda={t.ayudas[clave]}
        confianza={campo.confianza}
        editado={campo.editado}
        avisos={avisosDe(clave)}
        t={t}
      >
        <input
          type="number"
          inputMode="decimal"
          value={mostrado}
          placeholder="—"
          list={lista ? `lista-${clave}` : undefined}
          onChange={(e) => {
            if (e.target.value === '') {
              setLongitudMm(clave, null);
              return;
            }
            setLongitudMm(clave, unidadMostradaAMm(Number(e.target.value), unidades));
          }}
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
  const acabados = acabadosSugeridos(idioma);

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
      {demo && <div className="banner-demo">{r.bannerDemo}</div>}

      <ResumenAvisos avisos={avisos} t={t} />

      <fieldset className="grupo">
        <legend>{r.grupoIdentificacion}</legend>
        <div className="grupo__campos">
          <Campo etiqueta={et('tipo_pieza', t.campos.tipo_pieza)} ayuda={t.ayudas.tipo_pieza} confianza={datos.tipo_pieza.confianza} editado={datos.tipo_pieza.editado} avisos={avisosDe('tipo_pieza')} t={t}>
            <select
              value={tipo ?? ''}
              onChange={(e) =>
                onCambio({
                  ...datos,
                  tipo_pieza: { valor: (e.target.value || null) as TipoPieza | null, confianza: datos.tipo_pieza.confianza, editado: true },
                })
              }
            >
              <option value="">—</option>
              {tiposPiezaOpciones(t).map((tp) => (
                <option key={tp.valor} value={tp.valor}>
                  {tp.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          {campoTexto('numero_plano', et('numero_plano', t.campos.numero_plano))}
          {campoTexto('proyecto', et('proyecto', t.campos.proyecto))}
          {campoTexto('denominacion', et('denominacion', t.campos.denominacion))}
          {campoTexto('marca', et('marca', t.campos.marca))}
          {campoTexto('revision', et('revision', t.campos.revision))}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>{r.grupoGeometria}</legend>
        <div className="grupo__campos">
          {campoLongitud('largo_mm', et('largo_mm', tipo === 'torneado' || tipo === 'tubo_perfil' ? t.campoCorto.largo_torneado : t.campoCorto.largo_chapa))}
          {aplica('ancho_mm') && campoLongitud('ancho_mm', et('ancho_mm', t.campos.ancho_mm))}
          {aplica('alto_mm') && campoLongitud('alto_mm', et('alto_mm', t.campos.alto_mm))}
          {aplica('diametro_max_mm') && campoLongitud('diametro_max_mm', et('diametro_max_mm', t.campos.diametro_max_mm))}
          {aplica('espesor_mm') &&
            campoLongitud('espesor_mm', et('espesor_mm', tipo === 'tubo_perfil' ? t.campoCorto.espesor_tubo : t.campoCorto.espesor), ESPESORES_ESTANDAR)}
          {campoTexto('tolerancia_general', et('tolerancia_general', t.campos.tolerancia_general), TOLERANCIAS)}
          {campoTexto('tolerancias_criticas', et('tolerancias_criticas', t.campos.tolerancias_criticas))}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>{r.grupoMaterial}</legend>
        <div className="grupo__campos">
          <Campo etiqueta={et('material_familia', t.campos.material_familia)} ayuda={t.ayudas.material_familia} confianza={familia.confianza} editado={familia.editado} avisos={avisosDe('material_familia')} t={t}>
            <select
              value={familia.valor ?? ''}
              onChange={(e) =>
                onCambio({
                  ...datos,
                  material_familia: { valor: (e.target.value || null) as FamiliaMaterial | null, confianza: familia.confianza, editado: true },
                })
              }
            >
              <option value="">—</option>
              {familiasOpciones(t).map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </Campo>
          {campoTexto('material_calidad', et('material_calidad', t.campos.material_calidad), calidadesSugeridas)}
          {campoTexto('acabado', et('acabado', t.campos.acabado), acabados)}
        </div>
      </fieldset>

      <fieldset className="grupo">
        <legend>{r.grupoFabricacion}</legend>
        <div className="grupo__campos">
          {campoNumero('cantidad', et('cantidad', t.campos.cantidad), r.unidadesCantidad)}
          {aplica('num_pliegues') && campoNumero('num_pliegues', et('num_pliegues', t.campos.num_pliegues))}
          {campoNumero('num_agujeros', et('num_agujeros', t.campos.num_agujeros))}
          {campoTexto('roscas', et('roscas', t.campos.roscas))}
        </div>
      </fieldset>

      {tipo === 'chapa_plegada' && (datos.num_pliegues.valor ?? 0) >= 1 && (
        <Desarrollo datos={datos} unidades={unidades} opciones={opcionesDesplegado} onCambioOpciones={onCambioDesplegado} t={t} />
      )}

      <Presupuesto datos={datos} tarifas={tarifas} onAbrirTarifas={onAbrirTarifas} t={t} unidades={unidades} />

      {datos.observaciones.length > 0 && (
        <fieldset className="grupo">
          <legend>{r.grupoObservaciones}</legend>
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
              <input type="checkbox" checked={incluirImagenFeedback} onChange={(e) => onCambiarIncluirImagen(e.target.checked)} />
              {r.incluirImagen}
            </label>
          )}
        </div>
        <button className="btn btn--aprender" onClick={onGuardarFeedback} disabled={estadoFeedback === 'guardando' || estadoFeedback === 'guardado'} title={r.tituloGuardar}>
          {estadoFeedback === 'guardando' ? r.guardando : estadoFeedback === 'guardado' ? r.guardado : r.guardarCorreccion}
        </button>
      </div>

      <div className="acciones">
        <button className="btn" onClick={copiar}>
          {r.copiarJson}
        </button>
        <button className="btn btn--primario" onClick={exportar}>
          {r.descargarJson}
        </button>
      </div>
    </section>
  );
}

function ResumenAvisos({ avisos, t }: { avisos: Aviso[]; t: Textos }) {
  if (avisos.length === 0) {
    return <div className="resumen resumen--ok">{t.resultados.resumenOk}</div>;
  }
  return <div className="resumen resumen--avisos">{t.resultados.resumenAvisos(avisos.length)}</div>;
}
