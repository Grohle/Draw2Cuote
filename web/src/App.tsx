import { useEffect, useState } from 'react';
import { cargarAjustes, configApi, esModoDemo, type AjustesApp } from './ajustes';
import { Ajustes } from './components/Ajustes';
import { Dropzone, type ArchivoPlano } from './components/Dropzone';
import { Resultados } from './components/Resultados';
import { presetDe } from './proveedores';
import type { Extraccion, RespuestaExtraccion } from './tipos';

export default function App() {
  const [archivo, setArchivo] = useState<ArchivoPlano | null>(null);
  const [datos, setDatos] = useState<Extraccion | null>(null);
  const [demo, setDemo] = useState(false);
  const [serverKey, setServerKey] = useState(false);
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setDemo(respuesta.demo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado analizando el plano.');
    } finally {
      setAnalizando(false);
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

      <main className="contenido">
        <div className="columna columna--plano">
          <Dropzone
            archivo={archivo}
            onArchivo={(a) => {
              setArchivo(a);
              setDatos(null);
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
            <Resultados datos={datos} onCambio={setDatos} demo={demo} />
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
                <li>Corrige lo que haga falta y exporta el JSON estructurado para tu presupuesto.</li>
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
