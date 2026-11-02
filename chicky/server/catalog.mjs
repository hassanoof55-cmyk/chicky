export const ORIGIN = 'https://chickyfc.com';
export const escapeXml = value => String(value ?? '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export const productPath = (id, size) => `/products/${encodeURIComponent(id)}${size ? `?size=${encodeURIComponent(size)}` : ''}`;
export const categoryPath = id => `/categories/${encodeURIComponent(id)}`;
const text = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim() : '';
const validPrice = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const imageUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };

export function catalogEntries(menu) {
  const rows = [];
  const seen = new Set();
  for (const p of menu) {
    if (!p || p.is_published === false || typeof p.id !== 'string' || !p.id.trim() || !text(p.nameAr || p.name) || !imageUrl(p.image)) continue;
    const sizes = p.hasSizes ? (Array.isArray(p.sizes) ? p.sizes.filter(s => s && typeof s.id === 'string' && s.id) : []) : [null];
    for (const size of sizes) {
      const price = size ? size.price : p.price;
      if (!validPrice(price)) continue;
      const id = size ? `${p.id}--${size.id}` : p.id;
      if (seen.has(id)) throw new Error('Duplicate public catalog identifier');
      seen.add(id);
      rows.push({ id, productId:p.id, sizeId:size?.id || null, groupId:size ? p.id : null,
        title: `${text(p.nameAr || p.name)}${size ? ` - ${text(size.nameAr || size.nameEn || size.id)}` : ''}`,
        description:text(p.descriptionAr || p.description || p.nameAr || p.name),
        link:ORIGIN + productPath(p.id, size?.id), image:imageUrl(p.image), price,
        availability:p.availability === 'out_of_stock' || p.is_available === false ? 'out_of_stock' : 'in_stock',
        category:p.category, size:text(size?.nameAr || size?.nameEn),
        // CHICKY is the storefront, not an invented manufacturer for branded drinks.
        brand:text(p.brand), gtin: /^\d{8}$|^\d{12,14}$/.test(p.gtin || '') ? p.gtin : '', mpn:text(p.mpn),
      });
    }
  }
  return rows;
}
const tag = (key,value) => value === '' || value === null || value === undefined ? '' : `<g:${key}>${escapeXml(value)}</g:${key}>`;
export function googleFeed(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>CHICKY</title><link>${ORIGIN}</link><description>منيو CHICKY</description>${rows.map(r => `<item>${Object.entries({id:r.id,title:r.title,description:r.description,link:r.link,image_link:r.image,price:`${r.price.toFixed(2)} EGP`,availability:r.availability,condition:'new',item_group_id:r.groupId,size:r.size,brand:r.brand,gtin:r.gtin,mpn:r.mpn}).map(([k,v])=>tag(k,v)).join('')}</item>`).join('')}</channel></rss>`;
}
const csv = value => `"${String(value ?? '').replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g,'""')}"`;
export function metaFeed(rows) {
  const keys = ['id','title','description','availability','condition','price','link','image_link','brand','item_group_id','size'];
  return keys.join(',') + '\r\n' + rows.map(r => [r.id,r.title,r.description,r.availability,'new',`${r.price.toFixed(2)} EGP`,r.link,r.image,r.brand,r.groupId,r.size].map(csv).join(',')).join('\r\n') + '\r\n';
}
export function sitemap(rows, categories) {
  const ids = new Set(rows.map(r=>r.productId));
  const used = new Set(rows.map(r=>r.category));
  const urls = [ORIGIN+'/', ...[...ids].map(id=>ORIGIN+productPath(id)), ...categories.filter(c=>used.has(c.id)).map(c=>ORIGIN+categoryPath(c.id))];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(urls)].map(u=>`<url><loc>${escapeXml(u)}</loc></url>`).join('')}</urlset>`;
}
