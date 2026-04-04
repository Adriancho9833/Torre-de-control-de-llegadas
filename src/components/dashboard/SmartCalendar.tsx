"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  differenceInDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search, Plus, Save, X, Trash2, AlertTriangle, Loader2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ArriboRow {
  id?: string;
  fecha_eta: string;
  impo: string;
  modelo: string;
  destino: string;
  cantidad: number;
  observaciones: string;
  sede: string;
  _isNew?: boolean;
}

interface Modelo {
  id: string;
  modelo: string;
  coeficiente: number;
}

interface DestinoCapacidad {
  destino: string;
  limite_puntos: number | null;
}

// ─── Per-sede configuration ───────────────────────────────────────────────────
const SEDE_CONFIG: Record<string, { destinos: string[]; label: string }> = {
  ANTIOQUIA: {
    label: 'Antioquia',
    destinos: ['PLANTA', 'FABRICATO', 'ROSENDAL', 'OTROS'],
  },
  CARTAGENA: {
    label: 'Cartagena',
    destinos: ['PLANTA', 'BODEGA EXTERNA', 'OTROS'],
  },
};

// ─── Color mapping per destino ────────────────────────────────────────────────
function getDestinoStyle(destino: string): string {
  const d = destino?.toUpperCase();
  if (d === 'PLANTA')         return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (d === 'FABRICATO')      return 'bg-blue-100 text-blue-800 border-blue-300';
  if (d === 'BODEGA EXTERNA') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (d === 'ROSENDAL')       return 'bg-teal-100 text-teal-800 border-teal-300';
  if (d === 'OTROS')          return 'bg-purple-100 text-purple-800 border-purple-300';
  return 'bg-gray-100 text-gray-700 border-gray-300';
}

