import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const product = {
  id: 'chicken-1', name: 'Chicken meal', nameAr: 'وجبة فراخ', price: 100,
  category: 'meals', description: 'Never send this', descriptionAr: '', image: '',
  sizes: [{ id: 'large', nameEn: 'Large', nameAr: 'كبير', price: 150 }],
};
let sequence = 0;
async function setup(saved) {
  const storage = new Map(saved ? [['chicky.analytics-consent', saved]] : []);
  const scripts = [], cookieWrites = [];
  const cookies = new Map([['_ga', 'GA1.1.1.2'], ['_ga_PROPERTY', 'session'], ['auth', 'keep']]);
  const win = new EventTarget();
  win.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
  win.location = new URL('https://shop.example.com/?phone=secret');
  const doc = {
    referrer: 'https://www.google.com/search?q=customer+secret&phone=01234567890',
    title: 'Order for customer secret',
    createElement: () => ({ remove() { const i = scripts.indexOf(this); if (i >= 0) scripts.splice(i, 1); } }),
    head: { appendChild(script) { scripts.push(script); return script; } },
    get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(value) { cookieWrites.push(value); if (/max-age=0/i.test(value)) cookies.delete(value.split('=')[0]); },
  };
  globalThis.window = win;
  globalThis.document = doc;
  const url = new URL(`../lib/analytics.ts?test=${++sequence}`, import.meta.url).href;
  const analytics = await import(url);
  const commands = () => (win.chickyAnalyticsLayer ?? []).map(args => Array.from(args));
  return { ...analytics, url, win, scripts, storage, cookies, cookieWrites, commands };
}

test('a missing or invalid measurement ID has no effects even after acceptance', async () => {
  const a = await setup();
  a.setAnalyticsConsent('accepted');
  for (const id of [undefined, '', 'G-', 'G-ABCD', 'G-ABC12345678', 'G-ABC<script>', 'UA-123', 'G-ABC&x=y']) a.initializeAnalytics(id);
  a.trackCommerce('view_item', [a.analyticsItem(product)]);
  assert.equal(a.scripts.length, 0);
  assert.deepEqual(a.commands(), []);
  assert.equal(await a.getAnalyticsContext(), undefined);
});

