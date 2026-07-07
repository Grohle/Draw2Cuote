import { useState } from 'react';
import { cargarAjustes, configApi, guardarAjustes, type AjustesApp } from '../ajustes';
import type { Idioma, Textos } from '../i18n';
import { presetDe, presetTextos, PROVEEDORES, type IdProveedor } from '../proveedores';

interface Props {
  serverKey: boolean;
  onCerrar: (ajustes: AjustesApp) => void;
  t: Textos;
  idioma: Idioma;
}

export function Ajustes({ serverKey, onCerrar, t, idioma }: Props) {
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [verClave, setVerClave] = useState(false);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState<{ ok: boolean; msg: string } | null>(null);
  const a = t.ajustes;

  const preset = presetDe(ajustes.proveedor);
  const textosPreset = presetTextos(ajustes.proveedor, t);

  const cambiar = (parcial: Partial<AjustesApp>) => {
    setAjustes((ai) => ({ ...ai, ...parcial }));
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
        body: JSON.stringify({ config: configApi(ajustes, idioma) }),
      });
      const cuerpo = await res.json().catch(() => null);
      setPrueba(res.ok ? { ok: true, msg: a.conexionOk } : { ok: false, msg: cuerpo?.error ?? a.errorConexion(res.status) });
    } catch {
      setPrueba({ ok: false, msg: a.errorServidor });
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="modal-fondo" onClick={() => onCerrar(cargarAjustes())}>
      <div className="modal" role="dialog" aria-label={t.app.tituloAjustes} onClick={(e) => e.stopPropagation()}>
        <h2>{t.app.botonAjustes}</h2>

        <label className="modal__label" htmlFor="ajuste-proveedor">
          {a.etiquetaProveedor}
        </label>
        <select id="ajuste-proveedor" value={ajustes.proveedor} onChange={(e) => cambiarProveedor(e.target.value as IdProveedor)}>
          {PROVEEDORES.map((p) => (
            <option key={p.id} value={p.id}>
              {presetTextos(p.id, t).nombre}
            </option>
          ))}
        </select>
        <p className="modal__nota">{textosPreset.nota}</p>

        {preset.urlEditable && (
          <>
            <label className="modal__label" htmlFor="ajuste-url">
              {a.etiquetaUrl} {preset.urlObligatoria ? a.obligatoria : ''}
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
          {a.etiquetaClave} {preset.claveObligatoria ? '' : a.opcional}
        </label>
        <div className="modal__fila-clave">
          <input
            id="ajuste-clave"
            type={verClave ? 'text' : 'password'}
            placeholder={preset.claveObligatoria ? a.placeholderClaveObligatoria : a.placeholderClaveOpcional}
            value={ajustes.apiKey}
            autoComplete="off"
            onChange={(e) => cambiar({ apiKey: e.target.value })}
          />
          <button className="btn" type="button" onClick={() => setVerClave(!verClave)}>
            {verClave ? a.ocultar : a.ver}
          </button>
        </div>
        <p className="modal__nota">
          {ajustes.proveedor === 'anthropic' && serverKey ? a.notaServidorConClave : ''}
          {a.notaPrivacidad}
        </p>

        <label className="modal__label" htmlFor="ajuste-modelo">
          {a.etiquetaModelo} {ajustes.proveedor !== 'anthropic' ? a.debeVerVision : ''}
        </label>
        <input
          id="ajuste-modelo"
          type="text"
          list="lista-modelos"
          placeholder={a.placeholderModelo}
          value={ajustes.modelo}
          onChange={(e) => cambiar({ modelo: e.target.value })}
        />
        <datalist id="lista-modelos">
          {preset.modelos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        {!preset.admitePdf && <p className="modal__nota">{a.avisoSinPdf}</p>}

        {prueba && <p className={`modal__prueba ${prueba.ok ? 'modal__prueba--ok' : 'modal__prueba--error'}`}>{prueba.msg}</p>}

        <div className="modal__acciones">
          <button className="btn" type="button" onClick={() => cambiar({ apiKey: '' })}>
            {a.quitarClave}
          </button>
          <button className="btn" type="button" onClick={probar} disabled={probando || faltaUrl || faltaClave}>
            {probando ? a.probando : a.probarConexion}
          </button>
          <button className="btn btn--primario" type="button" onClick={guardar} disabled={faltaUrl}>
            {a.guardar}
          </button>
        </div>
      </div>
    </div>
  );
}
