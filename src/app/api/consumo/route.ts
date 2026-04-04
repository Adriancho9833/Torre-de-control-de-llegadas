import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { consumo_base_diario, sede = 'ANTIOQUIA' } = body;

    if (typeof consumo_base_diario !== 'number') {
      return NextResponse.json({ error: 'Falta consumo_base_diario' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('configuracion_sedes')
      .update({ consumo_base_diario })
      .eq('sede', sede)
      .select()
      .single();

    if (error) {
      // Si no existe la fila, la creamos
      const { data: insertData, error: insertError } = await supabase
        .from('configuracion_sedes')
        .insert([{ sede, consumo_base_diario, capacidad_total: 41 }])
        .select()
        .single();
      if (insertError) throw insertError;
      return NextResponse.json(insertData);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
