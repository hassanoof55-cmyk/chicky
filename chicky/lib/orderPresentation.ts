import type { StoredOrder } from '../types';

export function shortOrderId(id: string): string { return `CH-${id.replace(/^CH-/i, '').replace(/-/g, '').slice(-8).toUpperCase()}`; }
export function orderPhones(phone: string): string[] {
  return phone.split(/[\/،,;]/).map(part => part.trim()).filter(Boolean).map(part => part.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632))).filter(part => /^\+?[\d\s()-]{7,22}$/.test(part));
}
export function orderAddress(order: StoredOrder): string { return (order.address || '').replace(/\s*\[Payment:\s*(?:CASH|WALLET|CARD|INSTAPAY)\]/gi, '').trim(); }
export function orderPayment(order: StoredOrder): string {
  const method = order.paymentMethod || order.address?.match(/\[Payment:\s*(CASH|WALLET|CARD|INSTAPAY)\]/i)?.[1];
  return ({ cash: 'كاش', wallet: 'محفظة إلكترونية', card: 'بطاقة', instapay: 'InstaPay' })[method?.toLowerCase() || ''] || 'غير مسجّل';
}
export function orderMoney(order: StoredOrder): { subtotal: number; adjustment: number; breakdown?: { deliveryFee: number; discountAmount: number } } {
  const subtotal = Math.round(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  const pricing = order.pricing;
  if (pricing?.version === 1 && [pricing.subtotal, pricing.delivery_fee, pricing.discount_amount].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
      && Math.abs(pricing.subtotal - subtotal) <= 0.011
      && Math.abs(pricing.subtotal + pricing.delivery_fee - pricing.discount_amount - order.totalPrice) <= 0.011) {
    return { subtotal: pricing.subtotal, adjustment: Math.round((order.totalPrice - pricing.subtotal) * 100) / 100,
      breakdown: { deliveryFee: pricing.delivery_fee, discountAmount: pricing.discount_amount } };
  }
  return { subtotal, adjustment: Math.round((order.totalPrice - subtotal) * 100) / 100 };
}
export function orderTimestamp(createdAt: string): string {
  return new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(createdAt));
}
export function orderStatus(status: StoredOrder['status']): string { return status === 'pending' ? 'قيد التنفيذ' : status === 'completed' ? 'مكتمل' : 'ملغي'; }
export function orderService(order: StoredOrder): string {
  if (order.serviceType === 'delivery') return 'توصيل';
  if (order.serviceType === 'pickup') return 'استلام من الفرع';
  if (order.serviceType === 'dine-in') return 'داخل المطعم';
  return 'نوع الخدمة غير مسجّل';
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function orderReceiptHtml(order: StoredOrder): string {
  const money = orderMoney(order);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escape(shortOrderId(order.id))}</title><style>body{font:15px Arial,sans-serif;color:#111;max-width:76mm;margin:12px auto;padding:8px}h1,h2{text-align:center}p{line-height:1.6;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td{padding:8px 3px;border-bottom:1px solid #ddd;vertical-align:top}small{display:block;font-size:12px;color:#444}hr{border:0;border-top:1px dashed #888}.total{font-size:20px;font-weight:bold}@page{margin:8mm}@media print{body{margin:0}}</style></head><body><h1>CHICKY</h1><h2>${escape(shortOrderId(order.id))}</h2><p>${escape(order.id)}<br>${escape(orderTimestamp(order.createdAt))}<br>${escape(orderStatus(order.status))} — ${escape(orderService(order))}</p><hr><p><b>${escape(order.customerName)}</b><br>${escape(order.phone)}<br>${escape(orderAddress(order))}<br>${escape(order.area)}</p><p>الدفع: ${escape(orderPayment(order))}${order.scheduledTime ? `<br>موعد مجدول: ${escape(order.scheduledTime)}` : ''}</p><table>${order.items.map(item => `<tr><td>${escape(item.quantity)} × ${escape(item.name)}<small>${escape(item.selectedSize?.nameAr || item.selectedSize?.nameEn || '')} ${escape(item.selectedSpiciness || '')}</small>${(item.selectedModifiers || []).map(modifier => `<small>+ ${escape(modifier.nameAr || modifier.nameEn)}</small>`).join('')}</td><td>${escape(item.price * item.quantity)} ج.م</td></tr>`).join('')}</table><p>قيمة الأصناف: ${escape(money.subtotal)} ج.م<br>${money.breakdown ? `التوصيل: ${escape(money.breakdown.deliveryFee)} ج.م<br>الخصم: ${escape(money.breakdown.discountAmount)} ج.م` : `صافي التوصيل / الخصم: ${escape(money.adjustment)} ج.م<small>التوصيل والخصم غير محفوظين بشكل منفصل.</small>`}</p><p class="total">الإجمالي: ${escape(order.totalPrice)} ج.م</p></body></html>`;
}

export function printOrderReceipt(order: StoredOrder, onError: () => void): void {
  const frame = document.createElement('iframe');
  frame.title = 'طباعة بون الطلب';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:600px;border:0';
  let cleanupTimer: ReturnType<typeof setTimeout>;
  const cleanup = () => { clearTimeout(cleanupTimer); frame.remove(); };
  frame.onload = () => {
    try {
      if (!frame.contentWindow) throw new Error('Printing unavailable');
      frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
      frame.contentWindow.focus(); frame.contentWindow.print();
    } catch { cleanup(); onError(); }
  };
  cleanupTimer = setTimeout(cleanup, 120000);
  frame.srcdoc = orderReceiptHtml(order);
  document.body.appendChild(frame);
}
