-- Supabase Security Linter Fixes (2026-05-24)
-- ---------------------------------------------------
-- 1. Ensure functions have a stable search_path
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog;
ALTER FUNCTION public.rls_auto_enable()   SET search_path = pg_catalog;

-- 2. Reduce privilege escalation surface by running as caller
ALTER FUNCTION public.handle_new_user() SECURITY INVOKER;
ALTER FUNCTION public.rls_auto_enable()   SECURITY INVOKER;

-- If you need to keep SECURITY DEFINER for a specific reason, you can instead
-- REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()   FROM anon, authenticated;

