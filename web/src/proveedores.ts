import type { Textos } from './i18n';

export type IdProveedor = 'anthropic' | 'google' | 'ollama' | 'lmstudio' | 'vllm' | 'personalizado';

export interface PresetProveedor {
  id: IdProveedor;
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
}

export const PROVEEDORES: PresetProveedor[] = [
  {
    id: 'anthropic',
    urlEditable: false,
    urlObligatoria: false,
    claveObligatoria: true,
    modelos: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
    modeloDefecto: 'claude-opus-4-8',
    admitePdf: true,
  },
  {
    id: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: true,
    modelos: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    modeloDefecto: 'gemini-2.5-flash',
    admitePdf: true,
  },
  {
    id: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: false,
    modelos: ['qwen2.5vl:7b', 'llama3.2-vision:11b', 'gemma3:12b', 'minicpm-v:8b'],
    modeloDefecto: 'qwen2.5vl:7b',
    admitePdf: false,
  },
  {
    id: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: false,
    modelos: ['qwen2.5-vl-7b-instruct', 'gemma-3-12b-it'],
    modeloDefecto: 'qwen2.5-vl-7b-instruct',
    admitePdf: false,
  },
  {
    id: 'vllm',
    baseUrl: 'http://localhost:8000/v1',
    urlEditable: true,
    urlObligatoria: false,
    claveObligatoria: false,
    modelos: ['Qwen/Qwen2.5-VL-7B-Instruct'],
    modeloDefecto: 'Qwen/Qwen2.5-VL-7B-Instruct',
    admitePdf: false,
  },
  {
    id: 'personalizado',
    baseUrl: '',
    urlEditable: true,
    urlObligatoria: true,
    claveObligatoria: false,
    modelos: [],
    modeloDefecto: '',
    admitePdf: false,
  },
];

export function presetDe(id: string): PresetProveedor {
  return PROVEEDORES.find((p) => p.id === id) ?? PROVEEDORES[0];
}

/** Nombre y nota descriptiva del proveedor, en el idioma activo. */
export function presetTextos(id: IdProveedor, t: Textos): { nombre: string; nota: string } {
  return t.proveedores[id];
}
