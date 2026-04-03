import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addDays, format, differenceInDays } from 'date-fns';

export async function GET() {
  try {
    // 1. Obtener configuración
    const { data: configRow } = await supabase.from('configuracion').select('*').limit(1).single();
    const capacidadTotal = configRow?.capacidad_total || 41;
    const consumoDiario = configRow?.consumo_base_diario || 4;

    // 2. Obtener último inventario real
    const { data: inventarioRows } = await supabase
      .from('registro_ocupacion')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(1);
    
    let inventarioBase = 0;
    let fechaBase = new Date(); // Hoy

    if (inventarioRows && inventarioRows.length > 0) {
      inventarioBase = inventarioRows[0].cantidad_fisica_real;
      fechaBase = new Date(inventarioRows[0].fecha + 'T12:00:00Z'); // Evitar timezone bugs
    }

    // 3. Obtener arribos desde la tabla de calendario
    const fechaInicioStr = format(fechaBase, 'yyyy-MM-dd');
    const { data: arribos } = await supabase
      .from('arribos_calendario')
      .select('fecha_eta, cantidad')
      .gte('fecha_eta', fechaInicioStr);

    // Agrupar arribos por fecha
    const arriboPorFecha: Record<string, number> = {};
    if (arribos) {
      arribos.forEach(row => {
        const d = row.fecha_eta;
        arriboPorFecha[d] = (arriboPorFecha[d] || 0) + (row.cantidad || 0);
      });
    }

    // 4. Calcular proyección (Hoy + 25 días)
    const proyeccion = [];
    const HOY = new Date();
    
    let inventarioAcumulado = inventarioBase;
    
    for (let i = 0; i < 25; i++) {
        const currentDate = addDays(HOY, i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        // El consumo aplica desde el día 1 en delante o día actual si es diferente a la fecha base.
        // Simularemos un cálculo directo por iteración:
        // Nuevo Inventario = Inventario Anterior + Arribos Hoy - Consumo Diario
        const arribosDia = arriboPorFecha[dateStr] || 0;
        
        if (i > 0) {
            inventarioAcumulado = inventarioAcumulado + arribosDia - consumoDiario;
        } else {
            // El inventario base ya contiene su estado, solo sumamos arrivos no contemplados de hoy si aplicara, 
            // pero para simplificar, el día 0 es el base.
            inventarioAcumulado = inventarioBase;
        }

        if(inventarioAcumulado < 0) inventarioAcumulado = 0; // No podemos tener inventario negativo

        const ubicacionesDisponibles = capacidadTotal - inventarioAcumulado;

        proyeccion.push({
            date: format(currentDate, 'dd/MM'),
            fullDate: dateStr,
            positions: ubicacionesDisponibles,
            inventario: inventarioAcumulado,
            arribos: arribosDia
        });
    }

    return NextResponse.json({
        config: { capacidadTotal, consumoDiario },
        inventarioBase,
        proyeccion,
        saturadoEn: proyeccion.findIndex(p => p.positions < 7)
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
