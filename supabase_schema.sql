-- Ejecuta esto en el SQL Editor de tu consola Supabase

CREATE TABLE public.configuracion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    capacidad_total INT NOT NULL DEFAULT 41,
    consumo_base_diario INT NOT NULL DEFAULT 4
);

-- Configuración inicial
INSERT INTO public.configuracion (capacidad_total, consumo_base_diario) VALUES (41, 4);

-- Tabla principal de arribos (Layout Calendar)
DROP TABLE IF EXISTS public.plan_maestro;
DROP TABLE IF EXISTS public.plan_recibo;

CREATE TABLE public.arribos_calendario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_eta DATE NOT NULL,
    impo VARCHAR(100) NOT NULL,
    modelo VARCHAR(150),
    destino VARCHAR(100),
    cantidad INT DEFAULT 0,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para excepciones del calendario logístico
CREATE TABLE public.calendario_operativo (
    fecha DATE PRIMARY KEY,
    es_laborable BOOLEAN DEFAULT true,
    capacidad_override INT -- NULL si aplica la capacidad diaria normal de facturación
);

CREATE TABLE public.registro_ocupacion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha DATE NOT NULL,
    cantidad_fisica_real INT NOT NULL
);

-- Insertamos un inventario actual (hoy) para la prueba (Ej: 35)
INSERT INTO public.registro_ocupacion (fecha, cantidad_fisica_real) VALUES (CURRENT_DATE, 35);
