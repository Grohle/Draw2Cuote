/**
 * Proceso principal de la app de escritorio Draw2Quote.
 *
 * Arranca el mismo servidor Express de la versión web dentro del proceso de
 * Electron y abre una ventana apuntando a él. Los datos del usuario
 * (config.json, feedback.jsonl) se guardan en el perfil del sistema
 * (%APPDATA%/Draw2Quote en Windows) mediante la variable DRAW2QUOTE_DATOS,
 * porque el paquete instalado es de solo lectura.
 */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PUERTO = 3247; // puerto propio de la versión de escritorio

async function arrancarServidor() {
  process.env.PORT = String(PUERTO);
  process.env.DRAW2QUOTE_DATOS = path.join(app.getPath('userData'), 'datos');
  // el servidor es ESM; desde CommonJS se carga con import() dinámico
  const rutaServidor = pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href;
  await import(rutaServidor);
}

/** Espera a que el servidor responda antes de abrir la ventana. */
async function esperarServidor(intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(`http://localhost:${PUERTO}/api/status`);
      if (res.ok) return;
    } catch {
      // aún no está escuchando
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('El servidor local no arrancó a tiempo.');
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1360,
    height: 900,
    autoHideMenuBar: true,
    title: 'Draw2Quote',
  });
  ventana.loadURL(`http://localhost:${PUERTO}`);
}

app.whenReady().then(async () => {
  await arrancarServidor();
  await esperarServidor();
  crearVentana();
  // macOS: reabrir ventana al pulsar el icono del dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
  });
});

app.on('window-all-closed', () => app.quit());
