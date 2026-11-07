import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCartLine } from '../lib/cartLine.ts';

const base={id:'meal',price:100,quantity:1,selectedSpiciness:'Normal'};
test('removing one size retains another size even when their prices match',()=>{
  const cart=[{...base,selectedSize:{id:'a'}},{...base,selectedSize:{id:'b'}}];
  const remains=cart.filter(item=>!matchesCartLine(item,'meal','Normal',100,'a','[]'));
  assert.deepEqual(remains,[cart[1]]);
});
test('same-priced extras remain distinct for removal and quantity changes',()=>{
  const cart=[{...base,selectedModifiers:[{id:'cheese',price:10}]},{...base,selectedModifiers:[{id:'sauce',price:10}]}];
  const selected=item=>matchesCartLine(item,'meal','Normal',100,undefined,JSON.stringify(cart[0].selectedModifiers));
  assert.deepEqual(cart.filter(item=>!selected(item)),[cart[1]]);
  assert.deepEqual(cart.map(item=>selected(item)?{...item,quantity:2}:item).map(item=>item.quantity),[2,1]);
});
test('matching preserves existing price, spice and optional-argument semantics',()=>{
  assert.equal(matchesCartLine(base,'meal','Spicy',100),false);
  assert.equal(matchesCartLine(base,'meal','Normal',101),false);
  assert.equal(matchesCartLine(base,'other','Normal',100),false);
  assert.equal(matchesCartLine(base,'meal','Normal'),true);
  assert.equal(matchesCartLine(base,'meal','Normal',100,undefined,'[]'),true);
});
