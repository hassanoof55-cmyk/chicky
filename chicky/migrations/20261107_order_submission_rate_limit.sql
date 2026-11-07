-- Apply after 20261107_authoritative_order_pricing.sql. No historical edits.
-- Owner-approved policy: at most five new orders per primary phone in ten minutes.
BEGIN;
DO $$ BEGIN
  IF pg_catalog.to_regprocedure('public.submit_chicky_order_core(jsonb,text)') IS NULL
    OR position('Item price changed' IN pg_get_functiondef('public.submit_chicky_order_core(jsonb,text)'::regprocedure))=0
  THEN RAISE EXCEPTION 'Apply authoritative_order_pricing migration first'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.chicky_order_phone_key(phone text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path='' AS $$
  WITH clean AS (
    SELECT regexp_replace(translate(split_part(phone,'/',1),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9]','','g') AS digits
  )
  SELECT CASE WHEN digits ~ '^00201[0-9]{9}$' THEN '0'||substr(digits,5)
    WHEN digits ~ '^201[0-9]{9}$' THEN '0'||substr(digits,3) ELSE digits END
  FROM clean
$$;
REVOKE ALL ON FUNCTION public.chicky_order_phone_key(text) FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS chicky_orders_phone_created_idx
  ON public.orders(public.chicky_order_phone_key(phone),created_at);
CREATE OR REPLACE FUNCTION public.submit_chicky_order_core(p_order jsonb, p_promo_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_subtotal numeric; v_eligible numeric; v_discount numeric := 0;
  v_fee numeric := 0; v_total numeric; v_value numeric; v_type text;
  v_hash text; v_existing_hash text; v_phone_key text;
  v_item jsonb; v_product public.menu_items%ROWTYPE; v_size jsonb;
  v_mod_id jsonb; v_modifier jsonb; v_modifiers jsonb; v_ids jsonb;
  v_items jsonb := '[]'::jsonb; v_price numeric; v_spice text; v_ar boolean;

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
  -- Existing identical retries returned above and do not consume capacity.
  -- A transaction lock serializes concurrent submissions for the same primary phone.
  v_phone_key := public.chicky_order_phone_key(p_order->>'phone');
  PERFORM pg_advisory_xact_lock(hashtextextended('chicky-phone-rate:'||v_phone_key,0));
  IF (SELECT count(*) FROM public.orders
      WHERE public.chicky_order_phone_key(phone)=v_phone_key
        AND created_at>=statement_timestamp()-interval '10 minutes')>=5 THEN
    RAISE SQLSTATE 'PT429' USING MESSAGE='Order rate limit exceeded';
  END IF;
  IF jsonb_array_length(p_order->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid items'; END IF;
  IF p_order->>'scheduled_time' IS NOT NULL AND
    (jsonb_typeof(p_order->'scheduled_time') <> 'string' OR p_order->>'scheduled_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  THEN RAISE EXCEPTION 'Invalid scheduled time'; END IF;
  v_ar := coalesce(p_order->>'language','en') = 'ar';
  v_subtotal := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_order->'items') LOOP
    IF jsonb_typeof(v_item) <> 'object'
      OR jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_item->'price') IS DISTINCT FROM 'number'
    THEN RAISE EXCEPTION 'Invalid items'; END IF;
    IF (v_item->>'quantity')::numeric NOT BETWEEN 1 AND 999
      OR (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric)
      OR (v_item->>'price')::numeric NOT BETWEEN 0 AND 1000000
    THEN RAISE EXCEPTION 'Invalid quantities or prices'; END IF;
    -- Lock catalog rows until the transaction ends so concurrent admin edits
    -- cannot change the prices midway through this order.
    SELECT * INTO v_product FROM public.menu_items WHERE id=v_item->>'id' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable'; END IF;
    v_size := NULL;
    IF coalesce(v_product."hasSizes",false) THEN
      SELECT value INTO v_size FROM jsonb_array_elements(v_product.sizes)
        WHERE value->>'id'=v_item->>'size_id';
      IF v_size IS NULL OR jsonb_typeof(v_size->'price') IS DISTINCT FROM 'number'
      THEN RAISE EXCEPTION 'Invalid size'; END IF;
      v_price := (v_size->>'price')::numeric;
    ELSE
      IF nullif(v_item->>'size_id','') IS NOT NULL THEN RAISE EXCEPTION 'Invalid size'; END IF;
      v_price := v_product.price;
    END IF;
    v_spice := nullif(v_item->>'spiciness','');
    IF coalesce(v_product."spicinessOption",false) THEN
      IF v_spice IS NULL OR v_spice NOT IN ('Normal','Spicy') THEN RAISE EXCEPTION 'Invalid spiciness'; END IF;
    ELSIF v_spice IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid spiciness';
    END IF;
    v_ids := coalesce(v_item->'modifier_ids','[]'::jsonb);
    IF jsonb_typeof(v_ids) <> 'array' THEN RAISE EXCEPTION 'Invalid modifiers'; END IF;
    IF jsonb_array_length(v_ids)>100 OR
      (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(v_ids))
    THEN RAISE EXCEPTION 'Invalid modifiers'; END IF;
    v_modifiers := '[]'::jsonb;
    FOR v_mod_id IN SELECT value FROM jsonb_array_elements(v_ids) LOOP
      IF jsonb_typeof(v_mod_id) <> 'string' THEN RAISE EXCEPTION 'Invalid modifier'; END IF;
      SELECT value INTO v_modifier FROM jsonb_array_elements(v_product.modifiers)
        WHERE value->>'id'=v_mod_id #>> '{}';
      IF v_modifier IS NULL OR jsonb_typeof(v_modifier->'price') IS DISTINCT FROM 'number'
        OR (v_modifier->>'price')::numeric < 0
      THEN RAISE EXCEPTION 'Invalid modifier'; END IF;
      v_price := v_price+(v_modifier->>'price')::numeric;
      v_modifiers := v_modifiers || jsonb_build_array(v_modifier);
    END LOOP;
    IF v_price IS NULL OR v_price NOT BETWEEN 0 AND 1000000
      OR abs(v_price-(v_item->>'price')::numeric)>0.011
    THEN RAISE EXCEPTION 'Item price changed; refresh and try again'; END IF;
    v_subtotal := v_subtotal+v_price*(v_item->>'quantity')::numeric;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id',v_product.id,'name',CASE WHEN v_ar THEN v_product."nameAr" ELSE v_product.name END,
      'nameAr',v_product."nameAr",'category',v_product.category,
      'quantity',(v_item->>'quantity')::numeric,'price',v_price,
      'spiciness',v_spice,'size_id',v_size->>'id',
      'size',CASE WHEN v_ar THEN v_size->>'nameAr' ELSE v_size->>'nameEn' END,
      'selectedSize',v_size,'selectedModifiers',v_modifiers));
  END LOOP;
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
      FROM jsonb_array_elements(v_items) i JOIN public.menu_items m ON m.id=i->>'id'
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
    v_items,v_total,'pending',p_order->>'payment_method',jsonb_build_object('promo_code',v_promo.code,'service_type',p_order->>'service_type','submission_hash',v_hash,'scheduled_time',p_order->>'scheduled_time'));
END $$;
REVOKE ALL ON FUNCTION public.submit_chicky_order_core(jsonb,text) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
