-- ==============================================================================
-- SQL MIGRATION : ROLE-BASED ACCESS CONTROL (RBAC) & BACKUP STORAGE Setup
-- Target: Supabase PostgreSQL Database (Dawajin Pro)
-- Author: Tech Lead / Antigravity AI
-- ==============================================================================

-- 1. Add role column to profiles table (default 'admin')
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'driver'));

-- 2. Modify handle_new_user trigger function to ensure default 'admin' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.profiles (id, company_name, company_address, company_phone, company_tax_id, price_per_kg, role)
    VALUES (
        new.id,
        'الودرني للدواجن',
        'وادي النور الحامة,قابس ',
        '96 101 651',
        '1895235/E',
        5.800,
        'admin'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- 3. Create backups bucket if not exists in Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable RLS and setup storage policies for backups
-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to manage their own backup file 'backup_{user_id}.bin'
DROP POLICY IF EXISTS "Users can manage their own backups" ON storage.objects;
CREATE POLICY "Users can manage their own backups" 
ON storage.objects 
FOR ALL 
TO authenticated 
USING (bucket_id = 'backups' AND name = 'backup_' || auth.uid()::text || '.bin')
WITH CHECK (bucket_id = 'backups' AND name = 'backup_' || auth.uid()::text || '.bin');
