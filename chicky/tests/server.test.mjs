import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHandler, createCatalogLoader } from '../server/index.mjs';
const menu = [{id:'p1',name:'Rice',nameAr:'أرز',price:45,image:'https://example.com/rice.png',category:'sides',hasSizes:true,sizes:[{id:'m',nameAr:'وسط',price:45},{id:'l',nameAr:'كبير',price:50}]}];
const config = {layout:[{id:'sides',nameAr:'أصناف جانبية'}], footer:{addressAr:'الإسكندرية'}, header:{phone:'01220062060'}};
async function withServer(fn, loadCatalog = async()=>({menu,config})) {
  const server=createServer(createHandler({loadCatalog,template:'<html><head><title>Old</title></head><body><div id="root"></div></body></html>'}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise(r=>server.close(r)); }
}
test('crawlable product HTML matches selected variant, canonical and feed price without scripts from product data', async()=>withServer(async base=>{
  const r=await fetch(base+'/products/p1?size=l'); const html=await r.text();
  assert.equal(r.status,200); assert.match(html,/50\.00/); assert.match(html,/أرز/);
  assert.match(html,/rel="canonical" href="https:\/\/chickyfc.com\/products\/p1\?size=l"/);
  assert.match(html,/application\/ld\+json/); assert.match(html,/"priceCurrency":"EGP"/);
  assert.doesNotMatch(html,/<title>Old/);
  assert.equal((await fetch(base+'/products/p1?size=missing')).status,404);
  assert.equal((await fetch(base+'/products/missing')).status,404);
  assert.equal((await fetch(base+'/random-route')).status,404);
}));
test('home and category have discoverable public product links; feeds and sitemap have correct content types',async()=>withServer(async base=>{
  for (const path of ['/', '/categories/sides']) assert.match(await (await fetch(base+path)).text(),/href="\/products\/p1/);
  assert.match((await fetch(base+'/sitemap.xml')).headers.get('content-type'),/xml/);
  assert.match((await fetch(base+'/feeds/meta.csv')).headers.get('content-type'),/csv/);
  assert.match(await (await fetch(base+'/robots.txt')).text(),/Sitemap: https:\/\/chickyfc.com\/sitemap.xml/);
  assert.equal((await fetch(base+'/.env.local')).status,404);
  assert.equal((await fetch(base+'/products/p1',{method:'HEAD'})).status,200);
}));
test('upstream outage is 503 with retry advice, never an empty feed or soft 404', async()=>withServer(async base=>{
  for (const path of ['/', '/products/p1','/feeds/google.xml','/sitemap.xml']) {
    const r=await fetch(base+path);assert.equal(r.status,503);assert.equal(r.headers.get('retry-after'),'60');
  }
},async()=>{throw Error('upstream private detail');}));
test('public policies reflect owner supplied remedy, inclusive tax and actual local delivery fees',async()=>withServer(async base=>{
 const html=await(await fetch(base+'/policies')).text();
 assert.match(html,/شاملة الضريبة/);assert.match(html,/طلب جديد/);assert.match(html,/01220062060/);
 const privacy=await(await fetch(base+'/privacy')).text();assert.match(privacy,/Google Analytics/);assert.match(privacy,/واتساب/);
}));
test('public catalog fetches are coalesced and cached for 60 seconds, and stale data is not served after an outage', async()=>{
  let calls=0;let now=0;let fail=false;
  const load=createCatalogLoader({url:'https://db.example',key:'public-key',clock:()=>now,fetcher:async url=>{
    calls++;if(fail)throw Error('offline');return new Response(JSON.stringify(url.includes('menu_items')?menu:[{config_data:config}]),{status:200});
  }});
  await Promise.all([load(),load()]);assert.equal(calls,2);await load();assert.equal(calls,2);
  now=60001;fail=true;await assert.rejects(load());
});
