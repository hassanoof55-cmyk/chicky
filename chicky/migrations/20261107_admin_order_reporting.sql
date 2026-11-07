-- Administrator-only reporting. Existing order/pricing/status rules are unchanged.
BEGIN;
CREATE INDEX IF NOT EXISTS chicky_orders_created_id_idx ON public.orders(created_at DESC,id DESC);

CREATE OR REPLACE FUNCTION public.get_chicky_order_stats(p_from timestamptz,p_until timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_chicky_admin() THEN RAISE insufficient_privilege USING MESSAGE='Administrator access required'; END IF;
  IF p_from IS NULL OR p_until IS NULL OR p_until<=p_from THEN RAISE EXCEPTION 'Invalid reporting period'; END IF;
  WITH filtered AS MATERIALIZED (
    SELECT id,created_at,coalesce(nullif(area,''),'Unknown') AS area,total_price,items
    FROM public.orders WHERE created_at>=p_from AND created_at<p_until AND status IS DISTINCT FROM 'cancelled'
  ), area_groups AS (
    SELECT area,count(*) AS count,coalesce(sum(total_price::numeric),0) AS revenue FROM filtered GROUP BY area
  ), area_first AS (
    SELECT DISTINCT ON(area) area,created_at,id FROM filtered ORDER BY area,created_at DESC,id DESC
  ), item_rows AS MATERIALIZED (
    SELECT coalesce(item.value->>'name','undefined') AS name,
      CASE WHEN jsonb_typeof(item.value->'quantity')='number'
        OR (jsonb_typeof(item.value->'quantity')='string' AND item.value->>'quantity' ~ '^[+-]?[0-9]+([.][0-9]+)?$')
        THEN (item.value->>'quantity')::numeric ELSE 0 END AS quantity,
      f.created_at,f.id,item.ordinality
    FROM filtered f CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(f.items)='array' THEN f.items ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS item(value,ordinality)
  ), item_groups AS (
    SELECT name,sum(quantity) AS quantity FROM item_rows GROUP BY name
  ), item_first AS (
    SELECT DISTINCT ON(name) name,created_at,id,ordinality FROM item_rows
    ORDER BY name,created_at DESC,id DESC,ordinality
  )
  SELECT jsonb_build_object(
    'totalOrders',(SELECT count(*) FROM filtered),
    'totalRevenue',(SELECT coalesce(sum(total_price::numeric),0) FROM filtered),
    'areaStats',coalesce((SELECT jsonb_object_agg(area,jsonb_build_object('count',count,'revenue',revenue)) FROM area_groups),'{}'::jsonb),
    'areaOrder',coalesce((SELECT jsonb_agg(area ORDER BY created_at DESC,id DESC) FROM area_first),'[]'::jsonb),
    'topArea',(SELECT jsonb_build_array(g.area,jsonb_build_object('count',g.count,'revenue',g.revenue))
      FROM area_groups g JOIN area_first f USING(area) ORDER BY g.count DESC,f.created_at DESC,f.id DESC LIMIT 1),
    'topItem',(SELECT jsonb_build_array(g.name,g.quantity) FROM item_groups g JOIN item_first f USING(name)
      ORDER BY g.quantity DESC,f.created_at DESC,f.id DESC,f.ordinality LIMIT 1)
  ) INTO result;
  RETURN result;
END $$;

-- Keyset pagination prevents new, newer orders from shifting rows between export
-- batches. JSON aggregation above is one result, so API row caps cannot truncate totals.
CREATE OR REPLACE FUNCTION public.export_chicky_orders_page(
  p_from timestamptz,p_until timestamptz,p_before_at timestamptz DEFAULT NULL,
  p_before_id text DEFAULT NULL,p_limit integer DEFAULT 250)
RETURNS SETOF public.orders LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.is_chicky_admin() THEN RAISE insufficient_privilege USING MESSAGE='Administrator access required'; END IF;
  IF p_from IS NULL OR p_until IS NULL OR p_until<=p_from OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 250
    OR ((p_before_at IS NULL)<>(p_before_id IS NULL)) THEN RAISE EXCEPTION 'Invalid export request'; END IF;
  RETURN QUERY SELECT o.* FROM public.orders o
    WHERE o.created_at>=p_from AND o.created_at<p_until AND o.status IS DISTINCT FROM 'cancelled'
      AND (p_before_at IS NULL OR (o.created_at,o.id)<(p_before_at,p_before_id))
    ORDER BY o.created_at DESC,o.id DESC LIMIT p_limit;
END $$;
REVOKE ALL ON FUNCTION public.get_chicky_order_stats(timestamptz,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.export_chicky_orders_page(timestamptz,timestamptz,timestamptz,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_chicky_order_stats(timestamptz,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_chicky_orders_page(timestamptz,timestamptz,timestamptz,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
