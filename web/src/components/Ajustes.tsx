import { useState } from 'react';
import { cargarAjustes, configApi, guardarAjustes, type AjustesApp } from '../ajustes';
import { presetDe, PROVEEDORES, type IdProveedor } from '../proveedores';

interface Props {
  serverKey: boolean;
  onCerrar: (ajustes: AjustesApp) => void;
}

export function Ajustes({ serverKey, onCerrar }: Props) {
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [verClave, setVerClave] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; msg: string } | null>(null);

  const preset = presetDe(ajustes.proveedor);

  const cambiar = (parcial: Partial<AjustesApp>) => {
    setAjustes((a) => ({ ...a, ...parcial }));
    setPrueba(null);
  };

  const cambiarProveedor = (id: IdProveedor) => {
    const nuevo = presetDe(id);
    // al cambiar de proveedor se precargan su URL y modelo por defecto
    cambiar({ proveedor: id, baseUrl: nuevo.baseUrl ?? '', modelo: nuevo.modeloDefecto });
  };

  const faltaUrl = preset.urlObligatoria && !ajustes.baseUrl.trim();
  const faltaClave = preset.claveObligatoria && !ajustes.apiKey.trim() && !(ajustes.proveedor === 'anthropic' && serverKey);

  const guardar = () => {
    const limpios: AjustesApp = {
      proveedor: ajustes.proveedor,
      apiKey: ajustes.apiKey.trim(),
      baseUrl: ajustes.baseUrl.trim(),
      modelo: ajustes.modelo.trim(),
    };
    guardarAjustes(limpios);
    onCerrar(limpios);
  };

  const probar = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configApi(ajustes) }),
      });
      const cuerpo = await res.json().catch(() => null);
      setPrueba(
        res.ok
          ? { ok: true, msg: 'Conexión correcta con el proveedor.' }
          : { ok: false, msg: cuerpo?.error ?? `Error ${res.status} probando la conexión.` }
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

        <label className="modal__label" htmlFor="ajuste-proveedor">
          Proveedor de IA
        </label>
        <select
          id="ajuste-proveedor"
          value={ajustes.proveedor}
          onChange={(e) => cambiarProveedor(e.target.value as IdProveedor)}
        >
          {PROVEEDORES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <p className="modal__nota">{preset.nota}</p>

        {preset.urlEditable && (
          <>
            <label className="modal__label" htmlFor="ajuste-url">
              URL base {preset.urlObligatoria ? '(obligatoria)' : ''}
            </label>
            <input
              id="ajuste-url"
              type="text"
              placeholder={preset.baseUrl || 'https://api.miservicio.com/v1'}
              value={ajustes.baseUrl}
              onChange={(e) => cambiar({ baseUrl: e.target.value })}
            />
          </>
        )}

        <label className="modal__label" htmlFor="ajuste-clave">
          Clave de API {preset.claveObligatoria ? '' : '(opcional)'}
        </label>
        <div className="modal__fila-clave">
          <input
            id="ajuste-clave"
            type={verClave ? 'text' : 'password'}
            placeholder={preset.claveObligatoria ? 'clave del proveedor' : 'vacío si tu servidor no la exige'}
            value={ajustes.apiKey}
            autoComplete="off"
            onChange={(e) => cambiar({ apiKey: e.target.value })}
          />
          <button className="btn" type="button" onClick={() => setVerClave(!verClave)}>
            {verClave ? 'Ocultar' : 'Ver'}
          </button>
        </div>
        <p className="modal__nota">
          {ajustes.proveedor === 'anthropic' && serverKey
            ? 'El servidor ya tiene una clave de Anthropic; si guardas otra aquí, la tuya tiene prioridad. '
            : ''}
          La configuración se guarda solo en este navegador (localStorage) y se envía únicamente a tu servidor de
          Draw2Quote con cada análisis. No la uses en un equipo compartido.
        </p>

        <label className="modal__label" htmlFor="ajuste-modelo">
          Modelo de análisis {ajustes.proveedor !== 'anthropic' ? '(debe tener visión)' : ''}
        </label>
        <input
          id="ajuste-modelo"
          type="text"
          list="lista-modelos"
          placeholder="nombre del modelo"
          value={ajustes.modelo}
          onChange={(e) => cambiar({ modelo: e.target.value })}
        />
        <datalist id="lista-modelos">
          {preset.modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        {!preset.admitePdf && (
          <p className="modal__nota">⚠ Este proveedor solo analiza imágenes (PNG/JPG); los PDF requieren Anthropic o Google Gemini.</p>
        )}

        {prueba && <p className={`modal__prueba ${prueba.ok ? 'modal__prueba--ok' : 'modal__prueba--error'}`}>{prueba.msg}</p>}

        <div className="modal__acciones">
          <button className="btn" type="button" onClick={() => cambiar({ apiKey: '' })}>
            Quitar clave
          </button>
          <button className="btn" type="button" onClick={probar} disabled={probando || faltaUrl || faltaClave}>
            {probando ? 'Probando…' : 'Probar conexión'}
          </button>
          <button className="btn btn--primario" type="button" onClick={guardar} disabled={faltaUrl}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
