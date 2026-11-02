const KEY='chicky.analytics-receipts.v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Receipt={token:string;created:number};
function read(storage:Storage):Receipt[]{try{const v=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(r=>uuid.test(r?.token)&&Number.isFinite(r.created)&&Date.now()-r.created<72*60*60*1000).slice(-100):[];}catch{return [];}}
export function rememberAnalyticsReceipt(token:string,storage:Storage=localStorage){
 if(!uuid.test(token))return;
 try{const rows=read(storage);if(!rows.some(r=>r.token===token))rows.push({token,created:Date.now()});storage.setItem(KEY,JSON.stringify(rows.slice(-100)));}catch{}
}
export async function revokeAnalyticsReceipts(client:any,storage:Storage=localStorage){
 const receipts=read(storage);
 await Promise.all(receipts.map(async r=>{try{await client.rpc('revoke_chicky_analytics',{p_token:r.token});}catch{}}));
 // An unknown token succeeds too: its order may still be in flight in another
 // tab. Retain bounded receipts until 72h expiry and repeat on settlement.
 try{storage.setItem(KEY,JSON.stringify(read(storage)));}catch{}
}
