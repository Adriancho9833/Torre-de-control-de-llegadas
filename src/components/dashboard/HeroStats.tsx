"use client";
import { PackageOpen, Edit2, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export function HeroStats({ availablePositions, onUpdate, isLoading }: { availablePositions?: number, onUpdate: () => void, isLoading?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (availablePositions !== undefined && !isEditing) {
      setVal(availablePositions.toString());
    }
  }, [availablePositions, isEditing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/ocupacion', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ubicaciones_disponibles: parseInt(val) || 0 }) 
      });
      setIsEditing(false);
      onUpdate();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div className="bg-graphite-gray text-soft-snow rounded-xl p-6 shadow-lg flex flex-col justify-center relative h-full min-h-[160px] group">
      <div className="absolute -top-6 -right-6 text-charcoal-black opacity-30">
        <PackageOpen size={120} />
      </div>
      
      <div className="z-10 flex justify-between items-start w-full">
         <h2 className="text-xl font-medium tracking-wide opacity-90">Ubicaciones Disponibles</h2>
         {!isEditing && !isLoading && (
            <button onClick={() => setIsEditing(true)} className="opacity-0 group-hover:opacity-100 transition p-1.5 hover:bg-white/10 rounded-lg text-sunset-amber">
               <Edit2 size={16} />
            </button>
         )}
      </div>

      <div className="z-10 mt-1">
        {isEditing ? (
          <div className="flex items-center gap-3">
             <input 
               type="number"
               min="0"
               value={val}
               onChange={(e) => setVal(e.target.value)}
               className="text-5xl font-bold bg-white/10 border border-white/20 rounded-md p-2 outline-none focus:border-sunset-amber w-full max-w-[140px]"
             />
             <button onClick={handleSave} disabled={saving} className="bg-sunset-amber hover:bg-orange-500 text-white p-3 rounded-xl transition">
                {saving ? <Loader2 size={24} className="animate-spin" /> : <Check size={24} />}
             </button>
          </div>
        ) : (
          <div className="text-7xl font-bold tracking-tighter text-sunset-amber drop-shadow-sm">
            {isLoading ? "..." : (availablePositions ?? 0)}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm opacity-70 z-10">{isEditing ? "Define la capacidad del día actual" : "Hoy. Actualízalo si varían tus inventarios."}</p>
    </div>
  );
}
