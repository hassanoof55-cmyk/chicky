import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStorefront, normalizeStorefront, EMPTY_CONFIG } from '../lib/storefrontData.ts';

function client(menu, settings) {
  return { from(table) {
    return { select() { return {
      order: () => Promise.resolve(menu),
      eq: () => ({ maybeSingle: () => Promise.resolve(settings) }),
    }; } };
  } };
}

test('only database products are returned; missing categories do not hide them', async () => {
  const items = [{ id: 'live-item', category: 'live-category', name: 'Live item' }];
  const result = await loadStorefront(client({ data: items }, { data: { config_data: {} } }));
  assert.deepEqual(result.menu, items);
  assert.equal(result.config.layout[0].id, 'live-category');
  assert.deepEqual(result.config.hero.banners, []);
  assert.equal(result.config.header.logoRed, '');
  assert.equal(result.config.header.phone, '');
});

test('an empty menu stays empty instead of restoring sample products', async () => {
  const result = await loadStorefront(client({ data: [] }, { data: { config_data: {} } }));
  assert.deepEqual(result.menu, []);
  assert.deepEqual(result.config.layout, []);
  assert.deepEqual(result.config.tags, []);
});

test('database errors including 402 reject rather than substituting demo data', async () => {
  for (const table of ['menu', 'settings']) {
    const error = { message: 'Payment Required', status: 402 };
    const menu = table === 'menu' ? { error } : { data: [] };
    const settings = table === 'settings' ? { error } : { data: { config_data: {} } };
    await assert.rejects(loadStorefront(client(menu, settings)), err => err === error);
  }
});

test('missing site configuration blocks the storefront instead of showing defaults', async () => {
  await assert.rejects(loadStorefront(client({ data: [] }, { data: null })));
});

test('real branding and explicitly empty banner/tag lists are preserved', () => {
  const settings = { header: { phone: 'real-phone', logoRed: 'real-logo' }, hero: { banners: [] }, tags: [] };
  const result = normalizeStorefront([], settings);
  assert.equal(result.config.header.logoRed, 'real-logo');
  assert.deepEqual(result.config.hero.banners, []);
  assert.deepEqual(result.config.tags, []);
  assert.equal(EMPTY_CONFIG.header.phone, '');
});

test('a hanging backend exits loading with a timeout', async () => {
  const hanging = { from() { return { select() { return {
    order: () => new Promise(() => {}),
    eq: () => ({ maybeSingle: () => new Promise(() => {}) }),
  }; } }; } };
  await assert.rejects(loadStorefront(hanging, 10), /timed out/);
});
