-- ==============================================================================
-- SQL MIGRATION : AJOUT DE LA TABLE DES ÉCHÉANCES (DEADLINES)
-- Cible: Supabase PostgreSQL Database (Module de gestion de trésorerie)
-- ==============================================================================

-- 1. Création de la table des échéances
CREATE TABLE IF NOT EXISTS public.deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    amount NUMERIC(10,3) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Contrainte logique pour s'assurer que l'échéance vise SOIT un client SOIT un fournisseur
    CONSTRAINT deadline_target_check CHECK (
        (client_id IS NOT NULL AND supplier_id IS NULL) OR 
        (client_id IS NULL AND supplier_id IS NOT NULL)
    )
);

-- 2. Activation de la sécurité au niveau des lignes (RLS)
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

-- Suppression préventive de politique pour éviter les doublons
DROP POLICY IF EXISTS "Users can manage their own deadlines" ON public.deadlines;

-- 3. Politique RLS pour permettre aux utilisateurs authentifiés de gérer leurs propres échéances
CREATE POLICY "Users can manage their own deadlines" 
ON public.deadlines 
FOR ALL 
TO authenticated 
USING (profile_id = auth.uid()) 
WITH CHECK (profile_id = auth.uid());

-- 4. Création d'index pour optimiser les requêtes de recherche et de tri
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON public.deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON public.deadlines(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_client ON public.deadlines(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deadlines_supplier ON public.deadlines(supplier_id) WHERE supplier_id IS NOT NULL;
