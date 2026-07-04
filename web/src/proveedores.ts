export type IdProveedor = 'anthropic' | 'google' | 'ollama' | 'lmstudio' | 'vllm' | 'personalizado';

export interface PresetProveedor {
  id: IdProveedor;
  nombre: string;
  /** URL base por defecto; undefined = no aplica (anthropic) */
  baseUrl?: string;
  /** true si el campo URL base se muestra y puede editarse */
  urlEditable: boolean;
  /** true si sin URL base no se puede usar (personalizado) */
  urlObligatoria: boolean;
  claveObligatoria: boolean;
  /** sugerencias para el datalist; el campo siempre admite texto libre */
  modelos: string[];
  modeloDefecto: string;
  admitePdf: boolean;
  nota: string;
}

export const PROVEEDORES: PresetProveedor[] = [
  {
    id: 'anthropic',
    nombre: 'Anthropic Claude (nube)',
    urlEditable: false,
    urlObligatoria: false,
    claveObligatoria: true,
    modelos: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
    modeloDefecto: 'claude-opus-4-8',
    admitePdf: true,
    nota: 'Máxima precisión leyendo planos (PDF e imágenes). Clave en console.anthropic.com.',
  },
  {
    id: 'google',
    nombre: 'Google Gemini (nube, capa gratuita)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: true,
    modelos: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    modeloDefecto: 'gemini-2.5-flash',
    admitePdf: true,
    nota: 'API con capa gratuita (límites diarios). Admite PDF e imágenes. Clave gratuita en aistudio.google.com.',
  },
  {
    id: 'ollama',
    nombre: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: false,
    modelos: ['qwen2.5vl:7b', 'llama3.2-vision:11b', 'gemma3:12b', 'minicpm-v:8b'],
    modeloDefecto: 'qwen2.5vl:7b',
    admitePdf: false,
    nota: 'Sin clave ni coste, todo en tu máquina. El modelo debe tener VISIÓN. Solo imágenes (no PDF).',
  },
  {
    id: 'lmstudio',
    nombre: 'LM Studio (local)',
    baseUrl: 'http://localhost:1234/v1',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: false,
    modelos: ['qwen2.5-vl-7b-instruct', 'gemma-3-12b-it'],
    modeloDefecto: 'qwen2.5-vl-7b-instruct',
    admitePdf: false,
    nota: 'Activa el servidor local en LM Studio (pestaña Developer). Modelo con visión. Solo imágenes.',
  },
  {
    id: 'vllm',
    nombre: 'vLLM (local / servidor propio)',
    baseUrl: 'http://localhost:8000/v1',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: false,
    modelos: ['Qwen/Qwen2.5-VL-7B-Instruct'],
    modeloDefecto: 'Qwen/Qwen2.5-VL-7B-Instruct',
    admitePdf: false,
    nota: 'Sirve un modelo con visión con vLLM y apunta aquí su URL. Solo imágenes.',
  },
  {
    id: 'personalizado',
    nombre: 'API compatible OpenAI (cloud personalizado)',
    baseUrl: '',
    urlEditable: true,
    urlObligatoria: true,
    claveObligatoria: false,
    modelos: [],
    modeloDefecto: '',
    admitePdf: false,
    nota: 'Cualquier servicio con API estilo OpenAI: OpenRouter, Groq, Mistral, DeepSeek, Together... Indica su URL base (termina en /v1), la clave si la exige y un modelo con visión. Solo imágenes.',
  },
];

export function presetDe(id: string): PresetProveedor {
  return PROVEEDORES.find((p) => p.id === id) ?? PROVEEDORES[0];
}
