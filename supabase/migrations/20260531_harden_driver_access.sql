-- ==============================================================================
-- SQL MIGRATION: HARDEN DRIVER ACCESS WHILE ALLOWING DAILY DELIVERY WEIGHTS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.is_driver_user()
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
        AND role = 'driver'
    );
END;
$$ LANGUAGE plpgsql STABLE;

DROP POLICY IF EXISTS "Users can insert active profile clients." ON public.clients;
DROP POLICY IF EXISTS "Users can update active profile clients." ON public.clients;
DROP POLICY IF EXISTS "Users can delete active profile clients." ON public.clients;

CREATE POLICY "Admins can insert their own clients."
    ON public.clients FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_user() AND profile_id = auth.uid());

CREATE POLICY "Admins can update their own clients."
    ON public.clients FOR UPDATE
    TO authenticated
    USING (public.is_admin_user() AND profile_id = auth.uid())
    WITH CHECK (public.is_admin_user() AND profile_id = auth.uid());

CREATE POLICY "Admins can delete their own clients."
    ON public.clients FOR DELETE
    TO authenticated
    USING (public.is_admin_user() AND profile_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert active profile suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Users can update active profile suppliers." ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete active profile suppliers." ON public.suppliers;

CREATE POLICY "Admins can insert their own suppliers."
    ON public.suppliers FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin_user() AND profile_id = auth.uid());

CREATE POLICY "Admins can update their own suppliers."
    ON public.suppliers FOR UPDATE
    TO authenticated
    USING (public.is_admin_user() AND profile_id = auth.uid())
    WITH CHECK (public.is_admin_user() AND profile_id = auth.uid());

CREATE POLICY "Admins can delete their own suppliers."
    ON public.suppliers FOR DELETE
    TO authenticated
    USING (public.is_admin_user() AND profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_driver_ledger_weight_scope()
RETURNS trigger
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NOT public.is_driver_user() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.price := NULL;
        NEW.amount := NULL;
        NEW.paid := NULL;
        NEW.holiday := false;
        RETURN NEW;
    END IF;

    NEW.client_id := OLD.client_id;
    NEW.year := OLD.year;
    NEW.month := OLD.month;
    NEW.day := OLD.day;
    NEW.price := OLD.price;
    NEW.amount := OLD.amount;
    NEW.paid := OLD.paid;
    NEW.holiday := OLD.holiday;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_driver_ledger_weight_scope ON public.ledger_entries;
CREATE TRIGGER enforce_driver_ledger_weight_scope
    BEFORE INSERT OR UPDATE ON public.ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_ledger_weight_scope();

DROP POLICY IF EXISTS "Users can insert active profile ledger entries." ON public.ledger_entries;
DROP POLICY IF EXISTS "Users can update active profile ledger entries." ON public.ledger_entries;
DROP POLICY IF EXISTS "Users can delete active profile ledger entries." ON public.ledger_entries;

CREATE POLICY "Admins and drivers can insert delivery weights."
    ON public.ledger_entries FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE public.clients.id = public.ledger_entries.client_id
            AND public.clients.profile_id = public.get_active_profile_id()
        )
        AND (public.is_admin_user() OR public.is_driver_user())
    );

CREATE POLICY "Admins and drivers can update delivery weights."
    ON public.ledger_entries FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE public.clients.id = public.ledger_entries.client_id
            AND public.clients.profile_id = public.get_active_profile_id()
        )
        AND (public.is_admin_user() OR public.is_driver_user())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE public.clients.id = public.ledger_entries.client_id
            AND public.clients.profile_id = public.get_active_profile_id()
        )
        AND (public.is_admin_user() OR public.is_driver_user())
    );

CREATE POLICY "Admins can delete ledger entries."
    ON public.ledger_entries FOR DELETE
    TO authenticated
    USING (
        public.is_admin_user()
        AND EXISTS (
            SELECT 1 FROM public.clients
            WHERE public.clients.id = public.ledger_entries.client_id
            AND public.clients.profile_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert active profile purchases." ON public.purchases;
DROP POLICY IF EXISTS "Users can update active profile purchases." ON public.purchases;
DROP POLICY IF EXISTS "Users can delete active profile purchases." ON public.purchases;

CREATE POLICY "Admins can insert their own purchases."
    ON public.purchases FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin_user()
        AND EXISTS (
            SELECT 1 FROM public.suppliers
            WHERE public.suppliers.id = public.purchases.supplier_id
            AND public.suppliers.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update their own purchases."
    ON public.purchases FOR UPDATE
    TO authenticated
    USING (
        public.is_admin_user()
        AND EXISTS (
            SELECT 1 FROM public.suppliers
            WHERE public.suppliers.id = public.purchases.supplier_id
            AND public.suppliers.profile_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_admin_user()
        AND EXISTS (
            SELECT 1 FROM public.suppliers
            WHERE public.suppliers.id = public.purchases.supplier_id
            AND public.suppliers.profile_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete their own purchases."
    ON public.purchases FOR DELETE
    TO authenticated
    USING (
        public.is_admin_user()
        AND EXISTS (
            SELECT 1 FROM public.suppliers
            WHERE public.suppliers.id = public.purchases.supplier_id
            AND public.suppliers.profile_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage active profile deadlines" ON public.deadlines;

CREATE POLICY "Users can view active profile deadlines"
    ON public.deadlines FOR SELECT
    TO authenticated
    USING (profile_id = public.get_active_profile_id());

CREATE POLICY "Admins can insert their own deadlines"
    ON public.deadlines FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin_user()
        AND profile_id = auth.uid()
        AND (
            (client_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.clients
                WHERE public.clients.id = public.deadlines.client_id
                AND public.clients.profile_id = auth.uid()
            ))
            OR
            (supplier_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.suppliers
                WHERE public.suppliers.id = public.deadlines.supplier_id
                AND public.suppliers.profile_id = auth.uid()
            ))
        )
    );

CREATE POLICY "Admins can update their own deadlines"
    ON public.deadlines FOR UPDATE
    TO authenticated
    USING (public.is_admin_user() AND profile_id = auth.uid())
    WITH CHECK (
        public.is_admin_user()
        AND profile_id = auth.uid()
        AND (
            (client_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.clients
                WHERE public.clients.id = public.deadlines.client_id
                AND public.clients.profile_id = auth.uid()
            ))
            OR
            (supplier_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.suppliers
                WHERE public.suppliers.id = public.deadlines.supplier_id
                AND public.suppliers.profile_id = auth.uid()
            ))
        )
    );

CREATE POLICY "Admins can delete their own deadlines"
    ON public.deadlines FOR DELETE
    TO authenticated
    USING (public.is_admin_user() AND profile_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_driver_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_driver_ledger_weight_scope() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_user() TO authenticated;