function getFilterActiveStyle(destino: string): string {
  const d = destino?.toUpperCase();
  if (d === 'PLANTA')         return 'bg-emerald-100 text-emerald-700 shadow-sm';
  if (d === 'FABRICATO')      return 'bg-blue-100 text-blue-700 shadow-sm';
  if (d === 'BODEGA EXTERNA') return 'bg-blue-100 text-blue-700 shadow-sm';
  if (d === 'ROSENDAL')       return 'bg-teal-100 text-teal-700 shadow-sm';
  if (d === 'OTROS')          return 'bg-purple-100 text-purple-700 shadow-sm';
  return 'bg-white shadow-sm';
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface SmartCalendarProps {
  sede: string;
  capacidadTotal: number;
  consumoDiario: number;
  inventarioBase: number;
  onSuccess: () => void;
  filterDestino: string;        // lifted from parent
  onFilterChange: (d: string) => void; // lifted from parent
}

export function SmartCalendar({ sede, capacidadTotal, consumoDiario, inventarioBase, onSuccess, filterDestino, onFilterChange }: SmartCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<ArriboRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [destinosCapacidad, setDestinosCapacidad] = useState<DestinoCapacidad[]>([]);

  // Search (local)
  const [searchImpo, setSearchImpo] = useState('');

  // Modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalRows, setModalRows] = useState<ArriboRow[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const sedeConfig = SEDE_CONFIG[sede] || SEDE_CONFIG['ANTIOQUIA'];

  // ─── Fetch month data ────────────────────────────────────────────────────
  const fetchMonthData = useCallback(async (date: Date) => {
    setLoading(true);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const startDate = format(startOfWeek(monthStart, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const endDate = format(endOfWeek(monthEnd, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    try {
      const res = await fetch(`/api/calendario?start=${startDate}&end=${endDate}&sede=${sede}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [sede]);

  // ─── Fetch config (models + destinos) ───────────────────────────────────
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/config?sede=${sede}`);
      if (res.ok) {
        const json = await res.json();
        setModelos(json.modelos || []);
        setDestinosCapacidad(json.destinos || []);
      }
    } catch (e) { console.error(e); }
  }, [sede]);

  useEffect(() => {
    fetchMonthData(currentDate);
    fetchConfig();
  }, [currentDate, fetchMonthData, fetchConfig]);

  // ─── Calendar Grid ───────────────────────────────────────────────────────
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const rows: Date[][] = [];
  let days: Date[] = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    rows.push(days);
    days = [];
  }

  // ─── Coefficient lookup ──────────────────────────────────────────────────
  const coeficienteMap = useMemo(() => {
    const map: Record<string, number> = {};
    modelos.forEach(m => { map[m.modelo.toUpperCase()] = m.coeficiente; });
    return map;
  }, [modelos]);

  const limiteMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    destinosCapacidad.forEach(d => { map[d.destino.toUpperCase()] = d.limite_puntos; });
    return map;
  }, [destinosCapacidad]);

  // ─── Daily totals & saturation ───────────────────────────────────────────
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    data.forEach(item => {
      totals[item.fecha_eta] = (totals[item.fecha_eta] || 0) + (item.cantidad || 0);
    });
    return totals;
  }, [data]);

  // Daily discharge load per destino (para alertas por depósito)
  const dailyDischargeByDestino = useMemo(() => {
    // { 'yyyy-MM-dd': { 'PLANTA': 4.2, 'FABRICATO': 3.0, ... } }
    const result: Record<string, Record<string, number>> = {};
    data.forEach(item => {
      const coef = coeficienteMap[item.modelo?.toUpperCase()] ?? 1.0;
      const load = (item.cantidad || 0) * coef;
      if (!result[item.fecha_eta]) result[item.fecha_eta] = {};
      const dest = item.destino?.toUpperCase() || 'OTROS';
      result[item.fecha_eta][dest] = (result[item.fecha_eta][dest] || 0) + load;
    });
    return result;
  }, [data, coeficienteMap]);

  // Set of dates where at least one destino exceeds its limit
  const dischargeOverflowDates = useMemo(() => {
    const overflowDates = new Set<string>();
    Object.entries(dailyDischargeByDestino).forEach(([date, destinoLoads]) => {
      Object.entries(destinoLoads).forEach(([destino, load]) => {
        const limite = limiteMap[destino];
        if (limite !== null && limite !== undefined && load > limite) {
          overflowDates.add(date);
        }
      });
    });
    return overflowDates;
  }, [dailyDischargeByDestino, limiteMap]);

  const today = new Date();

  const columnProjections = useMemo(() => {
    const proj: Record<string, boolean> = {};
    let runningInv = inventarioBase;
    const flatDays = rows.flat();
    flatDays.forEach(d => {
      const ds = format(d, 'yyyy-MM-dd');
      const diff = differenceInDays(d, today);
      const arrivalsDia = dailyTotals[ds] || 0;
      if (diff > 0) {
        runningInv = runningInv + arrivalsDia - consumoDiario;
      } else if (diff === 0) {
        runningInv = inventarioBase;
      }
      if (runningInv < 0) runningInv = 0;
      proj[ds] = (capacidadTotal - runningInv) < 0;
    });
    return proj;
  }, [dailyTotals, rows, inventarioBase, capacidadTotal, consumoDiario, today]);

  // ─── Navigation ──────────────────────────────────────────────────────────
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  // ─── Modal Handlers ──────────────────────────────────────────────────────
  const openModal = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = data.filter(r => r.fecha_eta === dateStr);
    setModalRows(dayData);
    setPendingDeletes([]);
    setSelectedDate(date);
  };

  const closeModal = () => {
    setSelectedDate(null);
    setModalRows([]);
    setPendingDeletes([]);
  };

  const addModalRow = () => {
    if (!selectedDate) return;
    const defaultDestino = sedeConfig.destinos[0];
    setModalRows([
      ...modalRows,
      {
        id: crypto.randomUUID(),
        fecha_eta: format(selectedDate, 'yyyy-MM-dd'),
        impo: '',
        modelo: modelos[0]?.modelo || '',
        destino: defaultDestino,
        cantidad: 0,
        observaciones: '',
        sede,
        _isNew: true
      }
    ]);
  };

  const updateModalRow = (index: number, field: keyof ArriboRow, value: any) => {
    const newRows = [...modalRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setModalRows(newRows);
  };

  const removeModalRow = (index: number) => {
    const row = modalRows[index];
    if (row.id && !row._isNew) {
      setPendingDeletes([...pendingDeletes, row.id]);
    }
    setModalRows(modalRows.filter((_, i) => i !== index));
  };

  const saveDayData = async () => {
    setSaving(true);
    const upserts = modalRows.map(r => {
      const { _isNew, ...clean } = r as any;
      return { ...clean, sede };
    });
    try {
      const res = await fetch('/api/calendario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upserts, deletes: pendingDeletes })
      });
      if (res.ok) {
        await fetchMonthData(currentDate);
        onSuccess();
        closeModal();
      } else {
        alert('Error al guardar datos.');
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  // ─── Modal: real-time discharge preview ──────────────────────────────────
  const modalDischargeByDestino = useMemo(() => {
    const result: Record<string, number> = {};
    modalRows.forEach(row => {
      const coef = coeficienteMap[row.modelo?.toUpperCase()] ?? 1.0;
      const load = (row.cantidad || 0) * coef;
      const dest = row.destino?.toUpperCase() || 'OTROS';
      result[dest] = (result[dest] || 0) + load;
    });
    return result;
  }, [modalRows, coeficienteMap]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col w-full text-charcoal-black">

      {/* Header Toolbar */}
      <div className="p-4 border-b flex flex-col gap-4 sm:flex-row justify-between items-center bg-gray-50/50 rounded-t-xl">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500 capitalize min-w-[180px]">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex gap-1 bg-white border rounded-lg shadow-sm">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 transition rounded-l-lg"><ChevronLeft size={20} /></button>
            <button onClick={goToday} className="px-3 py-2 text-sm font-semibold border-x hover:bg-gray-100 transition">Hoy</button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 transition rounded-r-lg"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap justify-end">
          {/* Destino Filter - controlled by parent */}
          <div className="flex bg-gray-200 rounded-lg p-1 gap-0.5 flex-wrap">
            <button
              onClick={() => onFilterChange('ALL')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filterDestino === 'ALL' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
            >
              Todos
            </button>
            {sedeConfig.destinos.map(dest => (
              <button
                key={dest}
                onClick={() => onFilterChange(dest)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filterDestino === dest ? getFilterActiveStyle(dest) : 'text-gray-500'}`}
              >
                {dest.charAt(0) + dest.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* IMPO Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar IMPO..."
              value={searchImpo}
              onChange={(e) => setSearchImpo(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sunset-amber"
            />
          </div>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b bg-gray-50 text-center text-xs font-bold text-gray-500 uppercase tracking-wider py-3">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d}>{d}</div>)}
      </div>

      {/* Calendar Grid */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex justify-center items-center">
            <Loader2 className="animate-spin text-sunset-amber" size={32} />
          </div>
        )}
        <div className="grid grid-cols-7 border-l">
          {rows.map((week, idx) => (
            <React.Fragment key={idx}>
              {week.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isCurrentMonth = isSameMonth(day, monthStart);

                const dayArrivals = data.filter(item => {
                  if (item.fecha_eta !== dateStr) return false;
                  if (filterDestino !== 'ALL' && item.destino?.toUpperCase() !== filterDestino) return false;
                  return true;
                });

                const hasHighlight = searchImpo.length > 1 && dayArrivals.some(a => a.impo.toLowerCase().includes(searchImpo.toLowerCase()));
                const isInventoryOverflow = columnProjections[dateStr];
                const isDischargeOverflow = dischargeOverflowDates.has(dateStr);

                return (
                  <div
                    key={day.toString()}
                    onClick={() => openModal(day)}
                    className={`
                      min-h-[120px] max-h-[160px] border-r border-b p-2 cursor-pointer transition flex flex-col gap-1 relative group
                      ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/70 text-gray-400'}
                      ${hasHighlight ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-gray-50'}
                      ${isInventoryOverflow ? 'shadow-[inset_0_0_0_2px_#ef4444]' : ''}
                      ${isDischargeOverflow && !isInventoryOverflow ? 'shadow-[inset_0_0_0_2px_#f97316]' : ''}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isSameDay(day, today) ? 'bg-sunset-amber text-white shadow-sm' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="flex gap-0.5">
                        {isInventoryOverflow && (
                          <div title="Saturación de Inventario"><AlertTriangle size={13} className="text-red-500" /></div>
                        )}
                        {isDischargeOverflow && (
                          <div title="Capacidad de descargue excedida"><AlertTriangle size={13} className="text-orange-500" /></div>
                        )}
                      </div>
                    </div>

                    {/* Items In-Cell */}
                    <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar pb-1">
                      {dayArrivals.map((arribo, i) => {
                        const matchedSearch = searchImpo.length > 1 && arribo.impo.toLowerCase().includes(searchImpo.toLowerCase());
                        const badgeClass = getDestinoStyle(arribo.destino);
                        return (
                          <div
                            key={arribo.id || i}
                            className={`
                              text-[10px] border px-1.5 py-1 rounded truncate flex justify-between items-center
                              ${badgeClass}
                              ${matchedSearch
                                ? 'ring-2 ring-amber-400 ring-offset-1 font-extrabold shadow-[0_0_6px_1px_rgba(251,191,36,0.6)]'
                                : ''}
                            `}
                          >
                            <span className="truncate mr-1">{arribo.impo}</span>
                            <span className="font-bold bg-white/60 px-1 rounded shrink-0">{arribo.cantidad}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition pointer-events-none rounded" />
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-gray-800">
                  {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
                </h3>
                <p className="text-sm text-gray-500 font-medium">Gestión detallada de arribos</p>
              </div>
              <button onClick={closeModal} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition"><X size={20} /></button>
            </div>

            {/* Discharge Summary Banner */}
            {modalRows.length > 0 && Object.keys(modalDischargeByDestino).length > 0 && (
              <div className="px-6 pt-4 flex flex-wrap gap-3">
                {Object.entries(modalDischargeByDestino).map(([dest, load]) => {
                  const limite = limiteMap[dest];
                  const exceeded = limite !== null && limite !== undefined && load > limite;
                  return (
                    <div
                      key={dest}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${exceeded ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                    >
                      {exceeded && <AlertTriangle size={13} className="text-red-500" />}
                      <span>{dest}:</span>
                      <span className="font-mono">{load.toFixed(1)}</span>
                      {limite !== null && limite !== undefined && (
                        <span className="opacity-60">/ {limite} pts</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-6 overflow-y-auto flex-1">
              {modalRows.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 border border-dashed rounded-xl">
                  <p className="text-gray-500 font-medium">No hay arribos planificados para esta fecha.</p>
                  <button onClick={addModalRow} className="mt-4 bg-white border shadow-sm px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition">
                    Añadir el primer arribo
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-gray-100 text-gray-600">
                    <tr>
                      <th className="p-3 rounded-tl-lg w-1/5">IMPO</th>
                      <th className="p-3 w-1/5">Modelo</th>
                      <th className="p-3 w-[12%]">CANT.</th>
                      <th className="p-3 w-[14%]">Destino</th>
                      <th className="p-3 w-[10%] text-center">Coef.</th>
                      <th className="p-3">Observaciones</th>
                      <th className="p-3 rounded-tr-lg w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {modalRows.map((row, idx) => {
                      const coef = coeficienteMap[row.modelo?.toUpperCase()] ?? 1.0;
                      const load = (row.cantidad || 0) * coef;
                      const dest = row.destino?.toUpperCase() || 'OTROS';
                      const limite = limiteMap[dest];
                      const destLoad = modalDischargeByDestino[dest] || 0;
                      const exceeded = limite !== null && limite !== undefined && destLoad > limite;

                      return (
                        <tr key={row.id || idx} className={`hover:bg-gray-50 transition ${exceeded ? 'bg-red-50/40' : ''}`}>
                          <td className="p-2">
                            <input
                              type="text"
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none"
                              value={row.impo}
                              onChange={e => updateModalRow(idx, 'impo', e.target.value)}
                              placeholder="IMPO-XYZ"
                            />
                          </td>
                          <td className="p-2">
                            {/* Dropdown from modelos_coeficientes */}
                            <select
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none bg-white font-mono"
                              value={row.modelo}
                              onChange={e => updateModalRow(idx, 'modelo', e.target.value)}
                            >
                              {modelos.length === 0 && (
                                <option value="">Sin modelos configurados</option>
                              )}
                              {modelos.map(m => (
                                <option key={m.id} value={m.modelo}>{m.modelo}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono"
                              value={row.cantidad}
                              onChange={e => updateModalRow(idx, 'cantidad', parseInt(e.target.value) || 0)}
                            />
                          </td>
                          <td className="p-2">
                            <select
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none bg-white"
                              value={row.destino}
                              onChange={e => updateModalRow(idx, 'destino', e.target.value)}
                            >
                              {sedeConfig.destinos.map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${exceeded ? 'text-red-600 bg-red-100' : 'text-gray-600 bg-gray-100'}`}>
                              {load.toFixed(1)}
                            </span>
                          </td>
                          <td className="p-2">
                            <textarea
                              rows={1}
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none resize-y min-h-[42px]"
                              value={row.observaciones}
                              onChange={e => updateModalRow(idx, 'observaciones', e.target.value)}
                              placeholder="Novedades..."
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeModalRow(idx)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {modalRows.length > 0 && (
                <button onClick={addModalRow} className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-sunset-amber transition p-2">
                  <Plus size={16} /> Añadir Fila
                </button>
              )}
            </div>

            <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-2xl">
              <button onClick={closeModal} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
              <button
                onClick={saveDayData}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl font-bold bg-charcoal-black text-white hover:bg-gray-800 shadow-md transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar Arribos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
