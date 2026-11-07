-- Run after secure_access.sql and analytics_conversions.sql as the migration owner.
-- Dedicated disposable database only; fixtures and assertions always roll back.
BEGIN;

INSERT INTO public.menu_items(id,name,"nameAr",price,category,"hasSizes",sizes,modifiers)
VALUES ('analytics-test-catalog','Catalog chicken','كتالوج',30,'test',true,
  '[{"id":"regular","nameEn":"Regular","nameAr":"عادي","price":30},
    {"id":"large","nameEn":"Large","nameAr":"كبير","price":35}]',
  '[{"id":"extra-30","nameEn":"Extra","price":30},{"id":"extra-5","nameEn":"Small extra","price":5}]');
INSERT INTO public.promo_codes(code,discount_type,discount_value,is_active,usage_limit)
VALUES ('ANALYTICS_TEST','fixed',10,true,1);
-- Restore automatically on ROLLBACK, including an absent/empty areas array.
UPDATE public.site_settings SET config_data = jsonb_set(config_data,'{areas}',
  coalesce(config_data->'areas','[]'::jsonb) || '[{"id":"analytics-test-area","fee":7}]')
WHERE id='active_config';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.site_settings WHERE id='active_config') THEN
    RAISE EXCEPTION 'Test requires active_config';
  END IF;
END $$;

CREATE TEMP TABLE analytics_fixtures AS
SELECT n, jsonb_build_object(
  'id','CH-ACACACAC-0000-0000-0000-' || lpad(n::text,12,'0'),
  'customer_name','PRIVATE_CUSTOMER_SENTINEL','phone','0109'||lpad(n::text,7,'0'),
  'address','PRIVATE_ADDRESS_SENTINEL','area','PRIVATE_AREA_SENTINEL',
  'location',jsonb_build_object('lat',31.234567,'lng',30.123456),
  'notes','PRIVATE_NOTES_SENTINEL','payment_method','cash',
  'service_type','delivery','area_id','analytics-test-area',
  'items',jsonb_build_array(
    jsonb_build_object('id','analytics-test-catalog','name','PRIVATE_ITEM_SENTINEL',
      'size_id','regular','modifier_ids',jsonb_build_array('extra-30'),'size','PRIVATE_SIZE_SENTINEL','price',60,'quantity',2),
    jsonb_build_object('id','analytics-test-catalog','name','PRIVATE_ITEM_SENTINEL',
      'size_id','large','modifier_ids',jsonb_build_array('extra-5'),'size','كبير','price',40,'quantity',1)),
  'total_price',CASE WHEN n=1 THEN 157 ELSE 167 END,
  'analytics',jsonb_build_object('consent',true,'client_id','123.456','session_id','789',
    'revoke_token','acacacac-0000-4000-8000-' || lpad(n::text,12,'0'),
    'shipping',999999,'ignored','PRIVATE_ANALYTICS_SENTINEL')) AS p
FROM generate_series(1,15) n;
UPDATE analytics_fixtures SET p=p-'analytics' WHERE n=2;
UPDATE analytics_fixtures SET p=jsonb_set(p,'{analytics,consent}','false') WHERE n=10;
UPDATE analytics_fixtures SET p=jsonb_set(p,'{analytics,client_id}','"bad@example.com"') WHERE n=8;
UPDATE analytics_fixtures SET p=jsonb_set(p,'{analytics,revoke_token}','"not-a-uuid"') WHERE n=11;
UPDATE analytics_fixtures SET p=jsonb_set(p,'{analytics,session_id}','"not-digits"') WHERE n=12;
UPDATE analytics_fixtures SET p=jsonb_set(p,'{analytics,consent}','"true"') WHERE n=14;
-- Malformed historical size coverage is injected after valid submission below.
GRANT SELECT ON analytics_fixtures TO anon, authenticated, service_role;

