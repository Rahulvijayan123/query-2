-- Optional: required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table to store saved queries from the app
CREATE TABLE IF NOT EXISTS public.queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  query_text text NOT NULL DEFAULT '',
  facets text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes for common filters/sorts
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON public.queries (user_id);
CREATE INDEX IF NOT EXISTS idx_queries_email ON public.queries (email);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON public.queries (created_at DESC);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queries_updated_at ON public.queries;
CREATE TRIGGER trg_queries_updated_at
BEFORE UPDATE ON public.queries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS on queries table
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Demo-friendly policies (open). This matches the current app which uses a demo session
-- and does not authenticate via Supabase Auth. Replace with the secure set below when
-- you enable Supabase Auth in the app.
DROP POLICY IF EXISTS "queries_select_open" ON public.queries;
DROP POLICY IF EXISTS "queries_insert_open" ON public.queries;
DROP POLICY IF EXISTS "queries_update_open" ON public.queries;
DROP POLICY IF EXISTS "queries_delete_open" ON public.queries;

CREATE POLICY "queries_select_open" ON public.queries
  FOR SELECT USING (true);

CREATE POLICY "queries_insert_open" ON public.queries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "queries_update_open" ON public.queries
  FOR UPDATE USING (true);

CREATE POLICY "queries_delete_open" ON public.queries
  FOR DELETE USING (true);

-- Secure policies (commented out). Use these when you switch to Supabase Auth.
-- REVOKE ALL ON public.queries FROM anon, authenticated;
-- DROP POLICY IF EXISTS "queries_select_open" ON public.queries;
-- DROP POLICY IF EXISTS "queries_insert_open" ON public.queries;
-- DROP POLICY IF EXISTS "queries_update_open" ON public.queries;
-- DROP POLICY IF EXISTS "queries_delete_open" ON public.queries;
--
-- CREATE POLICY "queries_select_secure" ON public.queries
--   FOR SELECT USING (
--     auth.uid() IS NOT NULL AND (user_id = auth.uid() OR (email IS NOT NULL AND email = auth.email()))
--   );
--
-- CREATE POLICY "queries_insert_secure" ON public.queries
--   FOR INSERT WITH CHECK (
--     auth.uid() IS NOT NULL AND (user_id = auth.uid() OR (email IS NOT NULL AND email = auth.email()))
--   );
--
-- CREATE POLICY "queries_update_secure" ON public.queries
--   FOR UPDATE USING (
--     auth.uid() IS NOT NULL AND user_id = auth.uid()
--   );
--
-- CREATE POLICY "queries_delete_secure" ON public.queries
--   FOR DELETE USING (
--     auth.uid() IS NOT NULL AND user_id = auth.uid()
--   );
