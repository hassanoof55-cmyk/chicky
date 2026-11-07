BEGIN;
INSERT INTO public.menu_items(id,name,"nameAr",price,category,"hasSizes","spicinessOption")
VALUES ('access-test-catalog','Access fixture','اختبار',100,'test',false,false);

SET LOCAL ROLE anon;
DO $$ BEGIN
  IF public.is_chicky_admin() THEN RAISE EXCEPTION 'Anonymous administrator'; END IF;
  BEGIN PERFORM * FROM public.orders; RAISE EXCEPTION 'Anonymous order read allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.promo_codes SET usage_limit=0; RAISE EXCEPTION 'Anonymous promo write allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.submit_chicky_order(jsonb_build_object('id','CH-00000000-0000-0000-0000-000000000001',
  'customer_name','Migration Test','phone','00000000000','address','TEST ONLY','service_type','pickup',
  'items',jsonb_build_array(jsonb_build_object('id',id,'price',price,'quantity',1)),'total_price',price,'status','completed'))
FROM public.menu_items WHERE id='access-test-catalog' LIMIT 1;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='CH-00000000-0000-0000-0000-000000000001' AND status='pending') THEN
    RAISE EXCEPTION 'Submission did not create pending order'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"chicky_admin":true}}',true);
DO $$ BEGIN
  IF public.is_chicky_admin() THEN RAISE EXCEPTION 'User metadata escalated privileges'; END IF;
  IF EXISTS(SELECT 1 FROM public.orders) THEN RAISE EXCEPTION 'Non-admin read private orders'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"chicky_admin":true}}',true);
DO $$ BEGIN
  IF NOT public.is_chicky_admin() THEN RAISE EXCEPTION 'Signed admin flag not accepted'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.orders WHERE id='CH-00000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Admin order read denied'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.promo_codes(code,discount_type,discount_value,is_active,usage_limit) VALUES ('MIGRATION_TEST','fixed',1,true,1);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
SELECT public.submit_chicky_order(jsonb_build_object('id','CH-00000000-0000-0000-0000-000000000002',
  'customer_name','Migration Test','phone','00000000000','address','TEST ONLY','service_type','pickup',
  'items',jsonb_build_array(jsonb_build_object('id',id,'price',price,'quantity',1)),'total_price',price-1),'MIGRATION_TEST')
FROM public.menu_items WHERE id='access-test-catalog' LIMIT 1;
-- A lost HTTP response must not create a duplicate or consume the promo again.
SELECT public.submit_chicky_order(jsonb_build_object('id','CH-00000000-0000-0000-0000-000000000002',
  'customer_name','Migration Test','phone','00000000000','address','TEST ONLY','service_type','pickup',
  'items',jsonb_build_array(jsonb_build_object('id',id,'price',price,'quantity',1)),'total_price',price-1),'MIGRATION_TEST')
FROM public.menu_items WHERE id='access-test-catalog' LIMIT 1;
DO $$ DECLARE item public.menu_items%ROWTYPE; BEGIN
  SELECT * INTO item FROM public.menu_items WHERE id='access-test-catalog' LIMIT 1;
  BEGIN
    PERFORM public.submit_chicky_order(jsonb_build_object('id','CH-00000000-0000-0000-0000-000000000003',
      'customer_name','Migration Test','phone','00000000000','address','TEST ONLY','service_type','pickup',
      'items',jsonb_build_array(jsonb_build_object('id',item.id,'price',item.price,'quantity',1)),'total_price',item.price-1),'MIGRATION_TEST');
    RAISE EXCEPTION 'Used-up promo was accepted' USING ERRCODE='XX000';
  EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.promo_codes WHERE code='MIGRATION_TEST' AND usage_limit=0 AND NOT is_active) THEN RAISE EXCEPTION 'Promo not consumed'; END IF;
  IF EXISTS(SELECT 1 FROM public.orders WHERE id='CH-00000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'Rejected order leaked through transaction'; END IF;
END $$;
ROLLBACK;
SELECT 'SECURITY_AND_ORDER_TESTS_PASSED';
