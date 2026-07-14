import { useState } from 'react';
import { aliasComoTexto, CLAVES_CAMPO, textoAAlias, type CamposPersonalizados, type ClaveCampo } from '../camposPersonalizados';
import { crearCampoManual, MAX_CAMPOS_EXTRA, type Rechazo } from '../creadorCampos';
import type { Textos } from '../i18n';

interface Props {
  camposPersonalizados: CamposPersonalizados;
  onCambio: (cp: CamposPersonalizados) => void;
  onCerrar: () => void;
  t: Textos;
}

/** Editor de nombres a mostrar y alias (rótulos del plano) por campo. Se guarda al vuelo. */
export function Campos({ camposPersonalizados, onCambio, onCerrar, t }: Props) {
  const p = t.personalizar;
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [avisoExtra, setAvisoExtra] = useState<string | null>(null);

  const setEtiqueta = (clave: ClaveCampo, etiqueta: string) => {
    const actual = camposPersonalizados[clave] ?? {};
    onCambio({ ...camposPersonalizados, [clave]: { ...actual, etiqueta } });
  };
  const setAlias = (clave: ClaveCampo, texto: string) => {
    const actual = camposPersonalizados[clave] ?? {};
    onCambio({ ...camposPersonalizados, [clave]: { ...actual, alias: textoAAlias(texto) } });
  };

  const textoRechazo = (r: Rechazo): string => {
    if (r.motivo === 'duplicado') return p.extraDuplicado(r.nombre, r.conflicto ?? '');
    if (r.motivo === 'limite') return p.extraLimite(MAX_CAMPOS_EXTRA);
    return p.extraInvalido;
  };

  // Camino manual del creador de campos: mismos guardarraíles que el automático.
  const anadirExtra = () => {
    const { creados, rechazados } = crearCampoManual(nuevoNombre, camposPersonalizados);
    if (creados.length) {
      onCambio({ ...camposPersonalizados, extra: [...(camposPersonalizados.extra ?? []), ...creados] });
      setNuevoNombre('');
      setAvisoExtra(null);
    } else if (rechazados.length) {
      setAvisoExtra(textoRechazo(rechazados[0]));
    }
  };

  const quitarExtra = (id: string) => {
    onCambio({ ...camposPersonalizados, extra: (camposPersonalizados.extra ?? []).filter((c) => c.id !== id) });
  };

  const extra = camposPersonalizados.extra ?? [];

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal modal--ancho" role="dialog" aria-label={t.app.tituloCampos} onClick={(e) => e.stopPropagation()}>
        <h2>{p.titulo}</h2>
        <p className="modal__nota">{p.nota}</p>
        <div className="campos-editor">
          <div className="campos-editor__cabecera">
            <span>{p.columnaCampo}</span>
            <span>{p.columnaEtiqueta}</span>
            <span>{p.columnaAlias}</span>
          </div>
          {CLAVES_CAMPO.map((clave) => (
            <div className="campos-editor__fila" key={clave}>
              <span className="campos-editor__nombre">{t.campos[clave]}</span>
              <input
                type="text"
                value={camposPersonalizados[clave]?.etiqueta ?? ''}
                placeholder={t.campos[clave]}
                aria-label={`${t.campos[clave]} — ${p.columnaEtiqueta}`}
                onChange={(e) => setEtiqueta(clave, e.target.value)}
              />
              <input
                type="text"
                value={aliasComoTexto(clave, camposPersonalizados)}
                placeholder={p.placeholderAlias}
                aria-label={`${t.campos[clave]} — ${p.columnaAlias}`}
                onChange={(e) => setAlias(clave, e.target.value)}
              />
            </div>
          ))}
        </div>

        <h3 className="campos-extra__titulo">{p.extraTitulo}</h3>
        <p className="modal__nota">{p.extraNota}</p>
        {extra.length > 0 && (
          <ul className="campos-extra__lista">
            {extra.map((c) => (
              <li key={c.id} className="campos-extra__item">
                <span>{c.nombre}</span>
                <button className="cola__quitar" type="button" title={p.extraQuitar} aria-label={`${p.extraQuitar}: ${c.nombre}`} onClick={() => quitarExtra(c.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="campos-extra__nuevo">
          <input
            type="text"
            value={nuevoNombre}
            placeholder={p.extraPlaceholder}
            aria-label={p.extraTitulo}
            onChange={(e) => {
              setNuevoNombre(e.target.value);
              setAvisoExtra(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') anadirExtra();
            }}
          />
          <button className="btn" type="button" onClick={anadirExtra} disabled={!nuevoNombre.trim()}>
            {p.extraAnadir}
          </button>
        </div>
        {avisoExtra && <p className="campo__mensaje">⚠ {avisoExtra}</p>}

        <div className="modal__acciones">
          <button className="btn" type="button" onClick={() => onCambio({ extra: camposPersonalizados.extra })}>
            {p.restaurar}
          </button>
          <button className="btn btn--primario" type="button" onClick={onCerrar}>
            {p.cerrar}
          </button>
        </div>
      </div>
    </div>
  );
}
