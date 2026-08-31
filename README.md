# Draw2Quote

**From drawing to quote in seconds.** Drop a technical drawing (PDF or image) and the AI extracts the data you need to quote it: dimensions, thickness, material, grade, finish, quantity, tolerances, bends and holes — all structured and with a confidence level per field to avoid misreadings.

> The repository is currently named `Draw2Cuote`; the product name is **Draw2Quote**.

**All you need to run it is your AI API key** (or a local model with Ollama/LM Studio/vLLM): clone, `npm install`, start it up and configure the provider in Settings. The system's multi-agent design (extractor + reviewer + deterministic rules + learning from usage) is documented in [ARQUITECTURA.md](ARQUITECTURA.md).

## How it works

1. **Drop the drawing** (PDF, PNG, JPG, WebP · max. 32 MB) onto the upload area.
2. **Analyze drawing**: the backend sends the document to the Claude API with *structured outputs* (Zod schema), so the response always has the same shape and there's no free text to parse.
3. **Review and correct**: each field shows a confidence chip (high / medium / low). Doubtful readings and inconsistencies (non-standard thickness, a grade that doesn't match the material family, missing quantity...) are flagged with warnings.
4. **Export the structured JSON** to feed your quoting system.

### Fields adapted to the part type

The AI first detects the **manufacturing method** and the UI adapts the fields to it. It recognizes the most common processes — sheet metal bending, laser cutting, turning, milling/CNC, tube/profile, 3D printing, injection molding, casting, extrusion, thermoforming and carpentry — and both metallic and non-metallic material families: carbon/stainless steel, aluminum, galvanized steel, copper/brass, titanium, plastic, wood, glass, composite, ceramic and rubber (with their usual grades/qualities). A turned part shows length and max Ø, sheet metal shows thickness and bends, and volumetric processes (3D, injection...) ask for the bounding dimensions. Validations also change depending on the part type. The type is editable and the form reconfigures itself when it's changed.

The quote covers sheet metal, cutting, machining and tube work with its own formula; for processes without a specific formula (3D printing, injection molding, casting...) it estimates **material cost** from the bounding volume and warns that process cost must be added manually — it never makes up a number.

### Post-scan reasoning layer (verification)

With the **Review extraction** option enabled (on by default), after reading the drawing a **second reasoning pass** is run: the model receives the drawing and its first extraction and **checks the consistency of each field** (units, swapped dimensions, family↔grade, physical plausibility) and **re-examines the medium/low confidence fields** to confirm or correct them. It only changes a value if the drawing supports it (it never makes things up) and notes every correction in the observations (`field: before → after`). Reviewed results show the **AI-Reviewed** badge. It can be disabled in Settings to save the second call; if that second call fails, the first extraction is returned without breaking the analysis.

### OCR as a reference (guardrail for weaker models)

With the **Image OCR as reference** option enabled (off by default), before the scan the image is run through **Tesseract** (`tesseract.js`, pure WASM, no system binaries) and the recognized text is injected into the prompt as raw reference — `text@(x,y)` tokens — to help the model **cross-check figures and small text** that a less capable vision model often misreads (it is not treated as absolute truth). It's an **optional dependency**: if it isn't installed or fails, the analysis still runs without OCR. It only applies to **images** (not PDF). The first time it runs it downloads the language data from its CDN (requires Internet); on a machine without Internet access, point it to a local folder with the `.traineddata` files via the `DRAW2QUOTE_TESSDATA` variable, and the timeout is adjusted with `DRAW2QUOTE_OCR_TIMEOUT_MS` (45 s by default). See [ARQUITECTURA.md](ARQUITECTURA.md) § 2.

### Parts list and export

Each analyzed part can be **added to a list** that shows the **total price** of the batch using the current rates and can be **exported to CSV or Excel**. The export includes **only the columns that have a value** (columns that are entirely empty are omitted). The list is saved in the browser.

Besides drawing number, description and revision, the extraction includes the part's **mark / item number** (its short identifier in many assembly drawings) and the **project / job** it belongs to, if present on the drawing.

### Configurable fields and aliases

The data the app extracts is fixed (thickness, material, quantity...), but the label each drawing uses for it is almost limitless: `title`, `dwg`, `nº`, `no`, `mark`, `pos`... In **Fields** you can, for each field:

- **Rename** how it's shown in the interface (e.g. "Mark" → "Position").
- Add **aliases** (the actual labels used on your drawings, comma-separated). These aliases are sent to the reader inside the system prompt so it knows where to look, **without changing the data schema**: the canonical fields stay the same, the model is just taught which labels correspond to each one.

### Automatic field creator (with guardrails)

If a drawing includes a clearly labeled piece of data that **doesn't fit any fixed field** (weight, scale, heat treatment, welding standard...), the reader returns it as an extra field and the **field creator** registers it automatically. It's a small, well-scoped skill (`web/src/creadorCampos.ts`) used both by the AI (after each analysis) and by the human (manually, in **Fields**), always with the same guardrails: name **normalization** (lowercase, no accents), a **duplicate check** against fixed fields, their labels in both languages, your aliases and already-created fields, and length/count **limits**. Created fields appear in the results ("Additional fields from the drawing"), are managed/removed in Fields, are saved in the automatic configuration, and their names are sent to the reader so subsequent analyses use exactly the same ones.

### Drawing queue (batch analysis with pre-processing)

You can **drop several drawings at once** (or keep adding more while analysis is running): each one enters a visible queue under the analyze button, with a **status bar above each name** (empty while queued, animated while working, green when done), scrollable with the mouse wheel and **filterable by manufacturing type** or by "not yet analyzed". Clicking a part shows its analysis in the right-hand panel. While the AI analyzes one part, the pre-processing tools (currently, **OCR** if enabled) keep running on the next items in the queue, so each analysis arrives with that work already done.

### Sheet metal flat pattern (unfolding)

When the part is **bent sheet metal with at least one bend**, the reader extracts the **bend geometry** from the drawing — the **side** lengths (straight segments), and for each bend its **angle** and **inner radius** — and the **Sheet metal flat pattern** panel calculates the unfolded **a × b**:

- **Flat pattern (a) = Σ sides in outer dimension − Σ bend deduction**, with `BA = angle·(R + K·thickness)` and `BD = 2·(R+thickness)·tan(angle/2) − BA`. The width (b) is the dimension with no bends.
- **Inner vs. outer dimension**: the reader detects whether each face is dimensioned from the inside or the outside of the bend. Inner dimensions are converted by adding one thickness for each bend that touches that face (a U-channel of thickness 2 with an inner dimension of 46 measures 46+2+2 = 50 on the outside), and the conversion is shown next to the side.
- The profile is listed in order and vertically — face 1, angle 1, radius 1, face 2... — with each value flagged **"from drawing"** if it was read, or **"default"** (90°, radius = thickness) if it wasn't. Everything is editable.
- The **K-factor** (neutral fiber position) is estimated from R/thickness (neutral axis) or set manually. The method and corrections are saved automatically.

### Automatically saved configuration

Any configuration change (language, units, provider/model, rates, field names and aliases, sheet metal unfolding options) is **automatically saved** to a single JSON file on the server (`server/datos/config.json`, git-ignored, written atomically), as well as in the browser. On a new machine — or in the future desktop version — the app rehydrates that configuration from the file on startup. The API key is **not** saved in that file: it's a credential and stays only in the browser.

### Continuous learning from usage (applied ML)

Draw2Quote doesn't stay static after the first prompt: every correction a user confirms with **Save correction** becomes a training signal that feeds back into the system. The mechanism, without needing to retrain any model:

1. **Feedback capture.** Clicking "Save correction" sends the model's original extraction and the final extraction (after human review) to `POST /api/feedback`. The server calculates which fields were corrected and saves the event to `server/datos/feedback.jsonl` (local JSONL, git-ignored). Saving without having corrected anything is also a useful signal: it confirms that a high confidence reading was correct.
2. **In-context learning (retrieval-augmented, no weight changes).** Before each new analysis, the server injects two distilled blocks from the correction history into the system prompt — for any provider:
   - **Aggregated lessons**: fields that get corrected frequently, common `null → value` transitions, the most frequent grade/finish values per family (`construirLeccionesAprendidas`).
   - **Few-shot examples** (dynamic example injection, MICL): concrete past corrections presented as cases — "a previous reading was `D-8` and the correction was `D-B`" — with the instruction to use them as a reminder of the mistake to watch for, without copying values (`construirEjemplosCorreccion`). Relevance is approximated by recency/field diversity; retrieval by visual similarity of the crop is left as a roadmap item (see [ARQUITECTURA.md](ARQUITECTURA.md)).

   It's the same principle production copilots use to adapt without fine-tuning: the model doesn't change, but the context it receives does, and that moves measurable accuracy with real-world use.
3. **Real calibration.** The **Accuracy** panel (`GET /api/estadisticas`) shows, per field, what percentage of the times the model marked "high confidence" it later had to be corrected — real model evaluation, not just a usage counter.
4. **Export for real fine-tuning.** When saving a correction you can check "Include drawing image in the improvement dataset" (unchecked by default, since a drawing may contain sensitive customer information). Running:

   ```bash
   npm run feedback:exportar
   ```

   converts `server/datos/feedback.jsonl` into `server/datos/finetuning.jsonl`: a JSONL of `system` / `user` (image + instruction, or a note if no image was included) / `assistant` (the human-corrected extraction) messages — the starting format for a fine-tuning job or a local LoRA trainer. Events without an image are marked as useful only for adjusting textual judgment, not vision.

Lessons only activate once there's enough data (a minimum of 5 analyses with feedback), to avoid drawing premature conclusions from a small sample.

### Configurable estimated quote

Each analysis includes an **Estimated quote** breakdown calculated in the browser from the extracted data: material (weight × price/kg based on the material's real density), cutting or machining, holes, bends/threads, finish, a surcharge for critical tolerances, and batch setup — with unit price and batch total.

- It uses simplified geometry (bounding rectangle/cylinder, not the part's actual profile): it's an order-of-magnitude estimate, not a real nesting-based quote. Every approximation used is explicitly noted under the breakdown.
- If a piece of data essential to the calculation is missing (e.g. quantity or thickness), it clearly states what's missing instead of assuming a value.
- All rates (€/kg per material family, €/m of cutting, €/min of machining, cost per hole/bend/thread, finish, setup, surcharges and margin) are **editable in Rates** and are saved in your browser — adjust them to your shop's real costs.

### Accuracy and automatic validations

- The model is forbidden from making things up: if a piece of data isn't legible it returns `null` and explains why in *Observations*.
- All dimensions are normalized to millimeters.
- Confidence per field: any doubt is marked `medium` or `low` and the UI highlights it for human review.
- Local validations: standard thicknesses, family↔grade consistency, reasonable ranges, swapped dimensions.
- Helpers on each field (a `?` icon) explaining what it is and where it comes from on the drawing.

### Language and units

The header includes two selectors: **ES/EN** (with the flag of the active language) changes all the interface text (fields, help, validation warnings, quote, server messages) and **mm/in** changes how dimensions are shown and edited. Both are saved in the browser and remembered between sessions.

- **Automatic detection of the drawing's units**: when analyzing, the model detects whether the drawing is dimensioned in millimeters or inches and the view switches automatically to the corresponding system (a "Drawing dimensioned in mm / in inches" badge is shown). Dimensions are always returned in mm and converted for display.
- Data is always stored in millimeters (and kilograms for weight); the unit system only affects the presentation layer — when you enter a value in inches it's converted to mm before being stored, without carrying rounding errors into the stored value.
- The estimated quote gives the same total in € regardless of the displayed unit: only the line text changes (e.g. "Material (4.03 lb × ...)" instead of "Material (1.83 kg × ...)").
- Rates (Rates) are always managed in metric units (€/kg, €/m) to keep the shop's configuration simple.
- The chosen language also travels to the server with each analysis: API error messages and the demo mode's sample data are served in the active language.

## Getting started

```bash
npm install
npm --prefix web install

# development (frontend on :5173 with a proxy to the backend on :3001)
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev

# production
npm run build
npm start   # serves the built app on :3001
```

### Desktop version (installable .exe)

For anyone who doesn't want to use the web version, there's a desktop build with Electron in `desktop/` (kept separate from the root `package.json` so the web version doesn't download Electron). The desktop app starts the same embedded server and stores `config.json` and feedback in the user's profile (`%APPDATA%/Draw2Quote` on Windows), surviving reinstalls.

```bash
# prepare the app (once)
npm install && npm --prefix web install && npm run build

# build the installer (run ON Windows for the .exe)
cd desktop
npm install
npm run build:win     # → desktop/dist/Draw2Quote Setup 0.1.0.exe (NSIS installer)

# test in desktop mode without packaging
npm run dev
```

> The Windows installer (**NSIS .exe**) must be built on Windows (or with Wine). There are also `build:linux` (AppImage) and `build:mac` (DMG) targets. Once installed, the API key is configured in Settings just like on the web.

### Configuring the API from the app (multi-provider)

In **Settings** (header) you choose the AI provider without touching the server:

| Provider | Type | Key | PDF | Notes |
|---|---|---|---|---|
| **Anthropic Claude** | cloud | yes | yes | Highest accuracy; native structured outputs. Defaults to Opus 4.8. |
| **Google Gemini** | cloud (free tier) | yes (free at aistudio.google.com) | yes | Defaults to `gemini-2.5-flash`. |
| **Ollama** | local | no | no, images only | Default URL `http://localhost:11434/v1`. Use a vision-capable model (`qwen2.5vl`, `llama3.2-vision`...). |
| **LM Studio** | local | no | no, images only | Default URL `http://localhost:1234/v1`. |
| **vLLM** | local/server | optional | no, images only | Default URL `http://localhost:8000/v1`. |
| **OpenAI-compatible API** | custom cloud | optional | no, images only | OpenRouter, Groq, Mistral, DeepSeek, Together... provide the base URL (`.../v1`). |

- The configuration (provider, base URL, key, model) is saved only in your browser (localStorage) and is sent to your Draw2Quote server with each analysis. Don't use it on a shared machine.
- **Test connection** validates credentials and URL against the chosen provider without spending tokens.
- With Anthropic, native *structured outputs* are used; with the rest, the JSON schema is embedded in the prompt, JSON mode is requested, and the response is **validated with Zod on the server** — if the model doesn't comply with the schema, you'll get a clear error instead of corrupted data.
- OpenAI-compatible providers only accept images; for PDF use Anthropic or Gemini (the UI warns you).

With no configuration set (no `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` on the server) the app runs in **demo mode**: it returns sample data so you can try out the full interface without credentials.

## Structure

```
server/          Express backend (ESM, no build step)
  index.js       API: POST /api/extract, GET /api/status + static files in production
  extract.js     Call to Claude (claude-opus-4-8) with structured outputs + Zod schema
web/             React + Vite + TypeScript frontend
  src/App.tsx            Main page (dropzone + results)
  src/components/        Dropzone, Field (confidence chip + help), Results
  src/catalogo.ts        Standard thicknesses, grades per family, tolerances, finishes, help text
  src/validaciones.ts    Consistency rules that generate the warnings
```

## API

`POST /api/extract`

```json
{ "filename": "PL-2041.pdf", "mediaType": "application/pdf", "dataBase64": "..." }
```

Response: `{ "demo": false, "datos": { "espesor_mm": { "valor": 3, "confianza": "alta" }, ... , "observaciones": [] } }`

The request's `config` accepts `alias` — a map `{ field: ["label1", "label2"] }` with the names the user's drawings give to each field — and `camposExtra` — the list of already-defined extra field names —, which the server injects into the reader's prompt. The body also accepts `ocrTexto` (string or null): the OCR already computed by the queue, so it doesn't need to be repeated on the server.

`POST /api/ocr` — queue pre-processing: `{ "mediaType": "image/png", "dataBase64": "..." }` → `{ "texto": "25.4@(0.20,0.15) ..." | null }`. Returns null if OCR doesn't apply (PDF) or isn't available; it never breaks the analysis because of this.

`GET /api/config` · `PUT /api/config` — read and save the user's configuration in `server/datos/config.json` (auto-saved from the UI; the API key is excluded).
