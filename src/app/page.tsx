"use client";
import { useEffect, useState, useCallback } from "react";
import { HeroStats } from "@/components/dashboard/HeroStats";
import { AutonomyIndicator } from "@/components/dashboard/AutonomyIndicator";
import { ProjectionGraph } from "@/components/dashboard/ProjectionGraph";
import { SmartCalendar } from "@/components/dashboard/SmartCalendar";
import { SettingsModal } from "@/components/dashboard/SettingsModal";
import { ShieldCheck, Settings2, MapPin, Filter, Forklift, Container } from "lucide-react";

type Sede = "ANTIOQUIA" | "CARTAGENA";

const SEDE_INFO: Record<Sede, { label: string; city: string; activeClass: string }> = {
  ANTIOQUIA: {
    label: "Antioquia",
    city: "Medellín",
    activeClass: "bg-emerald-600 text-white shadow-lg shadow-emerald-200",
  },
  CARTAGENA: {
    label: "Cartagena",
    city: "Cartagena",
    activeClass: "bg-blue-600 text-white shadow-lg shadow-blue-200",
  },
};

// Destinos disponibles por sede
const SEDE_DESTINOS: Record<Sede, string[]> = {
  ANTIOQUIA: ["PLANTA", "FABRICATO", "ROSENDAL", "OTROS"],
  CARTAGENA: ["PLANTA", "BODEGA EXTERNA", "OTROS"],
};

