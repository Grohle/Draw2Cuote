import { useCallback, useRef, useState } from 'react';
import type { Textos } from '../i18n';

const TIPOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 32 * 1024 * 1024;

export interface ArchivoPlano {
  nombre: string;
  mediaType: string;
  dataBase64: string;
  dataUrl: string;
}

interface Props {
  archivo: ArchivoPlano | null;
  onArchivo: (a: ArchivoPlano) => void;
  onError: (msg: string) => void;
  t: Textos;
}

export function Dropzone({ archivo, onArchivo, onError, t }: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const procesar = useCallback(
    (file: File) => {
      if (!TIPOS.includes(file.type)) {
        onError(t.dropzone.formatoNoAdmitido(file.type || t.dropzone.desconocido));
        return;
      }
      if (file.size > MAX_BYTES) {
        onError(t.dropzone.archivoDemasiadoGrande);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const dataBase64 = dataUrl.split(',', 2)[1] ?? '';
        onArchivo({ nombre: file.name, mediaType: file.type, dataBase64, dataUrl });
      };
      reader.onerror = () => onError(t.dropzone.noSePudoLeer);
      reader.readAsDataURL(file);
    },
    [onArchivo, onError, t]
  );

  return (
    <div
      className={`dropzone ${arrastrando ? 'dropzone--activo' : ''} ${archivo ? 'dropzone--con-archivo' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        const file = e.dataTransfer.files[0];
        if (file) procesar(file);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) procesar(file);
          e.target.value = '';
        }}
      />
      {archivo ? (
        <div className="dropzone__vista">
          {archivo.mediaType === 'application/pdf' ? (
            <embed src={archivo.dataUrl} type="application/pdf" className="dropzone__pdf" />
          ) : (
            <img src={archivo.dataUrl} alt={t.dropzone.vistaPreviaDe(archivo.nombre)} className="dropzone__img" />
          )}
          <p className="dropzone__nombre">
            {archivo.nombre} <span className="dropzone__cambiar">{t.dropzone.cambiar}</span>
          </p>
        </div>
      ) : (
        <div className="dropzone__vacio">
          <div className="dropzone__icono" aria-hidden>
            📐
          </div>
          <p className="dropzone__titulo">{t.dropzone.titulo}</p>
          <p className="dropzone__sub">{t.dropzone.sub}</p>
        </div>
      )}
    </div>
  );
}
