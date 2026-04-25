import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addDays, format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sede = searchParams.get('sede') || 'ANTIOQUIA';
    const destino = searchParams.get('destino') || 'ALL'; // 'ALL' or specific deposit name

    // 1. Get all deposit configurations for this sede
    const { data: depositosConfig, error: configError } = await supabase
      .from('destinos_capacidad')
      .select('*')
      .eq('sede', sede);

    const { data: configSede } = await supabase
      .from('configuracion_sedes')
      .select('constante_traslados')
      .eq('sede', sede)
      .single();

    if (configError) throw configError;
    if (!depositosConfig || depositosConfig.length === 0) {
      return NextResponse.json({ error: 'No hay configuración de depósitos para esta sede.' }, { status: 404 });
    }
    
    const configConstante = parseFloat(configSede?.constante_traslados?.toString() || '0');
    // Aplicar la constante de traslados global solo a PLANTA (y ALL)
    const aplicarConstante = destino === 'ALL' || destino === 'PLANTA';
    const constanteTraslados = aplicarConstante ? configConstante : 0;

    // Filter to relevant deposits
    const depositosFiltrados = destino === 'ALL'
      ? depositosConfig
      : depositosConfig.filter(d => d.destino.toUpperCase() === destino.toUpperCase());

    if (depositosFiltrados.length === 0) {
      return NextResponse.json({ error: `Depósito '${destino}' no encontrado.` }, { status: 404 });
    }

    // Aggregate config values (for ALL: sum capacities, sum consumos, sum inventarios)
    const capacidadTotal = depositosFiltrados.reduce((sum, d) => sum + (d.capacidad_total || 0), 0);
    const consumoDiario = depositosFiltrados.reduce((sum, d) => sum + (d.consumo_base_diario || 0), 0);
    const inventarioBase = depositosFiltrados.reduce((sum, d) => sum + (d.inventario_actual || 0), 0);

    // 2. Get arrivals from calendar for reach date, filtered by sede (and destino if not ALL)
    const HOY = new Date();
    const fechaInicioStr = format(HOY, 'yyyy-MM-dd');

    let arrivalsQuery = supabase
      .from('arribos_calendario')
      .select('fecha_eta, cantidad, destino, categoria')
      .eq('sede', sede)
      .gte('fecha_eta', fechaInicioStr);

    if (destino !== 'ALL') {
      arrivalsQuery = arrivalsQuery.ilike('destino', destino);
    }

    const { data: arribos } = await arrivalsQuery;

    // Group arrivals by date
    const arriboPorFecha: Record<string, number> = {};
    if (arribos) {
      arribos.forEach(row => {
        // Ignorar conteo de traslados para evitar doble conteo
        if (row.categoria === 'TRASLADO DE FABRICATO') return;

        const d = row.fecha_eta;
        arriboPorFecha[d] = (arriboPorFecha[d] || 0) + parseFloat(row.cantidad?.toString() || '0');
      });
    }

    // 3. Calculate 25-day projection
    const proyeccion = [];
    let inventarioAcumulado = inventarioBase;

    for (let i = 0; i < 25; i++) {
      const currentDate = addDays(HOY, i);
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const arribosDia = arriboPorFecha[dateStr] || 0;

      if (i > 0) {
        const dayOfWeek = currentDate.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const consumoHoy = isWeekend ? 0 : consumoDiario;
        const constanteHoy = isWeekend ? 0 : constanteTraslados;
        
        inventarioAcumulado = inventarioAcumulado + arribosDia + constanteHoy - consumoHoy;
      } else {
        // Day 0: start from current real inventory
        inventarioAcumulado = inventarioBase + arribosDia; // Current inventory reflects the start of the day, add today's arrivals
      }

      if (inventarioAcumulado < 0) inventarioAcumulado = 0;
      if (inventarioAcumulado > capacidadTotal) inventarioAcumulado = capacidadTotal;

      // Fix precision issues from decimals
      inventarioAcumulado = parseFloat(inventarioAcumulado.toFixed(2));

      const ubicacionesDisponibles = parseFloat((capacidadTotal - inventarioAcumulado).toFixed(2));

      proyeccion.push({
        date: format(currentDate, 'dd/MM'),
        fullDate: dateStr,
        positions: ubicacionesDisponibles,
        inventario: inventarioAcumulado,
        arribos: arribosDia
      });
    }

    return NextResponse.json({
      config: { capacidadTotal, consumoDiario, constanteTraslados },
      inventarioBase,
      proyeccion,
      saturadoEn: proyeccion.findIndex(p => p.positions < 2),
      depositos: depositosFiltrados // send deposit details to frontend
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
