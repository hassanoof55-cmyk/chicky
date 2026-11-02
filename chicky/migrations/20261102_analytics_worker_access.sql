-- A dedicated random 256-bit worker key authorizes only the two delivery RPCs.
-- Store its SHA256 in this private table, and its plaintext only in runtime env.
BEGIN;
CREATE TABLE IF NOT EXISTS public.chicky_analytics_worker_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$')
);
ALTER TABLE public.chicky_analytics_worker_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chicky_analytics_worker_config FROM PUBLIC,anon,authenticated,chicky_analytics_worker;
CREATE OR REPLACE FUNCTION public.claim_chicky_analytics_worker(p_worker_token text,p_limit integer DEFAULT 20)
RETURNS TABLE(order_id text,payload jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_worker_token IS NULL OR length(p_worker_token)<>64 OR NOT EXISTS (
    SELECT 1 FROM public.chicky_analytics_worker_config c
    WHERE c.id AND c.token_hash=encode(sha256(convert_to(p_worker_token,'UTF8')),'hex')
  ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Worker authorization required'; END IF;
  RETURN QUERY SELECT * FROM public.claim_chicky_analytics_batch(least(coalesce(p_limit,20),20));
END $$;
CREATE OR REPLACE FUNCTION public.finish_chicky_analytics_worker(p_worker_token text,p_order_id text,p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_worker_token IS NULL OR length(p_worker_token)<>64 OR NOT EXISTS (
    SELECT 1 FROM public.chicky_analytics_worker_config c
    WHERE c.id AND c.token_hash=encode(sha256(convert_to(p_worker_token,'UTF8')),'hex')
  ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Worker authorization required'; END IF;
  PERFORM public.finish_chicky_analytics_event(p_order_id,p_success);
END $$;
REVOKE ALL ON FUNCTION public.claim_chicky_analytics_worker(text,integer),public.finish_chicky_analytics_worker(text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_chicky_analytics_worker(text,integer),public.finish_chicky_analytics_worker(text,text,boolean) TO anon;
NOTIFY pgrst,'reload schema';
COMMIT;
