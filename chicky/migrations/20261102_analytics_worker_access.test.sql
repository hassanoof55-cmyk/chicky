BEGIN;
INSERT INTO public.chicky_analytics_worker_config(id,token_hash)
VALUES(true,encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex'))
ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM * FROM public.claim_chicky_analytics_worker(repeat('b',64));
    RAISE EXCEPTION 'Wrong worker key accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM * FROM public.claim_chicky_analytics_worker(NULL);
    RAISE EXCEPTION 'Missing worker key accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM token_hash FROM public.chicky_analytics_worker_config;
    RAISE EXCEPTION 'Public key hash read allowed' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM * FROM public.claim_chicky_analytics_worker(repeat('a',64));
  PERFORM public.finish_chicky_analytics_worker(repeat('a',64),'missing',true);
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'ANALYTICS_WORKER_ACCESS_TESTS_PASSED';
