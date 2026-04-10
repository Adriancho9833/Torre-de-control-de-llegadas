import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const sede = searchParams.get('sede') || 'ANTIOQUIA';

    if (!start || !end) {
        return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
    }

    const { data: arribos, error } = await supabase
      .from('arribos_calendario')
      .select('*, arribos_citas(hora_cita)')
      .eq('sede', sede)
      .gte('fecha_eta', start)
      .lte('fecha_eta', end)
      .order('fecha_eta', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Create CSV Header
    let csvContent = "Fecha,Hora Cita,IMPO,Modelo,Cantidad,Destino,Novedades\n";

    if (arribos) {
        arribos.forEach((a: any) => {
            // For those with multiple appointments, we can join them or create multiple rows. 
            // We'll join them by " | " if there are multiple.
            const citasArray = a.arribos_citas?.map((c: any) => c.hora_cita.substring(0,5)) || [];
            const horasText = citasArray.join(' | ') || 'Sin Asignar';
            
            // Clean up text for CSV (quotes)
            const obs = a.observaciones ? `"${a.observaciones.replace(/"/g, '""')}"` : '';
            
            csvContent += `${a.fecha_eta},${horasText},${a.impo},${a.modelo},${a.cantidad},${a.destino},${obs}\n`;
        });
    }

    // Set headers to trigger a file download
    const filename = `Reporte_Arribos_${start}_to_${end}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
