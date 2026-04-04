import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Obtener modelos y destinos de capacidad (ahora con cap, consumo e inventario por depósito)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sede = searchParams.get('sede') || 'ANTIOQUIA';

    const [modelosRes, destinosRes] = await Promise.all([
      supabase.from('modelos_coeficientes').select('*').order('modelo', { ascending: true }),
      supabase.from('destinos_capacidad').select('*').eq('sede', sede).order('destino', { ascending: true }),
    ]);

    if (modelosRes.error) throw modelosRes.error;
    if (destinosRes.error) throw destinosRes.error;

    return NextResponse.json({
      modelos: modelosRes.data,
      destinos: destinosRes.data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Guardar cambios en modelos y destinos (incluyendo cap, consumo e inventario)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { modelos, destinos } = body;

    const results: any = {};

    if (modelos && Array.isArray(modelos)) {
      const { data, error } = await supabase
        .from('modelos_coeficientes')
        .upsert(modelos, { onConflict: 'id' })
        .select();
      if (error) throw error;
      results.modelos = data;
    }

    if (destinos && Array.isArray(destinos)) {
      const { data, error } = await supabase
        .from('destinos_capacidad')
        .upsert(destinos, { onConflict: 'id' })
        .select();
      if (error) throw error;
      results.destinos = data;
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Eliminar un modelo por ID
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { modeloId } = body;

    if (!modeloId) {
      return NextResponse.json({ error: 'modeloId requerido' }, { status: 400 });
    }

    const { error } = await supabase
      .from('modelos_coeficientes')
      .delete()
      .eq('id', modeloId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
