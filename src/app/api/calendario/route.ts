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
      .select('*, arribos_citas(hora_cita)')
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
      // Separar citas del payload de arribos
      const arribosToUpsert = upserts.map((u: any) => {
        const { citas, ...resto } = u;
        return resto;
      });

      const { data, error } = await supabase
        .from('arribos_calendario')
        .upsert(arribosToUpsert, { onConflict: 'id' })
        .select();

      if (error) throw new Error(error.message);

      // Ahora procesamos las citas iterando los upserts originales
      // Eliminar citas viejas y volver a insertarlas para asegurar sincronía
      if (data) {
        const upsertedIds = data.map((d: any) => d.id);
        
        // Solo borrar las citas de los arribos que se actualizaron para reemplazarlas
        await supabase.from('arribos_citas').delete().in('arribo_id', upsertedIds);
        
        const citasToInsert: any[] = [];
        
        // Emparejar por el index o por el ID en caso de ser actualización
        upserts.forEach((u: any, idx: number) => {
          const arribo_id = data[idx].id;
          if (u.citas && Array.isArray(u.citas)) {
             u.citas.forEach((hora: string) => {
                 if(hora) {
                    citasToInsert.push({ arribo_id, hora_cita: hora });
                 }
             });
          }
        });

        if (citasToInsert.length > 0) {
            const { error: citasErr } = await supabase.from('arribos_citas').insert(citasToInsert);
            if(citasErr) console.error("Error guardando citas:", citasErr);
        }
      }

      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error backend arribos_calendario:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
