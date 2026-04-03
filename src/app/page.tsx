"use client";
import { useEffect, useState, useCallback } from "react";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { AutonomyIndicator } from "@/components/dashboard/AutonomyIndicator";
import { DailyConsumptionForm } from "@/components/dashboard/DailyConsumptionForm";
import { ProjectionGraph } from "@/components/dashboard/ProjectionGraph";
import { SmartCalendar } from "@/components/dashboard/SmartCalendar";
import { ShieldCheck } from "lucide-react";

export default function Dashboard() {
  const [data, setData] = useState<{
    config: { capacidadTotal: number, consumoDiario: number } | null,
    inventarioBase: number,
    proyeccion: any[],
    saturadoEn: number
  }>({
    config: null,
    inventarioBase: 0,
    proyeccion: [],
    saturadoEn: -1
  });
  const [loading, setLoading] = useState(true);

  const fetchProjection = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proyeccion');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Error al obtener datos:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjection();
  }, [fetchProjection]);

  // Derived Values
  const availableToday = data.proyeccion.length > 0 ? data.proyeccion[0].positions : undefined;
  const daysLeft = data.saturadoEn !== -1 ? data.saturadoEn : "> 7";

  return (
    <div className="min-h-screen bg-soft-snow text-charcoal-black p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-gray-200/60 mt-4 md:mt-0">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-graphite-gray flex items-center gap-3">
              <ShieldCheck className="text-sunset-amber" size={38} />
              SGCR
            </h1>
            <p className="text-sm opacity-70 mt-1 ml-1 font-medium">Sistema de Gestión de Capacidad de Recibo</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold tracking-wider text-graphite-gray">BODEGA CENTRAL</div>
            <div className="text-xs font-semibold text-green-600 flex items-center justify-end gap-1 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse"></span>
              Operativo
            </div>
          </div>
        </header>

        {/* Top Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <HeroStats availablePositions={availableToday} onUpdate={fetchProjection} isLoading={loading} />
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AutonomyIndicator daysRemaining={daysLeft} isLoading={loading} />
            <DailyConsumptionForm 
              initialRate={data.config?.consumoDiario} 
              onUpdate={fetchProjection} 
              isLoading={loading} 
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 pb-6">
          <div className="col-span-1">
            <ProjectionGraph data={data.proyeccion} isLoading={loading} />
          </div>
        </div>

        {/* Calendar Area - Full Width */}
        <div className="pb-12">
          {data.config && !loading && (
            <SmartCalendar 
              capacidadTotal={data.config.capacidadTotal}
              consumoDiario={data.config.consumoDiario}
              inventarioBase={data.inventarioBase}
              onSuccess={fetchProjection}
            />
          )}
        </div>
      </div>
    </div>
  );
}
