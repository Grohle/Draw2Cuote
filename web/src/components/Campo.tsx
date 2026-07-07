import type { ReactNode } from 'react';
import type { Textos } from '../i18n';
import type { Confianza } from '../tipos';

export function ChipConfianza({ confianza, editado, t }: { confianza: Confianza; editado?: boolean; t: Textos }) {
  const textoConfianza: Record<Confianza, string> = {
    alta: t.campo.confianzaAlta,
    media: t.campo.confianzaMedia,
    baja: t.campo.confianzaBaja,
  };
  if (editado) {
    return (
      <span className="chip chip--revisado" title={t.campo.tituloRevisado}>
        {t.campo.revisado}
      </span>
    );
  }
  return (
    <span className={`chip chip--${confianza}`} title={t.campo.tituloConfianza(textoConfianza[confianza].toLowerCase())}>
      {textoConfianza[confianza]}
    </span>
  );
}

interface CampoProps {
  etiqueta: string;
  ayuda: string;
  confianza: Confianza;
  editado?: boolean;
  avisos: string[];
  t: Textos;
  children: ReactNode;
}

/** Envoltorio de campo: etiqueta + ayuda "?" + chip de confianza + avisos */
export function Campo({ etiqueta, ayuda, confianza, editado, avisos, t, children }: CampoProps) {
  const conAviso = avisos.length > 0;
  return (
    <div className={`campo ${conAviso ? 'campo--aviso' : ''} ${confianza === 'baja' && !editado ? 'campo--dudoso' : ''}`}>
      <div className="campo__cabecera">
        <label className="campo__etiqueta">
          {etiqueta}
          <span className="ayuda" tabIndex={0}>
            ?<span className="ayuda__texto">{ayuda}</span>
          </span>
        </label>
        <ChipConfianza confianza={confianza} editado={editado} t={t} />
      </div>
      {children}
      {avisos.map((a, i) => (
        <p key={i} className="campo__mensaje">
          ⚠ {a}
        </p>
      ))}
    </div>
  );
}
