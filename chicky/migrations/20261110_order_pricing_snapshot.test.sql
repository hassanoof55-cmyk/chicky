-- Isolated database only. All fixtures, catalog/area edits and orders roll back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_database() NOT LIKE 'chicky_pricing_test_%' THEN RAISE EXCEPTION 'Run only in the isolated pricing test database'; END IF; END $$;
INSERT INTO public.menu_items(id,name,"nameAr",price,category,"hasSizes","spicinessOption")
VALUES ('pricing-snapshot-meal','Pricing fixture','اختبار التسعير',100,'pricing-test',false,false),
 ('pricing-snapshot-decimal','Decimal fixture','اختبار الكسور',99.95,'pricing-test',false,false);
UPDATE public.site_settings SET config_data=jsonb_set(config_data,'{areas}',
 '[{"id":"pricing-snapshot-area","nameEn":"Test area","fee":30}]') WHERE id='active_config';
INSERT INTO public.promo_codes(code,discount_type,discount_value,is_active,usage_limit)
VALUES ('PRICING_SNAPSHOT_PERCENT','percentage',10,true,5),('PRICING_SNAPSHOT_FIXED','fixed',15,true,5);
CREATE TEMP TABLE pricing_fixture AS SELECT jsonb_build_object(
 'id','CH-30000000-0000-0000-0000-000000000001','customer_name','PRICING TEST',
 'phone','01000000981','address','ISOLATED TEST','service_type','delivery','area_id','pricing-snapshot-area',
 'items',jsonb_build_array(jsonb_build_object('id','pricing-snapshot-meal','price',100,'quantity',2)),
 'total_price',210,'pricing',jsonb_build_object('version',1,'subtotal',1,'delivery_fee',999,'discount_amount',999)) AS p;
GRANT SELECT ON pricing_fixture TO anon;
SET LOCAL ROLE anon;
SELECT public.submit_chicky_order(p,'PRICING_SNAPSHOT_PERCENT') FROM pricing_fixture;
SELECT public.submit_chicky_order(p || '{"id":"CH-30000000-0000-0000-0000-000000000002","service_type":"pickup","total_price":200}') FROM pricing_fixture;
SELECT public.submit_chicky_order(p || '{"id":"CH-30000000-0000-0000-0000-000000000003","total_price":230}') FROM pricing_fixture;
SELECT public.submit_chicky_order(p || '{"id":"CH-30000000-0000-0000-0000-000000000004","service_type":"dine-in","total_price":185}','PRICING_SNAPSHOT_FIXED') FROM pricing_fixture;
SELECT public.submit_chicky_order(p || '{"id":"CH-30000000-0000-0000-0000-000000000005","total_price":209.91,"items":[{"id":"pricing-snapshot-decimal","price":99.95,"quantity":2}]}','PRICING_SNAPSHOT_PERCENT') FROM pricing_fixture;
RESET ROLE;
DO $$ DECLARE actual jsonb; expected jsonb; i integer; BEGIN
 FOR i IN 1..5 LOOP
   SELECT order_details->'pricing' INTO STRICT actual FROM public.orders
   WHERE id='CH-30000000-0000-0000-0000-'||lpad(i::text,12,'0');
   expected := CASE i
    WHEN 1 THEN '{"version":1,"subtotal":200,"delivery_fee":30,"discount_amount":20}'
    WHEN 2 THEN '{"version":1,"subtotal":200,"delivery_fee":0,"discount_amount":0}'
    WHEN 3 THEN '{"version":1,"subtotal":200,"delivery_fee":30,"discount_amount":0}'
    WHEN 4 THEN '{"version":1,"subtotal":200,"delivery_fee":0,"discount_amount":15}'
    WHEN 5 THEN '{"version":1,"subtotal":199.90,"delivery_fee":30,"discount_amount":19.99}' END;
   IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Wrong pricing snapshot for case %: %',i,actual; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.submit_chicky_order_core(jsonb,text)','EXECUTE')
 OR NOT has_function_privilege('anon','public.submit_chicky_order(jsonb,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Submission access grants changed'; END IF;
END $$;
-- Identical retries retain the original pricing even after fee/catalog edits.
UPDATE public.site_settings SET config_data=jsonb_set(config_data,'{areas,0,fee}','50') WHERE id='active_config';
UPDATE public.menu_items SET price=300 WHERE id='pricing-snapshot-meal';
SET LOCAL ROLE anon;
SELECT public.submit_chicky_order(p,'PRICING_SNAPSHOT_PERCENT') FROM pricing_fixture;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='CH-30000000-0000-0000-0000-000000000001'
   AND total_price=210 AND order_details->'pricing'='{"version":1,"subtotal":200,"delivery_fee":30,"discount_amount":20}'::jsonb)
 OR (SELECT usage_limit FROM public.promo_codes WHERE code='PRICING_SNAPSHOT_PERCENT')<>3
 OR (SELECT count(*) FROM public.orders WHERE id LIKE 'CH-30000000-%')<>5
 THEN RAISE EXCEPTION 'Retry changed pricing, promo usage or order count'; END IF;
END $$;
ROLLBACK;
SELECT 'ORDER_PRICING_SNAPSHOT_TESTS_PASSED';
