import test from 'node:test';
import assert from 'node:assert/strict';
import * as conversions from '../server/conversions.mjs';

const config = { supabaseUrl: 'https://project.supabase.co', serviceKey: 'private-service-key', measurementId: 'G-ABC1234567', apiSecret: 'private-secret' };
const orderId = 'CH-12345678-1234-4234-8234-123456789ABC';
function payload() {
  return { client_id: '123456.789012', events: [{ name: 'purchase', params: {
    transaction_id: orderId, currency: 'EGP', value: 300, shipping: 0,
    session_id: '1234567890', engagement_time_msec: 1,
    items: [{ item_id: 'm1--large', item_name: 'Mega Deal 1', quantity: 2, price: 150 }],
  } }] };
}
function transport(rows = [{ order_id: orderId, payload: payload() }], googleStatus = 204) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), ...options, body: JSON.parse(options.body) });
    if (String(url).endsWith('/claim_chicky_analytics_batch')) return Response.json(rows);
    if (String(url).endsWith('/finish_chicky_analytics_event')) return new Response(null, { status: 204 });
    return new Response(null, { status: googleStatus });
  };
  return { calls, fetcher };
}
const googleCalls = calls => calls.filter(c => c.url.startsWith('https://www.google-analytics.com/'));
const finishes = calls => calls.filter(c => c.url.endsWith('/finish_chicky_analytics_event'));

test('exports the bounded worker and validation-only API', () => {
  for (const name of ['runConversionBatch', 'startConversionWorker', 'validateConversionPayload']) assert.equal(typeof conversions[name], 'function');
});

test('sends an outbox purchase, preserves transaction identity and acknowledges 204 transport acceptance', async () => {
  const { fetcher, calls } = transport();
  const result = await conversions.runConversionBatch({ ...config, fetcher });
  assert.deepEqual(result, { claimed: 1, sent: 1, failed: 0 });
  assert.equal(calls[0].url, 'https://project.supabase.co/rest/v1/rpc/claim_chicky_analytics_batch');
  assert.deepEqual(calls[0].body, { p_limit: 20 });
  assert.equal(calls[0].headers.apikey, config.serviceKey);
  assert.equal(calls[0].headers.Authorization, `Bearer ${config.serviceKey}`);
  const google = googleCalls(calls)[0];
  assert.equal(google.method, 'POST');
  assert.equal(new URL(google.url).pathname, '/mp/collect');
  assert.equal(new URL(google.url).searchParams.get('measurement_id'), config.measurementId);
  assert.equal(new URL(google.url).searchParams.get('api_secret'), config.apiSecret);
  assert.equal(google.headers.Authorization, undefined);
  assert.deepEqual(google.body, payload());
  assert.deepEqual(finishes(calls)[0].body, { p_order_id: orderId, p_success: true });
});

test('missing configuration does not claim work or create a worker', async () => {
  for (const key of Object.keys(config)) {
    const options = { ...config, [key]: '', fetcher: () => assert.fail('unexpected request') };
    assert.equal((await conversions.runConversionBatch(options)).skipped, 'missing_config');
    assert.equal(conversions.startConversionWorker(options), null);
  }
});

test('reconstructs every level of payload without forwarding additional private fields', async () => {
  const p = payload();
  p.user_id = 'customer@example.com'; p.user_data = { phone_number: '01234567890' };
  p.events[0].phone = '01234567890';
  Object.assign(p.events[0].params, { address: 'private', coupon: 'private', page_location: 'private', customer_name: 'private' });
  Object.assign(p.events[0].params.items[0], { notes: 'private', customer: 'private', item_variant: 'private' });
  const { calls, fetcher } = transport([{ order_id: orderId, payload: p }]);
  await conversions.runConversionBatch({ ...config, fetcher });
  assert.deepEqual(googleCalls(calls)[0].body, payload());
});

test('accepts the SQL RPC shape without engagement and adds only a fixed minimal engagement value', async () => {
  const p = payload(); delete p.events[0].params.engagement_time_msec;
  const { calls, fetcher } = transport([{ order_id: orderId, payload: p }]);
  assert.equal((await conversions.runConversionBatch({ ...config, fetcher })).sent, 1);
  assert.deepEqual(googleCalls(calls)[0].body, payload());
});

test('starts every leased send within the batch instead of leaving late rows past the SQL lease', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => {
    const p = payload();
    const id = `CH-12345678-1234-4234-8234-${String(i).padStart(12, '0')}`;
    p.events[0].params.transaction_id = id;
    return { order_id: id, payload: p };
  });
  const { fetcher, calls } = transport(rows);
  const releases = [];
  const batch = conversions.runConversionBatch({ ...config, fetcher: (url, options) => {
    if (String(url).includes('google-analytics.com')) return new Promise(resolve => releases.push(() => resolve(new Response(null, { status: 204 }))));
    return fetcher(url, options);
  } });
  for (let i = 0; i < 30; i++) await Promise.resolve();
  const started = releases.length;
  for (const release of releases) release();
  assert.equal(started, 20);
  assert.equal((await batch).sent, 20);
  assert.equal(finishes(calls).length, 20);
});

