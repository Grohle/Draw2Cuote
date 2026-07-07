import { CLAVES_CAMPO } from './camposPersonalizados';
import type { Confianza, Extraccion } from './tipos';

const CONFIANZAS: Confianza[] = ['alta', 'media', 'baja'];

/**
 * Garantiza que una extracción recibida tenga todos los campos esperados con la
 * forma { valor, confianza }. Protege la UI frente a respuestas de un backend o
 * proveedor con un esquema distinto (p. ej. sin campos nuevos como marca o
 * proyecto): en vez de que un campo ausente reviente el render, se rellena con
 * un valor nulo. No inventa datos: un campo que falta queda vacío.
 */
export function normalizarExtraccion(datos: unknown): Extraccion {
  const fuente = (datos && typeof datos === 'object' ? datos : {}) as Record<string, unknown>;
  const salida: Record<string, unknown> = {};

  for (const clave of CLAVES_CAMPO) {
    const campo = fuente[clave] as { valor?: unknown; confianza?: unknown; editado?: unknown } | undefined;
    if (campo && typeof campo === 'object') {
      salida[clave] = {
        valor: 'valor' in campo ? campo.valor : null,
        confianza: CONFIANZAS.includes(campo.confianza as Confianza) ? campo.confianza : 'media',
        ...(campo.editado ? { editado: true } : {}),
      };
    } else {
      salida[clave] = { valor: null, confianza: 'media' };
    }
  }

  salida.observaciones = Array.isArray(fuente.observaciones)
    ? (fuente.observaciones as unknown[]).filter((o): o is string => typeof o === 'string')
    : [];

  return salida as unknown as Extraccion;
}
