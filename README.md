# Draw2Quote

**De plano a presupuesto en segundos.** Arrastra un plano técnico (PDF o imagen) y la IA extrae los datos que necesitas para presupuestar: dimensiones, espesor, material, calidad, acabado, cantidad, tolerancias, pliegues y agujeros — todo estructurado y con nivel de confianza por campo para evitar lecturas erróneas.

> El repositorio se llama `Draw2Cuote` de momento; el nombre del producto es **Draw2Quote**.

**Para ejecutarlo solo necesitas tu clave de API de IA** (o un modelo local con Ollama/LM Studio/vLLM): clona, `npm install`, arranca y configura el proveedor en ⚙ Ajustes. El diseño multi-agente del sistema (extractor + revisor + reglas deterministas + aprendizaje con el uso) está documentado en [ARQUITECTURA.md](ARQUITECTURA.md).

## Cómo funciona

1. **Arrastra el plano** (PDF, PNG, JPG, WebP · máx. 32 MB) a la zona de carga.
2. **Analizar plano**: el backend envía el documento a la API de Claude con *structured outputs* (esquema Zod), de modo que la respuesta siempre tiene la misma forma y no hay texto libre que parsear.
3. **Revisa y corrige**: cada campo muestra un chip de confianza (alta / media / baja). Las lecturas dudosas y las incoherencias (espesor no comercial, calidad que no cuadra con la familia de material, cantidad ausente…) quedan marcadas con avisos.
4. **Exporta el JSON** estructurado para alimentar tu sistema de presupuestos.

### Campos adaptados al tipo de pieza

La IA detecta primero el **método de fabricación** y la UI adapta los campos según él. Se reconocen los procesos más habituales — chapa plegada, corte láser, torneado, fresado/CNC, tubo/perfil, impresión 3D, inyección, fundición, extrusión, termoformado y carpintería — y las familias de material tanto metálicas como no metálicas: acero al carbono/inoxidable, aluminio, galvanizado, cobre/latón, titanio, plástico, madera, vidrio, composite, cerámica y caucho (con sus grados/calidades habituales). Una pieza torneada muestra longitud y Ø máximo, la chapa muestra espesor y pliegues, los procesos volumétricos (3D, inyección…) piden las cotas envolventes. Las validaciones también cambian según el tipo. El tipo es editable y el formulario se reconfigura al cambiarlo.

El presupuesto cubre con fórmula propia la chapa, el corte, el mecanizado y el tubo; para procesos sin fórmula específica (impresión 3D, inyección, fundición…) estima el **coste de material** por volumen envolvente y avisa de que el coste de proceso debe añadirse a mano — nunca inventa un número.

### Capa de razonamiento tras el scan (verificación)

Con la opción **🧠 Revisar la extracción** activada (por defecto), tras leer el plano se hace una **segunda pasada de razonamiento**: el modelo recibe el plano y su primera extracción y **verifica la coherencia de cada campo** (unidades, cotas intercambiadas, familia↔calidad, plausibilidad física) y **vuelve a mirar los campos de confianza media/baja** para confirmarlos o corregirlos. Solo cambia un valor si el plano lo respalda (nunca inventa) y anota cada corrección en las observaciones (`campo: antes → después`). Los resultados revisados muestran el distintivo **🧠 Revisado por IA**. Se puede desactivar en ⚙ Ajustes para ahorrar la segunda llamada; si esa segunda llamada falla, se devuelve la primera extracción sin romper el análisis.

### OCR como referencia (guardarraíl para modelos flojos)

Con la opción **🔡 OCR de la imagen como referencia** activada (desactivada por defecto), antes del scan la imagen se pasa por **Tesseract** (`tesseract.js`, WASM puro, sin binarios de sistema) y el texto reconocido se inyecta en el prompt como referencia cruda —tokens `texto@(x,y)`— para ayudar al modelo a **cotejar cifras y textos pequeños** que un modelo de visión menos potente suele leer mal (no se trata como verdad absoluta). Es una **dependencia opcional**: si no está instalada o falla, el análisis sigue sin OCR. Solo aplica a **imágenes** (no PDF). La primera vez descarga los datos de idioma de su CDN (requiere Internet); en un equipo sin salida a Internet se apunta a una carpeta local con los `.traineddata` mediante la variable `DRAW2QUOTE_TESSDATA`, y el tope de tiempo se ajusta con `DRAW2QUOTE_OCR_TIMEOUT_MS` (45 s por defecto). Ver [ARQUITECTURA.md](ARQUITECTURA.md) § 2.

