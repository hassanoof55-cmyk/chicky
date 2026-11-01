BEGIN;

CREATE OR REPLACE FUNCTION public.is_chicky_admin() RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(auth.jwt()->'app_metadata'->'chicky_admin' = 'true'::jsonb, false)
$$;
REVOKE ALL ON FUNCTION public.is_chicky_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chicky_admin() TO anon, authenticated, service_role;

DO $$ DECLARE t text; p record; BEGIN
  FOREACH t IN ARRAY ARRAY['menu_items','orders','site_settings','logistics_config','promo_codes','site_builder'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, PUBLIC', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY chicky_admin_access ON public.%I TO authenticated USING (public.is_chicky_admin()) WITH CHECK (public.is_chicky_admin())', t);
  END LOOP;
END $$;
GRANT SELECT ON public.menu_items, public.site_settings, public.logistics_config, public.promo_codes TO anon;
CREATE POLICY storefront_read ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY storefront_read ON public.site_settings FOR SELECT TO anon, authenticated USING (id = 'active_config');
CREATE POLICY storefront_read ON public.logistics_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY available_promos ON public.promo_codes FOR SELECT TO anon, authenticated
  USING (is_active AND (expiry_date IS NULL OR expiry_date > now()) AND (usage_limit IS NULL OR usage_limit > 0));

-- Customer submission returns no private records. Promo consumption and order
-- creation succeed together. Private table CRUD remains administrator-only.
CREATE OR REPLACE FUNCTION public.submit_chicky_order(p_order jsonb, p_promo_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_subtotal numeric; v_eligible numeric; v_discount numeric := 0;
  v_fee numeric := 0; v_total numeric; v_value numeric; v_type text;
  v_hash text; v_existing_hash text;
BEGIN
  IF p_order IS NULL OR jsonb_typeof(p_order) <> 'object' OR octet_length(p_order::text) > 50000
    OR coalesce(p_order->>'id','') !~ '^CH-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$'
    OR length(btrim(coalesce(p_order->>'customer_name',''))) NOT BETWEEN 1 AND 200
    OR length(coalesce(p_order->>'phone','')) NOT BETWEEN 7 AND 100
    OR length(coalesce(p_order->>'address','')) NOT BETWEEN 1 AND 2000
    OR length(coalesce(p_order->>'area','')) > 300
    OR jsonb_typeof(p_order->'items') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_order->'total_price') IS DISTINCT FROM 'number'
  THEN RAISE EXCEPTION 'Invalid order'; END IF;
  v_hash := encode(sha256(convert_to(jsonb_build_object('order',p_order,'promo',upper(btrim(p_promo_code)))::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_order->>'id',0));
  SELECT order_details->>'submission_hash' INTO v_existing_hash FROM public.orders WHERE id=p_order->>'id';
  IF FOUND THEN
    IF v_existing_hash=v_hash THEN RETURN; END IF;
    RAISE EXCEPTION 'Invalid order';
  END IF;
  IF jsonb_array_length(p_order->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_order->'items') i
    WHERE jsonb_typeof(i->'quantity') IS DISTINCT FROM 'number'
       OR jsonb_typeof(i->'price') IS DISTINCT FROM 'number'
       OR NOT EXISTS (SELECT 1 FROM public.menu_items m WHERE m.id=i->>'id'))
  THEN RAISE EXCEPTION 'Invalid items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_order->'items') i
    WHERE (i->>'quantity')::numeric NOT BETWEEN 1 AND 999
       OR (i->>'quantity')::numeric <> trunc((i->>'quantity')::numeric)
       OR (i->>'price')::numeric NOT BETWEEN 0 AND 1000000)
  THEN RAISE EXCEPTION 'Invalid quantities or prices'; END IF;
  SELECT sum((i->>'price')::numeric*(i->>'quantity')::numeric) INTO v_subtotal
    FROM jsonb_array_elements(p_order->'items') i;
  IF p_order->>'service_type' = 'delivery' THEN
    SELECT (a->>'fee')::numeric INTO v_fee
      FROM public.site_settings s, jsonb_array_elements(s.config_data->'areas') a
      WHERE s.id='active_config' AND a->>'id'=p_order->>'area_id' LIMIT 1;
    IF v_fee IS NULL OR v_fee < 0 THEN RAISE EXCEPTION 'Invalid delivery area'; END IF;
  ELSIF coalesce(p_order->>'service_type','') NOT IN ('pickup','dine-in') THEN
    RAISE EXCEPTION 'Invalid service type';
  END IF;
  IF nullif(btrim(p_promo_code),'') IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promo_codes WHERE code=upper(btrim(p_promo_code)) FOR UPDATE;
    IF NOT FOUND OR NOT coalesce(v_promo.is_active,false)
       OR v_promo.expiry_date <= now() OR v_promo.usage_limit <= 0
       OR v_subtotal < coalesce(v_promo.min_order_value,0)
    THEN RAISE EXCEPTION 'Promo unavailable'; END IF;
    SELECT coalesce(sum((i->>'price')::numeric*(i->>'quantity')::numeric),0) INTO v_eligible
      FROM jsonb_array_elements(p_order->'items') i JOIN public.menu_items m ON m.id=i->>'id'
      WHERE (coalesce(cardinality(v_promo.applicable_categories),0)=0 AND coalesce(cardinality(v_promo.applicable_products),0)=0)
         OR m.category=ANY(v_promo.applicable_categories) OR m.id=ANY(v_promo.applicable_products);
    v_type := coalesce(v_promo.discount_type,v_promo.type);
    v_value := coalesce(v_promo.discount_value,v_promo.value);
    IF v_value IS NULL OR v_value < 0 OR v_type NOT IN ('percentage','fixed') THEN RAISE EXCEPTION 'Invalid promo'; END IF;
    v_discount := CASE WHEN v_type='percentage' THEN v_eligible*v_value/100 ELSE least(v_value,v_eligible) END;
    IF v_promo.usage_limit IS NOT NULL THEN
      UPDATE public.promo_codes SET usage_limit=usage_limit-1,is_active=(usage_limit-1>0) WHERE code=v_promo.code;
    END IF;
  END IF;
  v_total := (p_order->>'total_price')::numeric;
  IF v_total NOT BETWEEN 0 AND 10000000 OR abs(v_total-(v_subtotal-v_discount+v_fee)) > 0.011 THEN
    RAISE EXCEPTION 'Order total changed; refresh and try again';
  END IF;
  INSERT INTO public.orders(id,customer_name,phone,address,area,location,items,total_price,status,payment_method,order_details)
  VALUES(p_order->>'id',btrim(p_order->>'customer_name'),p_order->>'phone',p_order->>'address',p_order->>'area',
    CASE WHEN jsonb_typeof(p_order->'location')='object' THEN p_order->'location' ELSE '{}'::jsonb END,
    p_order->'items',v_total,'pending',p_order->>'payment_method',jsonb_build_object('promo_code',v_promo.code,'service_type',p_order->>'service_type','submission_hash',v_hash));
END $$;
REVOKE ALL ON FUNCTION public.submit_chicky_order(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_chicky_order(jsonb,text) TO anon, authenticated;

DROP POLICY IF EXISTS chicky_image_admin ON storage.objects;
CREATE POLICY chicky_image_admin ON storage.objects TO authenticated
  USING (bucket_id='menu-images' AND public.is_chicky_admin())
  WITH CHECK (bucket_id='menu-images' AND public.is_chicky_admin());

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['menu_items','site_settings','orders','promo_codes'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
