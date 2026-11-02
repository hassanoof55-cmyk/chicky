export async function persistOrder(client: any, order: Record<string, unknown>, promoCode: string | null = null, storage: Storage = sessionStorage) {
  const { analytics, ...businessOrder } = order;
  const bytes = new TextEncoder().encode(JSON.stringify({ order: businessOrder, promoCode }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const key = 'chicky_order_attempt_' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const id = storage.getItem(key) || 'CH-' + crypto.randomUUID().toUpperCase();
  storage.setItem(key, id);
  const { error } = await client.rpc('submit_chicky_order', { p_order: { ...order, id }, p_promo_code: promoCode });
  if (error) throw new Error('تعذر حفظ الطلب. جرّب تاني قبل ما تقفل الصفحة.');
  storage.removeItem(key);
  return id;
}