### Listado de piezas y exportación

Cada pieza analizada se puede **añadir a un listado (📋)** que muestra el **precio total** del conjunto con las tarifas actuales y se **exporta a CSV o Excel**. La exportación incluye **solo las columnas con algún valor** (las columnas totalmente vacías se omiten). El listado se guarda en el navegador.

Además de número de plano, denominación y revisión, la extracción incluye la **marca / posición** de la pieza (en muchos despieces es su identificador corto) y el **proyecto / obra** al que pertenece, si figuran en el plano.

### Campos y alias configurables

Los datos que extrae la app son fijos (espesor, material, cantidad…), pero el rótulo con el que cada plano los etiqueta es casi infinito: `title`, `dwg`, `nº`, `no`, `mark`, `pos`… En **🏷 Campos** puedes, por cada campo:

- **Renombrar** cómo se muestra en la interfaz (p. ej. "Marca" → "Posición").
- Añadir los **alias** (rótulos reales de tus planos, separados por comas). Esos alias se envían al lector dentro del prompt de sistema para que sepa dónde mirar, **sin cambiar el esquema de datos**: los campos canónicos siguen siendo los mismos, solo se le enseña al modelo qué etiquetas equivalen a cada uno.

### Creador de campos automático (con guardarraíles)

Si un plano trae un dato claramente rotulado que **no encaja en ningún campo fijo** (peso, escala, tratamiento térmico, norma de soldadura...), el lector lo devuelve como campo adicional y el **creador de campos** lo registra automáticamente. Es una skill pequeña y acotada (`web/src/creadorCampos.ts`) que usan por igual la IA (tras cada análisis) y el humano (a mano en **🏷 Campos**), siempre con los mismos guardarraíles: **normalización** del nombre (minúsculas, sin acentos), **comprobación de duplicidad** contra los campos fijos, sus etiquetas en ambos idiomas, tus alias y los campos ya creados, y **límites** de longitud y cantidad. Los campos creados aparecen en los resultados ("Campos adicionales del plano"), se gestionan/eliminan en 🏷 Campos, se guardan en la configuración automática, y sus nombres se envían al lector para que los siguientes análisis usen exactamente los mismos.

### Cola de planos (análisis por lotes con pre-procesado)

Puedes **soltar varios planos a la vez** (o ir añadiendo más mientras se analiza): cada uno entra en una cola visible bajo el botón de analizar, con una **barra de estado encima de cada nombre** (vacía en cola, animada mientras trabaja, verde al acabar), desplazable con la rueda del ratón y **filtrable por tipo de fabricación** o por "sin analizar". Al hacer clic en una pieza se ve su análisis en el panel derecho. Mientras la IA analiza una pieza, las herramientas previas (hoy, el **OCR** si está activado) van ejecutándose sobre las siguientes de la cola, de modo que cada análisis llegue con ese trabajo ya adelantado.

### Desarrollo (desplegado) de chapa

Cuando la pieza es **chapa plegada con al menos un pliegue**, el lector extrae del plano la **geometría de plegado** —las longitudes de los **lados** (tramos rectos), y por cada pliegue su **ángulo** y **radio interior**— y el panel **📐 Desarrollo de chapa** calcula el despliegue **a × b**:

