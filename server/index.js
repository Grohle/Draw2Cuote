import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { extraerDatosPlano, modoDemo } from './extract.js';

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
  res.json({ demo: modoDemo() });
});

app.post('/api/extract', async (req, res) => {
  const { mediaType, dataBase64 } = req.body ?? {};

  if (!mediaType || !dataBase64) {
    return res.status(400).json({ error: 'Faltan mediaType o dataBase64 en la petición.' });
  }
  if (!TIPOS_ADMITIDOS.has(mediaType)) {
    return res.status(415).json({ error: `Tipo de archivo no admitido: ${mediaType}. Usa PDF, PNG, JPG, WebP o GIF.` });
  }
  // base64 ~ 4/3 del tamaño real
  if (dataBase64.length * 0.75 > MAX_BYTES) {
    return res.status(413).json({ error: 'El archivo supera el límite de 32 MB.' });
  }

  try {
    const resultado = await extraerDatosPlano({ mediaType, dataBase64 });
    res.json(resultado);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: 'Credenciales de la API inválidas. Revisa ANTHROPIC_API_KEY.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Límite de peticiones alcanzado. Espera unos segundos y reintenta.' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(503).json({ error: 'No se pudo conectar con la API de Claude. Comprueba la red.' });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Error de la API (${err.status}): ${err.message}` });
    }
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    console.error('[extract]', err);
    res.status(status).json({ error: err.message || 'Error inesperado analizando el plano.' });
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
  console.log(`Draw2Quote server escuchando en http://localhost:${PORT}${modoDemo() ? ' (MODO DEMO: sin credenciales de API)' : ''}`);
});
