import { ORIGIN } from './catalog.mjs';
import { localRestaurantCopy, restaurantHours } from '../lib/restaurantInfo.mjs';
const publicUrl = value => {
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password ? u.href : undefined; }
  catch { return undefined; }
};
const telephone = value => {
  const number=String(value || '').replace(/[^+\d]/g,'');
  if (/^0\d{9,10}$/.test(number)) return '+20'+number.slice(1);
  if (/^20\d{9,10}$/.test(number)) return '+'+number;
  return /^\+\d{8,15}$/.test(number) ? number : undefined;
};
export function restaurantSchema(config, rows) {
  const images=[...new Set(rows.map(r=>publicUrl(r.image)).filter(Boolean))].slice(0,3);
  return {
    '@context':'https://schema.org', '@type':'Restaurant', '@id':ORIGIN+'/#restaurant',
    name:'CHICKY', alternateName:'تشيكي فرايد تشيكن', url:ORIGIN+'/',
    description:localRestaurantCopy.ar.description, telephone:telephone(config.header?.phone),
    address:{'@type':'PostalAddress',streetAddress:config.footer?.addressAr || '',addressLocality:'الإسكندرية',addressRegion:'الإسكندرية',postalCode:'21644',addressCountry:'EG'},
    hasMenu:ORIGIN+'/', hasMap:publicUrl(config.footer?.locationUrl),
    logo:publicUrl(config.header?.logoRed), image:images.length?images:undefined,
    servesCuisine:['Fried chicken','Fast food'], currenciesAccepted:'EGP',
    sameAs:[...new Set([config.footer?.facebook,config.footer?.instagram,config.footer?.tiktok].map(publicUrl).filter(Boolean))],
    openingHoursSpecification:{'@type':'OpeningHoursSpecification',dayOfWeek:restaurantHours.days,opens:restaurantHours.opens,closes:restaurantHours.closes},
  };
}