- **Desarrollo (a) = Σ lados en cota exterior − Σ bend deduction**, con `BA = ángulo·(R + K·espesor)` y `BD = 2·(R+espesor)·tan(ángulo/2) − BA`. La anchura (b) es la dimensión sin pliegues.
- **Cota interior vs exterior**: el lector detecta si cada cara está acotada por dentro o por fuera del doblado. Las cotas interiores se convierten sumando un espesor por cada pliegue que toca esa cara (una U de espesor 2 con interior 46 mide 46+2+2 = 50 por fuera) y la conversión se muestra junto al lado.
- El perfil se lista en orden y en vertical — cara 1, ángulo 1, radio 1, cara 2… — con cada valor marcado **"del plano"** si se leyó, o **"por defecto"** (90°, radio = espesor) si no aparece. Todo es editable.
- El **factor K** (posición de la fibra neutra) se estima por R/espesor (fibra neutra) o se fija manual. El método y las correcciones se guardan automáticamente.

### Configuración guardada automáticamente

Cualquier cambio de configuración (idioma, unidades, proveedor/modelo, tarifas, nombres y alias de campos, opciones de desarrollo de chapa) se guarda **automáticamente** en un único JSON en el servidor (`server/datos/config.json`, ignorado por git y con escritura atómica), además de en el navegador. En un equipo nuevo — o en la futura versión de escritorio — la app rehidrata esa configuración desde el archivo al arrancar. La clave de API **no** se guarda en ese archivo: es una credencial y se queda solo en el navegador.

### Aprendizaje continuo con el uso (ML aplicado)

Draw2Quote no se queda quieto tras el primer prompt: cada corrección que un usuario confirma con **🧠 Guardar corrección** se convierte en una señal de entrenamiento que retroalimenta al sistema. El mecanismo, sin necesidad de reentrenar ningún modelo:

1. **Captura de feedback.** Al pulsar "Guardar corrección" se envían la extracción original del modelo y la extracción final (tras la revisión humana) a `POST /api/feedback`. El servidor calcula qué campos se corrigieron y guarda el evento en `server/datos/feedback.jsonl` (JSONL local, ignorado por git). Guardar sin haber corregido nada también es señal útil: confirma que la confianza alta era correcta.
2. **Aprendizaje en contexto (retrieval-augmented, sin tocar pesos).** Antes de cada análisis nuevo, el servidor inyecta en el prompt de sistema dos bloques destilados del histórico de correcciones — para cualquier proveedor:
   - **Lecciones agregadas**: campos que se corrigen con frecuencia, transiciones `null → valor` habituales, valores de calidad/acabado más frecuentes por familia (`construirLeccionesAprendidas`).
   - **Ejemplos few-shot** (inyección dinámica de ejemplos, MICL): correcciones concretas pasadas presentadas como casos —"una lectura anterior fue `D-8` y la corrección fue `D-B`"— con la instrucción de usarlas como recordatorio del error a vigilar, sin copiar valores (`construirEjemplosCorreccion`). La relevancia se aproxima por recencia/diversidad de campo; la recuperación por similitud visual del recorte queda como hoja de ruta (ver [ARQUITECTURA.md](ARQUITECTURA.md)).

   Es el mismo principio que usan los copilots en producción para adaptarse sin fine-tuning: el modelo no cambia, pero el contexto que recibe sí, y eso mueve la precisión medible con el uso real.
3. **Calibración real.** El panel **📊 Precisión** (`GET /api/estadisticas`) muestra, por campo, qué porcentaje de las veces que el modelo marcó "confianza alta" tuvo que corregirse después — evaluación de modelos de verdad, no solo un contador de uso.
4. **Export a fine-tuning real.** Al guardar una corrección puedes marcar "Incluir imagen del plano en el dataset de mejora" (desmarcado por defecto, ya que un plano puede contener información sensible del cliente). Con:

   ```bash
   npm run feedback:exportar
   ```

   se convierte `server/datos/feedback.jsonl` en `server/datos/finetuning.jsonl`: un JSONL de mensajes `system` / `user` (imagen + instrucción, o una nota si no se incluyó imagen) / `assistant` (la extracción corregida por el humano) — el formato de partida para un job de fine-tuning o un entrenador LoRA local. Los eventos sin imagen quedan marcados como útiles solo para ajustar criterio textual, no visión.

Las lecciones se activan solo con datos suficientes (mínimo 5 análisis con feedback) para no sacar conclusiones prematuras con poca muestra.

