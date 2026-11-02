import test from 'node:test';
import assert from 'node:assert/strict';
import { storefrontRoute, routeMenu, routeTitle } from '../lib/storefrontRoute.ts';
test('product/category routes filter real menu and decode identifiers safely',()=>{
 const menu=[{id:'p1',nameAr:'أرز',category:'sides',sizes:[{id:'l',nameAr:'كبير'}]}, {id:'p2',category:'meals'}];
 const r=storefrontRoute('/products/p1','?size=l');
 assert.deepEqual(r,{productId:'p1',categoryId:null,sizeId:'l'});
 assert.deepEqual(routeMenu(menu,r),[menu[0]]);
 assert.equal(routeTitle(menu,{layout:[]},r,true),'أرز - كبير | CHICKY');
 assert.deepEqual(routeMenu(menu,storefrontRoute('/categories/meals','')),[menu[1]]);
 assert.deepEqual(routeMenu(menu,storefrontRoute('/products/no-such-id','')),[]);
 assert.doesNotThrow(()=>storefrontRoute('/products/%ZZ',''));
});
