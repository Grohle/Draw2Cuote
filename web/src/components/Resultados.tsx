import { useState, useMemo, useEffect } from 'react';
import { etiquetaDe, type CamposPersonalizados } from '../camposPersonalizados';
import { acabadosSugeridos, campoAplica, CALIDADES, ESPESORES_ESTANDAR, familiasOpciones, tiposPiezaOpciones, TOLERANCIAS } from '../catalogo';
import { descargarCsv, descargarXlsx } from '../descargas';
import { calcularDesarrollo, type OpcionesDesplegado } from '../desplegado';
import type { Idioma, Textos } from '../i18n';
import { construirTabla } from '../listado';
import type { Tarifas } from '../tarifas';
import type { Aviso, Extraccion, FamiliaMaterial, TipoPieza } from '../tipos';
import { etiquetaLongitud, listaLongitudMostrada, mmAUnidadMostrada, unidadMostradaAMm, type SistemaUnidades } from '../unidades';
import { validar } from '../validaciones';
import { Campo } from './Campo';
import { Desarrollo } from './Desarrollo';
import { IconoAnadir, IconoAviso, IconoCheck, IconoDescargar, IconoIA, IconoOk, IconoUnidades } from './Iconos';
import { Presupuesto } from './Presupuesto';

export type EstadoFeedback = 'inactivo' | 'guardando' | 'guardado' | 'error';

interface Props {
  datos: Extraccion;
  onCambio: (datos: Extraccion) => void;
  demo: boolean;
  revisado: boolean;
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
  onAnadirListado: (datos: Extraccion) => void;
}

type ClaveCampo = Exclude<keyof Extraccion, 'observaciones' | 'desarrollo' | 'sistema_unidades' | 'campos_extra'>;
const DECIMALES_MOSTRADOS: Record<SistemaUnidades, number> = { metrico: 3, imperial: 4 };
/** Campo por defecto si faltara en los datos: evita que un esquema inesperado deje la app en blanco. */
const CAMPO_VACIO = { valor: null, confianza: 'media' as const };

