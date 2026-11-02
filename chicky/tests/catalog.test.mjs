import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogEntries, googleFeed, metaFeed, sitemap, productPath } from '../server/catalog.mjs';

const product = { id: 'p1', name: 'Rice', nameAr: 'أرز & دجاج', descriptionAr: '<script>bad</script>', price: 45, image: 'https://example.com/rice.png', category: 'sides', hasSizes: true, sizes: [{id:'m', nameAr:'وسط', price:45},{id:'l',nameAr:'كبير',price:50}] };
test('catalog has stable distinct size SKUs and exact landing prices', () => {
  const rows = catalogEntries([product]);
  assert.deepEqual(rows.map(r => [r.id,r.price]), [['p1--m',45],['p1--l',50]]);
  assert.equal(rows[1].link, 'https://chickyfc.com/products/p1?size=l');
  assert.equal(productPath('p /?<'), '/products/p%20%2F%3F%3C');
});
test('exclude malformed, unpublished and unsafe image entries without fabricating identifiers', () => {
  const rows = catalogEntries([{...product, is_published:false}, {...product, price:-1,hasSizes:false}, {...product,image:'javascript:alert(1)'}, {...product,hasSizes:true,sizes:[]}, {...product,hasSizes:false,price:0}]);
  assert.equal(rows.length, 0);
});
test('feeds escape user controlled fields and retain valid currency and variant IDs', () => {
  const rows = catalogEntries([product]);
  const xml = googleFeed(rows);
  assert.match(xml, /أرز &amp; دجاج/);
  assert.doesNotMatch(xml, /<script>|<g:gtin>|<g:mpn>|identifier_exists/);
  assert.match(xml, /50\.00 EGP/);
  assert.match(xml, /<g:item_group_id>p1<\/g:item_group_id>/);
  const csv = metaFeed([{...rows[0],title:'=SUM(1,2) "test"'}]);
  assert.match(csv, /"'=SUM\(1,2\) ""test"""/);
  assert.match(csv, /45\.00 EGP/);
});
test('sitemap contains only valid public routes and XML escaped canonical URLs', () => {
  const xml = sitemap(catalogEntries([product]), [{id:'sides',nameAr:'أصناف جانبية'}]);
  assert.match(xml, /https:\/\/chickyfc.com\/products\/p1<\/loc>/);
  assert.match(xml, /\/categories\/sides/);
  assert.doesNotMatch(xml, /checkout|admin|cart|lastmod/);
});