test('preconsent events are discarded and acceptance initializes exactly once with one explicit page view', async () => {
  const a = await setup();
  assert.equal(a.getAnalyticsConsent(), 'unknown');
  a.initializeAnalytics('G-ABC1234567');
  a.trackCommerce('view_item', [a.analyticsItem(product)]);
  assert.equal(a.scripts.length, 0);
  assert.deepEqual(a.commands(), []);
  a.setAnalyticsConsent('accepted');
  a.initializeAnalytics('G-ABC1234567');
  a.setAnalyticsConsent('accepted');
  assert.equal(a.scripts.length, 1);
  assert.match(a.scripts[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-ABC1234567&l=chickyAnalyticsLayer$/);
  assert.equal(a.commands().filter(c => c[0] === 'config').length, 1);
  assert.deepEqual(a.commands().filter(c => c[0] === 'event'), [['event', 'page_view', {
    page_location: 'https://chickyfc.com/', page_referrer: '', page_title: 'CHICKY',
  }]]);
  const config = a.commands().find(c => c[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.page_location, 'https://chickyfc.com/');
  assert.equal(config.page_referrer, '');
});

test('catalog items use real base/variant IDs and the authoritative size price', async () => {
  const a = await setup();
  assert.deepEqual(a.analyticsItem(product, 2), {
    item_id: 'chicken-1', item_name: 'Chicken meal', item_category: 'meals', price: 100, quantity: 2,
  });
  assert.deepEqual(a.analyticsItem(product, 3, { ...product.sizes[0], price: 1, nameEn: 'customer secret' }), {
    item_id: 'chicken-1--large', item_name: 'Chicken meal', item_category: 'meals', item_variant: 'Large', price: 150, quantity: 3,
  });
  for (const quantity of [0, -1, 1.5, NaN, Infinity]) assert.equal(a.analyticsItem(product, quantity), null);
  assert.equal(a.analyticsItem({ ...product, price: NaN }), null);
  assert.equal(a.analyticsItem(product, 1, { id: 'missing' }), null);
  assert.equal(a.analyticsItem({ ...product, id: '' }), null);
});

test('only supported storefront events and allowlisted commerce fields leave the module', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567');
  const item = a.analyticsItem(product, 2, product.sizes[0]);
  const extra = { value: 300, currency: 'USD', tax: 12, shipping: 5, payment_type: 'cash',
    name: 'PII', phone: '01234567890', address: 'PII', location: { lat: 1 }, coupon: 'free text',
    page_location: 'PII', user_id: 'PII', items: [{ item_name: 'PII' }] };
  a.trackCommerce('add_to_cart', [item], extra);
  const event = a.commands().find(c => c[0] === 'event' && c[1] === 'add_to_cart');
  assert.deepEqual(event, ['event', 'add_to_cart', {
    currency: 'EGP', value: 300, tax: 12, shipping: 5, payment_type: 'cash',
    items: [{ item_id: 'chicken-1--large', item_name: 'Chicken meal', item_category: 'meals', item_variant: 'Large', price: 150, quantity: 2 }],
  }]);
  for (const name of ['purchase', 'refund', 'page_view', 'custom', 'user@example.com']) a.trackCommerce(name, [item], extra);
  a.trackCommerce('view_item', [{ item_id: 'chicken-1', item_name: 'customer free text', price: 1, quantity: 1 }]);
  a.trackCommerce('view_item', [null]);
  assert.equal(a.commands().filter(c => c[0] === 'event' && c[1] !== 'page_view').length, 1);
  for (const name of ['view_item_list', 'select_item', 'view_item', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info']) {
    a.trackCommerce(name, [a.analyticsItem(product)], { value: NaN, tax: -1, shipping_tier: 'customer free text', payment_type: 'user@example.com' });
  }
  const last = a.commands().at(-1);
  assert.deepEqual(last[2], { currency: 'EGP', value: 100, items: [a.analyticsItem(product)] });
});

test('rejection survives reload, revocation disables GA, clears cookies and discards queued events', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567');
  a.trackCommerce('add_to_cart', [a.analyticsItem(product)]);
  a.setAnalyticsConsent('rejected');
  assert.equal(a.getAnalyticsConsent(), 'rejected');
  assert.equal(a.storage.get('chicky.analytics-consent'), 'rejected');
  assert.equal(a.win['ga-disable-G-ABC1234567'], true);
  assert.equal(a.scripts.length, 0);
  assert.equal(a.cookies.has('_ga'), false);
  assert.equal(a.cookies.has('_ga_PROPERTY'), false);
  assert.equal(a.cookies.get('auth'), 'keep');
  assert.ok(a.cookieWrites.some(v => /domain=\.example\.com/i.test(v)));
  a.trackCommerce('view_item', [a.analyticsItem(product)]);
  a.setAnalyticsConsent('accepted');
  assert.equal(a.win['ga-disable-G-ABC1234567'], false);
  assert.deepEqual(a.commands().filter(c => c[0] === 'event').map(c => c[1]), ['page_view']);
  const reloaded = await setup('rejected');
  reloaded.initializeAnalytics('G-ABC1234567');
  assert.equal(reloaded.getAnalyticsConsent(), 'rejected');
  assert.equal(reloaded.scripts.length, 0);
  assert.deepEqual(reloaded.commands(), []);
});

test('page views strip query PII, hash, document title and referrer path, keeping only bounded campaign tokens', async () => {
  const a = await setup('accepted');
  a.win.location = new URL('https://preview.example.com/?utm_source=instagram&utm_medium=paid_social&utm_campaign=meal-2026&phone=01234567890&name=Customer&address=private&utm_term=customer-secret&search=private#order-private');
  a.initializeAnalytics('G-ABC1234567');
  assert.deepEqual(a.commands().find(c => c[0] === 'event'), ['event', 'page_view', {
    page_location: 'https://chickyfc.com/', page_referrer: '', page_title: 'CHICKY',
    campaign_source: 'instagram', campaign_medium: 'paid_social', campaign_name: 'meal-2026',
  }]);
  const serialized = JSON.stringify(a.commands());
  for (const secret of ['01234567890', 'Customer', 'private', 'customer-secret', 'customer+secret', 'preview.example.com', '/search']) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  a.scripts[0].onload();
  a.trackPageView();
  a.initializeAnalytics('G-ABC1234567');
  assert.equal(a.commands().filter(c => c[1] === 'page_view').length, 1);
});

test('page views discard invalid, duplicate, oversized or non-token campaign values', async () => {
  for (const query of [
    '?utm_source=user%40example.com&utm_medium=paid+social&utm_campaign=01234567890',
    `?utm_source=${'a'.repeat(65)}&utm_medium=%D8%B3&utm_campaign=one&utm_campaign=two`,
  ]) {
    const a = await setup('accepted');
    a.win.location = new URL(`https://chickyfc.com/${query}`);
    a.initializeAnalytics('G-ABC1234567');
    const payload = a.commands().find(c => c[1] === 'page_view')[2];
    assert.deepEqual(payload, { page_location: 'https://chickyfc.com/', page_referrer: '', page_title: 'CHICKY' });
  }
});

test('page views use current catalog paths only, rejecting arbitrary path arguments and unknown path text', async () => {
  const a = await setup('accepted');
  a.analyticsItem(product);
  a.win.location = new URL('https://preview.example.com/products/chicken-1?size=large&phone=secret');
  a.initializeAnalytics('G-ABC1234567');
  assert.equal(a.commands().find(c => c[1] === 'page_view')[2].page_location, 'https://chickyfc.com/products/chicken-1');
  for (const path of ['/products/chicken-1?phone=secret', '/products/free-form-customer', '/categories/meals', '//evil.com', '/orders/secret']) a.trackPageView(path);
  assert.equal(a.commands().filter(c => c[1] === 'page_view').length, 1);
  a.win.location = new URL('https://chickyfc.com/categories/meals?address=secret');
  a.trackPageView('/categories/meals');
  assert.equal(a.commands().at(-1)[2].page_location, 'https://chickyfc.com/categories/meals');
  a.trackPageView();
  assert.equal(a.commands().filter(c => c[1] === 'page_view').length, 2);
  const unknown = await setup('accepted');
  unknown.win.location = new URL('https://chickyfc.com/orders/customer-secret?phone=secret');
  unknown.initializeAnalytics('G-ABC1234567');
  assert.equal(unknown.commands().find(c => c[1] === 'page_view')[2].page_location, 'https://chickyfc.com/');
});

test('page views are never queued before consent, during rejection or after revocation; reload and later acceptance each get one fresh view', async () => {
  const a = await setup();
  a.initializeAnalytics('G-ABC1234567');
  a.trackPageView();
  a.setAnalyticsConsent('rejected');
  a.trackPageView();
  assert.deepEqual(a.commands(), []);
  a.win.location = new URL('https://chickyfc.com/?utm_source=facebook');
  a.setAnalyticsConsent('accepted');
  assert.equal(a.commands().filter(c => c[1] === 'page_view').length, 1);
  const staleOnload = a.scripts[0].onload;
  a.setAnalyticsConsent('rejected');
  staleOnload();
  a.trackPageView();
  assert.deepEqual(a.commands(), []);
  const reload = await setup('accepted');
  reload.initializeAnalytics('G-ABC1234567');
  reload.initializeAnalytics('G-ABC1234567');
  assert.equal(reload.commands().filter(c => c[1] === 'page_view').length, 1);
});

test('catalog registration before initialization retains the registered landing size in config and one page view', async () => {
  const a = await setup('accepted');
  a.analyticsItem(product);
  a.analyticsItem(product, 1, product.sizes[0]);
  a.win.location = new URL('https://preview.example.com/products/chicken-1?size=large&phone=private&utm_source=instagram#private');
  assert.deepEqual(a.commands(), []); // Registration has no analytics side effects.
  a.initializeAnalytics('G-ABC1234567');
  const location = 'https://chickyfc.com/products/chicken-1?size=large';
  assert.equal(a.commands().find(c => c[0] === 'config')[2].page_location, location);
  assert.equal(a.commands().find(c => c[1] === 'page_view')[2].page_location, location);
  a.trackPageView('/products/chicken-1');
  a.initializeAnalytics('G-ABC1234567');
  a.setAnalyticsConsent('accepted');
  assert.equal(a.commands().filter(c => c[1] === 'page_view').length, 1);
  a.win.location = new URL('https://chickyfc.com/products/chicken-1');
  a.trackPageView();
  assert.equal(a.commands().filter(c => c[1] === 'page_view').length, 2);
  assert.equal(a.commands().at(-1)[2].page_location, 'https://chickyfc.com/products/chicken-1');
});

test('only sizes registered for this product survive the page-view query allowlist', async () => {
  for (const search of ['?size=unknown', '?size=user%40example.com', '?size=large&size=large', '?size=other-size', '?size=unregistered']) {
    const a = await setup('accepted');
    a.analyticsItem(product);
    a.analyticsItem(product, 1, product.sizes[0]);
    const other = { ...product, id: 'other', sizes: [{ ...product.sizes[0], id: 'other-size' }] };
    a.analyticsItem(other, 1, other.sizes[0]);
    a.analyticsItem({ ...product, id: 'chicken-1--unregistered', sizes: [] });
    a.win.location = new URL(`https://chickyfc.com/products/chicken-1${search}&address=private`);
    a.initializeAnalytics('G-ABC1234567');
    assert.equal(a.commands().find(c => c[1] === 'page_view')[2].page_location, 'https://chickyfc.com/products/chicken-1');
  }
  const a = await setup('accepted');
  assert.equal(a.analyticsItem(product, 1, product.sizes[0], -1), null);
  a.analyticsItem(product);
  a.win.location = new URL('https://chickyfc.com/products/chicken-1?size=large');
  a.initializeAnalytics('G-ABC1234567');
  assert.equal(a.commands().find(c => c[1] === 'page_view')[2].page_location, 'https://chickyfc.com/products/chicken-1');
});

test('later consent uses the registered current landing SKU without queueing or leaking size on other routes', async () => {
  const a = await setup();
  a.analyticsItem(product);
  a.analyticsItem(product, 1, product.sizes[0]);
  a.win.location = new URL('https://chickyfc.com/products/chicken-1?size=large&name=private');
  a.initializeAnalytics('G-ABC1234567');
  a.trackPageView();
  assert.deepEqual(a.commands(), []);
  a.setAnalyticsConsent('accepted');
  assert.equal(a.commands().find(c => c[1] === 'page_view')[2].page_location, 'https://chickyfc.com/products/chicken-1?size=large');
  a.win.location = new URL('https://chickyfc.com/categories/meals?size=large');
  a.trackPageView();
  assert.equal(a.commands().at(-1)[2].page_location, 'https://chickyfc.com/categories/meals');
  a.win.location = new URL('https://chickyfc.com/orders/private?size=large');
  a.trackPageView();
  assert.equal(a.commands().at(-1)[2].page_location, 'https://chickyfc.com/');
  a.setAnalyticsConsent('rejected');
  a.trackPageView();
  assert.deepEqual(a.commands(), []);
});

test('a missing location pathname safely falls back to the canonical home without throwing', async () => {
  const a = await setup('accepted');
  a.win.location = { hostname: 'chickyfc.com' };
  a.initializeAnalytics('G-ABC1234567');
  assert.equal(a.commands().find(c => c[1] === 'page_view')[2].page_location, 'https://chickyfc.com/');
  a.setAnalyticsConsent('rejected');
  assert.equal(a.win['ga-disable-G-ABC1234567'], true);
});

test('cash, instapay and wallet are retained as safe payment enums; arbitrary payment text is discarded', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567');
  for (const payment_type of ['cash', 'instapay', 'wallet']) {
    a.trackCommerce('add_payment_info', [a.analyticsItem(product)], { payment_type });
    assert.equal(a.commands().at(-1)[2].payment_type, payment_type);
  }
  a.trackCommerce('add_payment_info', [a.analyticsItem(product)], { payment_type: 'customer@example.com' });
  assert.equal(a.commands().at(-1)[2].payment_type, undefined);
});

