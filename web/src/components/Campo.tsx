import type { ReactNode } from 'react';
import type { Confianza } from '../tipos';

const TEXTO_CONFIANZA: Record<Confianza, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export function ChipConfianza({ confianza, editado }: { confianza: Confianza; editado?: boolean }) {
  if (editado) {
    return <span className="chip chip--revisado" title="Valor corregido a mano">✓ Revisado</span>;
  }
  return (
    <span
      className={`chip chip--${confianza}`}
      title={`Confianza de la lectura automática: ${TEXTO_CONFIANZA[confianza].toLowerCase()}`}
    >
      {TEXTO_CONFIANZA[confianza]}
    </span>
  );
}

interface CampoProps {
  etiqueta: string;
  ayuda: string;
  confianza: Confianza;
  editado?: boolean;
  avisos: string[];
  children: ReactNode;
}

/** Envoltorio de campo: etiqueta + ayuda "?" + chip de confianza + avisos */
export function Campo({ etiqueta, ayuda, confianza, editado, avisos, children }: CampoProps) {
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
        <ChipConfianza confianza={confianza} editado={editado} />
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
