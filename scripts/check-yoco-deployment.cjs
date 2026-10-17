// Read-only GET probes. Never creates a checkout, webhook or production record.
const fs=require('node:fs'),path=require('node:path');
const {readConfig}=require('./backup-backend.cjs');
async function main(){
 const env=readConfig();let origin;try{origin=new URL(env.WEB_APP_URL).origin;}catch{throw new Error('WEB_APP_URL is not configured');}
 if(!origin.startsWith('https://'))throw new Error('An HTTPS web origin is required');
 const report={checkedAt:new Date().toISOString(),scope:'Unauthenticated GET only against WEB_APP_URL from local configuration. Vercel ownership/environment and runtime logs are not authenticated or verified.',origin,results:[]};
 for(const route of ['/api/runtime-config','/js/backend.js','/js/checkout-page.js','/v1/payments/yoco/checkout','/v1/payments/yoco/webhook','/v1/payments/yoco/status']){
  try{const res=await fetch(origin+route,{redirect:'error',signal:AbortSignal.timeout(12000)});const raw=await res.text();const row={route,method:'GET',status:res.status,contentType:res.headers.get('content-type')};
   if(route==='/api/runtime-config'){let p;try{p=JSON.parse(raw).data;}catch{}row.yocoEnabled=p?.payments?.yocoEnabled??null;row.supabaseProjectMatches=String(p?.supabase?.url||'').includes('ztfcxnowjtvonltevrqe.supabase.co');}
   if(route==='/js/backend.js')row.explicitlyDisabledClient=raw.includes('Online card checkout is disabled');
   if(route==='/js/checkout-page.js')row.callsYoco=raw.includes('startYocoCheckoutAsync');
   report.results.push(row);
  }catch{report.results.push({route,method:'GET',reachable:false});}
 }
 const output=path.join(__dirname,'../reports/yoco-repair/deployment-readonly.json');fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
