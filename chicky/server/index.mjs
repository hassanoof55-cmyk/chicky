import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, catalogEntries, googleFeed, metaFeed, sitemap } from './catalog.mjs';
import { renderSeo } from './seo.mjs';
import { policyPage } from './policies.mjs';
import { startConversionWorker } from './conversions.mjs';

export function createCatalogLoader({url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,fetcher=fetch,clock=Date.now}={}) {
  let cached=null;let expires=0;let inFlight=null;
  return async()=>{
    if(cached && clock()<expires)return cached;
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      if(!url || !key)throw Error('Missing public catalog configuration');
      const get=async path=>{const r=await fetcher(`${url}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Public catalog request failed');return r.json();};
      const [menu,settings]=await Promise.all([get('menu_items?select=*&order=created_at.asc'),get('site_settings?select=config_data&id=eq.active_config')]);
      if(!Array.isArray(menu)||!settings?.[0]?.config_data)throw Error('Invalid public catalog response');
      cached={menu,config:settings[0].config_data};expires=clock()+60000;return cached;
    })();
    try{return await inFlight;}finally{inFlight=null;}
  };
}
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
export function createHandler({loadCatalog=createCatalogLoader(),dist=resolve(fileURLToPath(new URL('../dist/',import.meta.url))),template}={}){
  return async(req,res)=>{
    const send=(status,type,body,extra={})=>{res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...extra});res.end(req.method==='HEAD'?undefined:body);};
    if(!['GET','HEAD'].includes(req.method))return send(405,'text/plain','Method not allowed',{'Allow':'GET, HEAD'});
    let u;try{u=new URL(req.url,'https://chickyfc.com');}catch{return send(400,'text/plain','Invalid request');}
    const path=u.pathname;
    if(path==='/healthz')return send(200,'text/plain','ok');
    if(path==='/robots.txt')return send(200,'text/plain; charset=utf-8',`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /cart\nSitemap: ${ORIGIN}/sitemap.xml\n`,{'Cache-Control':'public, max-age=300'});
    const productMatch=path.match(/^\/products\/([^/]+)$/);const categoryMatch=path.match(/^\/categories\/([^/]+)$/);
    const isCatalog=path==='/'||productMatch||categoryMatch||['/sitemap.xml','/feeds/google.xml','/feeds/meta.csv','/policies','/privacy'].includes(path);
    if(!isCatalog){
      // Serve only built public assets, never project files or SPA fallbacks for unknown routes.
      const allowed=path.startsWith('/assets/')||path.startsWith('/brand/')||path.startsWith('/images/')||path.startsWith('/audio/')||path==='/index.css';
      let decoded;try{decoded=decodeURIComponent(path);}catch{return send(400,'text/plain','Invalid path');}
      const file=resolve(dist,'.'+decoded);
      if(allowed && file.startsWith(dist+sep) && !decoded.split('/').some(p=>p.startsWith('.'))){
        try{if((await stat(file)).isFile()){const bytes=await readFile(file);return send(200,mime[extname(file)]||'application/octet-stream',bytes,{'Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'public, max-age=300'});}}catch{}
      }
      return send(404,'text/html; charset=utf-8','<!doctype html><html lang="ar" dir="rtl"><head><meta name="robots" content="noindex"><title>الصفحة غير موجودة | CHICKY</title></head><body><h1>الصفحة غير موجودة</h1><a href="/">الرجوع للمنيو</a></body></html>',{'X-Robots-Tag':'noindex'});
    }
    try{
      const {menu,config}=await loadCatalog();const rows=catalogEntries(menu);
      const categories=Array.isArray(config.layout)?[...config.layout]:[];
      for(const r of rows)if(r.category&&!categories.some(c=>c.id===r.category))categories.push({id:r.category,nameAr:r.category});
      const cache={'Cache-Control':'public, max-age=60'};
      if(path==='/policies'||path==='/privacy')return send(200,'text/html; charset=utf-8',policyPage(path,config),cache);
      if(path==='/sitemap.xml')return send(200,'application/xml; charset=utf-8',sitemap(rows,categories),cache);
      if(path==='/feeds/google.xml')return send(200,'application/xml; charset=utf-8',googleFeed(rows),cache);
      if(path==='/feeds/meta.csv')return send(200,'text/csv; charset=utf-8',metaFeed(rows),cache);
      let productId,categoryId;try{productId=productMatch?decodeURIComponent(productMatch[1]):null;categoryId=categoryMatch?decodeURIComponent(categoryMatch[1]):null;}catch{return send(400,'text/plain','Invalid path');}
      const html=renderSeo(template ?? await readFile(resolve(dist,'index.html'),'utf8'),{rows,categories,config,productId,categoryId,sizeId:u.searchParams.get('size')});
      if(!html)return send(404,'text/html; charset=utf-8','<meta name="robots" content="noindex"><h1>الصنف أو القسم غير موجود</h1><a href="/">المنيو</a>',{'X-Robots-Tag':'noindex'});
      return send(200,'text/html; charset=utf-8',html,cache);
    }catch{return send(503,'text/html; charset=utf-8','<!doctype html><html lang="ar" dir="rtl"><title>CHICKY</title><h1>بنحدّث المنيو، جرّب كمان شوية.</h1></html>',{'Retry-After':'60','Cache-Control':'no-store','X-Robots-Tag':'noindex'});}
  };
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  http.createServer(createHandler()).listen(Number(process.env.PORT)||3000,'0.0.0.0');
  startConversionWorker({
    supabaseUrl:process.env.VITE_SUPABASE_URL,
    publicKey:process.env.VITE_SUPABASE_ANON_KEY,
    serviceKey:process.env.CHICKY_ANALYTICS_WORKER_TOKEN,
    measurementId:process.env.VITE_GA4_MEASUREMENT_ID,
    apiSecret:process.env.GA4_API_SECRET,
  });
}
