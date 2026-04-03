"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

export function ProjectionGraph({ data, isLoading }: { data: any[], isLoading?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 h-[450px] flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="text-sunset-amber" size={24} />
        <h2 className="text-xl font-bold text-charcoal-black">Proyección de Capacidad (25 Días)</h2>
      </div>
      
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center opacity-50">
          <Loader2 className="animate-spin text-sunset-amber" size={48} />
        </div>
      ) : (
        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPositions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E59136" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#E59136" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#6B7280' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#6B7280' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold', color: '#131415' }}
                itemStyle={{ color: '#E59136' }}
              />
              <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'top', value: 'Límite de Saturación', fill: '#EF4444', fontSize: 13, fontWeight: 'bold' }} />
              <Area 
                type="monotone" 
                dataKey="positions" 
                name="Disponibilidad"
                stroke="#E59136" 
                strokeWidth={4}
                fillOpacity={1} 
                fill="url(#colorPositions)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#131415' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
