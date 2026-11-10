import test from 'node:test';
import assert from 'node:assert/strict';
import { shortOrderId, orderPhones, orderAddress, orderPayment, orderMoney, orderReceiptHtml, orderTimestamp } from '../lib/orderPresentation.ts';
const order = { id: 'CH-12345678-1234-1234-1234-ABCDEF123456', customerName: 'عميل تجريبي', phone: '01000000000 / ٠١١٠٠٠٠٠٠٠٠', address: 'عنوان تجريبي [Payment: CASH]', area: 'منطقة تجريبية', createdAt: '2026-11-10T12:30:00Z', totalPrice: 235, status: 'pending', serviceType: 'delivery', items: [{ name: 'وجبة', price: 100, quantity: 2, selectedModifiers: [] }] };
test('compact IDs retain searchable suffix and full original ID remains unchanged', () => {
  assert.equal(shortOrderId(order.id), 'CH-EF123456');
  assert.equal(order.id, 'CH-12345678-1234-1234-1234-ABCDEF123456');
});
test('phone links accept phone characters and normalize Arabic digits without creating arbitrary URLs', () => {
  assert.deepEqual(orderPhones(order.phone), ['01000000000', '01100000000']);
  assert.deepEqual(orderPhones('javascript:alert(1) / 01000000000'), ['01000000000']);
});
test('payment is separated for display only, with a legacy fallback and no invented collection status', () => {
  assert.equal(orderAddress(order), 'عنوان تجريبي'); assert.equal(orderPayment(order), 'كاش');
  assert.equal(orderPayment({ ...order, paymentMethod: 'wallet' }), 'محفظة إلكترونية');
  assert.equal(orderPayment({ ...order, address: 'عنوان' }), 'غير مسجّل');
  assert.equal(orderPayment({ ...order, paymentMethod: 'instapay' }), 'InstaPay');
  assert.equal(orderPayment({ ...order, address: 'عنوان [Payment: INSTAPAY]' }), 'InstaPay');
  assert.equal(orderAddress({ ...order, address: 'عنوان [Payment: INSTAPAY]' }), 'عنوان');
  assert.equal(order.address, 'عنوان تجريبي [Payment: CASH]');
});
test('money breakdown preserves persisted total and never calls the net adjustment a known delivery fee', () => {
  assert.deepEqual(orderMoney(order), { subtotal: 200, adjustment: 35 });
  assert.deepEqual(orderMoney({ ...order, totalPrice: 170 }), { subtotal: 200, adjustment: -30 });
  assert.match(orderReceiptHtml(order), /غير محفوظين بشكل منفصل/);
});
test('print receipt escapes all customer and catalog text, including attribute-breaking input', () => {
  const malicious = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  const html = orderReceiptHtml({ ...order, customerName: malicious, address: malicious, area: malicious, phone: malicious, scheduledTime: malicious, items: [{ ...order.items[0], name: malicious, selectedModifiers: [{ id: 'a', nameEn: malicious }] }] });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&quot;'));
  assert.match(html, /CHICKY/);
});
test('display time uses Cairo regardless of browser timezone', () => { assert.match(orderTimestamp(order.createdAt), /٢:٣٠/); });
