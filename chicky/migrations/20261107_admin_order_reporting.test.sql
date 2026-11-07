-- Named isolated database only. All synthetic records roll back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF current_database()<>'chicky_analytics_test_20261102' THEN RAISE EXCEPTION 'Isolated reporting test database required'; END IF;
END $$;
INSERT INTO public.orders(id,customer_name,phone,address,area,items,total_price,status,created_at)
SELECT 'CH-40000000-0000-0000-0000-'||lpad(n::text,12,'0'),'REPORT FIXTURE','00000000000','ISOLATED TEST',
 CASE WHEN n%2=0 THEN 'East' ELSE 'West' END,
 '[{"name":"Fixture Meal","quantity":2},{"name":"Side","quantity":1}]'::jsonb,10.25,
 CASE WHEN n%10=0 THEN 'cancelled' ELSE 'pending' END,'2036-02-15T12:00:00Z'::timestamptz
FROM generate_series(1,2505) n;
INSERT INTO public.orders(id,customer_name,phone,address,area,items,total_price,status,created_at) VALUES
 ('CH-40000000-0000-0000-0000-000000900001','REPORT FIXTURE','00000000000','ISOLATED TEST','West','[]',1,'pending','2036-02-01T00:00:00Z'),
 ('CH-40000000-0000-0000-0000-000000900002','REPORT FIXTURE','00000000000','ISOLATED TEST','West','[]',9999,'pending','2036-01-31T23:59:59.999999Z'),
 ('CH-40000000-0000-0000-0000-000000900003','REPORT FIXTURE','00000000000','ISOLATED TEST','West','[]',9999,'pending','2036-03-01T00:00:00Z');
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.get_chicky_order_stats('2036-02-01','2036-03-01');
 RAISE EXCEPTION 'Anonymous stats allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.export_chicky_orders_page('2036-02-01','2036-03-01');
 RAISE EXCEPTION 'Anonymous export allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","user_metadata":{"chicky_admin":true}}',true);
DO $$ BEGIN
 BEGIN PERFORM public.get_chicky_order_stats('2036-02-01','2036-03-01');
 RAISE EXCEPTION 'User metadata granted stats access' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.export_chicky_orders_page('2036-02-01','2036-03-01');
 RAISE EXCEPTION 'User metadata granted export access' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","app_metadata":{"chicky_admin":true}}',true);
DO $$ DECLARE s jsonb; BEGIN
 s:=public.get_chicky_order_stats('2036-02-01T00:00:00Z','2036-03-01T00:00:00Z');
 IF (s->>'totalOrders')::integer<>2256 OR (s->>'totalRevenue')::numeric<>23114.75
 OR (s->'areaStats'->'West'->>'count')::integer<>1254
 OR (s->'areaStats'->'East'->>'count')::integer<>1002
 OR s->'topArea'->>0<>'West' OR s->'topItem'->>0<>'Fixture Meal'
 OR (s->'topItem'->>1)::numeric<>4510 THEN RAISE EXCEPTION 'Large-period totals/scopes changed: %',s; END IF;
 s:=public.get_chicky_order_stats('2044-01-01','2044-02-01');
 IF s->>'totalOrders'<>'0' OR s->>'totalRevenue'<>'0' OR s->'areaStats'<>'{}'::jsonb
 OR s->'topArea'<>'null'::jsonb OR s->'topItem'<>'null'::jsonb THEN RAISE EXCEPTION 'Empty period incorrect'; END IF;
 BEGIN PERFORM public.get_chicky_order_stats('2036-03-01','2036-02-01');
 RAISE EXCEPTION 'Reversed period accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 BEGIN PERFORM * FROM public.export_chicky_orders_page('2036-02-01','2036-03-01',NULL,NULL,251);
 RAISE EXCEPTION 'Unbounded export accepted' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
RESET ROLE;
CREATE TEMP TABLE export_seen(id text PRIMARY KEY);
GRANT SELECT,INSERT ON export_seen TO authenticated;
SET LOCAL ROLE authenticated;
DO $$ DECLARE r record; last_at timestamptz; last_id text; n integer; BEGIN
 LOOP
  n:=0;
  FOR r IN SELECT * FROM public.export_chicky_orders_page('2036-02-01','2036-03-01',last_at,last_id,250) LOOP
   INSERT INTO export_seen VALUES(r.id);
   IF r.status='cancelled' THEN RAISE EXCEPTION 'Cancelled order exported'; END IF;
   last_at:=r.created_at;last_id:=r.id;n:=n+1;
  END LOOP;
  IF n>250 THEN RAISE EXCEPTION 'Export page exceeds bound'; END IF;
  EXIT WHEN n<250;
 END LOOP;
 IF (SELECT count(*) FROM export_seen)<>2256 THEN RAISE EXCEPTION 'Export truncated or skipped equal-timestamp rows'; END IF;
END $$;
RESET ROLE;
-- Equal popularity keeps newest-order/first-item tie behavior.
INSERT INTO public.orders(id,customer_name,phone,address,area,items,total_price,status,created_at) VALUES
 ('CH-40000000-0000-0000-0000-000000800001','REPORT FIXTURE','00000000000','ISOLATED TEST','Older','[{"name":"Z-first","quantity":1},{"name":"A-second","quantity":1}]',10,'pending','2037-01-01'),
 ('CH-40000000-0000-0000-0000-000000800002','REPORT FIXTURE','00000000000','ISOLATED TEST','Newest','[{"name":"Z-first","quantity":1},{"name":"A-second","quantity":1}]',10,'pending','2037-01-01');
SET LOCAL ROLE authenticated;
DO $$ DECLARE s jsonb; BEGIN
 s:=public.get_chicky_order_stats('2037-01-01','2037-02-01');
 IF s->'topArea'->>0<>'Newest' OR s->'topItem'->>0<>'Z-first' THEN RAISE EXCEPTION 'Popularity ties changed'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'ADMIN_ORDER_REPORTING_LARGE_DATA_TESTS_PASSED';
