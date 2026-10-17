// Configuration evidence only; never prints credential values or connection URLs.
const fs=require('node:fs');const path=require('node:path');const {readConfig,configStatus}=require('./backup-backend.cjs');
const root=path.resolve(__dirname,'..'),env=readConfig();
function jwtRole(value){try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url')).role||'unknown';}catch{return 'not-jwt';}}
function publicKey(value){return /^sb_publishable_/.test(value||'')||jwtRole(value||'')==='anon';}
function secretKey(value){return /^sb_secret_/.test(value||'')||jwtRole(value||'')==='service_role';}
let projectMatches=false;try{projectMatches=new URL(env.SUPABASE_URL).hostname==='ztfcxnowjtvonltevrqe.supabase.co';}catch{}
const privatePrefixes=['SERVICE_ROLE','SECRET','PASSWORD','PASSPHRASE','WEBHOOK_SECRET','AUTH_TOKEN'];
const unsafePublicNames=Object.keys(env).filter(name=>/^(NEXT_PUBLIC_|VITE_|EXPO_PUBLIC_|KAGIE_PUBLIC_)/.test(name)&&privatePrefixes.some(fragment=>name.includes(fragment)));
const report={generatedAt:new Date().toISOString(),scope:'Private local configuration files and current process only. Vercel production values were not inspected.',productionVerified:false,
 checks:{expectedSupabaseProject:projectMatches,publicSupabaseKeyAllowed:publicKey(env.SUPABASE_ANON_KEY),serverSupabaseKeyAllowed:secretKey(env.SUPABASE_SERVICE_ROLE_KEY),unsafePublicSecretVariableNames:unsafePublicNames,
 webOriginConfigured:!!env.WEB_APP_URL,yocoSecretPresent:!!env.YOCO_SECRET_KEY,yocoWebhookSecretPresent:!!env.YOCO_WEBHOOK_SECRET,yocoModeExplicit:['test','live'].includes(env.YOCO_MODE||env.YOCO_ENV),payfastMerchantConfigured:!!env.PAYFAST_MERCHANT_ID&&!!env.PAYFAST_MERCHANT_KEY,payfastPassphrasePresent:!!env.PAYFAST_PASSPHRASE},backup:{...configStatus(env),backupCreated:false}};
fs.mkdirSync(path.join(root,'reports/backend-repair'),{recursive:true});fs.writeFileSync(path.join(root,'reports/backend-repair/environment-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
