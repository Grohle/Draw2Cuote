import { useCallback, useRef, useState } from 'react';

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
}

export function Dropzone({ archivo, onArchivo, onError }: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const procesar = useCallback(
    (file: File) => {
      if (!TIPOS.includes(file.type)) {
        onError(`Formato no admitido (${file.type || 'desconocido'}). Arrastra un PDF, PNG, JPG, WebP o GIF.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        onError('El archivo supera el límite de 32 MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const dataBase64 = dataUrl.split(',', 2)[1] ?? '';
        onArchivo({ nombre: file.name, mediaType: file.type, dataBase64, dataUrl });
      };
      reader.onerror = () => onError('No se pudo leer el archivo.');
      reader.readAsDataURL(file);
    },
    [onArchivo, onError]
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
            <img src={archivo.dataUrl} alt={`Vista previa de ${archivo.nombre}`} className="dropzone__img" />
          )}
          <p className="dropzone__nombre">
            {archivo.nombre} <span className="dropzone__cambiar">— haz clic para cambiar</span>
          </p>
        </div>
      ) : (
        <div className="dropzone__vacio">
          <div className="dropzone__icono" aria-hidden>
            📐
          </div>
          <p className="dropzone__titulo">Arrastra aquí el plano</p>
          <p className="dropzone__sub">PDF o imagen (PNG, JPG, WebP) · máx. 32 MB · o haz clic para buscarlo</p>
        </div>
      )}
    </div>
  );
}