test('final unit price override includes modifiers without changing the catalog SKU', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567');
  const meal = { ...product, price: 45, sizes: [{ ...product.sizes[0], price: 45 }] };
  const item = a.analyticsItem(meal, 1, meal.sizes[0], 55); // 45 + 10 extras.
  a.trackCommerce('add_to_cart', [item]);
  assert.equal(item.item_id, 'chicken-1--large');
  assert.equal(item.price, 55);
  assert.equal(a.commands().at(-1)[2].value, 55);
  assert.equal(a.analyticsItem(meal, 2, { ...meal.sizes[0], price: 55 }).price, 45);
  assert.equal(a.analyticsItem(meal, 2, undefined, 55).item_id, 'chicken-1');
  for (const value of [0, -1, NaN, Infinity, '55', null]) assert.equal(a.analyticsItem(meal, 1, meal.sizes[0], value), null);
});

test('list metadata can only match the catalog category of the event items', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567');
  const item = a.analyticsItem(product);
  a.trackCommerce('view_item_list', [item], { item_list_id: 'meals', item_list_name: 'meals' });
  assert.equal(a.commands().at(-1)[2].item_list_id, 'meals');
  assert.equal(a.commands().at(-1)[2].item_list_name, 'meals');
  for (const name of ['customer@example.com', 'customer private text', 'a'.repeat(201), 'sides']) {
    a.trackCommerce('view_item_list', [item], { item_list_id: name, item_list_name: name });
    assert.equal(a.commands().at(-1)[2].item_list_id, undefined);
    assert.equal(a.commands().at(-1)[2].item_list_name, undefined);
  }
});

