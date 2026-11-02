import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberAnalyticsReceipt, revokeAnalyticsReceipts } from '../lib/orderAnalytics.ts';
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};}
test('revocation receipts contain only bounded random tokens and retry safely without GA',async()=>{
 const s=storage();const token='12345678-1234-4234-8234-123456789ABC';
 rememberAnalyticsReceipt(token,s);rememberAnalyticsReceipt(token,s);rememberAnalyticsReceipt('phone01220062060',s);
 const calls=[];await revokeAnalyticsReceipts({rpc:async(n,p)=>{calls.push([n,p]);return {error:Error('offline')};}},s);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'revoke_chicky_analytics');assert.deepEqual(calls[0][1],{p_token:token});
 await revokeAnalyticsReceipts({rpc:async()=>({error:null})},s);assert.deepEqual(JSON.parse([...s.data.values()][0]),[]);
});
