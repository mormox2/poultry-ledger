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
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