export function Resultados({
  datos,
  onCambio,
  demo,
  revisado,
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
  onAnadirListado,
}: Props) {
  const [anadido, setAnadido] = useState(false);
  const avisos = useMemo(() => validar(datos, t, unidades), [datos, t, unidades]);
  const avisosDe = (campo: keyof Extraccion) => avisos.filter((a) => a.campo === campo).map((a) => a.mensaje);
  const r = t.resultados;
  const desarrollo = useMemo(() => calcularDesarrollo(datos, opcionesDesplegado), [datos, opcionesDesplegado]);

  // El desarrollo calculado es la cota real de la dirección plegada, así que se
  // vuelca al campo que le toca (largo o ancho) para que presupuesto, listado y
  // exportación cuenten lo mismo que el panel. Se marca como calculado, y una
  // corrección a mano manda: a partir de ahí el cálculo ya no lo pisa.
  useEffect(() => {
    const { ejeDesarrollo, largoDesarrolladoMm } = desarrollo;
    if (ejeDesarrollo == null || largoDesarrolladoMm == null) return;
    const campo = datos[ejeDesarrollo];
    if (campo.editado) return;
    // Al micrómetro: sobra para chapa y evita arrastrar 15 decimales al listado y a la exportación.
    const valor = Number(largoDesarrolladoMm.toFixed(3));
    if (campo.valor != null && Math.abs(campo.valor - valor) < 0.001) return;
    onCambio({ ...datos, [ejeDesarrollo]: { valor, confianza: campo.confianza, origen: 'desarrollo' } });
  }, [desarrollo, datos, onCambio]);
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

  const setCampoExtra = (indice: number, valor: string) =>
    onCambio({
      ...datos,
      campos_extra: datos.campos_extra.map((c, i) => (i === indice ? { ...c, valor: valor === '' ? null : valor, editado: true } : c)),
    });

  const campoTexto = (clave: ClaveCampo, etiqueta: string, lista?: string[]) => {
    const campo = datos[clave] ?? CAMPO_VACIO;
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
    const campo = datos[clave] ?? CAMPO_VACIO;
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
    const campo = datos[clave] ?? CAMPO_VACIO;
    const mm = campo.valor as number | null;
    const mostrado = mm == null ? '' : Number(mmAUnidadMostrada(mm, unidades).toFixed(DECIMALES_MOSTRADOS[unidades]));
    const lista = listaMm ? listaLongitudMostrada(listaMm, unidades) : undefined;
    return (
      <Campo
        etiqueta={`${etiqueta} (${etiquetaLongitud(unidades)})`}
        ayuda={t.ayudas[clave]}
        confianza={campo.confianza}
        editado={campo.editado}
        origen={campo.origen}
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

  // Exportación de la pieza actual (una fila) a XLSX o CSV, reutilizando la
  // misma tabla que el listado (solo columnas con valor).
  const nombreBase = datos.numero_plano.valor?.trim() || 'pieza';
  const tablaPieza = () => construirTabla([{ id: 'actual', datos }], tarifas, t, unidades);
  const exportarXlsx = () => descargarXlsx(`${nombreBase}-draw2quote.xlsx`, tablaPieza(), datos.denominacion.valor?.trim() || nombreBase);
  const exportarCsv = () => descargarCsv(`${nombreBase}-draw2quote.csv`, tablaPieza());

  return (
    <section className="resultados">
      {demo && <div className="banner-demo">{r.bannerDemo}</div>}

      <div className="resultados__cabecera">
        <ResumenAvisos avisos={avisos} t={t} />
        {revisado && (
          <span className="chip-unidades chip-unidades--ia">
            <IconoIA tamano={13} /> {r.revisadoIA}
          </span>
        )}
        {datos.sistema_unidades && (
          <span className="chip-unidades">
            <IconoUnidades tamano={13} /> {r.unidadesPlano(datos.sistema_unidades === 'imperial')}
          </span>
        )}
      </div>

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

      {datos.campos_extra.length > 0 && (
        <fieldset className="grupo">
          <legend>{r.grupoExtra}</legend>
          <div className="grupo__campos">
            {datos.campos_extra.map((c, i) => (
              <Campo key={`${c.nombre}-${i}`} etiqueta={c.nombre} ayuda={r.ayudaCampoExtra} confianza={c.confianza} editado={c.editado} avisos={[]} t={t}>
                <input type="text" value={c.valor ?? ''} placeholder="—" onChange={(e) => setCampoExtra(i, e.target.value)} />
              </Campo>
            ))}
          </div>
        </fieldset>
      )}

      {tipo === 'chapa_plegada' && (datos.num_pliegues.valor ?? 0) >= 1 && (
        <Desarrollo
          datos={datos}
          res={desarrollo}
          onCambio={onCambio}
          unidades={unidades}
          opciones={opcionesDesplegado}
          onCambioOpciones={onCambioDesplegado}
          // Aquí el tipo es siempre chapa plegada, así que el largo usa su etiqueta corta.
          etiquetaEje={(clave) =>
            clave === 'largo_mm' ? et('largo_mm', t.campoCorto.largo_chapa) : et('ancho_mm', t.campos.ancho_mm)
          }
          t={t}
        />
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
          {estadoFeedback === 'guardado' && (
            <span className="feedback-mensaje feedback-mensaje--ok">
              <IconoCheck tamano={14} /> {mensajeFeedback}
            </span>
          )}
          {estadoFeedback === 'error' && (
            <span className="feedback-mensaje feedback-mensaje--error">
              <IconoAviso tamano={14} /> {mensajeFeedback}
            </span>
          )}
          {(estadoFeedback === 'inactivo' || estadoFeedback === 'guardando') && (
            <label className="feedback-imagen">
              <input type="checkbox" checked={incluirImagenFeedback} onChange={(e) => onCambiarIncluirImagen(e.target.checked)} />
              {r.incluirImagen}
            </label>
          )}
        </div>
        <button className="btn btn--aprender" onClick={onGuardarFeedback} disabled={estadoFeedback === 'guardando' || estadoFeedback === 'guardado'} title={r.tituloGuardar}>
          <IconoIA tamano={15} />
          {estadoFeedback === 'guardando' ? r.guardando : estadoFeedback === 'guardado' ? r.guardado : r.guardarCorreccion}
        </button>
      </div>

      <div className="acciones">
        <button
          className="btn btn--primario"
          onClick={() => {
            onAnadirListado(datos);
            setAnadido(true);
            setTimeout(() => setAnadido(false), 2000);
          }}
        >
          {anadido ? <IconoCheck tamano={15} /> : <IconoAnadir tamano={15} />}
          {anadido ? r.anadido : r.anadirListado}
        </button>
        <button className="btn" onClick={exportarXlsx}>
          <IconoDescargar tamano={15} />
          {r.exportarXlsx}
        </button>
        <button className="btn" onClick={exportarCsv}>
          <IconoDescargar tamano={15} />
          {r.exportarCsv}
        </button>
      </div>
    </section>
  );
}

function ResumenAvisos({ avisos, t }: { avisos: Aviso[]; t: Textos }) {
  if (avisos.length === 0) {
    return (
      <div className="resumen resumen--ok">
        <IconoOk tamano={15} /> {t.resultados.resumenOk}
      </div>
    );
  }
  return (
    <div className="resumen resumen--avisos">
      <IconoAviso tamano={15} /> {t.resultados.resumenAvisos(avisos.length)}
    </div>
  );
}