SET LOCAL ROLE anon;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['chicky_analytics_context','chicky_analytics_outbox'] LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I',t);
      RAISE EXCEPTION 'Anonymous private read allowed' USING ERRCODE='XX000';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF has_table_privilege(current_user,'public.' || t,'INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Anonymous private write allowed';
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.submit_chicky_order_core('{}',NULL);
    RAISE EXCEPTION 'Anonymous core execute allowed' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.claim_chicky_analytics_batch();
    RAISE EXCEPTION 'Anonymous claim allowed' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.finish_chicky_analytics_event('test',true);
    RAISE EXCEPTION 'Anonymous ack allowed' USING ERRCODE='XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.submit_chicky_order(p,CASE WHEN n=1 THEN 'ANALYTICS_TEST' END)
FROM analytics_fixtures ORDER BY n;
-- Same order, different analytics: must neither consume promo nor replace context.
SELECT public.submit_chicky_order(jsonb_set(p,'{analytics}',
  '{"consent":true,"client_id":"999.888","session_id":"777","revoke_token":"bbbbbbbb-0000-4000-8000-000000000001"}'),
  'ANALYTICS_TEST') FROM analytics_fixtures WHERE n=1;
SELECT public.submit_chicky_order(jsonb_set(p,'{analytics,consent}','true'),NULL)
FROM analytics_fixtures WHERE n=10;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.orders WHERE id LIKE 'CH-ACACACAC-%')<>15 THEN
    RAISE EXCEPTION 'Missing fixture or duplicate retry'; END IF;
  IF (SELECT usage_limit FROM public.promo_codes WHERE code='ANALYTICS_TEST')<>0 THEN
    RAISE EXCEPTION 'Promo retry changed consumption'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chicky_analytics_context
    WHERE order_id='CH-ACACACAC-0000-0000-0000-000000000001'
      AND client_id='123.456' AND payload='{"shipping":7}'::jsonb) THEN
    RAISE EXCEPTION 'Retry replaced context or trusted client shipping'; END IF;
  IF EXISTS (SELECT 1 FROM public.chicky_analytics_context WHERE order_id IN
    (SELECT p->>'id' FROM analytics_fixtures WHERE n IN (2,8,10,11,12,14))) THEN
    RAISE EXCEPTION 'Missing/invalid consent stored identifiers or late retry attached context'; END IF;
  IF EXISTS (SELECT 1 FROM public.chicky_analytics_outbox WHERE order_id LIKE 'CH-ACACACAC-%') THEN
    RAISE EXCEPTION 'Pending order queued'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"chicky_admin":true}}',true);
DO $$ DECLARE t text; BEGIN
  IF public.is_chicky_admin() THEN RAISE EXCEPTION 'Untrusted admin flag accepted'; END IF;
  FOREACH t IN ARRAY ARRAY['chicky_analytics_context','chicky_analytics_outbox'] LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I',t);
      RAISE EXCEPTION 'Nonadmin private read allowed' USING ERRCODE='XX000';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF has_table_privilege(current_user,'public.' || t,'INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Nonadmin private write allowed'; END IF;
  END LOOP;
  IF has_function_privilege(current_user,'public.submit_chicky_order_core(jsonb,text)','EXECUTE')
    OR has_function_privilege(current_user,'public.claim_chicky_analytics_batch(integer)','EXECUTE')
    OR has_function_privilege(current_user,'public.finish_chicky_analytics_event(text,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'Nonadmin internal RPC allowed'; END IF;
END $$;
RESET ROLE;

-- Simulate a historical malformed item that the new submission core now rejects.
UPDATE public.orders SET items=jsonb_set(items,'{0,size_id}','"unrecognized-size"')
WHERE id IN (SELECT p->>'id' FROM analytics_fixtures WHERE n=15);
-- Keep coverage of the analytics fallback for pre-upgrade label-only sizes.
UPDATE public.orders SET items=jsonb_set(items,'{1}',(items->1)-'size_id')
WHERE id IN (SELECT p->>'id' FROM analytics_fixtures WHERE n=1);
-- Revoke before completion; unknown tokens must be harmless and return void.
SET LOCAL ROLE anon;
SELECT public.revoke_chicky_analytics('acacacac-0000-4000-8000-000000000003');
SELECT public.revoke_chicky_analytics('ffffffff-ffff-4fff-8fff-ffffffffffff');
RESET ROLE;
UPDATE public.orders SET status='cancelled' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=5);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.chicky_analytics_outbox WHERE order_id IN
    (SELECT p->>'id' FROM analytics_fixtures WHERE n=5)) THEN
    RAISE EXCEPTION 'Cancelled order queued'; END IF;
