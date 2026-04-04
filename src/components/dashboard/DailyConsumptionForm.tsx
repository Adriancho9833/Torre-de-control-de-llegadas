"use client";
import { useState, useEffect } from "react";
import { Settings2, Loader2 } from "lucide-react";

export function DailyConsumptionForm({ initialRate = 4, onUpdate, isLoading, sede = 'ANTIOQUIA' }: { initialRate?: number, onUpdate: () => void, isLoading?: boolean, sede?: string }) {
  const [rate, setRate] = useState(initialRate);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRate(initialRate);
  }, [initialRate]);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/consumo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumo_base_diario: rate, sede })
      });
      if (res.ok) onUpdate();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col justify-between h-full">
      <div className="flex items-center gap-2 text-charcoal-black mb-4">
        <Settings2 size={20} className="text-sunset-amber" />
        <h3 className="font-semibold text-lg">Consumo Base Diario</h3>
      </div>
      <div className="flex items-end gap-3 mt-auto">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Despachos / día</label>
          <input 
            type="number" 
            value={isLoading ? "" : rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full bg-soft-snow border border-gray-200 rounded-lg p-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-sunset-amber transition-shadow"
            disabled={isLoading || saving}
          />
        </div>
        <button 
          onClick={handleUpdate}
          disabled={isLoading || saving}
          className="bg-charcoal-black hover:bg-graphite-gray text-soft-snow py-3 px-5 rounded-lg font-medium transition-colors h-[54px] min-w-[100px] flex items-center justify-center disabled:opacity-70"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : "Guardar"}
        </button>
      </div>
    </div>
  );
}
