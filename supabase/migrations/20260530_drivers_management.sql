-- ==============================================================================
-- SQL MIGRATION : SYSTEME MULTI-UTILISATEURS DE GESTION DES CHAUFFEURS (TENANCY)
-- Target: Supabase PostgreSQL Database (Dawajin Pro)
-- Author: Tech Lead / Antigravity AI
-- ==============================================================================

-- Activer l'extension pgcrypto pour le chiffrement des mots de passe (bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ajouter la colonne parent_id et email à public.profiles si elles n'existent pas
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Créer la fonction de résolution du tenant actif de l'entreprise
CREATE OR REPLACE FUNCTION public.get_active_profile_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_parent_id UUID;
BEGIN
    SELECT parent_id INTO v_parent_id 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_parent_id, auth.uid());
END;
$$ LANGUAGE plpgsql;

-- 3. Mettre à jour l'ensemble des règles de sécurité (Row-Level Security)

-- Table: profiles
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile or linked profiles." ON public.profiles;
CREATE POLICY "Users can view their own profile or linked profiles."
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR parent_id = auth.uid() OR id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Table: clients
DROP POLICY IF EXISTS "Users can view their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can view active profile clients." ON public.clients;
CREATE POLICY "Users can view active profile clients."
    ON public.clients FOR SELECT
    USING (profile_id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can insert their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can insert active profile clients." ON public.clients;
CREATE POLICY "Users can insert active profile clients."
    ON public.clients FOR INSERT
    WITH CHECK (profile_id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can update their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can update active profile clients." ON public.clients;
CREATE POLICY "Users can update active profile clients."
    ON public.clients FOR UPDATE
    USING (profile_id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can delete their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can delete active profile clients." ON public.clients;
CREATE POLICY "Users can delete active profile clients."
    ON public.clients FOR DELETE
    USING (profile_id = public.get_active_profile_id());

-- Table: ledger_entries
DROP POLICY IF EXISTS "Users can view ledger entries of their own clients." ON public.ledger_entries;
DROP POLICY IF EXISTS "Users can view active profile ledger entries." ON public.ledger_entries;
CREATE POLICY "Users can view active profile ledger entries."
    ON public.ledger_entries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = public.get_active_profile_id()
        )
    );

DROP POLICY IF EXISTS "Users can insert ledger entries of their own clients." ON public.ledger_entries;
DROP POLICY IF EXISTS "Users can insert active profile ledger entries." ON public.ledger_entries;
CREATE POLICY "Users can insert active profile ledger entries."
    ON public.ledger_entries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = public.get_active_profile_id()
        )
    );

DROP POLICY IF EXISTS "Users can update ledger entries of their own clients." ON public.ledger_entries;
DROP POLICY IF EXISTS "Users can update active profile ledger entries." ON public.ledger_entries;
CREATE POLICY "Users can update active profile ledger entries."
    ON public.ledger_entries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = public.get_active_profile_id()
        )
    );

DROP POLICY IF EXISTS "Users can delete ledger entries of their own clients." ON public.ledger_entries;
DROP POLICY IF EXISTS "Users can delete active profile ledger entries." ON public.ledger_entries;
CREATE POLICY "Users can delete active profile ledger entries."
    ON public.ledger_entries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.clients 
            WHERE public.clients.id = public.ledger_entries.client_id 
            AND public.clients.profile_id = public.get_active_profile_id()
        )
    );

-- Table: suppliers
DROP POLICY IF EXISTS "Users can view their own suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Users can view active profile suppliers." ON public.suppliers;
CREATE POLICY "Users can view active profile suppliers."
    ON public.suppliers FOR SELECT
    USING (profile_id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can insert their own suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert active profile suppliers." ON public.suppliers;
CREATE POLICY "Users can insert active profile suppliers."
    ON public.suppliers FOR INSERT
    WITH CHECK (profile_id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can update their own suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Users can update active profile suppliers." ON public.suppliers;
CREATE POLICY "Users can update active profile suppliers."
    ON public.suppliers FOR UPDATE
    USING (profile_id = public.get_active_profile_id());

DROP POLICY IF EXISTS "Users can delete their own suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete active profile suppliers." ON public.suppliers;
CREATE POLICY "Users can delete active profile suppliers."
    ON public.suppliers FOR DELETE
    USING (profile_id = public.get_active_profile_id());

-- Table: purchases
DROP POLICY IF EXISTS "Users can view purchases of their own suppliers." ON public.purchases;
DROP POLICY IF EXISTS "Users can view active profile purchases." ON public.purchases;
CREATE POLICY "Users can view active profile purchases."
    ON public.purchases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = public.get_active_profile_id()
        )
    );

