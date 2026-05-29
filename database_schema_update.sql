-- ==============================================================================
-- SQL MIGRATION : ARCHITECTURAL & PERFORMANCE ENHANCEMENTS (DEADLINES & INDEXING)
-- Target: Supabase PostgreSQL Database (Dawajin Pro)
-- Author: Tech Lead / Antigravity AI
-- ==============================================================================

-- 1. Automating updated_at triggers side-server
-- Function that automatically updates updated_at column to NOW() on change
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create Deadlines Table (If not exists)
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Constraint: either client_id or supplier_id, not both
    CONSTRAINT deadline_target_check CHECK (
        (client_id IS NOT NULL AND supplier_id IS NULL) OR 
        (client_id IS NULL AND supplier_id IS NOT NULL)
    )
);

-- Enable RLS on deadlines
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

-- Recreate policy
DROP POLICY IF EXISTS "Users can manage their own deadlines" ON public.deadlines;
CREATE POLICY "Users can manage their own deadlines" 
    ON public.deadlines 
    FOR ALL 
    TO authenticated 
    USING (profile_id = auth.uid()) 
    WITH CHECK (profile_id = auth.uid());

-- 3. Registering Auto-Modification triggers
-- For profiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- For ledger_entries
DROP TRIGGER IF EXISTS set_ledger_entries_updated_at ON public.ledger_entries;
CREATE TRIGGER set_ledger_entries_updated_at 
    BEFORE UPDATE ON public.ledger_entries 
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- For purchases
DROP TRIGGER IF EXISTS set_purchases_updated_at ON public.purchases;
CREATE TRIGGER set_purchases_updated_at 
    BEFORE UPDATE ON public.purchases 
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- For deadlines
DROP TRIGGER IF EXISTS set_deadlines_updated_at ON public.deadlines;
CREATE TRIGGER set_deadlines_updated_at 
    BEFORE UPDATE ON public.deadlines 
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- 4. High-Performance Indexing on Foreign Keys (FK) & Search Criteria
-- Eliminates sequential scan search penalty during cascades and joins

-- FK Indexes
CREATE INDEX IF NOT EXISTS idx_clients_profile_id ON public.clients(profile_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_profile_id ON public.suppliers(profile_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_client_id ON public.ledger_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_profile_id ON public.deadlines(profile_id);

-- Deadlines performance queries indexes
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON public.deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON public.deadlines(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_client_id ON public.deadlines(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deadlines_supplier_id ON public.deadlines(supplier_id) WHERE supplier_id IS NOT NULL;
