# Draw2Quote

**De plano a presupuesto en segundos.** Arrastra un plano técnico (PDF o imagen) y la IA extrae los datos que necesitas para presupuestar: dimensiones, espesor, material, calidad, acabado, cantidad, tolerancias, pliegues y agujeros — todo estructurado y con nivel de confianza por campo para evitar lecturas erróneas.

> El repositorio se llama `Draw2Cuote` de momento; el nombre del producto es **Draw2Quote**.

## Cómo funciona

1. **Arrastra el plano** (PDF, PNG, JPG, WebP · máx. 32 MB) a la zona de carga.
2. **Analizar plano**: el backend envía el documento a la API de Claude con *structured outputs* (esquema Zod), de modo que la respuesta siempre tiene la misma forma y no hay texto libre que parsear.
3. **Revisa y corrige**: cada campo muestra un chip de confianza (alta / media / baja). Las lecturas dudosas y las incoherencias (espesor no comercial, calidad que no cuadra con la familia de material, cantidad ausente…) quedan marcadas con avisos.
4. **Exporta el JSON** estructurado para alimentar tu sistema de presupuestos.

### Campos adaptados al tipo de pieza

La IA detecta primero el **tipo de pieza** — chapa plegada, torneado, fresado o tubo/perfil — y la UI adapta los campos: una pieza torneada muestra longitud y Ø máximo (sin espesor ni pliegues), la chapa muestra espesor y pliegues, el fresado añade el alto y el tubo pide espesor de pared. Las validaciones también cambian según el tipo. El tipo es editable y el formulario se reconfigura al cambiarlo.

### Diseñado para evitar lecturas raras

- El modelo tiene prohibido inventar: si un dato no es legible devuelve `null` y lo explica en *Observaciones*.
- Todas las dimensiones se normalizan a milímetros.
- Confianza por campo: cualquier duda se marca `media` o `baja` y la UI la resalta para revisión humana.
- Validaciones locales: espesores comerciales, coherencia familia↔calidad, rangos razonables, cotas intercambiadas.
- Helpers en cada campo (icono `?`) con la explicación de qué es y de dónde sale en el plano.

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
