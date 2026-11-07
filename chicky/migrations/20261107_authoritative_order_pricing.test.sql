-- Isolated database only; fixture changes and all orders roll back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.menu_items(id,name,"nameAr",price,category,"hasSizes","spicinessOption",sizes,modifiers)
VALUES ('security-base','Canonical meal','وجبة',100,'security-test',false,false,'[]',
 '[{"id":"cheese","nameEn":"Cheese","nameAr":"جبنة","price":10}]'),
 ('security-sized','Sized meal','وجبة كبيرة',0,'security-test',true,true,
 '[{"id":"large","nameEn":"Large","nameAr":"كبير","price":150}]','[]');

DO $$ DECLARE
 o jsonb := '{"id":"CH-10000000-0000-0000-0000-000000000001","customer_name":"SECURITY TEST","phone":"00000000000","address":"ISOLATED TEST","service_type":"pickup","items":[{"id":"security-base","name":"Forged name","price":1,"quantity":1}],"total_price":1}';
 bad jsonb; line jsonb;
BEGIN
 -- This deliberately fails on the vulnerable implementation.
 BEGIN
   PERFORM public.submit_chicky_order(o);
   RAISE EXCEPTION 'Tampered catalog price accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 FOR line IN SELECT value FROM jsonb_array_elements('[
   {"id":"security-sized","price":1,"quantity":1,"size_id":"large","spiciness":"Normal"},
   {"id":"security-sized","price":150,"quantity":1,"size_id":"foreign","spiciness":"Normal"},
   {"id":"security-sized","price":150,"quantity":1},
   {"id":"security-sized","price":150,"quantity":1,"size_id":"large","spiciness":"Invalid"},
   {"id":"security-base","price":100,"quantity":1,"modifier_ids":["foreign"]},
   {"id":"security-base","price":110,"quantity":1,"modifier_ids":["cheese","cheese"]},
   {"id":"security-base","price":100,"quantity":1,"modifier_ids":["cheese"]},
   {"id":"security-base","price":100,"quantity":0}
 ]'::jsonb) LOOP
   bad := o || jsonb_build_object('items',jsonb_build_array(line),'total_price',(line->>'price')::numeric);
   BEGIN
     PERFORM public.submit_chicky_order(bad);
     RAISE EXCEPTION 'Invalid options accepted: %',line USING ERRCODE='XX000';
   EXCEPTION WHEN raise_exception THEN NULL; END;
 END LOOP;
END $$;

SET LOCAL ROLE anon;
SELECT public.submit_chicky_order('{"id":"CH-10000000-0000-0000-0000-000000000001","customer_name":"SECURITY TEST","phone":"00000000000","address":"ISOLATED TEST","service_type":"pickup","scheduled_time":"23:30","language":"ar","items":[{"id":"security-base","name":"Forged name","price":110,"quantity":2,"modifier_ids":["cheese"]},{"id":"security-sized","price":150,"quantity":1,"size_id":"large","spiciness":"Spicy"}],"total_price":370}');
RESET ROLE;
DO $$ DECLARE o public.orders%ROWTYPE; BEGIN
 SELECT * INTO STRICT o FROM public.orders WHERE id='CH-10000000-0000-0000-0000-000000000001';
 IF o.total_price<>370 OR o.status<>'pending'
 OR o.items->0->>'name'<>'وجبة'
 OR o.items->0->'selectedModifiers'->0->>'nameEn'<>'Cheese'
 OR o.items->1->'selectedSize'->>'id'<>'large'
 OR o.items->1->>'spiciness'<>'Spicy'
 OR o.order_details->>'scheduled_time'<>'23:30'
 THEN RAISE EXCEPTION 'Canonical order details lost'; END IF;
END $$;
-- Existing scoped discounts, server delivery fees and atomic promo use survive.
INSERT INTO public.promo_codes(code,discount_type,discount_value,is_active,usage_limit,applicable_products)
VALUES ('SECURITY_TEST_PROMO','percentage',10,true,1,ARRAY['security-base']);
UPDATE public.site_settings SET config_data=jsonb_set(config_data,'{areas}',
 '[{"id":"security-area","nameEn":"Test area","fee":25}]') WHERE id='active_config';
DO $$ DECLARE
 o jsonb := '{"id":"CH-10000000-0000-0000-0000-000000000002","customer_name":"SECURITY TEST","phone":"00000000000","address":"ISOLATED TEST","service_type":"delivery","area_id":"security-area","items":[{"id":"security-base","price":110,"quantity":2,"modifier_ids":["cheese"]},{"id":"security-sized","price":150,"quantity":1,"size_id":"large","spiciness":"Normal"}],"total_price":373}';
BEGIN
 BEGIN
   PERFORM public.submit_chicky_order(o || '{"total_price":348}', 'SECURITY_TEST_PROMO');
   RAISE EXCEPTION 'Forged delivery total accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.promo_codes WHERE code='SECURITY_TEST_PROMO' AND usage_limit=1)
 THEN RAISE EXCEPTION 'Rejected total consumed promo'; END IF;
 BEGIN
   PERFORM public.submit_chicky_order(o || '{"scheduled_time":"25:00"}', 'SECURITY_TEST_PROMO');
   RAISE EXCEPTION 'Invalid scheduled time accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 PERFORM public.submit_chicky_order(o,'SECURITY_TEST_PROMO');
 PERFORM public.submit_chicky_order(o,'SECURITY_TEST_PROMO');
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id=o->>'id' AND total_price=373)
 OR NOT EXISTS(SELECT 1 FROM public.promo_codes WHERE code='SECURITY_TEST_PROMO' AND usage_limit=0 AND NOT is_active)
 THEN RAISE EXCEPTION 'Scoped discount, delivery fee or retry changed'; END IF;
 BEGIN
   PERFORM public.submit_chicky_order(o || '{"id":"CH-10000000-0000-0000-0000-000000000003"}', 'SECURITY_TEST_PROMO');
   RAISE EXCEPTION 'Exhausted promo accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
-- An identical retry still succeeds after a catalog change.
UPDATE public.menu_items SET price=120 WHERE id='security-base';
SET LOCAL ROLE anon;
SELECT public.submit_chicky_order('{"id":"CH-10000000-0000-0000-0000-000000000001","customer_name":"SECURITY TEST","phone":"00000000000","address":"ISOLATED TEST","service_type":"pickup","scheduled_time":"23:30","language":"ar","items":[{"id":"security-base","name":"Forged name","price":110,"quantity":2,"modifier_ids":["cheese"]},{"id":"security-sized","price":150,"quantity":1,"size_id":"large","spiciness":"Spicy"}],"total_price":370}');
DO $$ BEGIN
 BEGIN PERFORM public.submit_chicky_order_core('{}',NULL);
 RAISE EXCEPTION 'Anonymous core execution allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'AUTHORITATIVE_ORDER_PRICING_TESTS_PASSED';