END $$;
UPDATE public.orders SET created_at=now()-interval '73 hours' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=6);
UPDATE public.chicky_analytics_context SET created_at=now()-interval '73 hours' WHERE order_id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=13);
-- A pre-upgrade pending order must not acquire context on retry, even inside 72h.
DELETE FROM public.chicky_analytics_context WHERE order_id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=7);
UPDATE public.orders SET created_at=now()-interval '25 hours' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=7);
SET LOCAL ROLE anon;
SELECT public.submit_chicky_order(p,NULL) FROM analytics_fixtures WHERE n=7;
RESET ROLE;
UPDATE public.orders SET status='completed' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n<>5);
UPDATE public.orders SET status='pending' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=1);
UPDATE public.orders SET status='completed' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=1);
UPDATE public.orders SET status='completed' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=1);
DO $$ DECLARE e jsonb; BEGIN
  IF (SELECT count(*) FROM public.chicky_analytics_outbox WHERE order_id LIKE 'CH-ACACACAC-%')<>3 THEN
    RAISE EXCEPTION 'Expected only orders 1,4,9, exactly once'; END IF;
  SELECT payload INTO STRICT e FROM public.chicky_analytics_outbox
  WHERE order_id='CH-ACACACAC-0000-0000-0000-000000000001';
  IF e->>'name'<>'purchase' OR e->'params'->>'currency'<>'EGP'
    OR (e->'params'->>'value')::numeric<>150 OR (e->'params'->>'shipping')::numeric<>7
    OR jsonb_array_length(e->'params'->'items')<>2
    OR e->'params'->'items'->0->>'item_id'<>'analytics-test-catalog--regular'
    OR e->'params'->'items'->1->>'item_id'<>'analytics-test-catalog--large'
    OR e->'params'->'items'->0->>'item_name'<>'Catalog chicken'
    OR (e->'params'->'items'->0->>'price')::numeric<>56.25
    OR (e->'params'->'items'->1->>'price')::numeric<>37.5 THEN
    RAISE EXCEPTION 'Catalog/variant/final modifier price/proportional promo/value mismatch'; END IF;
  IF (SELECT sum((i->>'price')::numeric*(i->>'quantity')::numeric)
      FROM jsonb_array_elements(e->'params'->'items') i)<>150 THEN
    RAISE EXCEPTION 'Discounted items do not reconcile'; END IF;
  IF EXISTS (SELECT 1 FROM public.chicky_analytics_outbox
    WHERE order_id LIKE 'CH-ACACACAC-%' AND
      (payload::text ~ 'PRIVATE_|01090000001|31[.]234567|30[.]123456|123[.]456'
       OR payload->'params' ?| ARRAY['tax','customer_name','phone','address','location',
         'notes','order_details','p_order','client_id','session_id']
       OR payload ?| ARRAY['client_id','session_id'])) THEN
    RAISE EXCEPTION 'PII, raw fields, identifiers or fabricated tax leaked'; END IF;
  IF e - ARRAY['name','params'] <> '{}'::jsonb
    OR (e->'params') - ARRAY['transaction_id','currency','value','shipping','items'] <> '{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(e->'params'->'items') i
      WHERE i - ARRAY['item_id','item_name','item_variant','price','quantity'] <> '{}'::jsonb) THEN
    RAISE EXCEPTION 'Event contains fields outside the explicit allowlist'; END IF;
END $$;

