import { type ReactNode, useEffect, useState } from 'react';
import { cargarAjustes, configApi, esModoDemo, guardarAjustes, type AjustesApp } from './ajustes';
import {
  aliasParaServidor,
  cargarCamposPersonalizados,
  guardarCamposPersonalizados,
  type CamposPersonalizados,
} from './camposPersonalizados';
import { Ajustes } from './components/Ajustes';
import { Calibracion } from './components/Calibracion';
import { Campos } from './components/Campos';
import { Dropzone, type ArchivoPlano } from './components/Dropzone';
import { type EstadoFeedback, Resultados } from './components/Resultados';
import { Tarifas as ModalTarifas } from './components/Tarifas';
import { cargarConfigArchivo, guardarConfigArchivo, sinPreferenciasLocales } from './configArchivo';
import { cargarDesplegado, guardarDesplegado, type OpcionesDesplegado } from './desplegado';
import { cargarIdioma, guardarIdioma, obtenerTextos, type Idioma } from './i18n';
import { presetDe, presetTextos } from './proveedores';
import { cargarTarifas, guardarTarifas, type Tarifas } from './tarifas';
import type { Extraccion, RespuestaExtraccion } from './tipos';
import { cargarUnidades, guardarUnidades, type SistemaUnidades } from './unidades';

/** Convierte "texto **en negrita**" en nodos con <strong>, para los pasos de la pantalla inicial. */
function conNegritas(texto: string): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte));
}