export default function Dashboard() {
  const [sede, setSede] = useState<Sede>("ANTIOQUIA");
  const [filterDestino, setFilterDestino] = useState<string>("ALL");
  const [showSettings, setShowSettings] = useState(false);

  const [data, setData] = useState<{
    config: { capacidadTotal: number; consumoDiario: number; constanteTraslados: number } | null;
    inventarioBase: number;
    proyeccion: any[];
    saturadoEn: number;
  }>({
    config: null,
    inventarioBase: 0,
    proyeccion: [],
    saturadoEn: -1,
  });
  const [loading, setLoading] = useState(true);

  const fetchProjection = useCallback(async () => {
    setLoading(true);
    try {
      const destinoParam = filterDestino === "ALL" ? "ALL" : filterDestino;
      const res = await fetch(`/api/proyeccion?sede=${sede}&destino=${destinoParam}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Error al obtener datos:", e);
    }
    setLoading(false);
  }, [sede, filterDestino]);

  useEffect(() => {
    fetchProjection();
  }, [fetchProjection]);

  // Reset filter when sede changes
  useEffect(() => {
    setFilterDestino("ALL");
  }, [sede]);

  const availableToday =
    data.proyeccion.length > 0 ? data.proyeccion[0].positions : undefined;
  const daysLeft = data.saturadoEn !== -1 ? data.saturadoEn : "> 7";
  const sedeInfo = SEDE_INFO[sede];
  const destinos = SEDE_DESTINOS[sede];

  // Label for current filter
  const filterLabel =
    filterDestino === "ALL"
      ? "Todos los depósitos"
      : filterDestino.charAt(0) + filterDestino.slice(1).toLowerCase();

  return (
    <div className="min-h-screen bg-soft-snow text-charcoal-black p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-gray-200/60 mt-4 md:mt-0">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-graphite-gray flex items-center gap-3">
              <div className="flex -space-x-1">
                <Forklift className="text-sunset-amber" size={36} />
                <Container className="text-green-600/90" size={28} style={{ marginTop: 'auto' }} />
              </div>
              SGCR
            </h1>
            <p className="text-sm opacity-70 mt-1 ml-1 font-medium">
              Sistema de gestión de llegada de contenedores
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 font-semibold text-sm hover:bg-gray-50 hover:border-gray-300 transition shadow-sm"
            >
              <Settings2 size={16} />
              <span className="hidden sm:inline">Configuración</span>
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold tracking-wider text-graphite-gray">
                BODEGA CENTRAL
              </div>
              <div className="text-xs font-semibold text-green-600 flex items-center justify-end gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                Operativo
              </div>
            </div>
          </div>
        </header>

        {/* Sede + Depósito Filter Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          {/* Sede Toggle */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <MapPin size={16} />
            <span>Sede:</span>
          </div>
          <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
            {(Object.keys(SEDE_INFO) as Sede[]).map((s) => {
              const info = SEDE_INFO[s];
              const isActive = sede === s;
              return (
                <button
                  key={s}
                  onClick={() => setSede(s)}
                  className={`
                    flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300
                    ${isActive ? info.activeClass : "text-gray-500 hover:bg-white hover:text-gray-700"}
                  `}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-white" : "bg-gray-300"} transition`} />
                  {info.label}
                  <span className={`text-xs font-normal ${isActive ? "opacity-80" : "opacity-0"} transition-opacity`}>
                    — {info.city}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="hidden sm:block w-px h-6 bg-gray-300" />

          {/* Deposit Filter */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
            <Filter size={14} />
            <span>Depósito:</span>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5 flex-wrap">
            <button
              onClick={() => setFilterDestino("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${filterDestino === "ALL" ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
            >
              Todos
            </button>
            {destinos.map((dest) => (
              <button
                key={dest}
                onClick={() => setFilterDestino(dest)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${filterDestino === dest ? getFilterActiveStyle(dest) : "text-gray-500 hover:text-gray-700"}`}
              >
                {dest.charAt(0) + dest.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Filter context label */}
        {filterDestino !== "ALL" && (
          <div className="flex items-center gap-2 -mt-4">
            <span className="text-xs font-semibold text-gray-400">Mostrando proyección para:</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getFilterBadgeStyle(filterDestino)}`}>
              {filterLabel}
            </span>
            <button
              onClick={() => setFilterDestino("ALL")}
              className="text-xs text-gray-400 hover:text-gray-600 underline transition"
            >
              Ver todos
            </button>
          </div>
        )}

        {/* Top Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <HeroStats
              availablePositions={availableToday}
              onUpdate={fetchProjection}
              isLoading={loading}
              filterLabel={filterLabel}
            />
          </div>
          <div className="lg:col-span-2">
            <AutonomyIndicator daysRemaining={daysLeft} isLoading={loading} />
          </div>
        </div>

        {/* Projection Graph - reacts to filter */}
        <div className="grid grid-cols-1 gap-6 pb-2">
          <ProjectionGraph data={data.proyeccion} isLoading={loading} />
        </div>

        {/* Calendar - filter is controlled here, passed down */}
        <div className="pb-12">
          {!loading && (
            <SmartCalendar
              sede={sede}
              capacidadTotal={data.config?.capacidadTotal ?? 0}
              consumoDiario={data.config?.consumoDiario ?? 0}
              constanteTraslados={data.config?.constanteTraslados ?? 0}
              inventarioBase={data.inventarioBase}
              onSuccess={fetchProjection}
              filterDestino={filterDestino}
              onFilterChange={setFilterDestino}
            />
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          sede={sede}
          onClose={() => setShowSettings(false)}
          onSaved={fetchProjection}
        />
      )}
    </div>
  );
}

// ─── Color helpers (duplicated small utility) ──────────────────────────────
function getFilterActiveStyle(dest: string): string {
  const d = dest?.toUpperCase();
  if (d === "PLANTA") return "bg-emerald-100 text-emerald-700 shadow-sm";
  if (d === "FABRICATO") return "bg-blue-100 text-blue-700 shadow-sm";
  if (d === "BODEGA EXTERNA") return "bg-blue-100 text-blue-700 shadow-sm";
  if (d === "ROSENDAL") return "bg-teal-100 text-teal-700 shadow-sm";
  if (d === "OTROS") return "bg-purple-100 text-purple-700 shadow-sm";
  return "bg-white shadow-sm";
}

function getFilterBadgeStyle(dest: string): string {
  const d = dest?.toUpperCase();
  if (d === "PLANTA") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (d === "FABRICATO") return "bg-blue-100 text-blue-700 border border-blue-200";
  if (d === "BODEGA EXTERNA") return "bg-blue-100 text-blue-700 border border-blue-200";
  if (d === "ROSENDAL") return "bg-teal-100 text-teal-700 border border-teal-200";
  if (d === "OTROS") return "bg-purple-100 text-purple-700 border border-purple-200";
  return "bg-gray-100 text-gray-700 border border-gray-200";
}
