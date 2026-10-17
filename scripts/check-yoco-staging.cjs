/* Read-only staging gate. Never falls back to production configuration. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),production='ztfcxnowjtvonltevrqe';
function readStaging(){const file=path.join(root,'.backend-repair/staging.env.local'),env={};if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^(['"])(.*)\1$/,'$2');}return env;}
function validate(env){
 const ref=env.STAGING_SUPABASE_PROJECT_REF||'';
 const errors=[];if(!/^[a-z]{20}$/.test(ref)||ref===production)errors.push('A separate staging project reference is required.');
 if(env.STAGING_SUPABASE_URL!==`https://${ref}.supabase.co`)errors.push('Staging URL must match the isolated project reference.');
 try{const u=new URL(env.STAGING_DATABASE_URL);const direct=u.hostname===`db.${ref}.supabase.co`&&decodeURIComponent(u.username)==='postgres';const session=u.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(u.username)===`postgres.${ref}`;
  if(!['postgres:','postgresql:'].includes(u.protocol)||(!direct&&!session)||u.port==='6543'||!u.password||env.STAGING_DATABASE_URL.includes(production))throw Error();
 }catch{errors.push('Use a matching staging direct/session PostgreSQL connection; production and transaction-pooler connections are rejected.');}
 if(!env.STAGING_SUPABASE_SERVICE_ROLE_KEY)errors.push('Staging server key is missing.');
 if(!env.STAGING_SUPABASE_ANON_KEY)errors.push('Staging browser key is missing.');
 if(env.STAGING_SUPABASE_SERVICE_ROLE_KEY){let allowed=/^sb_secret_/.test(env.STAGING_SUPABASE_SERVICE_ROLE_KEY);try{const claims=JSON.parse(Buffer.from(env.STAGING_SUPABASE_SERVICE_ROLE_KEY.split('.')[1],'base64url'));allowed=claims.role==='service_role'&&claims.ref===ref;}catch{}if(!allowed)errors.push('Staging server key has an invalid class or project.');}
 if(env.YOCO_MODE!=='test'||!/^sk_test_/.test(env.YOCO_SECRET_KEY||''))errors.push('Yoco TEST credentials and YOCO_MODE=test are required.');
 if(!/^whsec_/.test(env.YOCO_WEBHOOK_SECRET||''))errors.push('The staging webhook signing secret is missing.');
 try{const u=new URL(env.STAGING_WEB_APP_URL);if(u.protocol!=='https:'||['kagie.app','www.kagie.app','kagie.co.za','www.kagie.co.za','kagie-complete.vercel.app'].includes(u.hostname)||u.username||u.password)throw Error();}catch{errors.push('A separate HTTPS staging site is required.');}
 return errors;
}
async function main(){
 const env=readStaging(),errors=validate(env),result={checkedAt:new Date().toISOString(),scope:'Read-only isolated staging preflight',ready:false,errors};
 if(!errors.length){
  const {Client}=require('../.backend-repair/runtime-node/node_modules/pg');const client=new Client({connectionString:env.STAGING_DATABASE_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000});
  try{await client.connect();await client.query('begin read only');
   const actual=(await client.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public'")).rows;
   const expected=JSON.parse(fs.readFileSync(path.join(root,'reports/backend-repair/production-preflight/repair-live-columns.json')))[0].data;
   const missing=[];for(const [table,cols]of Object.entries(expected))for(const [name,type]of cols)if(!actual.some(c=>c.table_name===table&&c.column_name===name&&c.data_type===type))missing.push(table+'.'+name);
   result.baselineCompatible=missing.length===0;result.missingBaselineColumns=missing;
   if(missing.length)result.errors.push('Staging lacks the captured application baseline. Do not run upgrade migrations against an empty project. Restore/review a schema-only baseline first.');
   const exists=(await client.query("select to_regclass('supabase_migrations.schema_migrations') present")).rows[0].present;
   result.history=exists?(await client.query('select version,name from supabase_migrations.schema_migrations order by version')).rows:[];
   const known=new Set(fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).map(f=>f.split('_')[0]));
   if(result.history.some(m=>!known.has(m.version)))result.errors.push('Unexpected staging migration history requires drift review.');
   if(!result.history.some(m=>m.version==='20261007163521')||!result.history.some(m=>m.version==='20261007164004'))result.errors.push('Captured baseline migration history is not present. Review baseline provenance; do not fabricate history entries.');
   await client.query('rollback');result.ready=result.errors.length===0;
  }catch{result.errors.push('Staging connection or TLS verification failed. Inspect the private configuration locally.');}finally{await client.end().catch(()=>{});}
 }
 fs.writeFileSync(path.join(root,'reports/yoco-readiness/staging-preflight.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.ready)process.exitCode=2;
}
module.exports={validate,readStaging};if(require.main===module)main().catch(()=>{console.error('Staging check failed; no mutations performed.');process.exitCode=1;});
