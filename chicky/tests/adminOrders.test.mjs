import test from 'node:test';
import assert from 'node:assert/strict';
import { orderDateRange, fetchOrdersPage, fetchOrderStats, exportOrdersCsv, csvCell, cairoDateBoundary, EMPTY_ORDER_FILTERS, orderSearchText } from '../lib/adminOrders.ts';

const builder=(result,calls=[])=>({
 select(...args){calls.push(['select',...args]);return this;},
 order(...args){calls.push(['order',...args]);return this;},
 range(...args){calls.push(['range',...args]);return this;},
 or(...args){calls.push(['or',...args]);return this;},
 eq(...args){calls.push(['eq',...args]);return this;},
 ilike(...args){calls.push(['ilike',...args]);return this;},
 gte(...args){calls.push(['gte',...args]);return this;},
 lt(...args){calls.push(['lt',...args]);return this;},
 abortSignal(signal){calls.push(['signal',signal]);return this;},
 then(resolve,reject){return Promise.resolve(typeof result==='function'?result():result).then(resolve,reject);}
});
const row=i=>({id:`CH-${String(i).padStart(6,'0')}`,created_at:'2026-11-07T12:00:00Z',customer_name:'Test',phone:'01000000000',items:[],total_price:10,status:'pending'});

test('periods keep existing UTC calendar semantics including leap days and year boundaries',()=>{
 assert.deepEqual(orderDateRange('day','2024-02-29'),{from:'2024-02-29T00:00:00.000Z',until:'2024-03-01T00:00:00.000Z'});
 assert.deepEqual(orderDateRange('month','2026-12'),{from:'2026-12-01T00:00:00.000Z',until:'2027-01-01T00:00:00.000Z'});
 assert.deepEqual(orderDateRange('year','2026'),{from:'2026-01-01T00:00:00.000Z',until:'2027-01-01T00:00:00.000Z'});
 for(const [kind,value] of [['day','2026-02-30'],['month','2026-13'],['year',''],['other','2026']])assert.throws(()=>orderDateRange(kind,value));
});
test('a history page fetches 25 rows with exact total and deterministic timestamp/ID ordering',async()=>{
 const calls=[],signal=new AbortController().signal;
 const client={from(table){assert.equal(table,'orders');return builder({data:Array.from({length:25},(_,i)=>row(i)),count:2501,error:null},calls);}};
 const page=await fetchOrdersPage(client,2,signal);
 assert.equal(page.orders.length,25);assert.equal(page.total,2501);
 assert.deepEqual(calls.filter(call=>call[0]==='range'),[['range',50,74]]);
 assert.deepEqual(calls.filter(call=>call[0]==='order').map(call=>call.slice(1)),[['created_at',{ascending:false}],['id',{ascending:false}]]);
 assert.equal(calls.find(call=>call[0]==='select')[2].count,'exact');
 assert.ok(calls.find(call=>call[0]==='signal'));
});
test('filters execute on the server before pagination, with a filtered exact total', async () => {
 const calls=[];
 const client={from(){return builder({data:[row(2000)],count:1,error:null},calls);}};
 const filters={search:'٠١٠٠٠٠٠٠٠٠٠',status:'pending',area:'النخيل',from:'2026-11-01',until:'2026-11-10'};
 const result=await fetchOrdersPage(client,0,undefined,filters);
 assert.equal(result.total,1);
 assert.deepEqual(calls.find(c=>c[0]==='or'),['or','id.ilike.%01000000000%,customer_name.ilike.%01000000000%,phone.ilike.%01000000000%']);
 assert.deepEqual(calls.find(c=>c[0]==='eq'),['eq','status','pending']);
 assert.deepEqual(calls.find(c=>c[0]==='ilike'),['ilike','area','%النخيل%']);
 assert.deepEqual(calls.find(c=>c[0]==='gte'),['gte','created_at','2026-10-31T22:00:00.000Z']);
 assert.deepEqual(calls.find(c=>c[0]==='lt'),['lt','created_at','2026-11-10T22:00:00.000Z']);
 assert.ok(calls.findIndex(c=>c[0]==='or') < calls.findIndex(c=>c[0]==='range'));
});
test('Cairo date filters account for summer time and reject invalid date ranges', async () => {
 assert.equal(cairoDateBoundary('2026-07-01'),'2026-06-30T21:00:00.000Z');
 assert.equal(cairoDateBoundary('2026-11-10',true),'2026-11-10T22:00:00.000Z');
 assert.throws(()=>cairoDateBoundary('2026-02-30'));
 await assert.rejects(fetchOrdersPage({},0,undefined,{...EMPTY_ORDER_FILTERS,from:'2026-11-12',until:'2026-11-01'}));
});
test('search text cannot insert PostgREST expressions or wildcards', async () => {
 const cleaned=orderSearchText('x),status.eq.completed,customer_name.ilike.*');
 assert.ok(!/[(),.*%]/.test(cleaned));
 assert.equal(orderSearchText('محمد أحمد'),'محمد أحمد');
 assert.equal(orderSearchText('CH-EF123456'),'CH-EF123456');
 await assert.rejects(fetchOrdersPage({from(){return builder({data:[],count:0});}},0,undefined,{...EMPTY_ORDER_FILTERS,search:'*%()'}));
});
test('a displayed short order number searches the persisted ID suffix', async () => {
 const calls=[];
 const client={from(){return builder({data:[],count:0,error:null},calls);}};
 await fetchOrdersPage(client,0,undefined,{...EMPTY_ORDER_FILTERS,search:'CH-EF123456'});
 assert.equal(calls.find(c=>c[0]==='or')[1],'id.ilike.%EF123456%,customer_name.ilike.%CH-EF123456%,phone.ilike.%CH-EF123456%');
});
test('full-period statistics come from their own aggregate request, never the history page',async()=>{
 const expected={totalOrders:2200,totalRevenue:22000,areaStats:{Test:{count:2200,revenue:22000}},topArea:['Test',{count:2200,revenue:22000}],topItem:['Meal',4400]};
 const range=orderDateRange('month','2026-11');
 const client={rpc(name,args){assert.equal(name,'get_chicky_order_stats');assert.deepEqual(args,{p_from:range.from,p_until:range.until});return builder({data:expected,error:null});}};
 assert.deepEqual(await fetchOrderStats(client,range),expected);
});
test('failed or incomplete page/stat requests cannot look like zero orders or zero revenue',async()=>{
 await assert.rejects(fetchOrdersPage({from(){return builder({data:[],count:null,error:null});}},0));
 await assert.rejects(fetchOrdersPage({from(){return builder({error:{message:'denied'}});}},0));
 await assert.rejects(fetchOrderStats({rpc(){return builder({data:null,error:{message:'offline'}});}},orderDateRange('year','2026')));
});
test('CSV export covers more than 1000 rows using an advancing cursor',async()=>{
 const all=Array.from({length:1253},(_,i)=>row(1253-i));let offset=0;const cursors=[];
 const client={rpc(name,args){assert.equal(name,'export_chicky_orders_page');cursors.push(args.p_before_id);const data=all.slice(offset,offset+250);offset+=data.length;return builder({data,error:null});}};
 const csv=await exportOrdersCsv(client,orderDateRange('month','2026-11'));
 assert.equal(csv.split('\r\n').length,1254);assert.ok(csv.startsWith('\uFEFF'));
 assert.equal(cursors.length,6);assert.equal(cursors[0],null);assert.equal(cursors[1],all[249].id);
 assert.ok(csv.includes('001253'));assert.ok(csv.includes('000001'));
});
test('failed or cancelled export never returns a partial report',async()=>{
 let requests=0;
 const failed={rpc(){requests++;return builder(requests===1?{data:Array.from({length:250},(_,i)=>row(i)),error:null}:{error:{message:'offline'}});}};
 await assert.rejects(exportOrdersCsv(failed,orderDateRange('year','2026')));
 const ac=new AbortController();requests=0;
 const cancelled={rpc(){requests++;return builder(()=>{ac.abort();return {data:Array.from({length:250},(_,i)=>row(i)),error:null};});}};
 await assert.rejects(exportOrdersCsv(cancelled,orderDateRange('year','2026'),ac.signal),error=>error.name==='AbortError');
 assert.equal(requests,1);
});
test('CSV escapes quotes/newlines and neutralizes formula-like customer text only in the exported file',()=>{
 assert.equal(csvCell('A,"B"\nC'),'"A,""B""\nC"');
 for(const text of ['=1+1','+201000000000','-formula','@SUM(1)','  =1','\t=1','\r=1'])assert.ok(csvCell(text).startsWith('"\''));
 assert.equal(csvCell(-25),'"-25"');assert.equal(csvCell('01000000000'),'"01000000000"');
 assert.equal(csvCell('وجبة عادية'),'"وجبة عادية"');
});
