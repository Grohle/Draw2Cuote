# Arquitectura de Draw2Quote

Draw2Quote sigue el principio de que un sistema fiable de lectura de planos en 2026 no descansa en un único modelo masivo, sino en una **arquitectura multi-agente que combina visión, extracción estructurada y reglas lógicas deterministas**. Este documento describe qué parte de esa arquitectura está implementada hoy, cómo se corresponde con el código, y qué queda como hoja de ruta.

El objetivo de despliegue es deliberadamente simple: **clonar el repo, `npm install`, y meter tu clave de API de IA**. Todo lo demás (multi-proveedor, aprendizaje con el uso, auditoría) funciona sin infraestructura adicional.

## Puesta en marcha (lo único que necesita el usuario)

```bash
npm install
npm --prefix web install
npm run build
npm start          # sirve la app en :3001
```

Y en **⚙ Ajustes** de la propia app se introduce la clave del proveedor de IA elegido (Anthropic, Google Gemini con capa gratuita, Ollama/LM Studio/vLLM locales, o cualquier API compatible OpenAI). Alternativamente, `export ANTHROPIC_API_KEY=...` en el servidor. Sin clave, la app arranca en modo demo.

## 1. Aprendizaje en contexto dirigido por correcciones (MICL)

Mejora del rendimiento **sin fine-tuning**: el sistema aprende de los errores que los usuarios corrigen.

**Implementado hoy (nivel texto):**

| Paso | Código |
|---|---|
| Captura de correcciones: extracción original vs corregida, campo a campo | `server/feedback.js` → `server/datos/feedback.jsonl` |
| Destilado del histórico en "lecciones aprendidas" (campos que más se corrigen, transiciones `null → valor`, valores frecuentes por familia) | `construirLeccionesAprendidas()` en `server/feedback.js` |
| **Inyección dinámica de ejemplos few-shot**: correcciones concretas pasadas (`campo: antes → después`) presentadas como ejemplos en el prompt, con la instrucción de usarlas como recordatorio del error, no de copiar valores | `construirEjemplosCorreccion()` en `server/feedback.js` |
| Inyección de ambos bloques en el prompt de sistema de cada análisis nuevo, para cualquier proveedor | `construirSystemEfectivo()` en `server/extract.js` |
| Calibración medible: % de correcciones por campo y por nivel de confianza | panel **📊 Precisión**, `GET /api/estadisticas` |
| Export a dataset de fine-tuning real (opcional, con imagen si el usuario lo permite) | `npm run feedback:exportar` |

La recuperación de ejemplos aproxima la relevancia por **recencia y diversidad de campo** (los más nuevos sin repetir el mismo `antes→después`), no por similitud visual.

**Hoja de ruta (nivel visual):** el salto pendiente es la dimensión *visual* de esta misma idea — capturar las coordenadas `[x_min, y_min, x_max, y_max]` del error sobre la imagen, indexar el recorte en una base vectorial (Qdrant / Azure AI Search) y, ante una región visualmente similar, recuperar por similitud el ejemplo corregido en vez de por recencia ("en este parche similar la lectura era '8' pero la correcta es 'B'"). No se incluye porque exige una base vectorial y un modelo de embeddings de imagen — infraestructura que rompería el requisito de "solo tu clave de API".

## 2. Guardarraíles para modelos menos potentes

**Implementado hoy:**

- **Esquema estructurado obligatorio**: structured outputs nativos con Anthropic; con el resto de proveedores el JSON Schema va incrustado en el prompt y la respuesta se **valida con Zod en el servidor** — un modelo flojo no puede devolver datos con forma corrupta (`server/proveedores.js`, `server/extract.js`).
- **Normalización defensiva en el cliente**: cualquier respuesta se completa a la forma esperada antes de renderizar (`web/src/normalizar.ts`).
- **Alias de campos configurables**: el usuario enseña al modelo qué rótulos usan sus planos (`title`, `dwg`, `nº`, `mark`...), reduciendo la búsqueda a comprobación (`🏷 Campos`, `bloqueAlias()`).
- **Prompts por dominio**: instrucciones específicas para cajetín, perfil de plegado, cota interior/exterior y unidades del plano, con la regla dura de **nunca inventar** (null + observación).
- **OCR como referencia cruzada** (activable en Ajustes, OFF por defecto): antes del scan se pasa la imagen por Tesseract (`tesseract.js`, WASM puro, **sin binarios de sistema**) y el texto reconocido se inyecta en el prompt como referencia cruda —lista de tokens `texto@(x,y)` con posición normalizada— para que el modelo pueda **cotejar cifras y textos pequeños** que un VLM flojo suele leer mal, sin tratarlo como verdad absoluta. Es una **dependencia opcional** (`optionalDependencies`, import dinámico): si no está instalada, o falla, o no hay red para bajar los datos de idioma, el análisis continúa sin OCR — no rompe la instalación base ni el requisito de "solo tu clave de API". Robusto por diseño: `errorHandler` para que un fallo del worker no tumbe el servidor y un **tope de tiempo** (`DRAW2QUOTE_OCR_TIMEOUT_MS`, 45 s por defecto) porque el arranque de `tesseract.js` puede colgarse si no logra descargar los datos. Solo aplica a imágenes rasterizadas (no PDF) y solo en la 1.ª pasada. Código: `server/ocr.js`, `bloqueOcr()` en `server/extract.js`. Los datos de idioma se descargan de su CDN la primera vez; en entornos sin salida a Internet se apunta a una carpeta local con `DRAW2QUOTE_TESSDATA`.

