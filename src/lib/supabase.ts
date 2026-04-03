import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Faltan las variables de entorno de Supabase.')
}

// Cliente público estándar
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder')

// Cliente con service role para validaciones de servidor o funciones autorizadas (Admin)
// Cuidado: Este cliente NUNCA debe ser exportado hacia componentes de cliente (React).
export const getServiceSupabase = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL as string, 
        process.env.SUPABASE_SERVICE_ROLE_KEY as string
    )
}
