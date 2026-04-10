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
import { ChevronLeft, ChevronRight, Search, Plus, Save, X, Trash2, AlertTriangle, Loader2, Download, Upload } from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CargueRapido } from './CargueRapido';

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
  citas?: string[]; // Array of times "HH:MM"
  arribos_citas?: { hora_cita: string }[]; // Raw from DB
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

const TIME_SLOTS = Array.from({ length: 23 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
});

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

// ─── Draggable Arrival Item ──────────────────────────────────────────────────
function DraggableArrival({ arribo, isHighlighted }: { arribo: ArriboRow; isHighlighted: boolean; }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: arribo.id || `temp-${arribo.impo}`,
    data: { arribo }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
  } : undefined;

  const badgeClass = getDestinoStyle(arribo.destino);
  const citaHora = arribo.arribos_citas && arribo.arribos_citas.length > 0 
    ? arribo.arribos_citas[0].hora_cita.substring(0, 5) 
    : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        text-[10px] border px-1.5 py-1 rounded truncate flex justify-between items-center cursor-grab hover:brightness-95
        ${badgeClass}
        ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1 font-extrabold shadow-[0_0_6px_1px_rgba(251,191,36,0.6)]' : ''}
      `}
    >
      <span className="truncate mr-1">{citaHora ? `${citaHora} | ` : ''}{arribo.impo}</span>
      <span className="font-bold bg-white/70 px-1 rounded shrink-0">{arribo.cantidad}</span>
    </div>
  );
}

// ─── Droppable Calendar Day ──────────────────────────────────────────────────
function DroppableDay({ dateStr, isCurrentMonth, hasHighlight, isInventoryCritical, isDischargeOverflow, isTodayDay, dayArrivals, searchImpo, openModal, dayNum }: any) {
  const { isOver, setNodeRef } = useDroppable({
    id: dateStr,
    data: { date: dateStr }
  });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        // Only open modal if not dragging
        if (!e.defaultPrevented) openModal(new Date(dateStr + "T12:00:00"));
      }}
      className={`
        min-h-[120px] max-h-[160px] border-r border-b p-2 cursor-pointer transition flex flex-col gap-1 relative group
        ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/70 text-gray-400'}
        ${hasHighlight ? 'bg-amber-50 hover:bg-amber-100/70' : 'hover:bg-gray-50'}
        ${isOver ? 'ring-2 ring-inset ring-sunset-amber bg-amber-50/40' : ''}
        ${isInventoryCritical ? 'shadow-[inset_0_0_0_2px_#ef4444]' : ''}
        ${isDischargeOverflow && !isInventoryCritical ? 'shadow-[inset_0_0_0_2px_#f97316]' : ''}
      `}
    >
      <div className="flex justify-between items-start mb-1">
        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isTodayDay ? 'bg-sunset-amber text-white shadow-sm' : ''}`}>
          {dayNum}
        </span>
        <div className="flex gap-0.5 pointer-events-none">
          {isInventoryCritical && (
            <div title="Saturación Crítica (<2)"><AlertTriangle size={13} className="text-red-500" /></div>
          )}
          {isDischargeOverflow && (
            <div title="Capacidad de descargue excedida"><AlertTriangle size={13} className="text-orange-500" /></div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 overflow-y-auto no-scrollbar pb-1 z-10" onClick={e => e.stopPropagation()}>
        {dayArrivals.map((arribo: ArriboRow, i: number) => {
          const matchedSearch = searchImpo.length > 1 && arribo.impo.toLowerCase().includes(searchImpo.toLowerCase());
          return <DraggableArrival key={arribo.id || i} arribo={arribo} isHighlighted={matchedSearch} />;
        })}
      </div>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition pointer-events-none rounded" />
    </div>
  );
}

// ─── Main Component Props ────────────────────────────────────────────────────
interface SmartCalendarProps {
  sede: string;
  capacidadTotal: number;
  consumoDiario: number;
  inventarioBase: number;
  onSuccess: () => void;
  filterDestino: string;
  onFilterChange: (d: string) => void;
}

