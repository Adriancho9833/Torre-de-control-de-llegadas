import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { ubicaciones_disponibles } = await request.json();
    
    // Obtener la capacidad total actual
    const { data: config } = await supabase.from('configuracion').select('capacidad_total').limit(1).single();
    const capacidadTotal = config?.capacidad_total || 41;

    // Calcular el inventario equivalente
    let inventarioReal = capacidadTotal - ubicaciones_disponibles;
    if (inventarioReal < 0) inventarioReal = 0;

    const fechaHoy = format(new Date(), 'yyyy-MM-dd');
    
    // Buscar si ya existe la fecha de hoy para hacer update o insert
    const { data: existente } = await supabase.from('registro_ocupacion').select('id').eq('fecha', fechaHoy).limit(1).single();

    if (existente) {
        await supabase.from('registro_ocupacion').update({ cantidad_fisica_real: inventarioReal }).eq('id', existente.id);
    } else {
        await supabase.from('registro_ocupacion').insert([{ fecha: fechaHoy, cantidad_fisica_real: inventarioReal }]);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
