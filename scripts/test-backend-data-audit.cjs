/* Actual PostgreSQL RLS/trigger fixtures; every record is synthetic and local. */
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(path.join(root, '.admin-test-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
const reportDir = path.join(root, 'reports/backend-audit');
const ids = {
  owner: '11111111-1111-4111-8111-111111111111', other: '22222222-2222-4222-8222-222222222222',
  assistant: '33333333-3333-4333-8333-333333333333', outsider: '44444444-4444-4444-8444-444444444444',
  master: '55555555-5555-4555-8555-555555555555', disabled: '66666666-6666-4666-8666-666666666666',
  app: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', otherApp: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  doc: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', cart: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  thread: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
};
const lit = (v) => `'${String(v).replaceAll("'", "''")}'`;
const ident = (v) => `"${String(v).replaceAll('"', '""')}"`;
const checks = [];
let db;
async function actor(id, sql, userMetadata = {}) {
  const auth=(await db.query('select raw_app_meta_data from auth.users where id=$1',[id])).rows[0];
  await db.exec('begin; set local role authenticated;');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [id, JSON.stringify({ sub: id, app_metadata:auth.raw_app_meta_data,user_metadata: userMetadata })]);
    const result = await db.query(sql);
    await db.exec('rollback');
    return { result, error: null };
  } catch (error) {
    await db.exec('rollback');
    return { result: null, error };
  }
}
async function check(name, fn) {
  try { await fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, message: error.message }); }
}
async function allowed(name, id, sql) {
  await check(name, async () => { const r = await actor(id, sql); assert.equal(r.error, null, r.error?.message); assert.ok(r.result.rows.length, 'expected an accessible/changed row'); });
}
async function denied(name, id, sql) {
  await check(name, async () => { const r = await actor(id, sql); assert.ok(r.error || !r.result.rows.length, 'unexpected accessible/changed row'); });
}
async function setup(metadata) {
  db = new PGlite(); await db.waitReady;
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',banned_until timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,public,storage to anon,authenticated,service_role;
    grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;`);
  const tables = [...new Set(metadata.columns.map((c) => c.table))];
  for (const table of tables) {
    const columns = metadata.columns.filter((c) => c.table === table);
    await db.exec(`create table public.${ident(table)} (${columns.map((c) => `${ident(c.column)} ${c.type}${c.default == null ? '' : ` default ${c.default}`}${c.nullable === 'NO' ? ' not null' : ''}`).join(',')});`);
    if (columns.some((c) => c.column === 'id')) await db.exec(`alter table public.${ident(table)} add primary key(id)`);
  }
  await db.exec(`create table public.user_profiles(user_id uuid primary key);
    create table public.guardian_profiles(user_id uuid primary key);
    create table public.school_profiles(user_id uuid primary key);
    create table public.carts(id uuid primary key default gen_random_uuid(),user_id uuid unique not null,total_amount numeric default 0);
    create table public.callback_requests(id uuid primary key default gen_random_uuid(),user_id uuid,assigned_assistant_id uuid);
    create table public.application_marks(id uuid primary key default gen_random_uuid(),application_id uuid);
    create table public.application_institutions(id uuid primary key default gen_random_uuid(),application_id uuid);
    create table public.document_reviews(id uuid primary key default gen_random_uuid(),document_id uuid,assistant_id uuid);
    create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,is_read boolean default false);
    create table public.assistant_activity(id uuid primary key default gen_random_uuid(),assistant_id uuid);
    create table storage.buckets(id text primary key,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    insert into storage.buckets(id,public) values('kagie-documents',false);
    insert into storage.buckets(id,public,file_size_limit,allowed_mime_types) values('unrelated-control',true,1048576,array['image/png']);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
    grant all on all tables in schema public,storage to anon,authenticated,service_role;`);
  for (const name of ['current_role','is_staff','handle_new_auth_user']) await db.exec(metadata.functions.find((f) => f.name === name).definition);
  for(const table of metadata.tables.filter(t=>t.rls)) {
    const exists=await db.query('select to_regclass($1) as table_name',[`${table.schema}.${table.name}`]);
    if(exists.rows[0].table_name) await db.exec(`alter table ${ident(table.schema)}.${ident(table.name)} enable row level security`);
  }
  for (const p of metadata.policies) {
    const exists = await db.query('select to_regclass($1) as table_name', [`${p.schemaname}.${p.tablename}`]);
    if (!exists.rows[0].table_name) continue;
    await db.exec(`alter table ${ident(p.schemaname)}.${ident(p.tablename)} enable row level security;
      create policy ${ident(p.policyname)} on ${ident(p.schemaname)}.${ident(p.tablename)} as ${p.permissive} for ${p.cmd}
      to ${p.roles.map(ident).join(',')}${p.qual ? ` using(${p.qual})` : ''}${p.with_check ? ` with check(${p.with_check})` : ''};`);
  }
  for (const [name, id] of Object.entries(ids).filter(([name]) => ['owner','other','assistant','outsider','master','disabled'].includes(name))) {
    const role = name === 'master' ? 'master_admin' : ['assistant','outsider'].includes(name) ? 'assistant_admin' : 'user';
    await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)', [id, `${name}@example.invalid`, JSON.stringify(role==='user'?{provider:'google'}:{role,provider:'email'})]);
    await db.query('insert into public.profiles(id,user_id,email,role) values($1,$1,$2,$3)', [id, `${name}@example.invalid`, role]);
  }
  await db.exec(`insert into public.applications(id,user_id,assistant_id,status) values
    ('${ids.app}','${ids.owner}','${ids.assistant}','Draft'),('${ids.otherApp}','${ids.other}',null,'Draft');
    insert into public.carts(id,user_id) values('${ids.cart}','${ids.owner}');
    insert into public.cart_items(cart_id,item_type,name,price) values('${ids.cart}','application_pack','Fixture pack',100);
    insert into public.documents(id,user_id,application_id,document_type,file_name,file_url)
      values('${ids.doc}','${ids.owner}','${ids.app}','certified_id','fixture.pdf','${ids.owner}/fixture.pdf');
    insert into public.support_threads(id,user_id,assistant_id) values('${ids.thread}','${ids.owner}','${ids.assistant}');
    insert into public.application_notes(application_id,author_id,author_role,note) values
      ('${ids.app}','${ids.assistant}','assistant_admin','Internal fixture note'),
      ('${ids.app}','${ids.owner}','user','__KAGIE_LEARNER_SUPPORT__{}'),
      ('${ids.app}','${ids.assistant}','assistant_admin','__KAGIE_PORTAL_ACCESS__{"entries":[]}');
    insert into storage.objects(bucket_id,name,owner_id) values('kagie-documents','${ids.owner}/fixture.pdf','${ids.owner}');`);
}
async function main() {
  const metadata = JSON.parse(await fs.readFile(path.join(reportDir, 'data-storage-metadata.json'), 'utf8'));
  await setup(metadata);
  await check('baseline: editable user_metadata.role escalates current_role', async () => {
    const r=await actor(ids.owner,'select public.current_role() as role',{role:'master_admin'}); assert.equal(r.result.rows[0].role,'master_admin');
  });
  await allowed('baseline: learner can change own profile role',ids.owner,`update public.profiles set role='master_admin' where id='${ids.owner}' returning id`);
  await allowed('baseline: unrelated learner can read another learner storage object',ids.other,'select id from storage.objects');
  await allowed('baseline: unrelated learner can overwrite another learner storage object',ids.other,"update storage.objects set owner_id='tampered' returning id");
  await allowed('baseline: learner can mark own payment Verified',ids.owner,`update public.applications set payment_status='Verified' where id='${ids.app}' returning id`);
  await allowed('baseline: learner can read ordinary staff notes',ids.owner,"select id from public.application_notes where note='Internal fixture note'");
  await db.exec(await fs.readFile(path.join(root,'supabase/migrations/20261015052453_backend_audit_hardening.sql'),'utf8'));
  await check('private document bucket enforces 8 MB and standard document MIME types',async()=>{
    const row=(await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='kagie-documents'")).rows[0];
    assert.equal(row.public,false);assert.equal(Number(row.file_size_limit),8388608);
    for(const mime of ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'])assert.ok(row.allowed_mime_types.includes(mime));
    assert.ok(!row.allowed_mime_types.includes('*/*'));assert.ok(row.allowed_mime_types.includes('application/octet-stream'));assert.ok(row.allowed_mime_types.includes('application/json'));
  });
  await check('bucket limits preserve existing objects and document records',async()=>{
    assert.equal((await db.query('select count(*)::integer as n from storage.objects')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::integer as n from public.documents')).rows[0].n,1);
  });
  await check('document bucket limits do not alter unrelated buckets',async()=>{
    const row=(await db.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='unrelated-control'")).rows[0];
    assert.equal(row.public,true);assert.equal(Number(row.file_size_limit),1048576);assert.deepEqual(row.allowed_mime_types,['image/png']);
  });
  await db.exec(`update public.profiles set is_active=false where id='${ids.disabled}';
    insert into public.support_messages(thread_id,sender_id,sender_role,message,is_internal) values
      ('${ids.thread}','${ids.assistant}','assistant_admin','Internal message fixture',true);`);
  await check('trusted role ignores editable user metadata', async () => {
    const r=await actor(ids.owner,'select public.current_role() as role',{role:'master_admin'}); assert.equal(r.result.rows[0].role,'user');
  });
  await check('trusted role retains actual assistant role', async () => {
    const r=await actor(ids.assistant,'select public.current_role() as role'); assert.equal(r.result.rows[0].role,'assistant_admin');
  });
  await denied('learner cannot change profile role',ids.owner,`update public.profiles set role='master_admin' where id='${ids.owner}' returning id`);
  await denied('learner cannot disable or rebind profile',ids.owner,`update public.profiles set is_active=false,user_id='${ids.other}' where id='${ids.owner}' returning id`);
  await allowed('learner can update own contact details',ids.owner,`update public.profiles set full_name='Fixture Learner' where id='${ids.owner}' returning id`);
  await check('legacy null user_id may backfill only to profile owner',async()=>{
    await db.query(`update public.profiles set user_id=null where id='${ids.owner}'`);
    try {
      const r=await actor(ids.owner,`update public.profiles set user_id=id where id='${ids.owner}' returning id`);assert.equal(r.error,null,r.error?.message);assert.equal(r.result.rows.length,1);
    } finally {await db.query(`update public.profiles set user_id=id where id='${ids.owner}'`);}
  });
  await allowed('master can change account access',ids.master,`update public.profiles set is_active=false where id='${ids.owner}' returning id`);
  await allowed('owner can read own document',ids.owner,`select id from public.documents where id='${ids.doc}'`);
  await denied('another learner cannot read document',ids.other,`select id from public.documents where id='${ids.doc}'`);
  await allowed('assigned assistant can read learner document',ids.assistant,`select id from public.documents where id='${ids.doc}'`);
  await denied('unassigned assistant cannot read learner document',ids.outsider,`select id from public.documents where id='${ids.doc}'`);
  await allowed('master can read learner document',ids.master,`select id from public.documents where id='${ids.doc}'`);
  await allowed('owner can read private object',ids.owner,'select id from storage.objects');
  await denied('unrelated learner cannot read private object',ids.other,'select id from storage.objects');
  await allowed('assigned assistant can read referenced private object',ids.assistant,'select id from storage.objects');
  await denied('unassigned assistant cannot read private object',ids.outsider,'select id from storage.objects');
  await denied('unrelated learner cannot overwrite private object',ids.other,"update storage.objects set owner_id='tampered' returning id");
  await allowed('owner can upload private object',ids.owner,`insert into storage.objects(bucket_id,name) values('kagie-documents','${ids.owner}/new.pdf') returning id`);
  await denied('learner cannot upload into another owner folder',ids.other,`insert into storage.objects(bucket_id,name) values('kagie-documents','${ids.owner}/new.pdf') returning id`);
  await allowed('owner can clean up failed upload',ids.owner,'delete from storage.objects returning id');
  await denied('unrelated learner cannot delete object',ids.other,'delete from storage.objects returning id');
  await denied('learner cannot approve own document',ids.owner,`update public.documents set status='Approved' where id='${ids.doc}' returning id`);
  await allowed('assigned assistant can review document',ids.assistant,`update public.documents set status='Approved' where id='${ids.doc}' returning id`);
  await denied('document cannot link another learner application',ids.owner,`insert into public.documents(user_id,application_id,document_type,file_name,file_url) values('${ids.owner}','${ids.otherApp}','general','fixture.pdf','${ids.owner}/new.pdf') returning id`);
  await denied('learner cannot set payment Verified',ids.owner,`update public.applications set payment_status='Verified' where id='${ids.app}' returning id`);
  await denied('learner cannot assign their application',ids.owner,`update public.applications set assistant_id='${ids.outsider}' where id='${ids.app}' returning id`);
  await denied('assistant cannot self-assign unrelated application',ids.outsider,`update public.applications set assistant_id='${ids.outsider}' where id='${ids.otherApp}' returning id`);
  await allowed('master can assign applications',ids.master,`update public.applications set assistant_id='${ids.outsider}' where id='${ids.otherApp}' returning id`);
  await allowed('learner can INSERT RETURNING a new own draft',ids.owner,`insert into public.applications(user_id) values('${ids.owner}') returning id`);
  await allowed('master can INSERT RETURNING a new learner draft',ids.master,`insert into public.applications(user_id) values('${ids.owner}') returning id`);
  await allowed('owner can submit manual proof for verification',ids.owner,`update public.applications set payment_status='Pending Verification',payment_method='EFT' where id='${ids.app}' returning id`);
  await denied('owner cannot insert Verified payment',ids.owner,`insert into public.payments(application_id,payer_name,phone,reference,method,status) values('${ids.app}','Fixture','000','fixture','EFT','Verified') returning id`);
  await denied('owner cannot create gateway payment',ids.owner,`insert into public.payments(application_id,payer_name,phone,reference,method,status) values('${ids.app}','Fixture','000','fixture','Yoco','Payment Pending') returning id`);
  await allowed('owner can insert pending EFT payment',ids.owner,`insert into public.payments(application_id,payer_name,phone,reference,method,status) values('${ids.app}','Fixture','000','fixture','EFT','Pending Verification') returning id`);
  await denied('owner cannot invent gateway status',ids.owner,`update public.applications set payment_method='Yoco',payment_note='{"gatewayStatus":"paid"}' where id='${ids.app}' returning id`);
  await denied('owner cannot read ordinary staff notes',ids.owner,"select id from public.application_notes where note='Internal fixture note'");
  await allowed('owner can read learner support details',ids.owner,"select id from public.application_notes where note like '__KAGIE_LEARNER_SUPPORT__%'");
  await allowed('owner can read shared institution login details',ids.owner,"select id from public.application_notes where note like '__KAGIE_PORTAL_ACCESS__%'");
  await denied('owner cannot rewrite staff portal credentials',ids.owner,`insert into public.application_notes(application_id,author_id,author_role,note) values('${ids.app}','${ids.owner}','user','__KAGIE_PORTAL_ACCESS__{}') returning id`);
  await denied('owner cannot read internal support message',ids.owner,'select id from public.support_messages');
  await allowed('assigned assistant can read internal support message',ids.assistant,'select id from public.support_messages');
  await denied('owner cannot spoof support sender',ids.owner,`insert into public.support_messages(thread_id,sender_id,sender_role,message) values('${ids.thread}','${ids.assistant}','assistant_admin','Spoof fixture') returning id`);
  await allowed('owner can send own support message',ids.owner,`insert into public.support_messages(thread_id,sender_id,sender_role,message) values('${ids.thread}','${ids.owner}','user','Fixture message') returning id`);
  await denied('owner cannot delete staff support messages',ids.owner,'delete from public.support_messages returning id');
  await denied('owner cannot change support thread assistant',ids.owner,`update public.support_threads set assistant_id='${ids.outsider}' where id='${ids.thread}' returning id`);
  await denied('assistant cannot move support thread between learners',ids.assistant,`update public.support_threads set user_id='${ids.other}' where id='${ids.thread}' returning id`);
  await denied('disabled account cannot upload',ids.disabled,`insert into storage.objects(bucket_id,name) values('kagie-documents','${ids.disabled}/new.pdf') returning id`);
  await check('fresh Auth ban blocks existing learner JWT data access',async()=>{
    await db.query(`update auth.users set banned_until=now()+interval '1 day' where id='${ids.owner}'`);
    try {const r=await actor(ids.owner,'select id from public.documents');assert.equal(r.error,null);assert.equal(r.result.rows.length,0);}
    finally {await db.query(`update auth.users set banned_until=null where id='${ids.owner}'`);}
  });
  await check('fresh Auth ban removes trusted staff role until expiry',async()=>{
    await db.query(`update auth.users set banned_until=now()+interval '1 day' where id='${ids.assistant}'`);
    try {const r=await actor(ids.assistant,'select public.current_role() as role');assert.equal(r.result.rows[0].role,'user');}
    finally {await db.query(`update auth.users set banned_until=null where id='${ids.assistant}'`);}
  });
  await check('Google signup bootstraps user despite forged metadata',async()=>{
    await db.exec('begin');
    try {
      await db.exec(`create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();
        insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('77777777-7777-4777-8777-777777777777','google@example.invalid','{"provider":"google"}','{"role":"master_admin","name":"Fixture Google"}');`);
      const row=await db.query("select p.role,p.full_name,(select count(*)::integer from public.carts where user_id=p.id) as carts from public.profiles p where p.id='77777777-7777-4777-8777-777777777777'");
      assert.equal(row.rows[0].role,'user'); assert.equal(row.rows[0].full_name,'Fixture Google'); assert.equal(row.rows[0].carts,1);
    } finally { await db.exec('rollback'); }
  });
  await check('legacy truncate grants revoked',async()=>{
    const row=await db.query("select has_table_privilege('authenticated','public.profiles','TRUNCATE') as allowed"); assert.equal(row.rows[0].allowed,false);
  });
  await db.exec(await fs.readFile(path.join(root,'supabase/migrations/20261015052507_backend_audit_payment_settlement.sql'),'utf8'));
  const paymentId='99999999-9999-4999-8999-999999999999';
  const trustedService={id:'88888888-8888-4888-8888-888888888888',type:'service',serviceCode:'cv_revamp',serviceName:'CV Revamp',price:100,quantity:1};
  await db.query(`insert into public.payments(id,application_id,user_id,payer_name,phone,reference,method,amount,status,provider,gateway_checkout_id,currency,checkout_snapshot)
    values($1,$2,$3,'Fixture payer','000','fixture','yoco',100,'Payment Pending','yoco','fixture-checkout','ZAR',$4)`,
    [paymentId,ids.app,ids.owner,JSON.stringify({services:[trustedService]})]);
  await db.query("update public.applications set status='Under Review',application_payload=$1 where id=$2",[JSON.stringify({forms:{learner:{name:'Fixture'}},services:[{id:'forged-unpaid-service',serviceCode:'fake',price:9999}]}),ids.app]);
  const rpc=`select public.settle_gateway_payment('${paymentId}','yoco','fixture-checkout','fixture-payment','succeeded',true,100,'ZAR','Fixture gateway note','') as outcome`;
  const service=async(fn)=>{
    await db.exec('begin; set local role service_role;');
    try { await db.query("select set_config('request.jwt.claim.sub','',true)");return await fn(); }
    finally { await db.exec('rollback'); }
  };
  await denied('learner cannot invoke settlement RPC',ids.owner,rpc);
  await check('RPC grants only service role',async()=>{
    const r=await db.query("select has_function_privilege('anon','public.settle_gateway_payment(uuid,text,text,text,text,boolean,numeric,text,text,text)','EXECUTE') as anon,has_function_privilege('authenticated','public.settle_gateway_payment(uuid,text,text,text,text,boolean,numeric,text,text,text)','EXECUTE') as learner,has_function_privilege('service_role','public.settle_gateway_payment(uuid,text,text,text,text,boolean,numeric,text,text,text)','EXECUTE') as service");
    assert.deepEqual(r.rows[0],{anon:false,learner:false,service:true});
  });
  await check('settlement atomically verifies payment/application and durably records trusted services',async()=>service(async()=>{
    const outcome=(await db.query(rpc)).rows[0].outcome;assert.equal(outcome.applied,true);
    const a=(await db.query(`select payment_status,status,application_payload from public.applications where id='${ids.app}'`)).rows[0];
    const p=(await db.query(`select status,paid_at from public.payments where id='${paymentId}'`)).rows[0];
    assert.equal(a.payment_status,'Verified');assert.equal(a.status,'Under Review');assert.equal(p.status,'Verified');assert.ok(p.paid_at);
    assert.deepEqual(a.application_payload.services,[trustedService]);assert.equal(a.application_payload.forms.learner.name,'Fixture');
  }));
  await check('duplicate success is idempotent and preserves staff fulfillment',async()=>service(async()=>{
    await db.query(rpc);await db.query(`update public.applications set application_payload=jsonb_set(application_payload,'{services,0,status}','"Working"') where id='${ids.app}'`);
    const outcome=(await db.query(rpc)).rows[0].outcome;assert.equal(outcome.duplicate,true);assert.equal(outcome.applied,false);
    const a=(await db.query(`select application_payload from public.applications where id='${ids.app}'`)).rows[0];assert.equal(a.application_payload.services[0].status,'Working');assert.equal(a.application_payload.services.length,1);
  }));
  await check('failure after success cannot downgrade either record',async()=>service(async()=>{
    await db.query(rpc);const outcome=(await db.query(rpc.replace("'succeeded',true","'failed',false"))).rows[0].outcome;assert.equal(outcome.duplicate,true);
    const a=(await db.query(`select payment_status from public.applications where id='${ids.app}'`)).rows[0];assert.equal(a.payment_status,'Verified');
    const p=(await db.query(`select status from public.payments where id='${paymentId}'`)).rows[0];assert.equal(p.status,'Verified');
  }));
  await check('failed gateway payment can retry successfully with new provider payment id',async()=>service(async()=>{
    await db.query(rpc.replace("'fixture-payment','succeeded',true","'failed-payment-1','failed',false"));
    const outcome=(await db.query(rpc.replace("'fixture-payment'","'successful-payment-2'"))).rows[0].outcome;assert.equal(outcome.status,'Verified');
    const p=(await db.query(`select gateway_payment_id from public.payments where id='${paymentId}'`)).rows[0];assert.equal(p.gateway_payment_id,'successful-payment-2');
  }));
  await check('verified payment ignores late failure from another provider attempt',async()=>service(async()=>{
    await db.query(rpc);const outcome=(await db.query(rpc.replace("'fixture-payment','succeeded',true","'late-failure-id','failed',false"))).rows[0].outcome;assert.equal(outcome.duplicate,true);
    const p=(await db.query(`select status,gateway_payment_id from public.payments where id='${paymentId}'`)).rows[0];assert.equal(p.status,'Verified');assert.equal(p.gateway_payment_id,'fixture-payment');
  }));
  await check('verified payment rejects a second successful provider payment id',async()=>{
    await service(async()=>{await db.query(rpc);let error;try{await db.query(rpc.replace("'fixture-payment'","'other-success-id'"));}catch(e){error=e;}assert.match(error?.message||'',/identifier mismatch/);});
  });
  await check('verified payment repairs pending application using pinned services',async()=>service(async()=>{
    await db.query(`update public.payments set status='Verified',paid_at=now() where id='${paymentId}'`);
    const outcome=(await db.query(rpc)).rows[0].outcome;assert.equal(outcome.applied,true);
    const a=(await db.query(`select payment_status,application_payload from public.applications where id='${ids.app}'`)).rows[0];
    assert.equal(a.payment_status,'Verified');assert.deepEqual(a.application_payload.services,[trustedService]);
  }));
  await check('different payment for paid application preserves existing fulfillment',async()=>service(async()=>{
    await db.query(`update public.applications set payment_status='Verified',application_payload='{"services":[{"id":"existing-paid-service","status":"Working"}]}' where id='${ids.app}'`);
    const outcome=(await db.query(rpc)).rows[0].outcome;assert.equal(outcome.application_already_paid,true);
    const duplicate=(await db.query(rpc)).rows[0].outcome;assert.equal(duplicate.application_already_paid,true);assert.equal(duplicate.duplicate,true);
    const a=(await db.query(`select application_payload from public.applications where id='${ids.app}'`)).rows[0];
    assert.deepEqual(a.application_payload.services,[{id:'existing-paid-service',status:'Working'}]);
    const p=(await db.query(`select status from public.payments where id='${paymentId}'`)).rows[0];assert.equal(p.status,'Verified');
  }));
  for(const [label,sql] of [
    ['amount mismatch',rpc.replace(",100,'ZAR'",",99,'ZAR'")],['currency mismatch',rpc.replace("100,'ZAR'","100,'USD'")],
    ['checkout mismatch',rpc.replace("'fixture-checkout'","'wrong-checkout'")],['provider mismatch',rpc.replace("'yoco'","'payfast'")]
  ]) await check(`settlement rejects ${label}`,async()=>{
    let error;try{await service(()=>db.query(sql));}catch(e){error=e;}assert.ok(error);assert.match(error.message,/does not match/);
  });
  await check('failed application write rolls back payment settlement too',async()=>{
    await db.exec(`create function public.audit_fail_settlement() returns trigger language plpgsql as $$begin raise exception 'Synthetic application write failure'; end$$;
      create trigger audit_fail_settlement before update on public.applications for each row execute function public.audit_fail_settlement();`);
    try {
      let error;try{await service(()=>db.query(rpc));}catch(e){error=e;}assert.match(error?.message||'',/Synthetic application write failure/);
      const p=(await db.query(`select status from public.payments where id='${paymentId}'`)).rows[0];assert.equal(p.status,'Payment Pending');
    } finally {await db.exec('drop trigger audit_fail_settlement on public.applications; drop function public.audit_fail_settlement();');}
  });
  await denied('learner cannot forge paid service payload',ids.owner,`update public.applications set application_payload='{"services":[{"id":"fake"}]}' where id='${ids.app}' returning id`);
  await db.exec(await fs.readFile(path.join(root,'supabase/migrations/20261015052736_backend_audit_catalog_access.sql'),'utf8'));
  await db.exec(`insert into public.institutions(id,name,is_visible) values('abcdefab-cdef-4abc-8def-abcdefabcdef','Visible Fixture',true),('abcdefab-cdef-4abc-8def-abcdefabcdee','Hidden Fixture',false);
    insert into public.question_papers(id,title,status) values('12341234-1234-4234-8234-123412341234','Published Fixture','Published'),('12341234-1234-4234-8234-123412341235','Draft Fixture','draft');`);
  await allowed('learner can read visible catalog entry',ids.owner,"select id from public.institutions where name='Visible Fixture'");
  await denied('learner cannot read hidden catalog entry',ids.owner,"select id from public.institutions where name='Hidden Fixture'");
  await allowed('master can read hidden catalog entry',ids.master,"select id from public.institutions where name='Hidden Fixture'");
  await denied('learner cannot change catalog visibility',ids.owner,"update public.institutions set is_visible=false where name='Visible Fixture' returning id");
  await allowed('master can change catalog visibility',ids.master,"update public.institutions set is_visible=false where name='Visible Fixture' returning id");
  await allowed('learner can read published question paper',ids.owner,"select id from public.question_papers where title='Published Fixture'");
  await denied('learner cannot read draft question paper',ids.owner,"select id from public.question_papers where title='Draft Fixture'");
  await allowed('master can edit draft question paper',ids.master,"update public.question_papers set title='Draft Changed' where title='Draft Fixture' returning id");
  await check('anonymous reader sees only visible and published catalog rows',async()=>{
    await db.exec('begin;set local role anon');
    try {
      const institutions=await db.query('select name from public.institutions');const papers=await db.query('select title from public.question_papers');
      assert.deepEqual(institutions.rows,[{name:'Visible Fixture'}]);assert.deepEqual(papers.rows,[{title:'Published Fixture'}]);
    }finally {await db.exec('rollback');}
  });
  const report={runtime:'PGlite PostgreSQL, synthetic records only',liveDatabaseChanged:false,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};
  await fs.writeFile(path.join(reportDir,'data-storage-checks.json'),JSON.stringify(report,null,2)+'\n');
  await db.close();
  console.log(JSON.stringify(report,null,2));
  if(report.failed) process.exitCode=1;
}
main().catch(async(error)=>{console.error(error);if(db)await db.close();process.exitCode=1;});
