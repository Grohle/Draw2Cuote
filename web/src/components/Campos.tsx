import { aliasComoTexto, CLAVES_CAMPO, textoAAlias, type CamposPersonalizados, type ClaveCampo } from '../camposPersonalizados';
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

  const setEtiqueta = (clave: ClaveCampo, etiqueta: string) => {
    const actual = camposPersonalizados[clave] ?? {};
    onCambio({ ...camposPersonalizados, [clave]: { ...actual, etiqueta } });
  };
  const setAlias = (clave: ClaveCampo, texto: string) => {
    const actual = camposPersonalizados[clave] ?? {};
    onCambio({ ...camposPersonalizados, [clave]: { ...actual, alias: textoAAlias(texto) } });
  };

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
        <div className="modal__acciones">
          <button className="btn" type="button" onClick={() => onCambio({})}>
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
