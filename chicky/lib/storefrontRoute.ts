import type { Product, SiteConfig } from '../types';
import { localRestaurantCopy } from './restaurantInfo.mjs';
export type StorefrontRoute = {productId:string|null;categoryId:string|null;sizeId:string|null};
export function storefrontRoute(path:string,search:string):StorefrontRoute {
  const product=path.match(/^\/products\/([^/]+)$/);const category=path.match(/^\/categories\/([^/]+)$/);
  const decode=(v:string|undefined)=>{try{return v?decodeURIComponent(v):null;}catch{return null;}};
  return {productId:decode(product?.[1]),categoryId:decode(category?.[1]),sizeId:new URLSearchParams(search).get('size')};
}
export function routeMenu(menu:Product[],route:StorefrontRoute) {
  return menu.filter(p=>(!route.productId||p.id===route.productId)&&(!route.categoryId||p.category===route.categoryId));
}
export function routeTitle(menu:Product[],config:Pick<SiteConfig,'layout'>,route:StorefrontRoute,isAr:boolean) {
  const p=menu.find(p=>p.id===route.productId);const c=config.layout.find(c=>c.id===route.categoryId);
  const size=p?.sizes?.find(s=>s.id===route.sizeId);
  if(p)return `${(isAr?p.nameAr:p.name)||p.nameAr||p.name}${size?` - ${isAr?size.nameAr:size.nameEn}`:''} | CHICKY`;
  if(c)return `${isAr?c.nameAr:c.nameEn} | CHICKY`;
  return localRestaurantCopy[isAr ? 'ar' : 'en'].title;
}