export default function App() {
  const [archivo, setArchivo] = useState<ArchivoPlano | null>(null);
  const [datos, setDatos] = useState<Extraccion | null>(null);
  const [datosOriginales, setDatosOriginales] = useState<Extraccion | null>(null);
  const [demo, setDemo] = useState(false);
  const [serverKey, setServerKey] = useState(false);
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [tarifas, setTarifas] = useState<Tarifas>(() => cargarTarifas());
  const [idioma, setIdioma] = useState<Idioma>(() => cargarIdioma());
  const [unidades, setUnidades] = useState<SistemaUnidades>(() => cargarUnidades());
  const [camposPersonalizados, setCamposPersonalizados] = useState<CamposPersonalizados>(() => cargarCamposPersonalizados());
  const [desplegado, setDesplegado] = useState<OpcionesDesplegado>(() => cargarDesplegado());
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [calibracionAbierta, setCalibracionAbierta] = useState(false);
  const [tarifasAbiertas, setTarifasAbiertas] = useState(false);
  const [camposAbiertos, setCamposAbiertos] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoFeedback, setEstadoFeedback] = useState<EstadoFeedback>('inactivo');
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);
  const [incluirImagenFeedback, setIncluirImagenFeedback] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  const t = obtenerTextos(idioma);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => setServerKey(Boolean(s.serverKey)))
      .catch(() => {});
  }, []);

  // Al arrancar sin preferencias en el navegador (p. ej. equipo nuevo o la
  // versión de escritorio), rehidrata la configuración desde el JSON guardado.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (sinPreferenciasLocales()) {
        const cfg = await cargarConfigArchivo();
        if (!cancelado && cfg) {
          if (cfg.idioma === 'es' || cfg.idioma === 'en') {
            setIdioma(cfg.idioma);
            guardarIdioma(cfg.idioma);
          }
          if (cfg.unidades === 'metrico' || cfg.unidades === 'imperial') {
            setUnidades(cfg.unidades);
            guardarUnidades(cfg.unidades);
          }
          if (cfg.tarifas) {
            setTarifas(cfg.tarifas);
            guardarTarifas(cfg.tarifas);
          }
          if (cfg.camposPersonalizados) {
            setCamposPersonalizados(cfg.camposPersonalizados);
            guardarCamposPersonalizados(cfg.camposPersonalizados);
          }
          if (cfg.desplegado) {
            setDesplegado(cfg.desplegado);
            guardarDesplegado(cfg.desplegado);
          }
          if (cfg.ajustes) {
            const fusion = { ...cargarAjustes(), ...cfg.ajustes };
            setAjustes(fusion);
            guardarAjustes(fusion);
          }
        }
      }
      if (!cancelado) setHidratado(true);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Guarda automáticamente toda la configuración en el JSON del servidor ante
  // cualquier cambio (tras la hidratación inicial, para no pisar lo guardado).
  useEffect(() => {
    if (!hidratado) return;
    guardarConfigArchivo({
      version: 1,
      idioma,
      unidades,
      ajustes: { proveedor: ajustes.proveedor, baseUrl: ajustes.baseUrl, modelo: ajustes.modelo },
      tarifas,
      camposPersonalizados,
      desplegado,
    });
  }, [hidratado, idioma, unidades, ajustes, tarifas, camposPersonalizados, desplegado]);

  const preset = presetDe(ajustes.proveedor);
  const nombreProveedor = presetTextos(ajustes.proveedor, t).nombre;
  const sinCredenciales = esModoDemo(ajustes, serverKey);
  const pdfNoAdmitido = archivo?.mediaType === 'application/pdf' && !preset.admitePdf;

  const cambiarIdioma = (nuevo: Idioma) => {
    setIdioma(nuevo);
    guardarIdioma(nuevo);
  };

  const cambiarUnidades = (nuevo: SistemaUnidades) => {
    setUnidades(nuevo);
    guardarUnidades(nuevo);
  };

  const cambiarCamposPersonalizados = (nuevos: CamposPersonalizados) => {
    setCamposPersonalizados(nuevos);
    guardarCamposPersonalizados(nuevos);
  };

  const cambiarDesplegado = (nuevo: OpcionesDesplegado) => {
    setDesplegado(nuevo);
    guardarDesplegado(nuevo);
  };

  const analizar = async () => {
    if (!archivo) return;
    setAnalizando(true);
    setError(null);
    setDatos(null);
    setDatosOriginales(null);
    setEstadoFeedback('inactivo');
    setMensajeFeedback(null);
    setIncluirImagenFeedback(false);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: archivo.nombre,
          mediaType: archivo.mediaType,
          dataBase64: archivo.dataBase64,
          config: configApi(ajustes, idioma, aliasParaServidor(camposPersonalizados)),
        }),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(cuerpo?.error ?? `Error ${res.status} del servidor.`);
      }
      const respuesta = cuerpo as RespuestaExtraccion;
      setDatos(respuesta.datos);
      // copia independiente: "datos" se mutará con las correcciones del usuario
      setDatosOriginales(JSON.parse(JSON.stringify(respuesta.datos)));
      setDemo(respuesta.demo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado analizando el plano.');
    } finally {
      setAnalizando(false);
    }
  };

  const cambiarDatos = (nuevos: Extraccion) => {
    setDatos(nuevos);
    // si el usuario sigue editando después de guardar, permite guardar de nuevo
    if (estadoFeedback !== 'inactivo') {
      setEstadoFeedback('inactivo');
      setMensajeFeedback(null);
    }
  };

  const guardarFeedback = async () => {
    if (!datos || !datosOriginales) return;
    setEstadoFeedback('guardando');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraccionOriginal: datosOriginales,
          extraccionFinal: datos,
          proveedor: ajustes.proveedor,
          modelo: ajustes.modelo || preset.modeloDefecto,
          idioma,
          imagen: incluirImagenFeedback && archivo ? { mediaType: archivo.mediaType, dataBase64: archivo.dataBase64 } : undefined,
        }),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(cuerpo?.error ?? `Error ${res.status}.`);
      }
      const n = (cuerpo.camposCorregidos as string[]).length;
      setMensajeFeedback(t.feedback.exito(n));
      setEstadoFeedback('guardado');
    } catch (e) {
      setMensajeFeedback(e instanceof Error ? e.message : t.feedback.errorGuardando);
      setEstadoFeedback('error');
    }
  };

  return (
    <div className="app">
      <header className="cabecera">
        <h1>
          Draw2<span>Quote</span>
        </h1>
        <p className="cabecera__lema">{t.app.lema}</p>
        <div className="cabecera__derecha">
          {sinCredenciales ? (
            <span className="cabecera__demo">{t.app.modoDemo}</span>
          ) : (
            <span className="cabecera__proveedor" title={nombreProveedor}>
              {nombreProveedor.split(' (')[0]}
            </span>
          )}
          <button className="btn btn--toggle" title={t.app.tituloIdioma} aria-label={t.app.tituloIdioma} onClick={() => cambiarIdioma(idioma === 'es' ? 'en' : 'es')}>
            🌐 {idioma === 'es' ? 'ES' : 'EN'}
          </button>
          <button className="btn btn--toggle" title={t.app.tituloUnidades} aria-label={t.app.tituloUnidades} onClick={() => cambiarUnidades(unidades === 'metrico' ? 'imperial' : 'metrico')}>
            📐 {unidades === 'metrico' ? 'mm' : 'in'}
          </button>
          <button className="btn btn--ajustes" title={t.app.tituloTarifas} aria-label={t.app.tituloTarifas} onClick={() => setTarifasAbiertas(true)}>
            {t.app.botonTarifas}
          </button>
          <button className="btn btn--ajustes" title={t.app.tituloPrecision} aria-label={t.app.tituloPrecision} onClick={() => setCalibracionAbierta(true)}>
            {t.app.botonPrecision}
          </button>
          <button className="btn btn--ajustes" title={t.app.tituloCampos} aria-label={t.app.tituloCampos} onClick={() => setCamposAbiertos(true)}>
            {t.app.botonCampos}
          </button>
          <button className="btn btn--ajustes" title={t.app.tituloAjustes} aria-label={t.app.tituloAjustes} onClick={() => setAjustesAbiertos(true)}>
            {t.app.botonAjustes}
          </button>
        </div>
      </header>

      {ajustesAbiertos && (
        <Ajustes
          serverKey={serverKey}
          t={t}
          idioma={idioma}
          onCerrar={(nuevos) => {
            setAjustes(nuevos);
            setAjustesAbiertos(false);
          }}
        />
      )}
      {calibracionAbierta && <Calibracion onCerrar={() => setCalibracionAbierta(false)} t={t} />}
      {camposAbiertos && (
        <Campos
          camposPersonalizados={camposPersonalizados}
          onCambio={cambiarCamposPersonalizados}
          onCerrar={() => setCamposAbiertos(false)}
          t={t}
        />
      )}
      {tarifasAbiertas && (
        <ModalTarifas
          t={t}
          onCerrar={(nuevas) => {
            setTarifas(nuevas);
            setTarifasAbiertas(false);
          }}
        />
      )}

      <main className="contenido">
        <div className="columna columna--plano">
          <Dropzone
            archivo={archivo}
            t={t}
            onArchivo={(a) => {
              setArchivo(a);
              setDatos(null);
              setDatosOriginales(null);
              setError(null);
            }}
            onError={setError}
          />
          {pdfNoAdmitido && <div className="error">⚠ {t.app.pdfNoAdmitido(nombreProveedor)}</div>}
          <button className="btn btn--primario btn--analizar" onClick={analizar} disabled={!archivo || analizando || pdfNoAdmitido}>
            {analizando ? t.app.analizando : t.app.botonAnalizar}
          </button>
          {analizando && <p className="pista">{t.app.pista}</p>}
          {error && <div className="error">⚠ {error}</div>}
        </div>

        <div className="columna columna--datos">
          {datos ? (
            <Resultados
              datos={datos}
              onCambio={cambiarDatos}
              demo={demo}
              onGuardarFeedback={guardarFeedback}
              estadoFeedback={estadoFeedback}
              mensajeFeedback={mensajeFeedback}
              incluirImagenFeedback={incluirImagenFeedback}
              onCambiarIncluirImagen={setIncluirImagenFeedback}
              tarifas={tarifas}
              onAbrirTarifas={() => setTarifasAbiertas(true)}
              t={t}
              idioma={idioma}
              unidades={unidades}
              camposPersonalizados={camposPersonalizados}
              opcionesDesplegado={desplegado}
              onCambioDesplegado={cambiarDesplegado}
            />
          ) : (
            <div className="vacio">
              <h2>{t.app.vacioTitulo}</h2>
              <ol>
                {t.app.vacioPasos.map((paso, i) => (
                  <li key={i}>{conNegritas(paso)}</li>
                ))}
              </ol>
              <p className="vacio__nota">
                {t.app.vacioNota} {sinCredenciales && t.app.vacioNotaSinCredenciales}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
