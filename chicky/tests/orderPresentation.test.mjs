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
test('new receipts show persisted delivery and discount separately, including zero amounts', () => {
  const saved = { ...order, totalPrice: 210, pricing: { version: 1, subtotal: 200, delivery_fee: 30, discount_amount: 20 } };
  assert.deepEqual(orderMoney(saved), { subtotal: 200, adjustment: 10, breakdown: { deliveryFee: 30, discountAmount: 20 } });
  const html = orderReceiptHtml(saved);
  assert.match(html, /التوصيل: 30 ج.م/); assert.match(html, /الخصم: 20 ج.م/);
  assert.ok(!html.includes('غير محفوظين بشكل منفصل'));
  assert.deepEqual(orderMoney({ ...saved, totalPrice: 200, pricing: { version: 1, subtotal: 200, delivery_fee: 0, discount_amount: 0 } }).breakdown, { deliveryFee: 0, discountAmount: 0 });
  assert.equal(saved.totalPrice, 210);
});
test('invalid, incomplete or inconsistent historical monetary snapshots remain explicitly unitemized', () => {
  const valid = { version: 1, subtotal: 200, delivery_fee: 55, discount_amount: 20 };
  for (const pricing of [null, {}, { ...valid, version: 2 }, { ...valid, subtotal: 201 }, { ...valid, delivery_fee: -1 }, { ...valid, discount_amount: '20' }, { ...valid, discount_amount: null }, { ...valid, delivery_fee: Infinity }, { ...valid, discount_amount: 0 }]) {
    assert.deepEqual(orderMoney({ ...order, pricing }), { subtotal: 200, adjustment: 35 });
    assert.match(orderReceiptHtml({ ...order, pricing }), /غير محفوظين بشكل منفصل/);
  }
});
test('decimal snapshots allow the existing server total tolerance without recalculating the payable amount', () => {
  const saved = { ...order, items: [{name:'وجبة',price:99.95,quantity:2}], totalPrice: 209.91, pricing: { version:1,subtotal:199.9,delivery_fee:30,discount_amount:19.99 } };
  assert.deepEqual(orderMoney(saved).breakdown, { deliveryFee:30,discountAmount:19.99 });
  assert.match(orderReceiptHtml(saved), /209.91 ج.م/);
});
test('print receipt escapes all customer and catalog text, including attribute-breaking input', () => {
  const malicious = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  const html = orderReceiptHtml({ ...order, customerName: malicious, address: malicious, area: malicious, phone: malicious, scheduledTime: malicious, items: [{ ...order.items[0], name: malicious, selectedModifiers: [{ id: 'a', nameEn: malicious }] }] });
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('&quot;'));
  assert.match(html, /CHICKY/);
});
test('display time uses Cairo regardless of browser timezone', () => { assert.match(orderTimestamp(order.createdAt), /٢:٣٠/); });
