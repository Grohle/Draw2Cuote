import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cargarAjustes, configApi, esModoDemo, guardarAjustes, type AjustesApp } from './ajustes';
import {
  aliasParaServidor,
  camposExtraParaServidor,
  cargarCamposPersonalizados,
  guardarCamposPersonalizados,
  type CamposPersonalizados,
} from './camposPersonalizados';
import { crearPieza, type PiezaCola, type ResultadoPieza } from './cola';
import { Ajustes } from './components/Ajustes';
import { Calibracion } from './components/Calibracion';
import { Campos } from './components/Campos';
import { Dropzone, type ArchivoPlano } from './components/Dropzone';
import { ListaCola } from './components/ListaCola';
import { Listado } from './components/Listado';
import { type EstadoFeedback, Resultados } from './components/Resultados';
import { Tarifas as ModalTarifas } from './components/Tarifas';
import { cargarConfigArchivo, guardarConfigArchivo, sinPreferenciasLocales } from './configArchivo';
import { procesarPropuestas } from './creadorCampos';
import { cargarDesplegado, guardarDesplegado, type OpcionesDesplegado } from './desplegado';
import { cargarIdioma, guardarIdioma, obtenerTextos, type Idioma } from './i18n';
import { cargarListado, guardarListado, type ItemListado } from './listado';
import { normalizarExtraccion } from './normalizar';
import { presetDe, presetTextos } from './proveedores';
import { cargarTarifas, guardarTarifas, type Tarifas } from './tarifas';
import type { Extraccion, RespuestaExtraccion } from './tipos';
import { cargarUnidades, guardarUnidades, type SistemaUnidades } from './unidades';

/** Convierte "texto **en negrita**" en nodos con <strong>, para los pasos de la pantalla inicial. */
function conNegritas(texto: string): ReactNode[] {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 === 1 ? <strong key={i}>{parte}</strong> : parte));
}

