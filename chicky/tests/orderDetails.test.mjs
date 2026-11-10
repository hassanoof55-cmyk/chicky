import test from 'node:test';
import assert from 'node:assert/strict';
import { orderItems, mapStoredOrder } from '../lib/orderDetails.ts';

test('checkout sends stable catalog option IDs alongside the displayed unit price', () => {
  const items = orderItems([{ id:'meal', name:'Meal', nameAr:'وجبة', category:'meals', price:120, quantity:2,
    selectedSize:{id:'large',nameEn:'Large',nameAr:'كبير',price:110}, selectedSpiciness:'Spicy',
    selectedModifiers:[{id:'cheese',nameEn:'Cheese',nameAr:'جبنة',price:10}] }], 'ar');
  assert.deepEqual(items, [{id:'meal',name:'وجبة',category:'meals',price:120,quantity:2,
    size:'كبير',size_id:'large',spiciness:'Spicy',modifier_ids:['cheese']}]);
});

test('initial and realtime admin orders retain canonical details and schedule', () => {
  const saved=mapStoredOrder({id:'order',items:[{id:'meal',name:'Meal',price:120,quantity:2,
    spiciness:'Spicy',selectedSize:{id:'large',nameEn:'Large'},selectedModifiers:[{id:'cheese',nameEn:'Cheese',price:10}]}],
    order_details:{service_type:'pickup',scheduled_time:'23:30'}});
  assert.equal(saved.items[0].selectedSpiciness,'Spicy');
  assert.equal(saved.items[0].selectedSize.nameEn,'Large');
  assert.equal(saved.items[0].selectedModifiers[0].nameEn,'Cheese');
  assert.equal(saved.scheduledTime,'23:30');
  assert.equal(saved.serviceType,'pickup');
});

test('legacy admin order labels remain readable without rewriting saved records', () => {
  const saved=mapStoredOrder({items:[{name:'Old meal',size:'Large',spiciness:'Normal',price:100,quantity:1}]});
  assert.equal(saved.items[0].selectedSize.nameEn,'Large');
  assert.equal(saved.items[0].selectedSpiciness,'Normal');
  assert.deepEqual(saved.items[0].selectedModifiers,[]);
  assert.equal(saved.scheduledTime,undefined);
});
test('admin mapping retains server pricing snapshots without creating amounts for historical orders', () => {
  const pricing = { version:1,subtotal:200,delivery_fee:30,discount_amount:20 };
  const saved = mapStoredOrder({items:[],total_price:210,order_details:{pricing}});
  assert.deepEqual(saved.pricing, pricing);
  assert.equal(saved.totalPrice, 210);
  assert.equal(mapStoredOrder({items:[]}).pricing, undefined);
});