**Hoja de ruta (procesamiento por regiones):** el OCR de hoy cubre la imagen completa; el salto pendiente es **restringirlo a regiones**: detección previa de layout con un modelo ligero (YOLOv8: cajetín, BOM, notas), extracción de cada caja como sub-imagen a resolución nativa, y OCR limitado a la región, usando el VLM solo para dar contexto estructural. Igual que el MICL visual, exige un modelo de detección adicional; queda documentado como extensión natural de `server/extract.js` (un paso previo que convierta `dataBase64` en una lista de parches, cada uno con su OCR de región).

## 3. Segunda capa de razonamiento: auditoría y reconciliación

**Implementado hoy:**

- **Agente revisor con autoridad de corrección** (activable en Ajustes, ON por defecto): tras el scan, una segunda llamada recibe el plano + la primera extracción y (a) verifica la coherencia de cada campo, (b) ejecuta la **auditoría matemática** (Σ cotas parciales = cota total ± tolerancia; cota interior + espesores adyacentes = cota exterior), y (c) re-examina específicamente los campos de confianza media/baja. Cada corrección queda anotada como observación `campo: antes → después (motivo)`. Código: `SYSTEM_REVISION_*` y `extraerDatosPlano()` en `server/extract.js`. Si la segunda pasada falla, se devuelve la primera sin romper el análisis.
- **Reglas deterministas (sin IA)**: validaciones físicas y de negocio en el cliente — espesores comerciales, coherencia familia↔calidad de material, rangos razonables, cotas intercambiadas, pared vs radio de tubo (`web/src/validaciones.ts`). Son las "aserciones con veto": generan avisos visibles campo a campo antes de presupuestar.
- **Cálculos deterministas sobre los datos extraídos**: desarrollo de chapa por fibra neutra/factor K (`web/src/desplegado.ts`) y presupuesto por geometría + tarifas (`web/src/presupuesto.ts`). La IA extrae; la aritmética la hace código normal y auditable.

**Hoja de ruta:** agente de *grounding* de inventario (cruzar material/BOM con la base de stock real del taller) y reconciliación multilateral de marcas (cada *balloon tag* del plano ↔ su fila de BOM). Requieren conexión a datos del ERP del usuario.

## 4. Flujo del análisis y barra de progreso

La UI informa por etapas durante el análisis (una sola petición al servidor; el avance dentro de cada etapa es estimado):

1. **Ingesta y clasificación** (0–10%) — lectura del archivo y enrutado al proveedor.
2. **Extracción visual** (10–55%) — scan del plano: cotas, cajetín, perfil de plegado, unidades.
3. **Auditoría lógica** (55–85%) — segunda pasada de razonamiento (si está activada).
4. **Síntesis y reporte** (85–100%) — validaciones deterministas, desarrollo, presupuesto.

## Resumen del reparto de responsabilidades

| Capa | Quién | Dónde |
|---|---|---|
| Extracción | VLM (multi-proveedor) con esquema estricto | `server/extract.js`, `server/esquema.js` |
| Revisión/auditoría | 2º agente LLM + aserciones matemáticas | `server/extract.js` (revisión) |
| Reglas de negocio | Código determinista, sin IA | `web/src/validaciones.ts`, `desplegado.ts`, `presupuesto.ts` |
| Aprendizaje con el uso | Feedback humano → lecciones en contexto | `server/feedback.js` |
| Configuración | JSON auto-guardado + localStorage | `server/config.js`, `web/src/configArchivo.ts` |
