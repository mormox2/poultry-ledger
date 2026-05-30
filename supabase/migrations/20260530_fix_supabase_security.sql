-- ==============================================================================
-- SQL MIGRATION : CORRECTION ET SÉCURISATION DE LA BASE DE DONNÉES (SUPABASE AUDIT)
-- Target: Supabase PostgreSQL Database (Dawajin Pro)
-- Author: Tech Lead / Antigravity AI
-- ==============================================================================

-- 1. Sécuriser les fonctions avec un search_path stable et explicite
-- (Prévient les attaques par détournement de schéma / hijacking de search_path)

ALTER FUNCTION public.update_modified_column() 
SET search_path = public, pg_catalog;

-- 2. Restreindre l'exécution des fonctions SECURITY DEFINER sensibles
-- (Par défaut, PUBLIC (qui inclut anon) a le droit d'exécuter toutes les fonctions)

-- Fonctions de gestion des comptes chauffeurs
REVOKE EXECUTE ON FUNCTION public.create_driver_account(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_driver_account(TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_driver_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_driver_account(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_driver_account(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_driver_account(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Fonction de résolution de l'ID de profil actif
REVOKE EXECUTE ON FUNCTION public.get_active_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_profile_id() TO authenticated;

-- 3. Sécuriser les fonctions déclencheurs (triggers) de manière stricte
-- (Les fonctions de triggers ne doivent pas être appelables directement via RPC par quiconque)

REVOKE EXECUTE ON FUNCTION public.force_active_profile_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_modified_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
