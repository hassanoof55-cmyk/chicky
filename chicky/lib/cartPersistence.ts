import type { CartItem, Product } from '../types';
export const CART_STORAGE_KEY = 'chicky.cart.v1';
export function serializeCart(cart:CartItem[]):string {
 return JSON.stringify(cart.map(item=>({id:item.id,quantity:item.quantity,sizeId:item.selectedSize?.id,spiciness:item.selectedSpiciness,modifierIds:item.selectedModifiers?.map(m=>m.id) || []})));
}
export function restoreCart(encoded:string|null,menu:Product[]):CartItem[] {
 try {
  const entries=JSON.parse(encoded || '[]');if(!Array.isArray(entries))return [];
  return entries.slice(0,100).flatMap(entry=>{
   const p=menu.find(p=>p.id===entry?.id);if(!p || !Number.isSafeInteger(entry.quantity)||entry.quantity<1||entry.quantity>999)return [];
   const size=p.hasSizes?p.sizes?.find(s=>s.id===entry.sizeId):undefined;if(p.hasSizes&&!size)return [];
   const spice=p.spicinessOption&&['Normal','Spicy'].includes(entry.spiciness)?entry.spiciness:undefined;
   if(p.spicinessOption&&!spice)return [];
   const mods=(p.modifiers || []).filter(m=>Array.isArray(entry.modifierIds)&&entry.modifierIds.includes(m.id));
   const price=(size?size.price:p.price)+mods.reduce((sum,m)=>sum+m.price,0);
   if(!Number.isFinite(price)||price<=0)return [];
   return [{...p,price,quantity:entry.quantity,selectedSize:size,selectedSpiciness:spice,selectedModifiers:mods}];
  });
 }catch{return [];}
}
