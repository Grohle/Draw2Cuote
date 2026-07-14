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

  salida.sistema_unidades =
    fuente.sistema_unidades === 'metrico' || fuente.sistema_unidades === 'imperial' ? fuente.sistema_unidades : null;

  salida.desarrollo = normalizarDesarrollo(fuente.desarrollo);

  // campos adicionales: solo entradas con nombre; el valor puede ser null
  salida.campos_extra = Array.isArray(fuente.campos_extra)
    ? (fuente.campos_extra as unknown[])
        .map((c) => {
          const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          return {
            nombre: typeof o.nombre === 'string' ? o.nombre.trim() : '',
            valor: typeof o.valor === 'string' ? o.valor : null,
            confianza: CONFIANZAS.includes(o.confianza as Confianza) ? (o.confianza as Confianza) : 'media',
            ...(o.editado ? { editado: true } : {}),
          };
        })
        .filter((c) => c.nombre)
    : [];

  salida.observaciones = Array.isArray(fuente.observaciones)
    ? (fuente.observaciones as unknown[]).filter((o): o is string => typeof o === 'string')
    : [];

  return salida as unknown as Extraccion;
}

function normalizarDesarrollo(fuente: unknown) {
  const d = (fuente && typeof fuente === 'object' ? fuente : {}) as Record<string, unknown>;

  // forma actual: lados = [{ longitud_mm, cota_interior }]
  let lados = Array.isArray(d.lados)
    ? (d.lados as unknown[])
        .map((l) => {
          const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
          return { longitud_mm: typeof o.longitud_mm === 'number' ? o.longitud_mm : 0, cota_interior: o.cota_interior === true };
        })
        .filter((l) => l.longitud_mm > 0)
    : [];

  // forma antigua (backend desactualizado): lados_mm = [n, n, ...] → se asume cota exterior
  if (lados.length === 0 && Array.isArray(d.lados_mm)) {
    lados = (d.lados_mm as unknown[])
      .filter((n): n is number => typeof n === 'number' && n > 0)
      .map((n) => ({ longitud_mm: n, cota_interior: false }));
  }

  const pliegues = Array.isArray(d.pliegues)
    ? (d.pliegues as unknown[]).map((p) => {
        const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return {
          angulo_grados: typeof o.angulo_grados === 'number' ? o.angulo_grados : null,
          radio_mm: typeof o.radio_mm === 'number' ? o.radio_mm : null,
        };
      })
    : [];
  return { lados, pliegues };
}
