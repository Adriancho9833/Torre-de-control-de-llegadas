import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return NextResponse.json({ capacidad_total: 41, consumo_base_diario: 4 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { consumo_base_diario } = body;

    if (typeof consumo_base_diario !== 'number') {
      return NextResponse.json({ error: 'Falta consumo_base_diario' }, { status: 400 });
    }

    const { data: configRows } = await supabase.from('configuracion').select('id').limit(1);

    if (!configRows || configRows.length === 0) {
      const { data, error } = await supabase
        .from('configuracion')
        .insert([{ capacidad_total: 41, consumo_base_diario }])
        .select();
      if (error) throw error;
      return NextResponse.json(data[0]);
    } else {
      const id = configRows[0].id;
      const { data, error } = await supabase
        .from('configuracion')
        .update({ consumo_base_diario })
        .eq('id', id)
        .select();
      if (error) throw error;
      return NextResponse.json(data[0]);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