SET LOCAL ROLE anon;
SELECT public.revoke_chicky_analytics('acacacac-0000-4000-8000-000000000004');
SELECT public.revoke_chicky_analytics('acacacac-0000-4000-8000-000000000004');
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.chicky_analytics_outbox WHERE order_id IN
    (SELECT p->>'id' FROM analytics_fixtures WHERE n=4)) OR
    EXISTS (SELECT 1 FROM public.chicky_analytics_context WHERE order_id IN
      (SELECT p->>'id' FROM analytics_fixtures WHERE n IN (3,4))
      AND (consented OR client_id IS NOT NULL OR session_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Revoke failed to disable context/delete unsent'; END IF;
END $$;

-- Isolate queue fixtures without disturbing existing events after rollback.
-- A queued completed sale cancelled before delivery must not be claimed.
SAVEPOINT cancelled_conversion;
UPDATE public.orders SET status='cancelled' WHERE id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=9);
SET LOCAL ROLE chicky_analytics_worker;
DO $$ BEGIN
  IF has_table_privilege(current_user,'public.orders','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege(current_user,'public.chicky_analytics_context','SELECT') THEN
    RAISE EXCEPTION 'Worker has broad table access'; END IF;
  IF EXISTS(SELECT 1 FROM public.claim_chicky_analytics_batch(20)
    WHERE order_id='CH-ACACACAC-0000-0000-0000-000000000009') THEN
    RAISE EXCEPTION 'Cancelled sale was claimed'; END IF;
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT cancelled_conversion;
RELEASE SAVEPOINT cancelled_conversion;
UPDATE public.chicky_analytics_outbox SET next_attempt_at=now()+interval '1 day'
WHERE order_id NOT LIKE 'CH-ACACACAC-%';
SET LOCAL ROLE service_role;
DO $$ DECLARE r record; n integer:=0; BEGIN
  FOR r IN SELECT * FROM public.claim_chicky_analytics_batch(20) LOOP
    n:=n+1;
    IF r.payload->>'client_id'<>'123.456'
      OR r.payload->'events'->0->'params'->>'session_id'<>'789' THEN
      RAISE EXCEPTION 'Consented worker envelope missing identifiers'; END IF;
  END LOOP;
  IF n<>2 THEN RAISE EXCEPTION 'Expected two leased events'; END IF;
  IF EXISTS (SELECT 1 FROM public.claim_chicky_analytics_batch(20)) THEN
    RAISE EXCEPTION 'Active lease reclaimed'; END IF;
  PERFORM public.finish_chicky_analytics_event('CH-ACACACAC-0000-0000-0000-000000000001',false);
  IF NOT EXISTS (SELECT 1 FROM public.chicky_analytics_outbox
    WHERE order_id='CH-ACACACAC-0000-0000-0000-000000000001'
      AND attempts=1 AND locked_until IS NULL AND next_attempt_at>now() AND sent_at IS NULL) THEN
    RAISE EXCEPTION 'Retry backoff missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.claim_chicky_analytics_batch()) THEN
    RAISE EXCEPTION 'Backoff ignored'; END IF;
END $$;
UPDATE public.chicky_analytics_outbox SET next_attempt_at=now() WHERE order_id IN
  (SELECT p->>'id' FROM analytics_fixtures WHERE n=1);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.claim_chicky_analytics_batch(1))<>1 THEN
    RAISE EXCEPTION 'Retry not claimable'; END IF;
  PERFORM public.finish_chicky_analytics_event('CH-ACACACAC-0000-0000-0000-000000000001',true);
  PERFORM public.finish_chicky_analytics_event('CH-ACACACAC-0000-0000-0000-000000000001',false);
  IF NOT EXISTS (SELECT 1 FROM public.chicky_analytics_outbox
    WHERE order_id='CH-ACACACAC-0000-0000-0000-000000000001'
      AND sent_at IS NOT NULL AND locked_until IS NULL AND attempts=2) THEN
    RAISE EXCEPTION 'Success ack not durable/idempotent'; END IF;
END $$;
-- Expired lease can be reclaimed; finished events cannot.
UPDATE public.chicky_analytics_outbox SET locked_until=now()-interval '1 second'
WHERE order_id IN (SELECT p->>'id' FROM analytics_fixtures WHERE n=9);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.claim_chicky_analytics_batch())<>1 THEN
    RAISE EXCEPTION 'Expired lease not reclaimed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT public.revoke_chicky_analytics('acacacac-0000-4000-8000-000000000009');
SELECT public.revoke_chicky_analytics('acacacac-0000-4000-8000-000000000001');
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.chicky_analytics_outbox WHERE order_id IN
    (SELECT p->>'id' FROM analytics_fixtures WHERE n=9)) THEN
    RAISE EXCEPTION 'Leased unsent event survived revoke'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chicky_analytics_outbox WHERE order_id IN
    (SELECT p->>'id' FROM analytics_fixtures WHERE n=1) AND sent_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Revoke deleted already sent history'; END IF;
END $$;
ROLLBACK;
SELECT 'ANALYTICS_CONVERSION_TESTS_PASSED';