### Presupuesto estimado configurable

Cada análisis incluye un desglose de **💰 Presupuesto estimado** calculado en el navegador a partir de los datos extraídos: material (peso × precio/kg según densidad real del material), corte o mecanizado, agujeros, pliegues/roscas, acabado, recargo por tolerancias críticas y preparación por lote — con precio unitario y total del lote.

- Usa geometría simplificada (rectángulo/cilindro envolvente, no el perfil real de la pieza): es una estimación de orden de magnitud, no un presupuesto de nesting real. Cada aproximación usada queda anotada explícitamente bajo el desglose.
- Si falta un dato imprescindible para calcular (p. ej. cantidad o espesor), se indica claramente qué falta en vez de asumir un valor.
- Todas las tarifas (€/kg por familia de material, €/m de corte, €/min de mecanizado, coste por agujero/pliegue/rosca, acabado, preparación, recargos y margen) son **editables en ⚙ 💶 Tarifas** y se guardan en tu navegador — ajústalas a los costes reales de tu taller.

### Precisión y validaciones automáticas

- El modelo tiene prohibido inventar: si un dato no es legible devuelve `null` y lo explica en *Observaciones*.
- Todas las dimensiones se normalizan a milímetros.
- Confianza por campo: cualquier duda se marca `media` o `baja` y la UI la resalta para revisión humana.
- Validaciones locales: espesores comerciales, coherencia familia↔calidad, rangos razonables, cotas intercambiadas.
- Helpers en cada campo (icono `?`) con la explicación de qué es y de dónde sale en el plano.

### Idioma y unidades

La cabecera incluye dos selectores: **🌐 ES/EN** cambia todo el texto de la interfaz (campos, ayudas, avisos de validación, presupuesto, mensajes del servidor) y **📐 mm/in** cambia cómo se muestran y editan las dimensiones. Ambos se guardan en el navegador y se recuerdan entre sesiones.

- **Detección automática de unidades del plano**: al analizar, el modelo detecta si el plano está acotado en milímetros o en pulgadas y la vista cambia sola al sistema correspondiente (se muestra un distintivo "📐 Plano acotado en mm / en pulgadas"). Las cotas se devuelven siempre en mm y se convierten para mostrarse.
- El dato se almacena siempre en milímetros (y kilogramos para el peso); el sistema de unidades solo afecta a la capa de presentación — al escribir un valor en pulgadas se convierte a mm antes de guardarlo, sin arrastrar redondeos en el valor almacenado.
- El presupuesto estimado da el mismo total en € independientemente de la unidad mostrada: solo cambia el texto de las líneas (p. ej. "Material (4.03 lb × ...)" en vez de "Material (1.83 kg × ...)").
- Las tarifas (⚙ 💶 Tarifas) se gestionan siempre en unidades métricas (€/kg, €/m) para no complicar la configuración del taller.
- El idioma elegido también viaja al servidor con cada análisis: los mensajes de error de la API y los datos de ejemplo del modo demo se sirven en el idioma activo.

## Puesta en marcha

```bash
npm install
npm --prefix web install

# desarrollo (frontend en :5173 con proxy al backend en :3001)
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev

# producción
npm run build
npm start   # sirve la app compilada en :3001
```

### Versión de escritorio (instalable .exe)

Para quien no quiera usar la versión web hay un empaquetado de escritorio con Electron en `desktop/` (separado del `package.json` raíz para que la versión web no descargue Electron). La app de escritorio arranca el mismo servidor embebido y guarda `config.json` y el feedback en el perfil del usuario (`%APPDATA%/Draw2Quote` en Windows), sobreviviendo a reinstalaciones.

```bash
# preparar la app (una vez)
npm install && npm --prefix web install && npm run build

# construir el instalable (ejecutar EN Windows para el .exe)
cd desktop
npm install
npm run build:win     # → desktop/dist/Draw2Quote Setup 0.1.0.exe (instalador NSIS)

# probar en modo escritorio sin empaquetar
npm run dev
```

