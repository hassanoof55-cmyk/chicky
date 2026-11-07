import test from 'node:test';
import assert from 'node:assert/strict';
import { persistOrder, orderSubmissionErrorMessage } from '../lib/orderSubmission.ts';
const storage = () => { const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };
const order={customer_name:'Migration Test',status:'pending',items:[{id:'item',quantity:1,price:50}],total_price:50};

test('rate limits explain the wait and retain the retry ID', async () => {
  const savedStorage=storage(), ids=[];
  const client={async rpc(name,args){ids.push(args.p_order.id);return {error:ids.length===1?{code:'PT429'}:null};}};
  await assert.rejects(persistOrder(client,order,null,savedStorage),/١٠ دقائق/);
  await persistOrder(client,order,null,savedStorage);
  assert.equal(ids[0],ids[1]);
});

test('checkout shows localized rate guidance but never raw backend errors',async()=>{
 const client={async rpc(){return {error:{code:'PT429'}};}};
 try { await persistOrder(client,order,null,storage()); assert.fail('Expected rate limit'); }
 catch(error) {
   assert.match(orderSubmissionErrorMessage(error,'ar'),/١٠ دقائق/);
   assert.match(orderSubmissionErrorMessage(error,'en'),/10 minutes/);
 }
 assert.equal(orderSubmissionErrorMessage(new Error('PRIVATE DATABASE DETAILS'),'en'),
   'Your order could not be saved. Please try again.');
});

test('a rejected order is not reported as saved', async () => {
  const client = { from() { return { async insert() { return { error: null }; } }; }, async rpc() { return { error: { message: 'denied' } }; } };
  await assert.rejects(persistOrder(client, order, null, storage()), /تعذر حفظ الطلب/);
});

test('an accepted order atomically saves its promo without reading private orders', async () => {
  let saved = false;
  const client = { async rpc(name, args) { assert.equal(name, 'submit_chicky_order'); assert.equal(args.p_promo_code,'TESTCODE'); assert.match(args.p_order.id,/^CH-[0-9A-F-]{36}$/); assert.deepEqual({...args.p_order,id:undefined},{...order,id:undefined}); saved = true; return {error:null}; } };
  const id=await persistOrder(client, order, 'TESTCODE', storage());
  assert.match(id,/^CH-[0-9A-F-]{36}$/);
  assert.equal(saved, true);
});

test('an uncertain response reuses its order ID across retries and remounts',async()=>{
 const savedStorage=storage(),ids=[];
 const client={async rpc(name,args){ids.push(args.p_order.id);return {error:ids.length===1?{message:'response lost'}:null};}};
 await assert.rejects(persistOrder(client,order,null,savedStorage));
 await persistOrder(client,order,null,savedStorage);
 assert.match(ids[0],/^CH-[0-9A-F-]{36}$/);
 assert.equal(ids[0],ids[1]);
 await persistOrder(client,order,null,savedStorage);
 assert.notEqual(ids[1],ids[2]);
});
test('optional analytics metadata cannot create a second business order after an uncertain response',async()=>{
 const savedStorage=storage(),ids=[];
 const client={async rpc(name,args){ids.push(args.p_order.id);return {error:ids.length===1?{message:'response lost'}:null};}};
 await assert.rejects(persistOrder(client,{...order,analytics:{client_id:'1.2',session_id:'123'}},null,savedStorage));
 await persistOrder(client,{...order,analytics:{client_id:'3.4',session_id:'456'}},null,savedStorage);
 assert.equal(ids[0],ids[1]);
});