export function SmartCalendar({ sede, capacidadTotal, consumoDiario, inventarioBase, onSuccess, filterDestino, onFilterChange }: SmartCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<ArriboRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [destinosCapacidad, setDestinosCapacidad] = useState<DestinoCapacidad[]>([]);

  // Modals / Overlays state
  const [showCargueRapido, setShowCargueRapido] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [exportStart, setExportStart] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportEnd, setExportEnd] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);
  const [searchImpo, setSearchImpo] = useState('');
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
        // Load raw citas into a mapped format for the modal logic optionally
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

  // ─── Drag and Drop Handlers ─────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // minimum drag distance before initiating
      },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const sourceArribo = active.data.current?.arribo as ArriboRow;
    const targetDateStr = over.id as string;

    if (sourceArribo && sourceArribo.fecha_eta !== targetDateStr && sourceArribo.id) {
      // Optimistic upate UI
      setData(prev => prev.map(a => a.id === sourceArribo.id ? { ...a, fecha_eta: targetDateStr } : a));
      
      // Persist update
      try {
        const payload = {
            id: sourceArribo.id,
            fecha_eta: targetDateStr,
            impo: sourceArribo.impo,
            modelo: sourceArribo.modelo,
            destino: sourceArribo.destino,
            cantidad: sourceArribo.cantidad,
            observaciones: sourceArribo.observaciones,
            citas: sourceArribo.arribos_citas?.map(c => c.hora_cita), // Preserve citas
            sede: sourceArribo.sede
        };

        const res = await fetch('/api/calendario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ upserts: [payload], deletes: [] })
        });
        
        if(!res.ok) throw new Error("Sync drag fail");
      } catch (err) {
        console.error("Drag and drop save error:", err);
        // Revert on error
        await fetchMonthData(currentDate); 
      }
    }
  };

  const handleExport = async () => {
    if(!exportStart || !exportEnd) return;
    setExporting(true);
    try {
        const res = await fetch(`/api/calendario?start=${exportStart}&end=${exportEnd}&sede=${sede}`);
        if(res.ok) {
            const json = await res.json();
            setReportData(json);
        } else {
            alert('Error generando reporte.');
        }
    } catch(err) {
        console.error(err);
    }
    setExporting(false);
  };

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
      const itemDest = item.destino?.toUpperCase();
      if (filterDestino === 'ALL' || itemDest === filterDestino) {
        totals[item.fecha_eta] = (totals[item.fecha_eta] || 0) + (item.cantidad || 0);
      }
    });
    return totals;
  }, [data, filterDestino]);

  // Daily discharge load per destino (para alertas por depósito)
  const dailyDischargeByDestino = useMemo(() => {
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
    // proj: { [dateStr]: 'CRITICAL' | 'TIGHT' | 'OK' }
    const proj: Record<string, 'CRITICAL' | 'TIGHT' | 'OK'> = {};
    let runningInv = inventarioBase;
    const flatDays = rows.flat();

    flatDays.forEach(d => {
      const ds = format(d, 'yyyy-MM-dd');
      const diff = differenceInDays(d, today);
      const arrivalsDia = dailyTotals[ds] || 0;
      
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const consumoAplicar = isWeekend ? 0 : consumoDiario;

      if (diff > 0) {
        runningInv = runningInv + arrivalsDia - consumoAplicar;
      } else if (diff === 0) {
        runningInv = inventarioBase + arrivalsDia;
      }
      
      if (runningInv < 0) runningInv = 0;
      const available = capacidadTotal - runningInv;
      if (available < 2) {
        proj[ds] = 'CRITICAL';
      } else if (available <= 5) {
        proj[ds] = 'TIGHT';
      } else {
        proj[ds] = 'OK';
      }
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
    const dayData = data.filter(r => r.fecha_eta === dateStr).map(r => ({
        ...r,
        // Map arribos_citas properly for editing
        citas: r.arribos_citas?.map(c => c.hora_cita.substring(0, 5)) || Array(Math.max(1, Math.ceil(r.cantidad))).fill('')
    }));
    
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
        cantidad: 0.5,
        citas: [''],
        observaciones: '',
        sede,
        _isNew: true
      } as unknown as ArriboRow
    ]);
  };

  const updateModalRow = (index: number, field: keyof ArriboRow, value: any) => {
    const newRows = [...modalRows];
    
    if (field === 'cantidad') {
      // Si cambia la cantidad, ajustar array de citas
      const newQty = parseFloat(value) || 0;
      const citaSlots = Math.max(1, Math.ceil(newQty));
      const currentCitas = newRows[index].citas || [];
      const newCitas = Array(citaSlots).fill('').map((_, i) => currentCitas[i] || '');
      
      newRows[index] = { ...newRows[index], cantidad: newQty, citas: newCitas };
    } else {
      newRows[index] = { ...newRows[index], [field]: value };
    }
    setModalRows(newRows);
  };

  const updateCita = (rowIndex: number, citaIndex: number, value: string) => {
    const newRows = [...modalRows];
    if (newRows[rowIndex].citas) {
       newRows[rowIndex].citas![citaIndex] = value;
    }
    setModalRows(newRows);
  }

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
      const { _isNew, arribos_citas, ...clean } = r as any;
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
            <div className="flex gap-2">
               <button 
                  onClick={() => setShowCargueRapido(true)} 
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-white border shadow-sm text-green-700 hover:bg-green-50 transition"
                >
                 <Upload size={14} /> Carga Rápida
               </button>
               <button 
                  onClick={() => { setReportData(null); setShowExportModal(true); }} 
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-white border shadow-sm text-blue-700 hover:bg-blue-50 transition"
                >
                 <Download size={14} /> Reporte
               </button>
            </div>

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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar IMPO..."
                value={searchImpo}
                onChange={(e) => setSearchImpo(e.target.value)}
                className="pl-9 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sunset-amber w-full sm:w-auto"
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
                  const projState = columnProjections[dateStr];
                  const isInventoryCritical = projState === 'CRITICAL';
                  const isDischargeOverflow = dischargeOverflowDates.has(dateStr);
                  const isTodayDay = isSameDay(day, today);
                  const dayNum = format(day, 'd');

                  return (
                    <DroppableDay 
                      key={day.toString()}
                      dateStr={dateStr}
                      isCurrentMonth={isCurrentMonth}
                      hasHighlight={hasHighlight}
                      isInventoryCritical={isInventoryCritical}
                      isDischargeOverflow={isDischargeOverflow}
                      isTodayDay={isTodayDay}
                      dayArrivals={dayArrivals}
                      searchImpo={searchImpo}
                      openModal={openModal}
                      dayNum={dayNum}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* MODAL */}
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[1200px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black text-gray-800">
                    {format(selectedDate, 'dd MMMM yyyy', { locale: es })}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">Gestión detallada de arribos y citas</p>
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
                  <div className="flex flex-col gap-4">
                    {modalRows.map((row, idx) => {
                      const coef = coeficienteMap[row.modelo?.toUpperCase()] ?? 1.0;
                      const load = (row.cantidad || 0) * coef;
                      const dest = row.destino?.toUpperCase() || 'OTROS';
                      const limite = limiteMap[dest];
                      const destLoad = modalDischargeByDestino[dest] || 0;
                      const exceeded = limite !== null && limite !== undefined && destLoad > limite;

                      const citaCount = Math.max(1, Math.ceil(row.cantidad || 0));

                      return (
                        <div key={row.id || idx} className={`border rounded-xl p-4 transition ${exceeded ? 'bg-red-50/40 border-red-200' : 'bg-white border-gray-200 hover:shadow-md'}`}>
                          <div className="flex flex-wrap md:flex-nowrap gap-3 items-end">
                            {/* IMPO */}
                            <div className="w-full md:w-1/6">
                              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">IMPO</label>
                              <input
                                type="text"
                                className="w-full border border-gray-300 bg-white p-2 text-sm font-semibold rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none"
                                value={row.impo}
                                onChange={e => updateModalRow(idx, 'impo', e.target.value)}
                                placeholder="8930"
                              />
                            </div>
                            {/* MODELO - Made wider */}
                            <div className="w-full md:w-1/4">
                              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Modelo</label>
                              <select
                                className="w-full border border-gray-300 p-2 text-sm rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none bg-white font-mono"
                                value={row.modelo}
                                onChange={e => updateModalRow(idx, 'modelo', e.target.value)}
                              >
                                {modelos.length === 0 && <option value="">Sin modelos configurados</option>}
                                {modelos.map(m => (
                                  <option key={m.id} value={m.modelo}>{m.modelo}</option>
                                ))}
                              </select>
                            </div>
                            {/* CANTIDAD */}
                            <div className="w-full md:w-[12%]">
                              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Cant.</label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                className="w-full border border-gray-300 p-2 text-sm rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono text-center"
                                value={row.cantidad}
                                onChange={e => updateModalRow(idx, 'cantidad', e.target.value)}
                              />
                            </div>
                            {/* DESTINO */}
                            <div className="w-full md:w-[15%]">
                              <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Destino</label>
                              <select
                                className="w-full border border-gray-300 p-2 text-sm rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none bg-white font-semibold"
                                value={row.destino}
                                onChange={e => updateModalRow(idx, 'destino', e.target.value)}
                              >
                                {sedeConfig.destinos.map(d => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                            {/* CITAS - Dynamically rendered */}
                            <div className="w-full md:w-[20%] flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Horas de Cita ({citaCount})</label>
                                <div className="flex gap-1 overflow-x-auto pb-1 min-w-0 no-scrollbar">
                                    {(row.citas || []).map((citaTime, cIdx) => (
                                        <select
                                            key={cIdx}
                                            className="border border-gray-300 p-2 text-sm rounded-lg focus:ring-2 focus:ring-sunset-amber focus:outline-none bg-white flex-shrink-0 cursor-pointer w-24 text-center appearance-none font-semibold shadow-sm hover:border-gray-400 transition"
                                            value={citaTime?.substring(0, 5) || "08:00"}
                                            onChange={e => updateCita(idx, cIdx, e.target.value)}
                                        >
                                            {TIME_SLOTS.map(slot => (
                                                <option key={slot} value={slot}>{slot}</option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                            </div>
                            {/* DELETE BTN */}
                            <div className="ml-auto flex items-center justify-center pb-1">
                                <button onClick={() => removeModalRow(idx)} className="text-red-400 hover:text-red-600 p-2 border border-transparent rounded-lg hover:bg-red-50 hover:border-red-200 transition">
                                  <Trash2 size={18} />
                                </button>
                            </div>
                          </div>
                          
                          {/* Second line: Observaciones y Coeficiente */}
                          <div className="flex gap-4 mt-2">
                            <div className="flex-1">
                                <input
                                  type="text"
                                  className="w-full border-b border-dashed border-gray-300 bg-transparent py-1 text-sm text-gray-600 focus:outline-none focus:border-sunset-amber"
                                  value={row.observaciones}
                                  onChange={e => updateModalRow(idx, 'observaciones', e.target.value)}
                                  placeholder="Escribe aquí las novedades u observaciones del viaje..."
                                />
                            </div>
                            <div className="flex items-center gap-2 px-2 shrink-0">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Coef:</span>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${exceeded ? 'text-red-700 bg-red-100' : 'text-gray-600 bg-gray-100'}`}>
                                  {load.toFixed(1)}
                                </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {modalRows.length > 0 && (
                  <button onClick={addModalRow} className="mt-6 flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-sunset-amber transition py-2 px-4 border border-dashed rounded-xl hover:bg-gray-50 w-full justify-center">
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

        {/* Cargue Rapido Modal */}
        {showCargueRapido && (
           <CargueRapido 
              sede={sede}
              onClose={() => setShowCargueRapido(false)}
              onSuccess={() => {
                  fetchMonthData(currentDate);
              }}
           />
        )}

        {/* Export Modal */}
        {showExportModal && (
           <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm">
             <div className={`bg-white w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${reportData ? 'max-w-5xl' : 'max-w-md p-6'}`}>
                {reportData === null ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800"><Download size={20} className="text-blue-600"/> Generar Reporte</h3>
                      <button onClick={() => setShowExportModal(false)} className="p-1 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
                    </div>
                    
                    <div className="flex flex-col gap-4 mb-6 text-charcoal-black">
                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Fecha Inicio</label>
                         <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"/>
                       </div>
                       <div>
                         <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Fecha Fin</label>
                         <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"/>
                       </div>
                    </div>
                    
                    <div className="flex justify-end gap-3 border-t pt-4">
                       <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                       <button onClick={handleExport} disabled={exporting} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50">
                         {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Generar Tabla
                       </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">Reporte de Arribos</h3>
                        <p className="text-sm text-gray-500">Selecciona el contenido de la tabla inferior y cópiala a tu portapapeles.</p>
                      </div>
                      <button onClick={() => setShowExportModal(false)} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition"><X size={20} /></button>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto">
                        <table className="w-full text-sm text-left border">
                            <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                                <tr>
                                    <th className="p-2 border">Fecha</th>
                                    <th className="p-2 border">Hora Cita</th>
                                    <th className="p-2 border">IMPO</th>
                                    <th className="p-2 border">Modelo</th>
                                    <th className="p-2 border">Cantidad</th>
                                    <th className="p-2 border">Destino</th>
                                    <th className="p-2 border">Novedades</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.length === 0 ? (
                                    <tr><td colSpan={7} className="p-4 text-center text-gray-500">No hay arribos en el rango seleccionado.</td></tr>
                                ) : (
                                    reportData.map((row) => {
                                        const citasArray = row.arribos_citas?.map((c: any) => c.hora_cita.substring(0,5)) || [];
                                        const horasText = citasArray.join(' | ') || 'Sin Asignar';
                                        return (
                                            <tr key={row.id} className="hover:bg-gray-50 border-b">
                                                <td className="p-2 border text-gray-600 font-mono whitespace-nowrap">{row.fecha_eta}</td>
                                                <td className="p-2 border font-mono">{horasText}</td>
                                                <td className="p-2 border font-bold text-gray-700">{row.impo}</td>
                                                <td className="p-2 border text-xs">{row.modelo}</td>
                                                <td className="p-2 border text-center font-bold bg-gray-50">{row.cantidad}</td>
                                                <td className="p-2 border">{row.destino}</td>
                                                <td className="p-2 border text-xs text-gray-500">{row.observaciones}</td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t bg-white flex justify-between items-center rounded-b-2xl">
                      <p className="text-xs text-gray-500 font-bold">{reportData.length} registros encontrados.</p>
                      <button onClick={() => setReportData(null)} className="px-5 py-2.5 rounded-xl font-bold bg-charcoal-black text-white hover:bg-gray-800 shadow-md transition">Volver atrás</button>
                    </div>
                  </>
                )}
             </div>
           </div>
        )}
      </div>
    </DndContext>
  );
}
