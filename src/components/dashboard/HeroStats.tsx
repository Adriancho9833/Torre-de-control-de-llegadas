"use client";
import { PackageOpen, Loader2 } from "lucide-react";

export function HeroStats({
  availablePositions,
  onUpdate,
  isLoading,
  filterLabel = "Todos los depósitos",
}: {
  availablePositions?: number;
  onUpdate: () => void;
  isLoading?: boolean;
  filterLabel?: string;
}) {
  const isNegative = typeof availablePositions === "number" && availablePositions < 0;
  const isCritical = typeof availablePositions === "number" && availablePositions <= 1;
  const isTight = typeof availablePositions === "number" && !isCritical && availablePositions <= 5;

  return (
    <div className="bg-graphite-gray text-soft-snow rounded-xl p-6 shadow-lg flex flex-col justify-center relative h-full min-h-[160px] overflow-hidden">
      <div className="absolute -top-6 -right-6 text-charcoal-black opacity-20">
        <PackageOpen size={120} />
      </div>

      <div className="z-10 flex justify-between items-start w-full">
        <h2 className="text-base font-semibold tracking-wide opacity-80">
          Ubicaciones Disponibles
        </h2>
      </div>

      <div className="z-10 mt-1">
        {isLoading ? (
          <div className="flex items-center gap-3 mt-2">
            <Loader2 className="animate-spin text-sunset-amber" size={32} />
          </div>
        ) : (
          <div
            className={`text-7xl font-bold tracking-tighter drop-shadow-sm ${
              isNegative
                ? "text-red-500"
                : isTight
                ? "text-orange-400"
                : "text-sunset-amber"
            }`}
          >
            {availablePositions ?? 0}
          </div>
        )}
      </div>

      <div className="z-10 mt-3 flex flex-col gap-1">
        <p className="text-xs opacity-60 font-medium">
          {filterLabel === "Todos los depósitos"
            ? "Suma de todos los depósitos · Hoy"
            : `Solo: ${filterLabel} · Hoy`}
        </p>
        {isNegative && (
          <p className="text-xs font-bold text-red-300">
            ⚠ Inventario excede la capacidad configurada
          </p>
        )}
        {isCritical && !isNegative && (
          <p className="text-xs font-bold text-red-400">
            ⚠ Críticos (1 o menos disponibles)
          </p>
        )}
        {isTight && (
          <p className="text-xs font-bold text-orange-300">
            ⚠ Un poco justos (2 a 5 disponibles)
          </p>
        )}
        {!isNegative && !isCritical && !isTight && (
          <p className="text-xs font-bold text-green-400">
            ✓ Holgados (Más de 5 disponibles)
          </p>
        )}
      </div>
    </div>
  );
}