> El instalador de Windows (**NSIS .exe**) debe generarse en Windows (o con Wine). Hay también targets `build:linux` (AppImage) y `build:mac` (DMG). Una vez instalado, en ⚙ Ajustes se configura la clave de API igual que en la web.

### Configurar la API desde la app (multi-proveedor)

En **⚙ Ajustes** (cabecera) eliges el proveedor de IA sin tocar el servidor:

| Proveedor | Tipo | Clave | PDF | Notas |
|---|---|---|---|---|
| **Anthropic Claude** | nube | sí | ✅ | Máxima precisión; structured outputs nativos. Por defecto Opus 4.8. |
| **Google Gemini** | nube (capa gratuita) | sí (gratis en aistudio.google.com) | ✅ | `gemini-2.5-flash` por defecto. |
| **Ollama** | local | no | ❌ solo imágenes | URL por defecto `http://localhost:11434/v1`. Usa un modelo con visión (`qwen2.5vl`, `llama3.2-vision`...). |
| **LM Studio** | local | no | ❌ solo imágenes | URL por defecto `http://localhost:1234/v1`. |
| **vLLM** | local/servidor | opcional | ❌ solo imágenes | URL por defecto `http://localhost:8000/v1`. |
| **API compatible OpenAI** | cloud personalizado | opcional | ❌ solo imágenes | OpenRouter, Groq, Mistral, DeepSeek, Together... indica la URL base (`.../v1`). |

- La configuración (proveedor, URL base, clave, modelo) se guarda solo en tu navegador (localStorage) y viaja a tu servidor de Draw2Quote con cada análisis. No la uses en un equipo compartido.
- **Probar conexión** valida credenciales y URL contra el proveedor elegido sin gastar tokens.
- Con Anthropic se usan *structured outputs* nativos; con el resto, el esquema JSON se incrusta en el prompt, se pide modo JSON y la respuesta se **valida con Zod en el servidor** — si el modelo no cumple el esquema, verás un error claro en vez de datos corruptos.
- Los proveedores compatibles OpenAI solo aceptan imágenes; para PDF usa Anthropic o Gemini (la UI te avisa).

Sin configuración (ni `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` en el servidor) la app funciona en **modo demo**: devuelve datos de ejemplo para poder probar la interfaz completa sin credenciales.

## Estructura

```
server/          Backend Express (ESM, sin build)
  index.js       API: POST /api/extract, GET /api/status + estáticos en producción
  extract.js     Llamada a Claude (claude-opus-4-8) con structured outputs + esquema Zod
web/             Frontend React + Vite + TypeScript
  src/App.tsx            Página principal (dropzone + resultados)
  src/components/        Dropzone, Campo (chip confianza + ayuda), Resultados
  src/catalogo.ts        Espesores comerciales, calidades por familia, tolerancias, acabados, textos de ayuda
  src/validaciones.ts    Reglas de coherencia que generan los avisos
```

## API

`POST /api/extract`

```json
{ "filename": "PL-2041.pdf", "mediaType": "application/pdf", "dataBase64": "..." }
```

Respuesta: `{ "demo": false, "datos": { "espesor_mm": { "valor": 3, "confianza": "alta" }, ... , "observaciones": [] } }`

El `config` de la petición admite `alias` — un mapa `{ campo: ["rótulo1", "rótulo2"] }` con los nombres que los planos del usuario dan a cada campo — y `camposExtra` — la lista de nombres de campos adicionales ya definidos —, que el servidor inyecta en el prompt del lector. El body admite además `ocrTexto` (string o null): el OCR ya pre-calculado por la cola, para no repetirlo en el servidor.

`POST /api/ocr` — pre-procesado de la cola: `{ "mediaType": "image/png", "dataBase64": "..." }` → `{ "texto": "25.4@(0.20,0.15) ..." | null }`. Devuelve null si el OCR no aplica (PDF) o no está disponible; nunca falla el análisis por esto.

`GET /api/config` · `PUT /api/config` — leen y guardan la configuración del usuario en `server/datos/config.json` (guardado automático desde la UI; la clave de API queda excluida).
