import { useEffect, useState } from 'react';
import { cargarAjustes, configApi, esModoDemo, type AjustesApp } from './ajustes';
import { Ajustes } from './components/Ajustes';
import { Calibracion } from './components/Calibracion';
import { Dropzone, type ArchivoPlano } from './components/Dropzone';
import { type EstadoFeedback, Resultados } from './components/Resultados';
import { Tarifas as ModalTarifas } from './components/Tarifas';
import { presetDe } from './proveedores';
import { cargarTarifas, type Tarifas } from './tarifas';
import type { Extraccion, RespuestaExtraccion } from './tipos';

export default function App() {
  const [archivo, setArchivo] = useState<ArchivoPlano | null>(null);
  const [datos, setDatos] = useState<Extraccion | null>(null);
  const [datosOriginales, setDatosOriginales] = useState<Extraccion | null>(null);
  const [demo, setDemo] = useState(false);
  const [serverKey, setServerKey] = useState(false);
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [tarifas, setTarifas] = useState<Tarifas>(() => cargarTarifas());
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [calibracionAbierta, setCalibracionAbierta] = useState(false);
  const [tarifasAbiertas, setTarifasAbiertas] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoFeedback, setEstadoFeedback] = useState<EstadoFeedback>('inactivo');
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);
  const [incluirImagenFeedback, setIncluirImagenFeedback] = useState(false);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => setServerKey(Boolean(s.serverKey)))
      .catch(() => {});
  }, []);

  const preset = presetDe(ajustes.proveedor);
  const sinCredenciales = esModoDemo(ajustes, serverKey);
  const pdfNoAdmitido = archivo?.mediaType === 'application/pdf' && !preset.admitePdf;

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
          config: configApi(ajustes),
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
          imagen: incluirImagenFeedback && archivo ? { mediaType: archivo.mediaType, dataBase64: archivo.dataBase64 } : undefined,
        }),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(cuerpo?.error ?? `Error ${res.status} guardando el feedback.`);
      }
      const n = (cuerpo.camposCorregidos as string[]).length;
      setMensajeFeedback(
        n > 0
          ? `Gracias: ${n} campo${n === 1 ? '' : 's'} corregido${n === 1 ? '' : 's'} registrado${n === 1 ? '' : 's'} para mejorar el modelo.`
          : 'Confirmado sin cambios: gracias, ayuda a calibrar la confianza del modelo.'
      );
      setEstadoFeedback('guardado');
    } catch (e) {
      setMensajeFeedback(e instanceof Error ? e.message : 'No se pudo guardar el feedback.');
      setEstadoFeedback('error');
    }
  };

  return (
    <div className="app">
      <header className="cabecera">
        <h1>
          Draw2<span>Quote</span>
        </h1>
        <p className="cabecera__lema">De plano a presupuesto en segundos</p>
        <div className="cabecera__derecha">
          {sinCredenciales ? (
            <span className="cabecera__demo">modo demo</span>
          ) : (
            <span className="cabecera__proveedor" title={`Proveedor: ${preset.nombre}`}>
              {preset.nombre.split(' (')[0]}
            </span>
          )}
          <button
            className="btn btn--ajustes"
            title="Tarifas de presupuesto"
            aria-label="Tarifas de presupuesto"
            onClick={() => setTarifasAbiertas(true)}
          >
            💶 Tarifas
          </button>
          <button
            className="btn btn--ajustes"
            title="Precisión del modelo"
            aria-label="Precisión del modelo"
            onClick={() => setCalibracionAbierta(true)}
          >
            📊 Precisión
          </button>
          <button
            className="btn btn--ajustes"
            title="Ajustes de la API"
            aria-label="Ajustes de la API"
            onClick={() => setAjustesAbiertos(true)}
          >
            ⚙ Ajustes
          </button>
        </div>
      </header>

      {ajustesAbiertos && (
        <Ajustes
          serverKey={serverKey}
          onCerrar={(nuevos) => {
            setAjustes(nuevos);
            setAjustesAbiertos(false);
          }}
        />
      )}
      {calibracionAbierta && <Calibracion onCerrar={() => setCalibracionAbierta(false)} />}
      {tarifasAbiertas && (
        <ModalTarifas
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
            onArchivo={(a) => {
              setArchivo(a);
              setDatos(null);
              setDatosOriginales(null);
              setError(null);
            }}
            onError={setError}
          />
          {pdfNoAdmitido && (
            <div className="error">
              ⚠ {preset.nombre} no admite PDF: sube una imagen del plano o cambia a Anthropic o Google Gemini en ⚙
              Ajustes.
            </div>
          )}
          <button
            className="btn btn--primario btn--analizar"
            onClick={analizar}
            disabled={!archivo || analizando || pdfNoAdmitido}
          >
            {analizando ? 'Analizando plano…' : 'Analizar plano'}
          </button>
          {analizando && (
            <p className="pista">
              Leyendo cotas, cajetín y notas del plano. Puede tardar un poco en planos densos.
            </p>
          )}
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
            />
          ) : (
            <div className="vacio">
              <h2>¿Cómo funciona?</h2>
              <ol>
                <li>Arrastra el plano (PDF o imagen) al panel de la izquierda.</li>
                <li>Pulsa <strong>Analizar plano</strong>: la IA lee cajetín, cotas y notas.</li>
                <li>
                  Revisa los datos extraídos. Cada campo indica la <strong>confianza</strong> de la lectura y los
                  valores dudosos quedan marcados para revisión.
                </li>
                <li>
                  Corrige lo que haga falta y pulsa <strong>🧠 Guardar corrección</strong>: esas correcciones alimentan
                  el panel de precisión y ajustan el criterio del modelo en los próximos análisis.
                </li>
                <li>
                  Revisa el <strong>💰 presupuesto estimado</strong> (ajustable en <strong>💶 Tarifas</strong>) y exporta
                  el JSON estructurado.
                </li>
              </ol>
              <p className="vacio__nota">
                La app nunca inventa datos: si algo no es legible en el plano, el campo queda vacío y se añade una
                observación.{' '}
                {sinCredenciales && (
                  <>
                    En <strong>⚙ Ajustes</strong> puedes conectar Anthropic, Google Gemini (gratuita), Ollama, LM
                    Studio, vLLM o cualquier API compatible con OpenAI.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
