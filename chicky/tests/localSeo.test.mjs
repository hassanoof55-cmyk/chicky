import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSeo } from '../server/seo.mjs';
const template='<html lang="en"><head><title>Old</title></head><body><div id="root"></div></body></html>';
const rows=[{id:'p1--large',productId:'p1',sizeId:'large',title:'وجبة دجاج',description:'دجاج مقرمش',link:'https://chickyfc.com/products/p1?size=large',image:'https://example.com/chicken.jpg',price:150,category:'meals',availability:'in_stock'}];
const config={header:{phone:'01220062060',logoRed:'https://example.com/logo.png'},footer:{addressAr:'شاطئ النخيل، شارع ١٤ مع ٢٩، العجمي، الإسكندرية',locationUrl:'https://maps.app.goo.gl/hYdQ3hjhzkVh4mdTA',facebook:'https://www.facebook.com/chicky',instagram:'https://www.instagram.com/chickyfriedchicken',tiktok:'javascript:alert(1)'}};
const data=html=>[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
test('restaurant schema uses confirmed overnight hours and public branch data',()=>{
 const html=renderSeo(template,{rows,categories:[],config});
 const restaurant=data(html).find(d=>d['@type']==='Restaurant');
 assert.equal(restaurant['@id'],'https://chickyfc.com/#restaurant');
 assert.equal(restaurant.telephone,'+201220062060');
 assert.equal(restaurant.address.streetAddress,config.footer.addressAr);
 assert.equal(restaurant.hasMenu,'https://chickyfc.com/');
 assert.equal(restaurant.hasMap,config.footer.locationUrl);
 assert.deepEqual(restaurant.openingHoursSpecification,{ '@type':'OpeningHoursSpecification',dayOfWeek:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],opens:'11:00',closes:'05:00'});
 assert.equal(restaurant.sameAs.length,2);
 assert.equal(restaurant.aggregateRating,undefined);
 assert.equal(restaurant.geo,undefined);
});
test('local keywords and confirmed hours appear in readable HTML and page metadata',()=>{
 const html=renderSeo(template,{rows,categories:[],config});
 assert.match(html,/<title>[^<]*العجمي[^<]*الإسكندرية/);
 assert.match(html,/<meta name="description" content="[^"]*العجمي/);
 const visible=html.replace(/<script[\s\S]*?<\/script>/g,'');
 assert.match(visible,/فرايد تشيكن مقرمش في العجمي، الإسكندرية/);
 assert.match(visible,/١١ صباحًا.*٥ الفجر/);
});
test('product offers remain intact alongside exactly one stable restaurant identity',()=>{
 const html=renderSeo(template,{rows,categories:[],config,productId:'p1',sizeId:'large'});
 const entities=data(html);
 assert.equal(entities.filter(d=>d['@type']==='Restaurant').length,1);
 const product=entities.find(d=>d['@type']==='Product');
 assert.equal(product.sku,'p1--large');assert.equal(product.offers.price,'150.00');
 assert.equal(product.offers.url,'https://chickyfc.com/products/p1?size=large');
 assert.match(html,/<title>وجبة دجاج \| CHICKY<\/title>/);
});
test('restaurant JSON-LD escapes configured text and rejects unsafe public links',()=>{
 const malicious={...config,footer:{...config.footer,addressAr:'</script><script>alert(1)</script>',facebook:'javascript:alert(1)',instagram:'https://user:password@example.com/profile',locationUrl:'javascript:alert(1)'}};
 const html=renderSeo(template,{rows,categories:[],config:malicious});
 const restaurant=data(html)[0];
 assert.equal(restaurant.address.streetAddress,malicious.footer.addressAr);
 assert.deepEqual(restaurant.sameAs,[]);assert.equal(restaurant.hasMap,undefined);
 assert.doesNotMatch(html,/<script>alert\(1\)/);
});
