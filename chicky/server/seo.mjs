import { ORIGIN, escapeXml as esc, productPath, categoryPath } from './catalog.mjs';
import { restaurantSchema } from './restaurant.mjs';
import { localRestaurantCopy } from '../lib/restaurantInfo.mjs';
const json = data => JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
export function renderSeo(template, { rows, categories, config, productId, sizeId, categoryId }) {
  const productRows = productId ? rows.filter(r=>r.productId===productId) : [];
  const row = productRows.find(r=>r.sizeId===sizeId) || (!sizeId ? productRows[0] : null);
  const category = categoryId ? categories.find(c=>c.id===categoryId) : null;
  if ((productId && !row) || (categoryId && (!category || !rows.some(r=>r.category===categoryId)))) return null;
  const title = row ? `${row.title} | CHICKY` : category ? `${category.nameAr || category.nameEn} | CHICKY` : localRestaurantCopy.ar.title;
  const description = (row?.description || localRestaurantCopy.ar.description).slice(0,300);
  const path = row ? productPath(productId,sizeId) : category ? categoryPath(categoryId) : '/';
  const canonical = ORIGIN+path;
  const visibleRows = row ? [row] : rows.filter(r=>!category || r.category===categoryId).filter((r,i,all)=>all.findIndex(x=>x.productId===r.productId)===i);
  const cards = visibleRows.map(r=>`<article><a href="${esc(productPath(r.productId,r.sizeId))}"><img src="${esc(r.image)}" width="260" height="220" alt="${esc(r.title)}" loading="lazy"><h2>${esc(r.title)}</h2></a><p>${esc(r.description)}</p><p>${r.price.toFixed(2)} ج.م</p></article>`).join('');
  const fallback = `<main dir="rtl" style="max-width:1100px;margin:auto;padding:32px;font-family:Arial,sans-serif"><a href="/">CHICKY — المنيو</a><h1>${esc(title)}</h1>${row ? `<p>${esc(row.description)}</p><p>${row.availability==='in_stock'?'متاح للطلب':'غير متاح حاليًا'}</p>` : ''}<nav>${categories.filter(c=>rows.some(r=>r.category===c.id)).map(c=>`<a style="display:inline-block;margin:8px" href="${esc(categoryPath(c.id))}">${esc(c.nameAr || c.nameEn)}</a>`).join('')}</nav><section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px">${cards}</section>${row && productRows.length>1 ? `<nav aria-label="الأحجام">${productRows.map(r=>`<a style="display:inline-block;margin:8px" href="${esc(productPath(r.productId,r.sizeId))}">${esc(r.size)} — ${r.price.toFixed(2)} ج.م</a>`).join('')}</nav>` : ''}<p>${esc(config.footer?.addressAr)}</p><a href="tel:${esc(String(config.header?.phone || '').replace(/[^+\d]/g,''))}">${esc(config.header?.phone)}</a><noscript><p>لتخصيص طلبك وإضافة الأصناف للسلة، فعّل JavaScript أو اتصل بالمطعم.</p></noscript></main>`;
  const structured = row ? {
    '@context':'https://schema.org','@type':'Product',name:row.title,description:row.description,image:[row.image],sku:row.id,url:canonical,
    offers:{'@type':'Offer',url:canonical,price:row.price.toFixed(2),priceCurrency:'EGP',availability:`https://schema.org/${row.availability==='in_stock'?'InStock':'OutOfStock'}`},
    ...(row.brand ? {brand:{'@type':'Brand',name:row.brand}} : {}),
  } : restaurantSchema(config,rows);
  const restaurantMetadata = row ? `<script type="application/ld+json">${json(restaurantSchema(config,rows))}</script>` : '';
  const metadata = `<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="${row?'product':'website'}">${row?`<meta property="og:image" content="${esc(row.image)}">`:''}<script type="application/ld+json">${json(structured)}</script>`;
  const localDetails = `<p>${esc(localRestaurantCopy.ar.description)}</p><p>${esc(localRestaurantCopy.ar.hours)}</p>`;
  return template.replace(/<title>[\s\S]*?<\/title>/i,'').replace('</head>',metadata+restaurantMetadata+'</head>').replace('<div id="root"></div>',`<div id="root">${fallback.replace('</main>',localDetails+'</main>')}</div>`).replace('<html lang="en">','<html lang="ar" dir="rtl">');
}
