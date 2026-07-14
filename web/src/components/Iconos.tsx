import type { SVGProps } from 'react';

/**
 * Set de iconos de la app: SVG monocromos de trazo (stroke = currentColor),
 * 24×24, sin relleno, para sustituir a los emojis con un acabado profesional
 * y coherente en cualquier plataforma. El tamaño se controla con la prop
 * `tamano` (por defecto 16 px, alineado con el texto de los botones).
 *
 * Las dos banderas del cambio de idioma son la excepción con color propio.
 */

interface PropsIcono extends SVGProps<SVGSVGElement> {
  tamano?: number;
}

function Base({ tamano = 16, children, ...resto }: PropsIcono) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icono"
      {...resto}
    >
      {children}
    </svg>
  );
}

/** Tarifas: símbolo del euro. */
export function IconoTarifas(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M17.5 5.8A7.5 7.5 0 0 0 12 3.5c-4.1 0-7.5 3.8-7.5 8.5s3.4 8.5 7.5 8.5a7.5 7.5 0 0 0 5.5-2.3" />
      <path d="M3 10h9M3 14h8" />
    </Base>
  );
}

/** Precisión: gráfico de barras. */
export function IconoPrecision(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-6M12 20.5V4.5M17.5 20.5v-10" />
    </Base>
  );
}

/** Campos: etiqueta (tag). */
export function IconoCampos(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M20.6 13.3l-7.3 7.3a1.9 1.9 0 0 1-2.7 0L4 14V4h10l6.6 6.6a1.9 1.9 0 0 1 0 2.7Z" />
      <circle cx="8.3" cy="8.3" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Listado: líneas con viñetas. */
export function IconoListado(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Ajustes: deslizadores (mezclador). */
export function IconoAjustes(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M4 7h9.5M17.5 7H20M4 12h3.5M11.5 12H20M4 17h11.5M19.5 17H20" />
      <circle cx="15.5" cy="7" r="2" />
      <circle cx="9.5" cy="12" r="2" />
      <circle cx="17.5" cy="17" r="2" />
    </Base>
  );
}

/** Unidades: regla en diagonal con marcas. */
export function IconoUnidades(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M16.2 2.7 2.7 16.2a1 1 0 0 0 0 1.4l3.7 3.7a1 1 0 0 0 1.4 0L21.3 7.8a1 1 0 0 0 0-1.4l-3.7-3.7a1 1 0 0 0-1.4 0Z" />
      <path d="m7.3 11.3 1.9 1.9M10.3 8.3l1.9 1.9M13.3 5.3l1.9 1.9" />
    </Base>
  );
}

/** Presupuesto: calculadora. */
export function IconoPresupuesto(p: PropsIcono) {
  return (
    <Base {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8.5 7.5h7" />
      <circle cx="8.7" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.3" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8.7" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.3" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Desarrollo de chapa: sección de chapa doblada (dos caras paralelas con radio). */
export function IconoDesarrollo(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M21 18.5H10.5A4.5 4.5 0 0 1 6 14V3" />
      <path d="M21 22H10.5A8 8 0 0 1 2.5 14V3" />
      <path d="M2.5 3h3.5M21 18.5v3.5" />
    </Base>
  );
}

/** Cola de planos: hojas apiladas. */
export function IconoCola(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="m12 3.2-8.5 4.5L12 12.2l8.5-4.5L12 3.2Z" />
      <path d="m3.5 12.2 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.4 8.5 4.5 8.5-4.5" />
    </Base>
  );
}

/** IA (revisión / corrección): destellos. */
export function IconoIA(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M11 5.5 12.7 10l4.5 1.7-4.5 1.7L11 17.9l-1.7-4.5L4.8 11.7 9.3 10 11 5.5Z" />
      <path d="M18.5 3.5v3.4M16.8 5.2h3.4M19.5 16.6v2.8M18.1 18h2.8" />
    </Base>
  );
}

/** Aviso: triángulo de advertencia. */
export function IconoAviso(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M12 4.2 2.8 19.8h18.4L12 4.2Z" />
      <path d="M12 10v4.4" />
      <circle cx="12" cy="16.9" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

/** Correcto: check en círculo. */
export function IconoOk(p: PropsIcono) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="m8.3 12.3 2.5 2.5 4.9-5.4" />
    </Base>
  );
}

/** Check simple (chips de estado). */
export function IconoCheck(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Base>
  );
}

/** Quitar / cerrar: aspa. */
export function IconoQuitar(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

/** Añadir: más. */
export function IconoAnadir(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

/** Descargar (exportaciones). */
export function IconoDescargar(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M12 4v10.5M7.5 11 12 15.5 16.5 11M4.5 19.5h15" />
    </Base>
  );
}

/** Copiar al portapapeles. */
export function IconoCopiar(p: PropsIcono) {
  return (
    <Base {...p}>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
      <path d="M4.5 15V5.5a2 2 0 0 1 2-2H16" />
    </Base>
  );
}

/** Plano técnico (dropzone): hoja con pieza y cota. */
export function IconoPlano(p: PropsIcono) {
  return (
    <Base {...p}>
      <rect x="3" y="4" width="18" height="16" rx="1.6" />
      <path d="M7.5 8h6.5v4.5H7.5z" />
      <path d="M7.5 16.5h9M7.5 15.5v2M16.5 15.5v2" />
    </Base>
  );
}

/** OCR: marco de escaneo con texto. */
export function IconoOcr(p: PropsIcono) {
  return (
    <Base {...p}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M8 10h8M8 14h5" />
    </Base>
  );
}

interface PropsBandera extends SVGProps<SVGSVGElement> {
  /** Ancho en px; la altura guarda proporción 3:2. */
  ancho?: number;
}

/** Bandera de España (versión civil simplificada, sin escudo). */
export function BanderaES({ ancho = 18, ...resto }: PropsBandera) {
  return (
    <svg width={ancho} height={(ancho * 2) / 3} viewBox="0 0 24 16" aria-hidden="true" className="bandera" {...resto}>
      <rect width="24" height="16" rx="1.5" fill="#c60b1e" />
      <rect y="4" width="24" height="8" fill="#ffc400" />
    </svg>
  );
}

/** Bandera del Reino Unido (Union Jack simplificada). */
export function BanderaEN({ ancho = 18, ...resto }: PropsBandera) {
  return (
    <svg width={ancho} height={(ancho * 2) / 3} viewBox="0 0 24 16" aria-hidden="true" className="bandera" {...resto}>
      <clipPath id="uk-marco">
        <rect width="24" height="16" rx="1.5" />
      </clipPath>
      <g clipPath="url(#uk-marco)">
        <rect width="24" height="16" fill="#012169" />
        <path d="M0 0l24 16M24 0 0 16" stroke="#fff" strokeWidth="3.2" />
        <path d="M0 0l24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.3" />
        <path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5.2" />
        <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3" />
      </g>
    </svg>
  );
}