export default function App() {
  // Cola de planos: cada archivo subido es una pieza; la IA las analiza en orden.
  const [cola, setCola] = useState<PiezaCola[]>([]);
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const [enCursoId, setEnCursoId] = useState<string | null>(null);
  const [serverKey, setServerKey] = useState(false);
  const [ajustes, setAjustes] = useState<AjustesApp>(() => cargarAjustes());
  const [tarifas, setTarifas] = useState<Tarifas>(() => cargarTarifas());
  const [idioma, setIdioma] = useState<Idioma>(() => cargarIdioma());
  const [unidades, setUnidades] = useState<SistemaUnidades>(() => cargarUnidades());
  const [camposPersonalizados, setCamposPersonalizados] = useState<CamposPersonalizados>(() => cargarCamposPersonalizados());
  const [desplegado, setDesplegado] = useState<OpcionesDesplegado>(() => cargarDesplegado());
  const [listado, setListado] = useState<ItemListado[]>(() => cargarListado());
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [calibracionAbierta, setCalibracionAbierta] = useState(false);
  const [tarifasAbiertas, setTarifasAbiertas] = useState(false);
  const [camposAbiertos, setCamposAbiertos] = useState(false);
  const [listadoAbierto, setListadoAbierto] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [estadoFeedback, setEstadoFeedback] = useState<EstadoFeedback>('inactivo');
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);
  const [incluirImagenFeedback, setIncluirImagenFeedback] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  // Refs espejo para el bucle asíncrono de la cola (los closures de un bucle
  // largo verían estados desactualizados; la ref siempre tiene el valor vivo).
  const colaRef = useRef<PiezaCola[]>([]);
  const seleccionadaRef = useRef<string | null>(null);
  const cpRef = useRef<CamposPersonalizados>(camposPersonalizados);
  const enMarchaRef = useRef(false);
  const prepEnCursoRef = useRef(false);
  /** Promesas del pre-OCR por pieza, para que el análisis espere al suyo si sigue en curso. */
  const prepRef = useRef(new Map<string, Promise<string | null>>());

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
            cpRef.current = cfg.camposPersonalizados;
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
      ajustes: { proveedor: ajustes.proveedor, baseUrl: ajustes.baseUrl, modelo: ajustes.modelo, revisar: ajustes.revisar, ocr: ajustes.ocr },
      tarifas,
      camposPersonalizados,
      desplegado,
    });
  }, [hidratado, idioma, unidades, ajustes, tarifas, camposPersonalizados, desplegado]);

  // Progreso del análisis de la pieza en curso: avanza de forma asintótica
  // hacia el 90% mientras se espera la respuesta y se reinicia con cada pieza.
  useEffect(() => {
    if (!analizando || !enCursoId) return;
    const inicio = Date.now();
    setProgreso(4);
    const timer = setInterval(() => {
      const segundos = (Date.now() - inicio) / 1000;
      setProgreso(Math.min(90, 4 + 86 * (1 - Math.exp(-segundos / 20))));
    }, 250);
    return () => clearInterval(timer);
  }, [analizando, enCursoId]);

  // Al cambiar de pieza seleccionada, el estado del feedback vuelve a empezar.
  useEffect(() => {
    setEstadoFeedback('inactivo');
    setMensajeFeedback(null);
    setIncluirImagenFeedback(false);
  }, [seleccionada]);

  /** Etapa mostrada bajo la barra según el % y si hay 2ª pasada de revisión. */
  const etapaAnalisis = (pct: number): string => {
    const e = t.app.etapas;
    if (pct < 10) return e.ingesta;
    if (pct < (ajustes.revisar ? 55 : 85)) return e.extraccion;
    if (pct < 85 && ajustes.revisar) return e.auditoria;
    return e.sintesis;
  };

  const preset = presetDe(ajustes.proveedor);
  const nombreProveedor = presetTextos(ajustes.proveedor, t).nombre;
  const sinCredenciales = esModoDemo(ajustes, serverKey);

  const piezaSeleccionada = cola.find((p) => p.id === seleccionada) ?? null;
  const archivo = piezaSeleccionada?.archivo ?? null;
  const resultadoSel = piezaSeleccionada?.resultado ?? null;
  const pdfNoAdmitido = archivo?.mediaType === 'application/pdf' && !preset.admitePdf;
  const pendientes = cola.filter((p) => p.analisis === 'pendiente').length;
  const indiceEnCurso = cola.findIndex((p) => p.id === enCursoId);

  /** Toda mutación de la cola pasa por aquí: la ref es la fuente de verdad del bucle. */
  const mutarCola = (fn: (prev: PiezaCola[]) => PiezaCola[]) => {
    colaRef.current = fn(colaRef.current);
    setCola(colaRef.current);
  };

  const parchearPieza = (id: string, parche: Partial<PiezaCola>) =>
    mutarCola((prev) => prev.map((p) => (p.id === id ? { ...p, ...parche } : p)));

  const seleccionar = (id: string | null) => {
    seleccionadaRef.current = id;
    setSeleccionada(id);
  };

  const cambiarIdioma = (nuevo: Idioma) => {
    setIdioma(nuevo);
    guardarIdioma(nuevo);
  };

  const cambiarUnidades = (nuevo: SistemaUnidades) => {
    setUnidades(nuevo);
    guardarUnidades(nuevo);
  };

  const cambiarCamposPersonalizados = (nuevos: CamposPersonalizados) => {
    cpRef.current = nuevos;
    setCamposPersonalizados(nuevos);
    guardarCamposPersonalizados(nuevos);
  };

  const cambiarDesplegado = (nuevo: OpcionesDesplegado) => {
    setDesplegado(nuevo);
    guardarDesplegado(nuevo);
  };

  const actualizarListado = (nuevo: ItemListado[]) => {
    setListado(nuevo);
    guardarListado(nuevo);
  };

  const anadirAlListado = (d: Extraccion) => {
    // instantánea independiente de la pieza analizada
    const item: ItemListado = { id: crypto.randomUUID(), datos: JSON.parse(JSON.stringify(d)) };
    actualizarListado([...listado, item]);
  };

  const anadirPlano = (a: ArchivoPlano) => {
    const pieza = crearPieza(a);
    mutarCola((prev) => [...prev, pieza]);
    if (!seleccionadaRef.current) seleccionar(pieza.id);
    setError(null);
  };

  const quitarPieza = (id: string) => {
    prepRef.current.delete(id);
    mutarCola((prev) => prev.filter((p) => p.id !== id));
    if (seleccionadaRef.current === id) seleccionar(colaRef.current[0]?.id ?? null);
  };

  /**
   * Carril adelantado de la cola: mientras la IA analiza una pieza, se va
   * ejecutando el OCR de las siguientes (de una en una: el worker es único),
   * de modo que cada análisis llegue con ese trabajo ya hecho.
   */
  const prepararPieza = (pieza: PiezaCola): Promise<string | null> => {
    parchearPieza(pieza.id, { preparacion: 'encurso' });
    const promesa = fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: pieza.archivo.mediaType, dataBase64: pieza.archivo.dataBase64, idioma }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((cuerpo) => (typeof cuerpo?.texto === 'string' ? (cuerpo.texto as string) : null))
      .catch(() => null);
    prepRef.current.set(pieza.id, promesa);
    promesa.then((texto) => parchearPieza(pieza.id, { preparacion: 'lista', ocrTexto: texto }));
    return promesa;
  };

  const lanzarPreparacion = () => {
    if (prepEnCursoRef.current || !ajustes.ocr) return;
    prepEnCursoRef.current = true;
    (async () => {
      try {
        while (enMarchaRef.current) {
          const objetivo = colaRef.current.find((p) => p.analisis === 'pendiente' && p.preparacion === 'pendiente');
          if (!objetivo) break;
          await prepararPieza(objetivo);
        }
      } finally {
        prepEnCursoRef.current = false;
      }
    })();
  };

  /** Analiza una pieza de la cola (una llamada a /api/extract, con su OCR si ya está hecho). */
  const analizarPieza = async (pieza: PiezaCola) => {
    if (pieza.archivo.mediaType === 'application/pdf' && !preset.admitePdf) {
      parchearPieza(pieza.id, { analisis: 'error', error: t.app.pdfNoAdmitido(nombreProveedor) });
      return;
    }
    parchearPieza(pieza.id, { analisis: 'analizando' });
    setEnCursoId(pieza.id);
    try {
      // si el pre-OCR de esta pieza está en curso o hecho, se aprovecha aquí
      const prep = prepRef.current.get(pieza.id);
      const ocrTexto = prep ? await prep : undefined;
      const body: Record<string, unknown> = {
        filename: pieza.archivo.nombre,
        mediaType: pieza.archivo.mediaType,
        dataBase64: pieza.archivo.dataBase64,
        config: configApi(ajustes, idioma, aliasParaServidor(cpRef.current), camposExtraParaServidor(cpRef.current)),
      };
      if (ocrTexto !== undefined) body.ocrTexto = ocrTexto;

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const cuerpo = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(cuerpo?.error ?? `Error ${res.status} del servidor.`);
      }
      const respuesta = cuerpo as RespuestaExtraccion;
      // normaliza por si el backend/proveedor devuelve un esquema distinto: así
      // un campo ausente no revienta el render (la app quedaría en blanco)
      const datos = normalizarExtraccion(respuesta.datos);

      // Creador de campos (skill): si el plano trae datos rotulados que no
      // encajan en ningún campo, se crean como campos adicionales — con
      // normalización, anti-duplicados y límites. Los nuevos nombres entran en
      // el prompt de las siguientes piezas de la cola.
      const propuestas = datos.campos_extra.map((c) => c.nombre);
      if (propuestas.length) {
        const creacion = procesarPropuestas(propuestas, cpRef.current);
        if (creacion.creados.length) {
          cambiarCamposPersonalizados({ ...cpRef.current, extra: [...(cpRef.current.extra ?? []), ...creacion.creados] });
        }
      }

      const resultado: ResultadoPieza = {
        datos,
        datosOriginales: JSON.parse(JSON.stringify(datos)),
        demo: respuesta.demo,
        revisado: Boolean(respuesta.revisado),
      };
      parchearPieza(pieza.id, { analisis: 'hecho', resultado });
      if (!seleccionadaRef.current) seleccionar(pieza.id);
      // si el plano trae unidades detectadas y es la pieza a la vista, ajusta la vista
      if (seleccionadaRef.current === pieza.id && datos.sistema_unidades && datos.sistema_unidades !== unidades) {
        cambiarUnidades(datos.sistema_unidades);
      }
    } catch (e) {
      parchearPieza(pieza.id, {
        analisis: 'error',
        error: e instanceof Error ? e.message : 'Error inesperado analizando el plano.',
      });
    } finally {
      setEnCursoId(null);
    }
  };

  /** Recorre la cola: analiza pendientes en orden mientras el carril de OCR va por delante. */
  const procesarCola = async () => {
    if (enMarchaRef.current) return;
    enMarchaRef.current = true;
    setAnalizando(true);
    setError(null);
    try {
      while (true) {
        lanzarPreparacion();
        const pieza = colaRef.current.find((p) => p.analisis === 'pendiente');
        if (!pieza) break;
        await analizarPieza(pieza);
      }
    } finally {
      enMarchaRef.current = false;
      setAnalizando(false);
    }
  };

  const cambiarDatos = (nuevos: Extraccion) => {
    const id = seleccionadaRef.current;
    if (!id) return;
    mutarCola((prev) => prev.map((p) => (p.id === id && p.resultado ? { ...p, resultado: { ...p.resultado, datos: nuevos } } : p)));
    // si el usuario sigue editando después de guardar, permite guardar de nuevo
    if (estadoFeedback !== 'inactivo') {
      setEstadoFeedback('inactivo');
      setMensajeFeedback(null);
    }
  };

  const guardarFeedback = async () => {
    if (!piezaSeleccionada || !resultadoSel) return;
    setEstadoFeedback('guardando');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extraccionOriginal: resultadoSel.datosOriginales,
          extraccionFinal: resultadoSel.datos,
          proveedor: ajustes.proveedor,
          modelo: ajustes.modelo || preset.modeloDefecto,
          idioma,
          imagen: incluirImagenFeedback
            ? { mediaType: piezaSeleccionada.archivo.mediaType, dataBase64: piezaSeleccionada.archivo.dataBase64 }
            : undefined,
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

  const etiquetaAnalizar = analizando
    ? indiceEnCurso >= 0
      ? t.app.analizandoPieza(indiceEnCurso + 1, cola.length)
      : t.app.analizando
    : pendientes > 1
      ? t.app.botonAnalizarN(pendientes)
      : t.app.botonAnalizar;

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
          <button className="btn btn--ajustes" title={t.app.tituloListado} aria-label={t.app.tituloListado} onClick={() => setListadoAbierto(true)}>
            {t.app.botonListado}
            {listado.length > 0 && <span className="btn__contador">{listado.length}</span>}
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
      {listadoAbierto && (
        <Listado
          items={listado}
          tarifas={tarifas}
          unidades={unidades}
          t={t}
          onQuitar={(id) => actualizarListado(listado.filter((it) => it.id !== id))}
          onVaciar={() => actualizarListado([])}
          onCerrar={() => setListadoAbierto(false)}
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
          <Dropzone archivo={archivo} t={t} onArchivo={anadirPlano} onError={setError} />
          {pdfNoAdmitido && <div className="error">⚠ {t.app.pdfNoAdmitido(nombreProveedor)}</div>}
          <button className="btn btn--primario btn--analizar" onClick={procesarCola} disabled={pendientes === 0 || analizando}>
            {etiquetaAnalizar}
          </button>
          {analizando && (
            <div className="progreso">
              <div className="progreso__barra">
                <div className="progreso__relleno" style={{ width: `${Math.round(progreso)}%` }} />
              </div>
              <p className="progreso__etapa">
                {etapaAnalisis(progreso)} · {Math.round(progreso)}%
              </p>
              <p className="pista">{t.app.pista}</p>
            </div>
          )}
          {error && <div className="error">⚠ {error}</div>}
          <ListaCola
            piezas={cola}
            seleccionada={seleccionada}
            onSeleccionar={seleccionar}
            onQuitar={quitarPieza}
            progresoActual={progreso}
            t={t}
          />
        </div>

        <div className="columna columna--datos">
          {resultadoSel ? (
            <Resultados
              datos={resultadoSel.datos}
              onCambio={cambiarDatos}
              demo={resultadoSel.demo}
              revisado={resultadoSel.revisado}
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
              onAnadirListado={anadirAlListado}
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
