import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminConfigSaver, upsertConfigEntry } from '../lib/adminConfig.ts';

test('configuration writes stay ordered and only the newest save reports success',async()=>{
 const writes=[],statuses=[],drafts=[];let finishFirst;
 const client={rpc(name,args){assert.equal(name,'save_chicky_config');writes.push(args.p_config);
   return writes.length===1?new Promise(resolve=>{finishFirst=resolve;}):Promise.resolve({error:null});}};
 const saver=createAdminConfigSaver(client,{onDraft:value=>drafts.push(value),onStatus:value=>statuses.push(value)});
 const first=saver.save({label:'a'}),second=saver.save({label:'ab'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(writes,[{label:'a'}]);
 finishFirst({error:null});assert.equal(await first,true);assert.equal(await second,true);
 assert.deepEqual(writes,[{label:'a'},{label:'ab'}]);assert.equal(statuses.at(-1),'saved');
 assert.equal(statuses.filter(value=>value==='saved').length,1);assert.equal(drafts.at(-1).label,'ab');
});
test('a failed save stays retryable and cannot claim success or block later saves',async()=>{
 let attempts=0;const statuses=[];
 const client={async rpc(){attempts++;if(attempts===1)throw Error('offline');return {error:attempts===2?{message:'denied'}:null};}};
 const saver=createAdminConfigSaver(client,{onDraft(){},onStatus:value=>statuses.push(value)});
 assert.equal(await saver.save({label:'keep draft'}),false);assert.equal(statuses.at(-1),'error');
 assert.equal(await saver.retry(),false);assert.equal(statuses.at(-1),'error');
 assert.equal(await saver.retry(),true);assert.equal(statuses.at(-1),'saved');
});

test('typing while an older save finishes retains the new unsaved draft',async()=>{
 let finish;const drafts=[],statuses=[],saved=[];
 const client={rpc(){return new Promise(resolve=>{finish=resolve;});}};
 const saver=createAdminConfigSaver(client,{onDraft:value=>drafts.push(value),onStatus:value=>statuses.push(value),onSaved:value=>saved.push(value)});
 const pending=saver.save({label:'old'});
 await new Promise(resolve=>setImmediate(resolve));
 saver.stage({label:'still typing'});
 finish({error:null});await pending;
 assert.equal(drafts.at(-1).label,'still typing');assert.equal(statuses.at(-1),'dirty');assert.deepEqual(saved,[]);
});

test('pending work remains busy even when a newer unsaved draft is staged',async()=>{
 let finish;const busy=[];
 const saver=createAdminConfigSaver({rpc(){return new Promise(resolve=>{finish=resolve;});}},
   {onDraft(){},onStatus(){},onBusy:value=>busy.push(value)});
 const pending=saver.save({label:'save'});saver.stage({label:'new draft'});
 assert.equal(saver.isSaving(),true);
 await new Promise(resolve=>setImmediate(resolve));finish({error:null});await pending;
 assert.equal(saver.isSaving(),false);assert.deepEqual(busy,[true,false]);
});

test('retrying a pending addition replaces its stable ID without duplicates or reordering',()=>{
 const original=[{id:'before',name:'Before'},{id:'pending',name:'Draft'},{id:'after',name:'After'}];
 const updated=upsertConfigEntry(original,{id:'pending',name:'Corrected'});
 assert.deepEqual(updated.map(item=>item.id),['before','pending','after']);
 assert.equal(updated[1].name,'Corrected');assert.equal(original[1].name,'Draft');
 const appended=upsertConfigEntry(updated,{id:'new',name:'New'});
 assert.equal(upsertConfigEntry(appended,{id:'new',name:'Retried'}).length,4);
});
