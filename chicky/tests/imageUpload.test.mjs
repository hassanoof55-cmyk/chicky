import test from 'node:test';
import assert from 'node:assert/strict';
import { fitImage, optimizeImage, IMAGE_LIMITS } from '../lib/imageUpload.ts';

test('resizing keeps aspect ratio, avoids upscaling and handles portrait images', () => {
  assert.deepEqual(fitImage(4000, 2000, 960), { width: 960, height: 480 });
  assert.deepEqual(fitImage(1000, 4000, 960), { width: 240, height: 960 });
  assert.deepEqual(fitImage(300, 100, 960), { width: 300, height: 100 });
  assert.deepEqual(fitImage(1, 10000, 960), { width: 1, height: 960 });
  assert.throws(() => fitImage(0, 12, 960));
});

test('invalid and oversized files fail before decoding or uploading', async () => {
  await assert.rejects(optimizeImage(new File(['text'], 'a.txt', { type: 'text/plain' }), 'product'));
  await assert.rejects(optimizeImage(new File([], 'a.png', { type: 'image/png' }), 'product'));
  await assert.rejects(optimizeImage(new File([new Uint8Array(21 * 1024 * 1024)], 'a.png', { type: 'image/png' }), 'product'));
});

test('vector logos and GIF animation remain intact but obey the upload budget', async () => {
  for (const type of ['image/svg+xml', 'image/gif']) {
    const small = new File(['small'], 'logo', { type });
    assert.equal(await optimizeImage(small, 'logoRed'), small);
    const large = new File([new Uint8Array(IMAGE_LIMITS.logoRed.maxBytes + 1)], 'logo', { type });
    await assert.rejects(optimizeImage(large, 'logoRed'));
  }
});
