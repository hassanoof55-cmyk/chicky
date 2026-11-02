const KEY='chicky.analytics-receipts.v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Receipt={token:string;created:number};
function read(storage:Storage):Receipt[]{try{const v=JSON.parse(storage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(r=>uuid.test(r?.token)&&Number.isFinite(r.created)&&Date.now()-r.created<72*60*60*1000).slice(-100):[];}catch{return [];}}
export function rememberAnalyticsReceipt(token:string,storage:Storage=localStorage){
 if(!uuid.test(token))return;
 try{const rows=read(storage);if(!rows.some(r=>r.token===token))rows.push({token,created:Date.now()});storage.setItem(KEY,JSON.stringify(rows.slice(-100)));}catch{}
}
export async function revokeAnalyticsReceipts(client:any,storage:Storage=localStorage){
 const receipts=read(storage);const succeeded=new Set<string>();
 await Promise.all(receipts.map(async r=>{try{const {error}=await client.rpc('revoke_chicky_analytics',{p_token:r.token});if(!error)succeeded.add(r.token);}catch{}}));
 // Re-read so concurrent order submissions do not lose their revocation receipts.
 try{storage.setItem(KEY,JSON.stringify(read(storage).filter(r=>!succeeded.has(r.token))));}catch{}
}