test('blocked storage still permits a session choice and malformed consent never opts in', async () => {
  const a = await setup('garbage');
  a.win.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(a.getAnalyticsConsent(), 'unknown');
  a.initializeAnalytics('G-ABC1234567');
  a.setAnalyticsConsent(true);
  assert.equal(a.scripts.length, 0);
  a.setAnalyticsConsent('accepted');
  assert.equal(a.getAnalyticsConsent(), 'accepted');
  assert.equal(a.scripts.length, 1);
  a.setAnalyticsConsent('rejected');
  assert.equal(a.win['ga-disable-G-ABC1234567'], true);
});

test('consent changes in another tab disable the configured tag', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567');
  a.storage.set('chicky.analytics-consent', 'rejected');
  const event = new Event('storage');
  Object.assign(event, { key: 'chicky.analytics-consent', newValue: 'rejected', storageArea: a.win.localStorage });
  a.win.dispatchEvent(event);
  assert.equal(a.getAnalyticsConsent(), 'rejected');
  assert.equal(a.win['ga-disable-G-ABC1234567'], true);
  assert.equal(a.scripts.length, 0);
});

test('context is consented, bounded, and cannot complete after revocation', async () => {
  const a = await setup();
  assert.equal(await a.getAnalyticsContext(), undefined);
  a.initializeAnalytics('G-ABC1234567');
  a.setAnalyticsConsent('accepted');
  assert.equal(await a.getAnalyticsContext(), undefined); // Tag has not loaded.
  a.scripts[0].onload();
  const pending = a.getAnalyticsContext();
  const gets = a.commands().filter(c => c[0] === 'get');
  assert.equal(gets.length, 2);
  gets.find(c => c[2] === 'client_id')[3]('12345.67890');
  gets.find(c => c[2] === 'session_id')[3](1234567890);
  assert.deepEqual(await pending, { client_id: '12345.67890', session_id: '1234567890' });
  const revoked = a.getAnalyticsContext();
  const callbacks = a.commands().filter(c => c[0] === 'get').slice(-2);
  a.setAnalyticsConsent('rejected');
  callbacks[0][3]('12345.67890'); callbacks[1][3]('1234567890');
  assert.equal(await revoked, undefined);
});