test('Google failures and network uncertainty acknowledge false so retries retain the same transaction ID', async () => {
  for (const status of [400, 429, 500]) {
    const { calls, fetcher } = transport(undefined, status);
    assert.equal((await conversions.runConversionBatch({ ...config, fetcher })).failed, 1);
    assert.deepEqual(finishes(calls)[0].body, { p_order_id: orderId, p_success: false });
  }
  const { calls, fetcher } = transport();
  await conversions.runConversionBatch({ ...config, fetcher: (url, options) => {
    if (String(url).includes('google-analytics.com')) throw Error('uncertain response with secret');
    return fetcher(url, options);
  } });
  assert.equal(finishes(calls)[0].body.p_success, false);
  await conversions.runConversionBatch({ ...config, fetcher });
  assert.equal(googleCalls(calls)[0].body.events[0].params.transaction_id, orderId);
});

test('aborts a stalled Google send at ten seconds and releases it for retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { calls, fetcher } = transport();
  let signal;
  const batch = conversions.runConversionBatch({ ...config, fetcher: (url, options) => {
    if (!String(url).includes('google-analytics.com')) return fetcher(url, options);
    signal = options.signal;
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  for (let i = 0; i < 20 && !signal; i++) await Promise.resolve();
  assert.ok(signal);
  t.mock.timers.tick(9999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal((await batch).failed, 1);
  assert.equal(signal.aborted, true);
  assert.equal(finishes(calls)[0].body.p_success, false);
});

test('malformed events never reach Google and are acknowledged false', async () => {
  const mutations = [
    p => { p.client_id = 'email@example.com'; },
    p => { p.events.push(p.events[0]); },
    p => { p.events[0].name = 'refund'; },
    p => { p.events[0].params.transaction_id = 'CH-123'; },
    p => { p.events[0].params.transaction_id = 'CH-87654321-1234-4234-8234-123456789ABC'; },
    p => { p.events[0].params.session_id = 'private'; },
    p => { p.events[0].params.currency = 'USD'; },
    p => { p.events[0].params.value = Infinity; },
    p => { p.events[0].params.value = 0; },
    p => { p.events[0].params.shipping = -1; },
    p => { p.events[0].params.items[0].price = 0; },
    p => { p.events[0].params.items[0].quantity = 1.5; },
    p => { p.events[0].params.items[0].item_id = 'customer@example.com'; },
    p => { p.events[0].params.items[0].item_name = 'customer@example.com'; },
    p => { p.events[0].params.items[0].item_name = 'Call 01234567890'; },
    p => { p.events[0].params.items[0].item_name = 'a'.repeat(101); },
    p => { p.events[0].params.items = Array(101).fill(p.events[0].params.items[0]); },
    p => { p.events[0].params.engagement_time_msec = 0; },
  ];
  for (const mutate of mutations) {
    const p = payload(); mutate(p);
    const { calls, fetcher } = transport([{ order_id: orderId, payload: p }]);
    assert.equal((await conversions.runConversionBatch({ ...config, fetcher })).failed, 1);
    assert.equal(googleCalls(calls).length, 0);
    assert.equal(finishes(calls)[0].body.p_success, false);
  }
});

test('debug validation only uses the official debug endpoint and propagates diagnostics without acknowledging a sale', async () => {
  const calls = [];
  for (const messages of [[], [{ fieldPath: 'events[0]', description: 'invalid', validationCode: 'VALUE_INVALID' }]]) {
    const result = await conversions.validateConversionPayload({ ...config, payload: payload(), fetcher: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return Response.json({ validationMessages: messages });
    } });
    assert.equal(result.valid, messages.length === 0);
    assert.deepEqual(result.validationMessages, messages);
  }
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.equal(new URL(c.url).pathname, '/debug/mp/collect');
    assert.deepEqual(c.body, { ...payload(), validation_behavior: 'ENFORCE_RECOMMENDATIONS' });
  }
  const { calls: batchCalls, fetcher } = transport();
  assert.equal((await conversions.runConversionBatch({ ...config, fetcher, debug: true })).skipped, 'debug_mode');
  assert.equal(batchCalls.length, 0);
});

test('worker runs immediately, repeats at thirty seconds, does not overlap, and can stop', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let release, claims = 0;
  const fetcher = async () => {
    claims++;
    return await new Promise(resolve => { release = () => resolve(Response.json([])); });
  };
  const worker = conversions.startConversionWorker({ ...config, fetcher });
  assert.equal(claims, 1);
  t.mock.timers.tick(60000);
  assert.equal(claims, 1);
  release();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  t.mock.timers.tick(30000);
  assert.equal(claims, 2);
  worker.stop(); release();
  t.mock.timers.tick(90000);
  assert.equal(claims, 2);
});

test('real worker interval is unreferenced and debug mode cannot start ingestion', () => {
  const worker = conversions.startConversionWorker({ ...config, fetcher: async () => Response.json([]) });
  assert.equal(worker.timer.hasRef(), false);
  worker.stop();
  assert.equal(conversions.startConversionWorker({ ...config, debug: true }), null);
});
