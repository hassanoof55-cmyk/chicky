import test from 'node:test';
import assert from 'node:assert/strict';
import { disposeLeafletMap } from '../lib/leafletCleanup.ts';
test('closing a map removes its listeners/layers once and releases map/layer references',()=>{
 let removed=0;const map={current:{remove(){removed++;}}},layer={current:{}},other={current:{}};
 disposeLeafletMap(map,layer,other);disposeLeafletMap(map,layer,other);
 assert.equal(removed,1);assert.equal(map.current,null);assert.equal(layer.current,null);assert.equal(other.current,null);
});