test('context returns nothing if GA never responds or returns non-identifier text', async () => {
  const a = await setup('accepted');
  a.initializeAnalytics('G-ABC1234567'); a.scripts[0].onload();
  const pending = a.getAnalyticsContext();
  for (const command of a.commands().filter(c => c[0] === 'get')) command[3]('customer@example.com');
  assert.equal(await pending, undefined);
  assert.equal(await a.getAnalyticsContext(), undefined);
});

async function renderConsent(a, lang) {
  const source = await readFile(new URL('../components/AnalyticsConsent.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const executable = outputText.replace(/(['"])(react(?:\/jsx-runtime)?)\1/g, (_, quote, name) => JSON.stringify(import.meta.resolve(name)))
    .replace(/(['"])\.\.\/lib\/analytics(?:\.ts)?\1/g, JSON.stringify(a.url));
  const { default: Consent } = await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`);
  return renderToStaticMarkup(React.createElement(Consent, { lang }));
}

test('the bilingual consent region has equal choices, explicit labels and a persistent settings control', async () => {
  const a = await setup();
  const en = await renderConsent(a, 'en');
  assert.match(en, /role="region"/);
  assert.match(en, /aria-labelledby=/);
  assert.match(en, /dir="ltr"/);
  assert.match(en, /Accept analytics/);
  assert.match(en, /Reject analytics/);
  assert.match(en, /Analytics settings/);
  const ar = await renderConsent(a, 'ar');
  assert.match(ar, /dir="rtl"/);
  assert.match(ar, /lang="ar"/);
  assert.match(ar, /قبول التحليلات/);
  assert.match(ar, /رفض التحليلات/);
  a.setAnalyticsConsent('rejected');
  const closed = await renderConsent(a, 'en');
  assert.doesNotMatch(closed, /role="region"/);
  assert.match(closed, /Analytics settings/);
  assert.equal(a.scripts.length, 0);
});
