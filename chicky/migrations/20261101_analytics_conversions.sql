-- Apply AFTER 20261101_secure_access.sql, as its owner. No historical backfill.
-- completed is the storefront's sole confirmed conversion state; it is not an
-- independent assertion that a payment processor settled the order.
BEGIN;

-- The web process receives only this RPC-only role, never a service-role key.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='chicky_analytics_worker') THEN
    CREATE ROLE chicky_analytics_worker NOLOGIN NOINHERIT;
  END IF;
END $$;
GRANT chicky_analytics_worker TO authenticator;
GRANT USAGE ON SCHEMA public TO chicky_analytics_worker;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid='public.orders'::regclass AND attname='id'
      AND atttypid='pg_catalog.text'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Expected public.orders.id text; review schema before upgrade';
  END IF;
  IF pg_catalog.to_regprocedure('public.submit_chicky_order_core(jsonb,text)') IS NULL THEN
    IF pg_catalog.to_regprocedure('public.submit_chicky_order(jsonb,text)') IS NULL THEN
      RAISE EXCEPTION 'Apply secure_access migration first';
    END IF;
    ALTER FUNCTION public.submit_chicky_order(jsonb,text) RENAME TO submit_chicky_order_core;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.submit_chicky_order_core(jsonb,text) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.chicky_analytics_context (
  order_id text PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  consented boolean NOT NULL DEFAULT true,
  client_id text,
  session_id text,
  revoke_token uuid NOT NULL UNIQUE,
  -- Only server-derived delivery fee, never the submitted order/analytics object.
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chicky_analytics_context_identifiers CHECK (
    (consented AND client_id IS NOT NULL AND session_id IS NOT NULL
      AND length(client_id)<=100 AND client_id ~ '^[0-9]+\.[0-9]+$'
      AND length(session_id)<=40 AND session_id ~ '^[0-9]+$')
    OR (NOT consented AND client_id IS NULL AND session_id IS NULL)),
  CONSTRAINT chicky_analytics_context_shipping CHECK (
    jsonb_typeof(payload)='object' AND payload ? 'shipping'
    AND payload - 'shipping' = '{}'::jsonb
    AND jsonb_typeof(payload->'shipping')='number'
    AND (payload->>'shipping')::numeric BETWEEN 0 AND 10000000)
);
CREATE TABLE IF NOT EXISTS public.chicky_analytics_outbox (
  order_id text PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
CREATE INDEX IF NOT EXISTS chicky_analytics_outbox_due
  ON public.chicky_analytics_outbox(next_attempt_at,created_at) WHERE sent_at IS NULL;
ALTER TABLE public.chicky_analytics_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chicky_analytics_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chicky_analytics_context, public.chicky_analytics_outbox
  FROM PUBLIC, anon, authenticated;
-- No storefront/admin policies: only the existing BYPASSRLS service_role gets CRUD.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chicky_analytics_context,
  public.chicky_analytics_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.submit_chicky_order(p_order jsonb, p_promo_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_analytics jsonb := p_order->'analytics';
  v_existing boolean;
  v_valid boolean;
  v_config jsonb;
  v_fee numeric := 0;
BEGIN
  -- Same lock as core, held before checking existence: concurrent retries cannot
  -- attach/replace consent to an existing order. Core still validates every retry.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order->>'id',0));
  SELECT EXISTS (SELECT 1 FROM public.orders WHERE id=p_order->>'id') INTO v_existing;
  v_valid := coalesce(jsonb_typeof(v_analytics)='object'
    AND v_analytics->'consent'='true'::jsonb
    AND jsonb_typeof(v_analytics->'client_id')='string'
    AND length(v_analytics->>'client_id')<=100
    AND v_analytics->>'client_id' ~ '^[0-9]+\.[0-9]+$'
    AND jsonb_typeof(v_analytics->'session_id')='string'
    AND length(v_analytics->>'session_id')<=40
    AND v_analytics->>'session_id' ~ '^[0-9]+$'
    AND jsonb_typeof(v_analytics->'revoke_token')='string'
    AND v_analytics->>'revoke_token' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',false);
  IF v_valid AND NOT v_existing AND p_order->>'service_type'='delivery' THEN
    -- Keep configuration stable through core's own fee/total validation.
    SELECT config_data INTO v_config FROM public.site_settings
      WHERE id='active_config' FOR SHARE;
    SELECT (a->>'fee')::numeric INTO v_fee FROM jsonb_array_elements(v_config->'areas') a
      WHERE a->>'id'=p_order->>'area_id' LIMIT 1;
  END IF;
  -- Never change the original core's exact-order hash or void return contract.
  -- Shipping claimed by analytics is ignored, including numeric but forged fees.
  PERFORM public.submit_chicky_order_core(p_order - 'analytics',p_promo_code);
  IF v_valid AND NOT v_existing THEN
    INSERT INTO public.chicky_analytics_context(order_id,client_id,session_id,revoke_token,payload)
    SELECT o.id,v_analytics->>'client_id',v_analytics->>'session_id',
      (v_analytics->>'revoke_token')::uuid,jsonb_build_object('shipping',v_fee)
    FROM public.orders o WHERE o.id=p_order->>'id' AND o.status='pending'
      AND o.created_at BETWEEN now()-interval '1 day' AND now()
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.submit_chicky_order(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_chicky_order(jsonb,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.capture_chicky_analytics_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_context public.chicky_analytics_context%ROWTYPE;
  v_item jsonb;
  v_menu public.menu_items%ROWTYPE;
  v_size jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_items jsonb;
  v_line jsonb;
  v_subtotal numeric := 0;
  v_net numeric;
  v_price numeric;
  v_qty numeric;
  v_factor numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  -- Serialize capture with revoke; context is never inferred from an old order.
  SELECT * INTO v_context FROM public.chicky_analytics_context
    WHERE order_id=NEW.id FOR UPDATE;
  IF NOT FOUND OR NOT v_context.consented
    OR NEW.created_at NOT BETWEEN now()-interval '72 hours' AND now()
    OR v_context.created_at NOT BETWEEN now()-interval '72 hours' AND now() THEN
    RETURN NEW;
  END IF;
  v_net := NEW.total_price-(v_context.payload->>'shipping')::numeric;
  IF v_net IS NULL OR v_net<0 OR v_net>10000000
    OR jsonb_typeof(NEW.items) IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
  IF jsonb_array_length(NEW.items) NOT BETWEEN 1 AND 100 THEN RETURN NEW; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items) LOOP
    SELECT * INTO v_menu FROM public.menu_items WHERE id=v_item->>'id';
    IF NOT FOUND OR jsonb_typeof(v_item->'price') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number' THEN RETURN NEW; END IF;
    v_price := (v_item->>'price')::numeric;
    v_qty := (v_item->>'quantity')::numeric;
    IF v_price NOT BETWEEN 0 AND 1000000 OR v_qty NOT BETWEEN 1 AND 999
      OR v_qty<>trunc(v_qty) THEN RETURN NEW; END IF;
    v_size := NULL;
    IF nullif(v_item->>'size_id','') IS NOT NULL OR nullif(v_item->>'size','') IS NOT NULL THEN
      -- IDs must belong to this catalog item. Legacy bilingual size labels are
      -- matched to catalog data, never copied into the analytics payload.
      SELECT s INTO v_size FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_menu.sizes)='array' THEN v_menu.sizes ELSE '[]'::jsonb END) s
      WHERE nullif(s->>'id','') IS NOT NULL AND
        CASE WHEN nullif(v_item->>'size_id','') IS NOT NULL
          THEN s->>'id'=v_item->>'size_id'
          ELSE v_item->>'size' IN (s->>'nameEn',s->>'nameAr') END
      ORDER BY s->>'id' LIMIT 1;
      IF v_size IS NULL THEN RETURN NEW; END IF;
    END IF;
    v_line := jsonb_build_object('item_id',v_menu.id ||
      CASE WHEN v_size IS NULL THEN '' ELSE '--' || (v_size->>'id') END,
      'item_name',v_menu.name,'price',v_price,'quantity',v_qty);
    IF v_size IS NOT NULL THEN
      v_line := v_line || jsonb_build_object('item_variant',v_size->>'nameEn');
    END IF;
    v_lines := v_lines || jsonb_build_array(v_line);
    v_subtotal := v_subtotal+v_price*v_qty;
  END LOOP;
  IF v_net>v_subtotal+0.011 OR (v_subtotal=0 AND v_net<>0) THEN RETURN NEW; END IF;
  -- Final order unit prices already include modifiers. Allocate promo savings
  -- proportionally across all lines; do not substitute current catalog prices.
  v_factor := CASE WHEN v_subtotal=0 THEN 0 ELSE v_net/v_subtotal END;
  SELECT jsonb_agg(jsonb_set(i,'{price}',to_jsonb((i->>'price')::numeric*v_factor)) ORDER BY n)
    INTO v_items FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS x(i,n);
  INSERT INTO public.chicky_analytics_outbox(order_id,payload)
  VALUES (NEW.id,jsonb_build_object('name','purchase','params',jsonb_build_object(
    'transaction_id',NEW.id,'currency','EGP','value',v_net,
    'shipping',(v_context.payload->>'shipping')::numeric,'items',v_items)))
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_chicky_analytics_purchase() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS chicky_analytics_purchase_completed ON public.orders;
CREATE TRIGGER chicky_analytics_purchase_completed AFTER UPDATE OF status ON public.orders
  FOR EACH ROW WHEN (NEW.status='completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.capture_chicky_analytics_purchase();

CREATE OR REPLACE FUNCTION public.claim_chicky_analytics_batch(p_limit integer DEFAULT 20)
RETURNS TABLE(order_id text,payload jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT q.order_id FROM public.chicky_analytics_outbox q
    JOIN public.chicky_analytics_context c ON c.order_id=q.order_id
    JOIN public.orders o ON o.id=q.order_id
    WHERE q.sent_at IS NULL AND q.next_attempt_at<=now()
      AND (q.locked_until IS NULL OR q.locked_until<=now())
      AND o.status='completed'
      AND c.consented AND c.created_at BETWEEN now()-interval '72 hours' AND now()
      AND o.created_at BETWEEN now()-interval '72 hours' AND now()
    ORDER BY q.next_attempt_at,q.created_at,q.order_id
    LIMIT least(greatest(coalesce(p_limit,20),1),100)
    FOR UPDATE OF q SKIP LOCKED
  ), leased AS (
    UPDATE public.chicky_analytics_outbox q
    SET locked_until=now()+interval '5 minutes',attempts=q.attempts+1
    FROM due WHERE q.order_id=due.order_id
    RETURNING q.order_id,q.payload
  )
  -- Identifiers are assembled transiently for the trusted worker, never stored
  -- in outbox.payload. session_id remains a digit string to avoid numeric loss.
  SELECT l.order_id,jsonb_build_object('client_id',c.client_id,'events',
    jsonb_build_array(jsonb_set(l.payload,'{params,session_id}',to_jsonb(c.session_id))))
  FROM leased l JOIN public.chicky_analytics_context c ON c.order_id=l.order_id
  WHERE c.consented;
END $$;
REVOKE ALL ON FUNCTION public.claim_chicky_analytics_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chicky_analytics_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_chicky_analytics_batch(integer) TO chicky_analytics_worker;

CREATE OR REPLACE FUNCTION public.finish_chicky_analytics_event(p_order_id text,p_success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.chicky_analytics_outbox q
  SET sent_at=CASE WHEN p_success IS TRUE THEN now() ELSE NULL END,
    locked_until=NULL,
    next_attempt_at=CASE WHEN p_success IS TRUE THEN q.next_attempt_at
      ELSE now()+make_interval(secs=>least(3600.0,30.0*power(2.0,least(greatest(q.attempts-1,0),7)))::double precision) END
  WHERE q.order_id=p_order_id AND q.sent_at IS NULL AND q.locked_until>now();
END $$;
REVOKE ALL ON FUNCTION public.finish_chicky_analytics_event(text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_chicky_analytics_event(text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_chicky_analytics_event(text,boolean) TO chicky_analytics_worker;
-- Delivery is at least once. Workers must finish within their lease; on an
-- uncertain HTTP result retry using the same transaction_id for deduplication.

CREATE OR REPLACE FUNCTION public.revoke_chicky_analytics(p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order_id text;
BEGIN
  UPDATE public.chicky_analytics_context
  SET consented=false,client_id=NULL,session_id=NULL
  WHERE revoke_token=p_token RETURNING order_id INTO v_order_id;
  DELETE FROM public.chicky_analytics_outbox WHERE order_id=v_order_id AND sent_at IS NULL;
  -- No order-ID lookup endpoint, no status/record return, unknown token is a no-op.
  -- Revocation cannot recall a payload already handed to a worker/external sink.
END $$;
REVOKE ALL ON FUNCTION public.revoke_chicky_analytics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_chicky_analytics(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
