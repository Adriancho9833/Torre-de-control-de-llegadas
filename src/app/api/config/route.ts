import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Obtener modelos y destinos de capacidad (ahora con cap, consumo e inventario por depósito) y config global
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sede = searchParams.get('sede') || 'ANTIOQUIA';

    const [modelosRes, destinosRes, configSedeRes] = await Promise.all([
      supabase.from('modelos_coeficientes').select('*').order('modelo', { ascending: true }),
      supabase.from('destinos_capacidad').select('*').eq('sede', sede).order('destino', { ascending: true }),
      supabase.from('configuracion_sedes').select('*').eq('sede', sede).single(),
    ]);

    if (modelosRes.error) throw modelosRes.error;
    if (destinosRes.error) throw destinosRes.error;

    return NextResponse.json({
      modelos: modelosRes.data,
      destinos: destinosRes.data,
      configSede: configSedeRes.data || { constante_traslados: 0 },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Guardar cambios en modelos, destinos y configuracion global
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { modelos, destinos, configSede } = body;

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

    if (configSede && configSede.sede) {
      const { data, error } = await supabase
        .from('configuracion_sedes')
        .upsert([configSede], { onConflict: 'sede' })
        .select();
      if (error) throw error;
      results.configSede = data;
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
