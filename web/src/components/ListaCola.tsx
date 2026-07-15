import { useState } from 'react';
import { pasaFiltro, tiposPresentes, type FiltroCola, type PiezaCola } from '../cola';
import type { Textos } from '../i18n';
import type { TipoPieza } from '../tipos';
import { IconoCola, IconoQuitar } from './Iconos';

interface Props {
  piezas: PiezaCola[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
  onQuitar: (id: string) => void;
  /** % de progreso del análisis en curso, para animar la barra de la pieza activa. */
  progresoActual: number;
  t: Textos;
}

/**
 * Lista de la cola de planos, bajo el botón de analizar: desplazable con la
 * rueda del ratón y filtrable por tipo de fabricación (o "sin analizar").
 * Cada pieza lleva una barra fina ENCIMA del nombre que indica su estado:
 * vacía en cola, animada mientras se pre-procesa o analiza, llena al acabar.
 */
export function ListaCola({ piezas, seleccionada, onSeleccionar, onQuitar, progresoActual, t }: Props) {
  const [filtro, setFiltro] = useState<FiltroCola>('todas');
  const c = t.cola;

  if (piezas.length === 0) return null;

  const tipos = tiposPresentes(piezas);
  const visibles = piezas.filter((p) => pasaFiltro(p, filtro));
  const hechas = piezas.filter((p) => p.analisis === 'hecho').length;

  /** Ancho y clase de la barra de estado según los dos carriles de la pieza. */
  const barra = (p: PiezaCola): { ancho: number; clase: string } => {
    if (p.analisis === 'hecho') return { ancho: 100, clase: 'cola__barra-relleno--hecha' };
    if (p.analisis === 'error') return { ancho: 100, clase: 'cola__barra-relleno--error' };
    if (p.analisis === 'analizando') return { ancho: Math.max(10, progresoActual), clase: 'cola__barra-relleno--activa' };
    if (p.preparacion === 'encurso') return { ancho: 15, clase: 'cola__barra-relleno--preparando' };
    if (p.preparacion === 'lista') return { ancho: 25, clase: 'cola__barra-relleno--preparada' };
    return { ancho: 0, clase: '' };
  };

  const estadoDe = (p: PiezaCola): string => {
    if (p.analisis === 'hecho') return c.estadoHecha;
    if (p.analisis === 'error') return c.estadoError;
    if (p.analisis === 'analizando') return c.estadoAnalizando;
    if (p.preparacion === 'encurso') return c.estadoPreparando;
    if (p.preparacion === 'lista') return c.estadoPreparada;
    return c.estadoEsperando;
  };

  return (
    <section className="cola" aria-label={c.titulo}>
      <div className="cola__cabecera">
        <h3 className="cola__titulo">
          <IconoCola tamano={15} /> {c.titulo} <span className="cola__contador">{c.progresoCola(hechas, piezas.length)}</span>
        </h3>
        <select className="cola__filtro" value={filtro} aria-label={c.filtroEtiqueta} onChange={(e) => setFiltro(e.target.value as FiltroCola)}>
          <option value="todas">{c.filtroTodas}</option>
          <option value="pendientes">{c.filtroPendientes}</option>
          {tipos.map((tipo: TipoPieza) => (
            <option key={tipo} value={tipo}>
              {t.tiposPieza[tipo]}
            </option>
          ))}
        </select>
      </div>

      <ul className="cola__lista">
        {visibles.map((p) => {
          const b = barra(p);
          const denominacion = p.resultado?.datos.denominacion.valor;
          const marca = p.resultado?.datos.marca.valor;
          return (
            <li key={p.id}>
              <div
                className={`cola__item ${p.id === seleccionada ? 'cola__item--activa' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onSeleccionar(p.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSeleccionar(p.id);
                }}
              >
                <div className="cola__barra" aria-hidden>
                  <div className={`cola__barra-relleno ${b.clase}`} style={{ width: `${Math.round(b.ancho)}%` }} />
                </div>
                <div className="cola__fila">
                  <span className="cola__nombre" title={p.archivo.nombre}>
                    {p.archivo.nombre}
                  </span>
                  <button
                    className="cola__quitar"
                    type="button"
                    title={c.quitar}
                    aria-label={`${c.quitar}: ${p.archivo.nombre}`}
                    disabled={p.analisis === 'analizando'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuitar(p.id);
                    }}
                  >
                    <IconoQuitar tamano={13} />
                  </button>
                </div>
                <div className="cola__detalle">
                  <span className={`cola__estado cola__estado--${p.analisis}`}>{estadoDe(p)}</span>
                  {p.resultado?.datos.tipo_pieza.valor && <span className="cola__tipo">{t.tiposPieza[p.resultado.datos.tipo_pieza.valor]}</span>}
                  {(marca || denominacion) && <span className="cola__denominacion">{marca ?? denominacion}</span>}
                  {p.analisis === 'error' && p.error && (
                    <span className="cola__error" title={p.error}>
                      {p.error}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {visibles.length === 0 && <p className="cola__sinresultados">{c.filtroSinResultados}</p>}
    </section>
  );
}
