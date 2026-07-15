import { construirTabla, tablaACsv, tablaAExcelHtml, type ItemListado } from '../listado';
import type { Textos } from '../i18n';
import type { Tarifas } from '../tarifas';
import type { SistemaUnidades } from '../unidades';
import { IconoDescargar, IconoQuitar } from './Iconos';

interface Props {
  items: ItemListado[];
  tarifas: Tarifas;
  unidades: SistemaUnidades;
  t: Textos;
  onQuitar: (id: string) => void;
  onVaciar: () => void;
  onCerrar: () => void;
}

const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob(['﻿', contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/** Modal del listado de piezas: tabla, precio total y exportación CSV / Excel. */
export function Listado({ items, tarifas, unidades, t, onQuitar, onVaciar, onCerrar }: Props) {
  const l = t.listado;
  const tabla = construirTabla(items, tarifas, t, unidades);

  const exportarCsv = () => descargar('draw2quote-listado.csv', tablaACsv(tabla), 'text/csv;charset=utf-8');
  const exportarExcel = () => descargar('draw2quote-listado.xls', tablaAExcelHtml(tabla, l.titulo), 'application/vnd.ms-excel');

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal modal--ancho" role="dialog" aria-label={t.app.tituloListado} onClick={(e) => e.stopPropagation()}>
        <h2>{l.titulo}</h2>
        <p className="modal__nota">{l.itemsN(items.length)}</p>

        {items.length === 0 ? (
          <p className="modal__nota">{l.vacio}</p>
        ) : (
          <>
            <div className="listado__scroll">
              <table className="listado__tabla">
                <thead>
                  <tr>
                    {tabla.cabeceras.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                    <th aria-label={l.quitar} />
                  </tr>
                </thead>
                <tbody>
                  {tabla.filas.map((fila, i) => (
                    <tr key={items[i].id}>
                      {fila.map((celda, ci) => (
                        <td key={ci}>{celda}</td>
                      ))}
                      <td>
                        <button className="listado__quitar" type="button" title={l.quitar} onClick={() => onQuitar(items[i].id)}>
                          <IconoQuitar tamano={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="listado__total">
              <span>{l.precioTotal}</span>
              <strong>{euros(tabla.totalGeneral)}</strong>
            </div>
            <p className="modal__nota">{l.nota}</p>
          </>
        )}

        <div className="modal__acciones">
          {items.length > 0 && (
            <>
              <button className="btn" type="button" onClick={onVaciar}>
                {l.vaciar}
              </button>
              <button className="btn" type="button" onClick={exportarCsv}>
                <IconoDescargar tamano={15} />
                {l.exportarCsv}
              </button>
              <button className="btn btn--primario" type="button" onClick={exportarExcel}>
                <IconoDescargar tamano={15} />
                {l.exportarExcel}
              </button>
            </>
          )}
          <button className="btn" type="button" onClick={onCerrar}>
            {l.cerrar}
          </button>
        </div>
      </div>
    </div>
  );
}
