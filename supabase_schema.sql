-- =====================================================
-- SGCR V2 - Schema completo
-- Ejecutar en el SQL Editor de Supabase (nuevo proyecto)
-- =====================================================

-- Tabla de configuración por sede
CREATE TABLE public.configuracion_sedes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sede VARCHAR(50) NOT NULL UNIQUE,
    capacidad_total INT NOT NULL DEFAULT 41,
    consumo_base_diario INT NOT NULL DEFAULT 4,
    constante_traslados DECIMAL(6, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.configuracion_sedes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_configuracion_sedes" ON public.configuracion_sedes FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.configuracion_sedes (sede, capacidad_total, consumo_base_diario)
VALUES ('ANTIOQUIA', 41, 4), ('CARTAGENA', 30, 3);

-- Tabla de capacidad de descargue y capacidad física por depósito
CREATE TABLE public.destinos_capacidad (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sede VARCHAR(50) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    limite_puntos NUMERIC(6, 2) NULL,
    capacidad_total INT NOT NULL DEFAULT 20,
    consumo_base_diario INT NOT NULL DEFAULT 2,
    inventario_actual INT NOT NULL DEFAULT 0,
    UNIQUE(sede, destino)
);
ALTER TABLE public.destinos_capacidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_destinos_capacidad" ON public.destinos_capacidad FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.destinos_capacidad (sede, destino, limite_puntos, capacidad_total, consumo_base_diario, inventario_actual) VALUES
    ('ANTIOQUIA', 'PLANTA', 5, 15, 2, 10),
    ('ANTIOQUIA', 'FABRICATO', 5, 15, 1, 10),
    ('ANTIOQUIA', 'ROSENDAL', 6, 8, 1, 5),
    ('ANTIOQUIA', 'OTROS', NULL, 5, 0, 0),
    ('CARTAGENA', 'PLANTA', 10, 20, 3, 0),
    ('CARTAGENA', 'BODEGA EXTERNA', 5, 10, 2, 0),
    ('CARTAGENA', 'OTROS', NULL, 5, 0, 0);

-- Tabla de modelos y coeficientes de descargue
CREATE TABLE public.modelos_coeficientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    modelo VARCHAR(150) NOT NULL UNIQUE,
    coeficiente NUMERIC(6, 2) NOT NULL DEFAULT 1.0,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.modelos_coeficientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_modelos_coeficientes" ON public.modelos_coeficientes FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.modelos_coeficientes (modelo, coeficiente, descripcion) VALUES
    ('AGILITY', 1.0, 'Descarga estándar - referencia base'),
    ('BET', 1.4, 'Más complejo, mayor tiempo de descarga');

-- Tabla principal del calendario de arribos
CREATE TABLE public.arribos_calendario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_eta DATE NOT NULL,
    impo VARCHAR(100) NOT NULL,
    modelo VARCHAR(150),
    destino VARCHAR(100),
    cantidad NUMERIC(6, 2) DEFAULT 0,
    observaciones TEXT,
    sede VARCHAR(50) NOT NULL DEFAULT 'ANTIOQUIA',
    categoria VARCHAR(50) NOT NULL DEFAULT 'DE PUERTO' CHECK (categoria IN ('DE PUERTO', 'TRASLADO DE FABRICATO', 'TRASLADO DE ZF')),
    llegado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.arribos_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_arribos_calendario" ON public.arribos_calendario FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_arribos_sede ON public.arribos_calendario(sede);
CREATE INDEX idx_arribos_sede_fecha ON public.arribos_calendario(sede, fecha_eta);

-- Tabla para citas horarias individuales de cada arribo
CREATE TABLE public.arribos_citas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    arribo_id UUID REFERENCES public.arribos_calendario(id) ON DELETE CASCADE,
    hora_cita TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.arribos_citas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_arribos_citas" ON public.arribos_citas FOR ALL USING (true) WITH CHECK (true);

-- Tabla para excepciones del calendario logístico (días feriados / capacidad override)
CREATE TABLE public.calendario_operativo (
    fecha DATE PRIMARY KEY,
    es_laborable BOOLEAN DEFAULT true,
    capacidad_override INT
);
ALTER TABLE public.calendario_operativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_calendario_operativo" ON public.calendario_operativo FOR ALL USING (true) WITH CHECK (true);

-- (Opcional / legacy) Tabla de configuración global original
-- Mantenida por compatibilidad, se puede ignorar en V2
CREATE TABLE public.configuracion (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    capacidad_total INT NOT NULL DEFAULT 41,
    consumo_base_diario INT NOT NULL DEFAULT 4
);
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_configuracion" ON public.configuracion FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.configuracion (capacidad_total, consumo_base_diario) VALUES (41, 4);
