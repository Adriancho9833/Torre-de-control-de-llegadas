import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const sede = searchParams.get('sede') || 'ANTIOQUIA';

    let query = supabase
      .from('arribos_calendario')
      .select('*')
      .eq('sede', sede)
      .order('created_at', { ascending: true });

    if (start && end) {
      query = query.gte('fecha_eta', start).lte('fecha_eta', end);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { upserts, deletes } = body;

    // Ejecutar borrados si existen
    if (deletes && Array.isArray(deletes) && deletes.length > 0) {
      const { error: delError } = await supabase
        .from('arribos_calendario')
        .delete()
        .in('id', deletes);
      if (delError) throw delError;
    }

    // Ejecutar inserts / updates
    if (upserts && Array.isArray(upserts) && upserts.length > 0) {
      const { data, error } = await supabase
        .from('arribos_calendario')
        .upsert(upserts, { onConflict: 'id' })
        .select();

      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error backend arribos_calendario:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
