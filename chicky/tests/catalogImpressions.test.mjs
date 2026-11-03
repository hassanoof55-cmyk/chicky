import test from 'node:test';
import assert from 'node:assert/strict';
import { observeCatalogImpression } from '../lib/catalogImpressions.ts';
function setup() {
 const target=new EventTarget();let consent=false;let hits=0;let observe;
 class Observer { constructor(callback){observe=callback;} observe(){} disconnect(){this.disconnected=true;} }
 const cleanup=observeCatalogImpression({},()=>hits++,()=>consent,target,Observer,'consent');
 return {visible:value=>observe([{isIntersecting:value}]),consent(value){consent=value;target.dispatchEvent(new Event('consent'));},hits:()=>hits,cleanup};
}
test('a currently visible item is measured after opt-in, never before or twice',()=>{
 const s=setup();s.visible(true);assert.equal(s.hits(),0);s.consent(true);assert.equal(s.hits(),1);
 s.visible(true);s.consent(true);assert.equal(s.hits(),1);s.cleanup();s.consent(false);s.consent(true);assert.equal(s.hits(),1);
});
test('old offscreen impressions are not replayed when consent changes',()=>{
 const s=setup();s.visible(true);s.visible(false);s.consent(true);assert.equal(s.hits(),0);
 s.visible(true);assert.equal(s.hits(),1);s.consent(false);s.visible(true);assert.equal(s.hits(),1);
 s.visible(false);s.consent(true);assert.equal(s.hits(),1);s.visible(true);assert.equal(s.hits(),2);s.cleanup();
});
