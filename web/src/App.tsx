import { useEffect, useState } from 'react';
import { cabecerasApi, cargarAjustes, MODELO_DEFECTO, type AjustesApp } from './ajustes';
import { Ajustes } from './components/Ajustes';
import { Dropzone, type ArchivoPlano } from './components/Dropzone';
import { Resultados } from './components/Resultados';
import type { Extraccion, RespuestaExtraccion } from './tipos';

interface EstadoServidor {
  serverKey: boolean;
  modelos: string[];
  modeloDefecto: string;
}

export default function App() {
  const [archivo, setArchivo] = useState<ArchivoPlano | null>(null);
  const [datos, setDatos] = useState<Extraccion | null>(null);
  const [demo, setDemo] = useState(false);
  const [servidor, setServidor] = useState<EstadoServidor>({
    serverKey: false,
    modelos: [MODELO_DEFECTO],
    modeloDefecto: MODELO_DEFECTO,
  });
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => setServidor(s))
      .catch(() => {});
  }, []);

  const sinCredenciales = !servidor.serverKey && !ajustes.apiKey;

  const analizar = async () => {
    if (!archivo) return;
    setAnalizando(true);
    setError(null);
    setDatos(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cabecerasApi(ajustes) },
        body: JSON.stringify({
          filename: archivo.nombre,
          mediaType: archivo.mediaType,
          dataBase64: archivo.dataBase64,
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
          {sinCredenciales && <span className="cabecera__demo">modo demo</span>}
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
          serverKey={servidor.serverKey}
          modelos={servidor.modelos}
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
          <button className="btn btn--primario btn--analizar" onClick={analizar} disabled={!archivo || analizando}>
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
                  <>Configura tu clave de API en <strong>⚙ Ajustes</strong> para analizar planos reales.</>
                )}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
