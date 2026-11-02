import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeCart, restoreCart } from '../lib/cartPersistence.ts';
const product={id:'p1',name:'Rice',price:40,hasSizes:true,spicinessOption:true,sizes:[{id:'l',price:50}],modifiers:[{id:'sauce',price:10}]};
test('cart survives product navigation with current database prices and valid selections only',()=>{
 const line={...product,price:999,quantity:2,selectedSize:{id:'l',price:999},selectedSpiciness:'Spicy',selectedModifiers:[{id:'sauce',price:999}],customer_name:'PRIVATE'};
 const encoded=serializeCart([line]);assert.doesNotMatch(encoded,/PRIVATE|999|price|name/);
 const restored=restoreCart(encoded,[product]);assert.equal(restored[0].price,60);assert.equal(restored[0].quantity,2);assert.equal(restored[0].selectedSize.price,50);
});
test('invalid, removed products or required sizes never become orderable from stored data',()=>{
 assert.deepEqual(restoreCart('broken',[product]),[]);
 assert.deepEqual(restoreCart(JSON.stringify([{id:'p1',quantity:1,sizeId:'missing'},{id:'gone',quantity:2}]),[product]),[]);
 assert.deepEqual(restoreCart(JSON.stringify([{id:'p1',quantity:0,sizeId:'l'}]),[product]),[]);
});
