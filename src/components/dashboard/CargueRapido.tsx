"use client";

import React, { useState } from 'react';
import { X, Save, ClipboardPaste, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface CargueRapidoProps {
  sede: string;
  onSuccess: () => void;
  onClose: () => void;
}

interface ParsedRow {
  impo: string;
  modelo: string;
  cantidad: number;
  destino: string;
  fecha_eta: string;
  error?: string;
}

export function CargueRapido({ sede, onSuccess, onClose }: CargueRapidoProps) {
  const [pastedData, setPastedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const pastedText = clipboardData.getData('text');
    if (!pastedText) return;

    const rows = pastedText.split('\n').filter(row => row.trim() !== '');
    const newParsedRows: ParsedRow[] = [];

    rows.forEach(row => {
      const cols = row.split('\t').map(c => c.trim());
      // Expecting: IMPO | Modelo | Cantidad | Destino | Fecha
      if (cols.length >= 5) {
        let cantidad = parseFloat(cols[2].replace(',', '.'));
        if (isNaN(cantidad)) cantidad = 0;

        let error = undefined;
        // Basic date validation (YYYY-MM-DD or DD/MM/YYYY to YYYY-MM-DD)
        let fecha = cols[4];
        if (fecha.includes('/')) {
            const parts = fecha.split('/');
            if(parts.length === 3) {
                // Assuming DD/MM/YYYY
                fecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        
        const dateObj = new Date(fecha);
        if (isNaN(dateObj.getTime())) {
            error = "Fecha inválida (usa YYYY-MM-DD)";
        }

        newParsedRows.push({
          impo: cols[0],
          modelo: cols[1],
          cantidad,
          destino: cols[3],
          fecha_eta: fecha,
          error
        });
      }
    });

    setPastedData(newParsedRows);
  };

  const handleSave = async () => {
    const validRows = pastedData.filter(r => !r.error);
    if (validRows.length === 0) return;

    setLoading(true);
    const upserts = validRows.map(r => ({
      impo: r.impo,
      modelo: r.modelo,
      cantidad: r.cantidad,
      destino: r.destino,
      fecha_eta: r.fecha_eta,
      sede,
      observaciones: 'Cargue masivo'
    }));

    try {
      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upserts, deletes: [] })
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        alert('Error al guardar el cargue masivo.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const hasErrors = pastedData.some(r => r.error);

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <ClipboardPaste className="text-sunset-amber" /> Cargue Rápido (Excel)
            </h3>
            <p className="text-sm text-gray-500 font-medium">Pega los datos directamente desde una hoja de cálculo.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition"><X size={20} /></button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm">
            <p className="font-bold mb-1">Formato requerido (Columnas):</p>
            <p className="font-mono bg-white inline-block px-2 py-1 rounded border">IMPO | Modelo | Cantidad | Destino | Fecha (YYYY-MM-DD o DD/MM/YYYY)</p>
            <p className="mt-2 text-xs opacity-80">Selecciona el rango en Excel, presiona Ctrl+C y luego haz clic en el área de abajo y presiona Ctrl+V.</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 transition-colors flex flex-col items-center justify-center min-h-[150px] outline-none
              ${isPasting ? 'border-sunset-amber bg-amber-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsPasting(true); }}
            onDragLeave={() => setIsPasting(false)}
            onPaste={handlePaste}
            tabIndex={0}
            autoFocus
          >
            <ClipboardPaste size={32} className="text-gray-400 mb-2" />
            <p className="text-gray-600 font-bold mb-1">Haz clic aquí y presiona Ctrl+V para pegar</p>
            <p className="text-gray-400 text-sm">Soporta múltiples filas desde Excel o Sheets</p>
          </div>

          {pastedData.length > 0 && (
            <div className="mt-4 border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase">
                  <tr>
                    <th className="p-3">IMPO</th>
                    <th className="p-3">Modelo</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3">Destino</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pastedData.map((row, idx) => (
                    <tr key={idx} className={row.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="p-3 font-mono">{row.impo}</td>
                      <td className="p-3 text-xs">{row.modelo}</td>
                      <td className="p-3 text-center font-bold px-1.5">{row.cantidad}</td>
                      <td className="p-3">{row.destino}</td>
                      <td className="p-3 font-mono text-xs">{row.fecha_eta}</td>
                      <td className="p-3">
                        {row.error ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                            <AlertTriangle size={12} /> {row.error}
                          </span>
                        ) : (
                          <span className="text-green-600 text-xs font-bold">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-between items-center rounded-b-2xl">
          <p className="text-sm font-semibold text-gray-500">
            {pastedData.length > 0 ? `${pastedData.length} filas detectadas.` : 'Esperando datos...'}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={loading || pastedData.length === 0 || hasErrors}
              className="px-6 py-2.5 rounded-xl font-bold bg-charcoal-black text-white hover:bg-gray-800 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
              Guardar {pastedData.filter(r => !r.error).length} Arribos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
