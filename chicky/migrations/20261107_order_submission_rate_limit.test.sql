-- Isolated database only. No test order survives this transaction.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.menu_items(id,name,"nameAr",price,category,"hasSizes","spicinessOption")
VALUES ('rate-test-catalog','Rate fixture','اختبار',100,'test',false,false);
CREATE TEMP TABLE rate_fixture AS SELECT jsonb_build_object(
 'id','CH-20000000-0000-0000-0000-000000000001','customer_name','RATE TEST',
 'phone','01000000123','address','ISOLATED TEST','service_type','pickup',
 'items',jsonb_build_array(jsonb_build_object('id','rate-test-catalog','price',100,'quantity',1)),
 'total_price',100) AS p;
GRANT SELECT ON rate_fixture TO anon;
SET LOCAL ROLE anon;
DO $$ DECLARE o jsonb; i integer; BEGIN
 SELECT p INTO o FROM rate_fixture;
 FOR i IN 1..5 LOOP
   PERFORM public.submit_chicky_order(o || jsonb_build_object('id','CH-20000000-0000-0000-0000-'||lpad(i::text,12,'0')));
 END LOOP;
 -- Same payload/ID succeeds even at the limit.
 PERFORM public.submit_chicky_order(o);
 BEGIN
   PERFORM public.submit_chicky_order(o || '{"id":"CH-20000000-0000-0000-0000-000000000006"}');
   RAISE EXCEPTION 'Sixth order accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL; END;
 BEGIN
   PERFORM public.submit_chicky_order(o || '{"id":"CH-20000000-0000-0000-0000-000000000006","phone":"+20 1000000123 / 01200000000"}');
   RAISE EXCEPTION 'Phone formatting bypassed limit' USING ERRCODE='XX000';
 EXCEPTION WHEN SQLSTATE 'PT429' THEN NULL; END;
 PERFORM public.submit_chicky_order(o || '{"id":"CH-20000000-0000-0000-0000-000000000007","phone":"01000000456"}');
END $$;
RESET ROLE;
DO $$ BEGIN
 IF public.chicky_order_phone_key('٠١٠٠٠٠٠٠١٢٣')<>'01000000123'
 OR public.chicky_order_phone_key('00201000000123')<>'01000000123'
 THEN RAISE EXCEPTION 'Phone normalization failed'; END IF;
 IF has_function_privilege('anon','public.chicky_order_phone_key(text)','EXECUTE')
 OR has_function_privilege('anon','public.submit_chicky_order_core(jsonb,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Internal function exposed'; END IF;
END $$;
UPDATE public.orders SET created_at=statement_timestamp()-interval '11 minutes'
WHERE id LIKE 'CH-20000000-%';
SET LOCAL ROLE anon;
SELECT public.submit_chicky_order(p || '{"id":"CH-20000000-0000-0000-0000-000000000008"}') FROM rate_fixture;
RESET ROLE;
ROLLBACK;
SELECT 'ORDER_RATE_LIMIT_TESTS_PASSED';
