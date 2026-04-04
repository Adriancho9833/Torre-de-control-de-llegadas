"use client";
import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Save, Loader2, Settings2, MapPin, Package, BarChart3 } from "lucide-react";

interface Modelo {
  id?: string;
  modelo: string;
  coeficiente: number;
  descripcion: string;
  _isNew?: boolean;
}

interface Destino {
  id?: string;
  sede: string;
  destino: string;
  limite_puntos: number | null;
  capacidad_total: number;
  consumo_base_diario: number;
  inventario_actual: number;
}

type Tab = "modelos" | "depositos";

interface SettingsModalProps {
  sede: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SettingsModal({ sede, onClose, onSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("depositos");
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingModeloDeletes, setPendingModeloDeletes] = useState<string[]>([]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/config?sede=${sede}`);
      if (res.ok) {
        const json = await res.json();
        setModelos(json.modelos || []);
        setDestinos(json.destinos || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [sede]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // -- Modelos CRUD --
  const addModelo = () => {
    setModelos([
      ...modelos,
      { id: crypto.randomUUID(), modelo: "", coeficiente: 1.0, descripcion: "", _isNew: true },
    ]);
  };

  const updateModelo = (index: number, field: keyof Modelo, value: any) => {
    const updated = [...modelos];
    updated[index] = { ...updated[index], [field]: value };
    setModelos(updated);
  };

  const removeModelo = (index: number) => {
    const m = modelos[index];
    if (m.id && !m._isNew) {
      setPendingModeloDeletes([...pendingModeloDeletes, m.id]);
    }
    setModelos(modelos.filter((_, i) => i !== index));
  };

  // -- Destinos update --
  const updateDestino = (index: number, field: keyof Destino, value: any) => {
    const updated = [...destinos];
    updated[index] = { ...updated[index], [field]: value };
    setDestinos(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const id of pendingModeloDeletes) {
        await fetch("/api/config", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modeloId: id }),
        });
      }

      const modelosClean = modelos.map(({ _isNew, ...m }) => ({
        ...m,
        coeficiente: parseFloat(String(m.coeficiente)) || 1.0,
      }));

      const destinosClean = destinos.map((d) => ({
        ...d,
        limite_puntos: d.limite_puntos === null || d.limite_puntos === undefined ? null : parseFloat(String(d.limite_puntos)),
        capacidad_total: parseInt(String(d.capacidad_total)) || 0,
        consumo_base_diario: parseInt(String(d.consumo_base_diario)) || 0,
        inventario_actual: parseInt(String(d.inventario_actual)) || 0,
      }));

      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelos: modelosClean, destinos: destinosClean }),
      });

      if (res.ok) {
        setPendingModeloDeletes([]);
        onSaved();
        onClose();
      } else {
        alert("Error al guardar la configuración.");
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const tabClass = (tab: Tab) =>
    `px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === tab ? "bg-charcoal-black text-white shadow-md" : "text-gray-500 hover:bg-gray-100"}`;

  // Totales resumen
  const totalCapacidad = destinos.reduce((s, d) => s + (d.capacidad_total || 0), 0);
  const totalInventario = destinos.reduce((s, d) => s + (d.inventario_actual || 0), 0);
  const totalConsumo = destinos.reduce((s, d) => s + (d.consumo_base_diario || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b bg-gray-50 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Settings2 className="text-sunset-amber" size={24} />
            <div>
              <h3 className="text-xl font-black text-gray-800">Configuración General</h3>
              <p className="text-xs text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> Sede activa: <span className="font-bold text-gray-700">{sede}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 flex gap-2 border-b pb-4 bg-white">
          <button className={tabClass("depositos")} onClick={() => setActiveTab("depositos")}>
            🏭 Depósitos y Capacidades
          </button>
          <button className={tabClass("modelos")} onClick={() => setActiveTab("modelos")}>
            📦 Modelos y Coeficientes
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-sunset-amber" size={32} />
            </div>
          ) : (
            <>
              {/* TAB: DEPOSITOS */}
              {activeTab === "depositos" && (
                <div>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                      <div className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                        <BarChart3 size={12} /> Capacidad Total
                      </div>
                      <div className="text-2xl font-black text-blue-700">{totalCapacidad}</div>
                      <div className="text-xs text-blue-400">posiciones en {sede.toLowerCase()}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <div className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                        <Package size={12} /> Inventario Actual
                      </div>
                      <div className="text-2xl font-black text-amber-700">{totalInventario}</div>
                      <div className="text-xs text-amber-400">contenedores ocupados</div>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                      <div className="text-xs font-semibold text-green-500 uppercase tracking-wider mb-1">Disponibles HOY</div>
                      <div className={`text-2xl font-black ${(totalCapacidad - totalInventario) < 5 ? 'text-red-600' : 'text-green-700'}`}>
                        {totalCapacidad - totalInventario}
                      </div>
                      <div className="text-xs text-green-400">posiciones libres</div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-4">
                    Configura la capacidad máxima, inventario actual y consumo diario de cada depósito de <strong>{sede}</strong>. El límite de descargue es la máxima carga de coeficientes por día.
                  </p>

                  <div className="space-y-4">
                    {destinos.map((d, idx) => {
                      const disponibles = (d.capacidad_total || 0) - (d.inventario_actual || 0);
                      const pct = d.capacidad_total > 0 ? Math.min(100, Math.round(((d.inventario_actual || 0) / d.capacidad_total) * 100)) : 0;
                      const isOverfull = disponibles < 0;

                      return (
                        <div key={d.id || idx} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-white transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-black text-gray-800 text-base">{d.destino}</h4>
                            <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${isOverfull ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                              {isOverfull ? '⚠ Excedido' : `${disponibles} libres`}
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
                            <div
                              className={`h-1.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Cap. Máxima</label>
                              <input
                                type="number" min="0"
                                value={d.capacidad_total}
                                onChange={e => updateDestino(idx, 'capacidad_total', parseInt(e.target.value) || 0)}
                                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono text-center text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Inventario Actual</label>
                              <input
                                type="number" min="0"
                                value={d.inventario_actual}
                                onChange={e => updateDestino(idx, 'inventario_actual', parseInt(e.target.value) || 0)}
                                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono text-center text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Consumo / día</label>
                              <input
                                type="number" min="0"
                                value={d.consumo_base_diario}
                                onChange={e => updateDestino(idx, 'consumo_base_diario', parseInt(e.target.value) || 0)}
                                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono text-center text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Límite Descargue</label>
                              <input
                                type="number" min="0" step="0.5"
                                value={d.limite_puntos ?? ""}
                                onChange={e => updateDestino(idx, 'limite_puntos', e.target.value === "" ? null : parseFloat(e.target.value))}
                                placeholder="Sin límite"
                                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono text-center text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-gray-400">
                    <span>💡 Consumo total sede: <strong className="text-gray-600">{totalConsumo} cont/día</strong></span>
                    <span>Al guardar, la proyección del dashboard se actualizará automáticamente.</span>
                  </div>
                </div>
              )}

              {/* TAB: MODELOS */}
              {activeTab === "modelos" && (
                <div>
                  <p className="text-sm text-gray-500 mb-4">
                    Define los modelos de contenedor y su coeficiente de descargue. Un coeficiente de <strong>1.0</strong> es la referencia base. El modelo aparece como opción en el calendario.
                  </p>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-gray-100 text-gray-600">
                      <tr>
                        <th className="p-3 rounded-tl-lg w-2/5">Modelo</th>
                        <th className="p-3 w-1/5 text-center">Coeficiente</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3 rounded-tr-lg w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {modelos.map((m, idx) => (
                        <tr key={m.id || idx} className="hover:bg-gray-50">
                          <td className="p-2">
                            <input
                              type="text"
                              value={m.modelo}
                              onChange={(e) => updateModelo(idx, "modelo", e.target.value.toUpperCase())}
                              placeholder="Ej: AGILITY"
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono font-bold uppercase"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number" step="0.1" min="0.1"
                              value={m.coeficiente}
                              onChange={(e) => updateModelo(idx, "coeficiente", e.target.value)}
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none font-mono text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={m.descripcion}
                              onChange={(e) => updateModelo(idx, "descripcion", e.target.value)}
                              placeholder="Descripción opcional..."
                              className="w-full border p-2 rounded focus:ring-2 focus:ring-sunset-amber focus:outline-none"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeModelo(idx)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={addModelo} className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-sunset-amber transition p-2">
                    <Plus size={16} /> Añadir Modelo
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl font-bold bg-charcoal-black text-white hover:bg-gray-800 shadow-md transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
