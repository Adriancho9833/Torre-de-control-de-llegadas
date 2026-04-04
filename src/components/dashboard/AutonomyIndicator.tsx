import { ShieldAlert, ShieldCheck } from "lucide-react";

export function AutonomyIndicator({ daysRemaining, isLoading }: { daysRemaining?: number | string, isLoading?: boolean }) {
  const isCritical = typeof daysRemaining === 'number' && daysRemaining >= 0;
  
  return (
    <div className={`rounded-xl p-6 shadow-md border flex flex-col justify-center h-full transition-colors ${isCritical ? 'bg-sunset-amber/10 border-sunset-amber text-sunset-amber' : 'bg-white border-gray-200 text-charcoal-black'}`}>
      <div className="flex items-center gap-4">
        <div className={`p-4 rounded-full flex-shrink-0 ${isCritical ? 'bg-sunset-amber/20' : 'bg-gray-100 text-green-600'}`}>
          {isCritical ? <ShieldAlert size={32} /> : <ShieldCheck size={32} />}
        </div>
        <div>
          <h3 className="text-lg font-semibold opacity-80">Estado de Capacidad</h3>
          <div className="text-2xl mt-1 font-bold">
            {isLoading ? "..." : (
               isCritical 
                ? `¡Crítico en ${daysRemaining} días!`
                : "Espacio Holgado"
            )}
          </div>
        </div>
      </div>
      <p className="text-sm mt-3 opacity-90 font-medium">
         {isCritical ? `Cuidado: Tendremos menos de 2 espacios disponibles en ${daysRemaining} días.` : "Sin riesgo inminente de saturación crítica (~25 días)."}
      </p>
    </div>
  );
}
