-- Save the existing storefront config and its logistics mirror together.
-- SECURITY INVOKER preserves existing table grants and administrator RLS.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_chicky_config(p_config jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.is_chicky_admin() THEN
    RAISE insufficient_privilege USING MESSAGE='Administrator access required';
  END IF;
  IF jsonb_typeof(p_config) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_config->'areas') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Invalid configuration'; END IF;
  INSERT INTO public.site_settings(id,config_data) VALUES ('active_config',p_config)
    ON CONFLICT(id) DO UPDATE SET config_data=excluded.config_data;
  INSERT INTO public.logistics_config(id,areas,status,updated_at)
    VALUES (1,p_config->'areas',p_config->>'branchStatus',now())
    ON CONFLICT(id) DO UPDATE SET areas=excluded.areas,
      status=CASE WHEN p_config ? 'branchStatus' THEN excluded.status ELSE public.logistics_config.status END,
      updated_at=excluded.updated_at;
END $$;
REVOKE ALL ON FUNCTION public.save_chicky_config(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_chicky_config(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
