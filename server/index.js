import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { EsquemaExtraccion, extraerDatosPlano, hayClaveServidor, probarProveedor } from './extract.js';
import { calcularEstadisticas, registrarFeedback } from './feedback.js';
import { mensajes } from './mensajes.js';

const PORT = process.env.PORT || 3001;
const MAX_BYTES = 32 * 1024 * 1024; // límite de la API para PDF
const TIPOS_ADMITIDOS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/api/status', (_req, res) => {
  res.json({ serverKey: hayClaveServidor() });
});

// Valida la configuración del panel de ajustes contra el proveedor elegido
app.post('/api/test-key', async (req, res) => {
  const config = req.body?.config ?? {};
  const m = mensajes(config.idioma);
  if ((config.proveedor ?? 'anthropic') === 'anthropic' && !config.apiKey && !hayClaveServidor()) {
    return res.status(400).json({ error: m.faltaClaveQueProbar });
  }
  try {
    await probarProveedor(config);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: m.claveInvalida });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(503).json({ error: m.noConectaApi });
    }
    const status = Number.isInteger(err.status) ? err.status : 502;
    res.status(status).json({ error: err.message || m.errorProbandoConexion });
  }
});

app.post('/api/extract', async (req, res) => {
  const { mediaType, dataBase64, config } = req.body ?? {};
  const m = mensajes(config?.idioma);

  if (!mediaType || !dataBase64) {
    return res.status(400).json({ error: m.faltanDatos });
  }
  if (!TIPOS_ADMITIDOS.has(mediaType)) {
    return res.status(415).json({ error: m.tipoNoAdmitido(mediaType) });
  }
  // base64 ~ 4/3 del tamaño real
  if (dataBase64.length * 0.75 > MAX_BYTES) {
    return res.status(413).json({ error: m.archivoDemasiadoGrande });
  }

  try {
    const resultado = await extraerDatosPlano({ mediaType, dataBase64, config });
    res.json(resultado);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: m.credencialesInvalidas });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: m.limitePeticiones });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(503).json({ error: m.noConectaApiRed });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: m.errorApi(err.status, err.message) });
    }
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    console.error('[extract]', err);
    res.status(status).json({ error: err.message || m.errorInesperado });
  }
});

// Bucle de aprendizaje: el usuario confirma o corrige una extracción ya revisada.
app.post('/api/feedback', (req, res) => {
  const { extraccionOriginal, extraccionFinal, proveedor, modelo, imagen, idioma } = req.body ?? {};
  const m = mensajes(idioma);
  const original = EsquemaExtraccion.safeParse(extraccionOriginal);
  const final = EsquemaExtraccion.safeParse(extraccionFinal);
  if (!original.success || !final.success) {
    return res.status(400).json({ error: m.formatoInesperado });
  }
  try {
    const { camposCorregidos } = registrarFeedback({
      extraccionOriginal: original.data,
      extraccionFinal: final.data,
      proveedor,
      modelo,
      imagen,
      idioma,
    });
    res.json({ ok: true, camposCorregidos });
  } catch (err) {
    console.error('[feedback]', err);
    res.status(500).json({ error: m.noGuardoFeedback });
  }
});

// Estadísticas de calibración: qué % de cada campo se ha corregido, agrupado por confianza.
app.get('/api/estadisticas', (req, res) => {
  try {
    res.json(calcularEstadisticas());
  } catch (err) {
    console.error('[estadisticas]', err);
    res.status(500).json({ error: mensajes(req.query.idioma).noCalculoEstadisticas });
  }
});

// En producción sirve el frontend compilado (web/dist)
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '..', 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(
    `Draw2Quote server escuchando en http://localhost:${PORT}${hayClaveServidor() ? '' : ' (sin clave en el servidor: usa Ajustes en la UI o modo demo)'}`
  );
});
