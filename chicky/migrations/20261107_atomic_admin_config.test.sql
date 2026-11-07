-- Isolated database only. All settings and policy fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE config_before AS SELECT config_data FROM public.site_settings WHERE id='active_config';
CREATE TEMP TABLE logistics_before AS SELECT * FROM public.logistics_config WHERE id=1;
GRANT SELECT ON config_before TO authenticated;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.save_chicky_config('{}');
 RAISE EXCEPTION 'Anonymous save allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"chicky_admin":true}}',true);
DO $$ BEGIN
 BEGIN PERFORM public.save_chicky_config('{"areas":[]}');
 RAISE EXCEPTION 'Untrusted admin metadata allowed save' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"chicky_admin":true}}',true);
SELECT public.save_chicky_config(config_data || '{"filterLabelEn":"ATOMIC TEST","areas":[{"id":"test-zone","fee":25}],"branchStatus":"open"}') FROM config_before;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.site_settings WHERE id='active_config' AND config_data->>'filterLabelEn'='ATOMIC TEST')
 OR NOT EXISTS(SELECT 1 FROM public.logistics_config WHERE id=1 AND areas='[{"id":"test-zone","fee":25}]'::jsonb AND status='open')
 THEN RAISE EXCEPTION 'Configuration/mirror mismatch'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.save_chicky_config(config_data - 'branchStatus') FROM config_before;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.logistics_config WHERE id=1 AND status='open')
 THEN RAISE EXCEPTION 'Missing optional status changed existing branch state'; END IF;
END $$;
-- Force the second write to fail under real RLS; the first must roll back too.
DROP POLICY chicky_admin_access ON public.logistics_config;
CREATE POLICY deny_logistics_write ON public.logistics_config TO authenticated USING(false) WITH CHECK(false);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.save_chicky_config('{"filterLabelEn":"MUST ROLLBACK","areas":[],"branchStatus":"closed"}');
  RAISE EXCEPTION 'Mirror write unexpectedly succeeded' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.site_settings WHERE id='active_config' AND config_data->>'filterLabelEn'='MUST ROLLBACK')
 THEN RAISE EXCEPTION 'Failed mirror left partial settings'; END IF;
END $$;
ROLLBACK;
SELECT 'ATOMIC_ADMIN_CONFIG_TESTS_PASSED';
