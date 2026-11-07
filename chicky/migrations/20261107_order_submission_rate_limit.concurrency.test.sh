#!/bin/sh
# Execute inside the DB container. Only this named isolated database is allowed.
set -eu
db=chicky_analytics_test_20261102
run_sql() { psql -X -v ON_ERROR_STOP=1 -U supabase_admin -d "$db" "$@"; }
run_sql <<'SQL'
BEGIN;
INSERT INTO public.menu_items(id,name,"nameAr",price,category,"hasSizes","spicinessOption")
VALUES ('rate-concurrency-fixture','Concurrency fixture','اختبار',100,'test',false,false)
ON CONFLICT(id) DO NOTHING;
-- Reset only this synthetic workflow's previous fixtures, never customer data.
UPDATE public.orders SET created_at=now()-interval '1 day'
WHERE phone='01000000999' AND customer_name='RATE CONCURRENCY TEST';
INSERT INTO public.orders(id,customer_name,phone,address,items,total_price,status)
SELECT 'CH-30000000-0000-0000-0000-'||lpad(n::text,12,'0'),
 'RATE CONCURRENCY TEST','01000000999','ISOLATED TEST','[]'::jsonb,100,'pending'
FROM generate_series(1,4) n
ON CONFLICT(id) DO UPDATE SET created_at=now();
COMMIT;
SQL
query="BEGIN; SELECT public.submit_chicky_order(jsonb_build_object(
'id','CH-'||upper(gen_random_uuid()::text),'customer_name','RATE CONCURRENCY TEST',
'phone','01000000999','address','ISOLATED TEST','service_type','pickup',
'items','[{\"id\":\"rate-concurrency-fixture\",\"price\":100,\"quantity\":1}]'::jsonb,
'total_price',100)); SELECT pg_sleep(1); COMMIT;"
run_sql -c "$query" > /tmp/chicky-rate-race-a.log 2>&1 &
first=$!
run_sql -c "$query" > /tmp/chicky-rate-race-b.log 2>&1 &
second=$!
success=0
if wait "$first"; then success=$((success+1)); fi
if wait "$second"; then success=$((success+1)); fi
if [ "$success" -ne 1 ]; then
 cat /tmp/chicky-rate-race-a.log /tmp/chicky-rate-race-b.log
 exit 1
fi
run_sql <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM public.orders WHERE phone='01000000999'
   AND created_at>=statement_timestamp()-interval '10 minutes')<>5
 THEN RAISE EXCEPTION 'Concurrent requests exceeded the five-order limit'; END IF;
END $$;
SELECT 'ORDER_RATE_LIMIT_CONCURRENCY_TEST_PASSED';
SQL
