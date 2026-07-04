import { useState } from 'react';
import { cargarAjustes, guardarAjustes, type AjustesApp } from '../ajustes';

interface Props {
  serverKey: boolean;
  modelos: string[];
  onCerrar: (ajustes: AjustesApp) => void;
}

const NOMBRES_MODELO: Record<string, string> = {
  'claude-opus-4-8': 'Claude Opus 4.8 — máxima precisión (recomendado)',
  'claude-sonnet-5': 'Claude Sonnet 5 — equilibrio precio/precisión',
  'claude-haiku-4-5': 'Claude Haiku 4.5 — rápido y económico',
};

export function Ajustes({ serverKey, modelos, onCerrar }: Props) {
  const inicial = cargarAjustes();
  const [clave, setClave] = useState(inicial.apiKey);
  const [modelo, setModelo] = useState(inicial.modelo);
  const [verClave, setVerClave] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; msg: string } | null>(null);

  const guardar = () => {
    const ajustes: AjustesApp = { apiKey: clave.trim(), modelo };
    guardarAjustes(ajustes);
    onCerrar(ajustes);
  };

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: clave.trim() ? { 'x-draw2quote-key': clave.trim() } : {},
      });
      const cuerpo = await res.json().catch(() => null);
      setPrueba(
        res.ok
          ? { ok: true, msg: 'Conexión correcta: la clave es válida.' }
          : { ok: false, msg: cuerpo?.error ?? `Error ${res.status} probando la clave.` }
      );
    } catch {
      setPrueba({ ok: false, msg: 'No se pudo contactar con el servidor de la app.' });
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={() => onCerrar(cargarAjustes())}>
      <div className="modal" role="dialog" aria-label="Ajustes de la API" onClick={(e) => e.stopPropagation()}>
        <h2>Ajustes de la API</h2>

        <label className="modal__label" htmlFor="ajuste-clave">
          Clave de API de Anthropic
        </label>
        <div className="modal__fila-clave">
          <input
            id="ajuste-clave"
            type={verClave ? 'text' : 'password'}
            placeholder="sk-ant-..."
            value={clave}
            autoComplete="off"
            onChange={(e) => {
              setClave(e.target.value);
              setPrueba(null);
            }}
          />
          <button className="btn" type="button" onClick={() => setVerClave(!verClave)}>
            {verClave ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        <p className="modal__nota">
          {serverKey
            ? 'El servidor ya tiene una clave configurada; si guardas otra aquí, la tuya tiene prioridad.'
            : 'El servidor no tiene clave configurada: sin clave aquí, la app funciona en modo demo.'}{' '}
          La clave se guarda solo en este navegador (localStorage) y se envía únicamente a tu servidor de Draw2Quote
          con cada análisis. No la uses en un equipo compartido.
        </p>

        <label className="modal__label" htmlFor="ajuste-modelo">
          Modelo de análisis
        </label>
        <select id="ajuste-modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}>
          {modelos.map((m) => (
            <option key={m} value={m}>
              {NOMBRES_MODELO[m] ?? m}
            </option>
          ))}
        </select>

        {prueba && <p className={`modal__prueba ${prueba.ok ? 'modal__prueba--ok' : 'modal__prueba--error'}`}>{prueba.msg}</p>}

        <div className="modal__acciones">
          <button
            className="btn"
            type="button"
            onClick={() => {
              setClave('');
              setPrueba(null);
            }}
          >
            Quitar clave
          </button>
          <button className="btn" type="button" onClick={probar} disabled={probando || (!clave.trim() && !serverKey)}>
            {probando ? 'Probando…' : 'Probar conexión'}
          </button>
          <button className="btn btn--primario" type="button" onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
