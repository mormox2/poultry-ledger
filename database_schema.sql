-- =====================================================================
-- DATABASE SCHEMA FOR DAWAJIN PRO (الودرني للدواجن)
-- RUN THIS SCRIPT IN THE SUPABASE SQL EDITOR
-- =====================================================================

-- 1. Create Profiles Table (Stores user company settings)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT DEFAULT 'الودرني للدواجن' NOT NULL,
    company_address TEXT DEFAULT 'وادي النور الحامة,قابس',
    company_phone TEXT DEFAULT '96 101 651',
    company_tax_id TEXT DEFAULT '1895235/E',
    price_per_kg NUMERIC(6,3) DEFAULT 5.800 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile."
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile."
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 2. Create Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT DEFAULT '—',
    phone TEXT DEFAULT '—',
    tax_id TEXT DEFAULT '-',
    notes TEXT DEFAULT NULL,
    color INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients."
    ON public.clients FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own clients."
    ON public.clients FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own clients."
    ON public.clients FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own clients."
    ON public.clients FOR DELETE
    USING (auth.uid() = profile_id);

-- 3. Create Ledger Entries Table (Daily weights registry)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    total_weight NUMERIC(8,3) DEFAULT NULL,
    net_weight NUMERIC(8,3) DEFAULT NULL,
    price NUMERIC(6,3) DEFAULT NULL,
    amount NUMERIC(10,3) DEFAULT NULL,
    paid NUMERIC(10,3) DEFAULT NULL,
    holiday BOOLEAN DEFAULT false NOT NULL,
    notes TEXT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure unique daily record per client
    CONSTRAINT unique_daily_entry_per_client UNIQUE(client_id, year, month, day)
);

-- Enable RLS on ledger_entries
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ledger entries of their own clients."
    ON public.ledger_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert ledger entries of their own clients."
    ON public.ledger_entries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can update ledger entries of their own clients."
    ON public.ledger_entries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete ledger entries of their own clients."
    ON public.ledger_entries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = auth.uid()
        )
    );

-- 4. Trigger to automatically create a profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public, pg_catalog -- Explicitly set search path for safety and system operator compatibility
AS $$
BEGIN
    INSERT INTO public.profiles (id, company_name, company_address, company_phone, company_tax_id, price_per_kg)
    VALUES (
        new.id,
        'الودرني للدواجن',
        'وادي النور الحامة,قابس ',
        '96 101 651',
        '1895235/E',
        5.800
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to make sure supabase auth system can run the function successfully
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_auth_admin;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 5. Create Suppliers Table
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT DEFAULT '—',
    phone TEXT DEFAULT '—',
    tax_id TEXT DEFAULT '-',
    notes TEXT DEFAULT NULL,
    color INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suppliers."
    ON public.suppliers FOR SELECT
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert their own suppliers."
    ON public.suppliers FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update their own suppliers."
    ON public.suppliers FOR UPDATE
    USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own suppliers."
    ON public.suppliers FOR DELETE
    USING (auth.uid() = profile_id);

-- =====================================================================
-- 6. Create Purchases Table (Daily purchases registry)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    total_weight NUMERIC(8,3) DEFAULT NULL,
    net_weight NUMERIC(8,3) DEFAULT NULL,
    price NUMERIC(6,3) DEFAULT NULL,
    amount NUMERIC(10,3) DEFAULT NULL,
    paid NUMERIC(10,3) DEFAULT NULL,
    holiday BOOLEAN DEFAULT false NOT NULL,
    notes TEXT DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure unique daily record per supplier
    CONSTRAINT unique_daily_purchase_per_supplier UNIQUE(supplier_id, year, month, day)
);

-- Enable RLS on purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchases of their own suppliers."
    ON public.purchases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert purchases of their own suppliers."
    ON public.purchases FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can update purchases of their own suppliers."
    ON public.purchases FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete purchases of their own suppliers."
    ON public.purchases FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = auth.uid()
        )
    );

-- =====================================================================
-- 7. Create Deadlines Table (Payment deadlines/dues management)
-- =====================================================================
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
    
    -- Ensure either client_id or supplier_id is filled, but not both
    CONSTRAINT deadline_target_check CHECK (
        (client_id IS NOT NULL AND supplier_id IS NULL) OR 
        (client_id IS NULL AND supplier_id IS NOT NULL)
    )
);

-- Enable RLS on deadlines
ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own deadlines" 
    ON public.deadlines 
    FOR ALL 
    TO authenticated 
    USING (profile_id = auth.uid()) 
    WITH CHECK (profile_id = auth.uid());

-- =====================================================================
-- 8. Server-Side Automated Trigger Functions & Performance Indexes
-- =====================================================================

-- Trigger Function for updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach BEFORE UPDATE triggers
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER set_ledger_entries_updated_at BEFORE UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER set_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
CREATE TRIGGER set_deadlines_updated_at BEFORE UPDATE ON public.deadlines FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

-- Foreign Key (FK) Indexes
CREATE INDEX IF NOT EXISTS idx_clients_profile_id ON public.clients(profile_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_profile_id ON public.suppliers(profile_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_client_id ON public.ledger_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_profile_id ON public.deadlines(profile_id);

-- Deadlines Indexes
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON public.deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON public.deadlines(status);
CREATE INDEX IF NOT EXISTS idx_deadlines_client_id ON public.deadlines(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deadlines_supplier_id ON public.deadlines(supplier_id) WHERE supplier_id IS NOT NULL;