DROP POLICY IF EXISTS "Users can insert purchases of their own suppliers." ON public.purchases;
DROP POLICY IF EXISTS "Users can insert active profile purchases." ON public.purchases;
CREATE POLICY "Users can insert active profile purchases."
    ON public.purchases FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = public.get_active_profile_id()
        )
    );

DROP POLICY IF EXISTS "Users can update purchases of their own suppliers." ON public.purchases;
DROP POLICY IF EXISTS "Users can update active profile purchases." ON public.purchases;
CREATE POLICY "Users can update active profile purchases."
    ON public.purchases FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = public.get_active_profile_id()
        )
    );

DROP POLICY IF EXISTS "Users can delete purchases of their own suppliers." ON public.purchases;
DROP POLICY IF EXISTS "Users can delete active profile purchases." ON public.purchases;
CREATE POLICY "Users can delete active profile purchases."
    ON public.purchases FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.suppliers 
            WHERE public.suppliers.id = public.purchases.supplier_id 
            AND public.suppliers.profile_id = public.get_active_profile_id()
        )
    );

-- Table: deadlines
DROP POLICY IF EXISTS "Users can manage their own deadlines" ON public.deadlines;
DROP POLICY IF EXISTS "Users can manage active profile deadlines" ON public.deadlines;
CREATE POLICY "Users can manage active profile deadlines" 
    ON public.deadlines 
    FOR ALL 
    TO authenticated 
    USING (profile_id = public.get_active_profile_id()) 
    WITH CHECK (profile_id = public.get_active_profile_id());


-- 4. Déclencheurs BEFORE INSERT pour assurer que profile_id est toujours égal à l'admin parent

CREATE OR REPLACE FUNCTION public.force_active_profile_id()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    NEW.profile_id := public.get_active_profile_id();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS force_clients_profile_id ON public.clients;
CREATE TRIGGER force_clients_profile_id
    BEFORE INSERT ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.force_active_profile_id();

DROP TRIGGER IF EXISTS force_suppliers_profile_id ON public.suppliers;
CREATE TRIGGER force_suppliers_profile_id
    BEFORE INSERT ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.force_active_profile_id();

DROP TRIGGER IF EXISTS force_deadlines_profile_id ON public.deadlines;
CREATE TRIGGER force_deadlines_profile_id
    BEFORE INSERT ON public.deadlines
    FOR EACH ROW EXECUTE FUNCTION public.force_active_profile_id();


-- 5. Fonction RPC pour créer un compte livreur/chauffeur
CREATE OR REPLACE FUNCTION public.create_driver_account(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_phone TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_password TEXT;
BEGIN
    -- Vérifier que l'appelant est bien un administrateur
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Only admin users can create driver accounts.';
    END IF;

    -- Crypter le mot de passe en utilisant l'algorithme blowfish (bcrypt standard Supabase Auth)
    v_encrypted_password := crypt(p_password, gen_salt('bf'));

    -- Insérer l'utilisateur dans auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
    VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email,
        v_encrypted_password,
        now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('name', p_name),
        false,
        now(),
        now(),
        NULL,
        NULL,
        '',
        '',
        '',
        ''
    )
    RETURNING id INTO v_user_id;

    -- Mettre à jour profiles avec le role 'driver', le parent_id et l'email
    INSERT INTO public.profiles (id, company_name, company_phone, role, parent_id, email)
    VALUES (v_user_id, p_name, p_phone, 'driver', auth.uid(), p_email)
    ON CONFLICT (id) DO UPDATE 
    SET company_name = EXCLUDED.company_name,
        company_phone = EXCLUDED.company_phone,
        role = 'driver',
        parent_id = auth.uid(),
        email = EXCLUDED.email;

    RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'error', 'Email already exists.');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;


-- 6. Fonction RPC pour supprimer un compte livreur/chauffeur
CREATE OR REPLACE FUNCTION public.delete_driver_account(p_driver_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
    -- Vérifier que l'appelant est bien l'admin parent de ce livreur
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_driver_id AND parent_id = auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized to delete this account.';
    END IF;

    -- Supprimer de auth.users (va cascader automatiquement sur public.profiles)
    DELETE FROM auth.users WHERE id = p_driver_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
