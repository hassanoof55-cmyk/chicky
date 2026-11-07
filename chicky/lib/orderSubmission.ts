class OrderRateLimitError extends Error {}

export function orderSubmissionErrorMessage(error: unknown, language: 'ar' | 'en') {
  if (error instanceof OrderRateLimitError) return language === 'ar'
    ? 'وصلت للحد المسموح من الطلبات. استنى ١٠ دقائق وحاول تاني.'
    : 'You have reached the order limit. Please wait 10 minutes and try again.';
  return language === 'ar' ? 'تعذر حفظ الطلب. جرّب تاني قبل ما تقفل الصفحة.' : 'Your order could not be saved. Please try again.';
}

export async function persistOrder(client: any, order: Record<string, unknown>, promoCode: string | null = null, storage: Storage = sessionStorage) {
  const { analytics, ...businessOrder } = order;
  const bytes = new TextEncoder().encode(JSON.stringify({ order: businessOrder, promoCode }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const key = 'chicky_order_attempt_' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const id = storage.getItem(key) || 'CH-' + crypto.randomUUID().toUpperCase();
  storage.setItem(key, id);
  const { error } = await client.rpc('submit_chicky_order', { p_order: { ...order, id }, p_promo_code: promoCode });
  if (error?.code === 'PT429') throw new OrderRateLimitError('وصلت للحد المسموح من الطلبات. استنى ١٠ دقائق وحاول تاني.');
  if (error) throw new Error('تعذر حفظ الطلب. جرّب تاني قبل ما تقفل الصفحة.');
  storage.removeItem(key);
  return id;
}
