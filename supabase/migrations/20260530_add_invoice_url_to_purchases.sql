-- ==============================================================================
-- SQL MIGRATION : AJOUT DE LA COLONNE INVOICE_URL A LA TABLE PURCHASES
-- Target: Supabase PostgreSQL Database (Dawajin Pro)
-- ==============================================================================

-- 1. Ajouter la colonne invoice_url à public.purchases
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS invoice_url TEXT;

-- 2. Recréer la politique RLS ou vérifier la compatibilité
-- La colonne s'intègre automatiquement aux politiques RLS existantes (ALL/SELECT/UPDATE).
