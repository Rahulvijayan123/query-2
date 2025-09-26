-- Simple trigger that just logs when a query is inserted
CREATE OR REPLACE FUNCTION public.log_new_query()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Just log the insert (this will help us debug)
  RAISE NOTICE 'New query inserted: %', NEW.email;
  
  -- You can also insert into a log table if you want
  INSERT INTO public.query_logs (query_id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());
  
  RETURN NEW;
END;
$$;

-- Create a simple log table
CREATE TABLE IF NOT EXISTS public.query_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id uuid REFERENCES public.queries(id),
  email text,
  created_at timestamptz DEFAULT now()
);

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_log_new_query ON public.queries;
CREATE TRIGGER trigger_log_new_query
  AFTER INSERT ON public.queries
  FOR EACH ROW
  EXECUTE FUNCTION public.log_new_query();


