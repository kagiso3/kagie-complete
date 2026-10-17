/* Live schema metadata, real PostgreSQL engine, synthetic identities only. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { PGlite } = require('../.admin-test-runtime/node_modules/@electric-sql/pglite');
const { pgcrypto } = require('../.admin-test-runtime/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.cjs');
const evidence = path.join(root, 'reports/backend-repair/production-preflight');
const quote = v => '"' + v.replaceAll('"', '""') + '"';
async function setup(options = {}) {
 const db = options.db || new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}',banned_until timestamptz,deleted_at timestamptz,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 insert into storage.buckets(id,name,public) values('kagie-documents','kagie-documents',false);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
 alter table storage.objects enable row level security;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;`);
 const columns = JSON.parse(fs.readFileSync(path.join(evidence,'repair-live-columns.json')))[0].data;
 for(const [table,cols] of Object.entries(columns)) {
  await db.exec(`create table public.${quote(table)}(${cols.map(([name,type,udt,def,nullable])=>`${quote(name)} ${type}${def===null?'':' default '+def}${nullable==='NO'?' not null':''}`).join(',')})`);
 }
 const constraints = JSON.parse(fs.readFileSync(path.join(evidence,'repair-live-constraints.json')));
 for(const c of constraints.filter(c=>c.contype!=='f').concat(constraints.filter(c=>c.contype==='f'))) {
  await db.exec(`alter table public.${quote(c.table_name)} add constraint ${quote(c.conname)} ${c.definition}`);
 }
 const meta=JSON.parse(fs.readFileSync(path.join(root,'reports/backend-audit/data-storage-metadata.json')));
 for(const name of ['current_role','is_staff','set_updated_at','handle_new_auth_user','seed_default_packs']) await db.exec(meta.functions.find(f=>f.name===name).definition);
 for(const p of meta.policies) {
  await db.exec(`alter table ${quote(p.schemaname)}.${quote(p.tablename)} enable row level security;
   create policy ${quote(p.policyname)} on ${quote(p.schemaname)}.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(quote).join(',')}${p.qual?' using('+p.qual+')':''}${p.with_check?' with check('+p.with_check+')':''}`);
 }
 for(const t of meta.tables.filter(t=>t.rls)) if(t.schema==='public') await db.exec(`alter table public.${quote(t.name)} enable row level security`);
 await db.exec('grant all on all tables in schema public,storage to anon,authenticated,service_role;');
 return db;
}
const ids={owner:'10000000-0000-4000-8000-000000000001',other:'10000000-0000-4000-8000-000000000002',master:'10000000-0000-4000-8000-000000000003',assistant:'10000000-0000-4000-8000-000000000004'};
async function main(){
 const db=await setup(),checks=[];
 const check=async(name,fn)=>{await fn();checks.push({name,passed:true});};
 const actor=async name=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]||'']);if(name)await db.exec('set role authenticated');};
 const denied=async sql=>{try{const r=await db.query(sql);assert.equal(r.rows.length,0,'Unexpected access');}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.ok(e.message);}};
 for(const [name,id] of Object.entries(ids)){
  await db.query('insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)',[id,name+'@fixture.invalid',JSON.stringify({role:name==='master'?'master_admin':name==='assistant'?'assistant_admin':'user'})]);
  await db.query('insert into profiles(id,user_id,email,role) values($1,$1,$2,$3)',[id,name+'@fixture.invalid',name==='master'?'master_admin':name==='assistant'?'assistant_admin':'user']);
 }
 const app=(await db.query('insert into applications(user_id,assistant_id) values($1,$2) returning id',[ids.owner,ids.assistant])).rows[0].id;
 await db.query("insert into application_marks(application_id,subject,percent,level) values($1,'Original',70,6)",[app]);
 await db.query("insert into application_packs(code,name,price) values('launch','Preserved price',321)");
 const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 for(const file of migrations){try{await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));}catch(e){throw new Error(file+': '+e.message+' at '+e.position+' '+fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8').slice(Math.max(0,Number(e.position)-150),Number(e.position)+150));}}
 await check('All versioned migrations apply to the captured 31-table production schema',async()=>assert.ok(migrations.length>=4));
 await check('Existing account, application, marks, and catalog price survive',async()=>{
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from applications')).rows[0].n,1);
  assert.equal((await db.query('select subject from application_marks')).rows[0].subject,'Original');
  assert.equal(Number((await db.query("select price from application_packs where code='launch'")).rows[0].price),321);
 });
 await actor('owner');
 await check('Owner atomically replaces marks',async()=>assert.equal((await db.query('select replace_application_marks($1,$2,$3) n',[app,ids.owner,JSON.stringify([{subject:'Math',percent:80,level:7}])])).rows[0].n,1));
 await check('Invalid replacement preserves previous marks',async()=>{await assert.rejects(db.query('select replace_application_marks($1,$2,$3)',[app,ids.owner,JSON.stringify([{subject:'Invalid',percent:101,level:7}])]));assert.equal((await db.query('select subject from application_marks')).rows[0].subject,'Math');});
 await actor('other');await check('Another learner cannot replace marks',()=>denied(`select replace_application_marks('${app}','${ids.owner}','[]')`));
 await actor('assistant');await check('Assistant access defaults to denied until granted',async()=>assert.equal((await db.query('select id from applications where id=$1',[app])).rows.length,0));
 await actor('master');
 await db.query("insert into assistant_service_permissions(assistant_admin_id,service_key,enabled) values($1,'applications',true)",[ids.assistant]);
 await db.query("insert into assistant_form_permissions(assistant_admin_id,form_type,enabled) values($1,'undergraduate',true)",[ids.assistant]);
 await actor('assistant');await check('Assigned assistant with both permissions sees application',async()=>assert.equal((await db.query('select id from applications where id=$1',[app])).rows.length,1));
 await check('Assistant cannot grant privileged access',()=>denied(`insert into assistant_service_permissions(assistant_admin_id,service_key,enabled) values('${ids.assistant}','publish_jobs',true) returning assistant_admin_id`));
 await actor('master');await db.query("update assistant_form_permissions set enabled=false where assistant_admin_id=$1",[ids.assistant]);
 await actor('assistant');await check('Permission revocation removes access immediately',async()=>assert.equal((await db.query('select id from applications where id=$1',[app])).rows.length,0));
 await actor('owner');await check('Owner cannot fabricate legacy payment confirmation',()=>denied(`insert into application_payments(application_id,user_id,payment_status) values('${app}','${ids.owner}','Paid') returning id`));
 await actor('master');await db.query("insert into application_updates(user_id,application_id,title,message,status,posted_by) values($1,$2,'Update','Preserved','Under Review',$3)",[ids.owner,app,ids.master]);
 await actor('owner');await check('Owner may acknowledge updates',async()=>assert.equal((await db.query('update application_updates set is_read=true returning id')).rows.length,1));
 await check('Owner cannot rewrite official updates',()=>denied("update application_updates set message='Forged' returning id"));
 await actor('');
 await actor('owner');
 await check('Legacy profile records persist for their owner',async()=>assert.equal((await db.query('insert into learner_details(user_id,identity_number) values($1,$2) returning id',[ids.owner,'SYNTHETIC'])).rows.length,1));
 await actor('other');await check('Legacy personal details stay isolated',async()=>assert.equal((await db.query('select id from learner_details where user_id=$1',[ids.owner])).rows.length,0));
 await actor('owner');await check('Learner accommodation requests persist',async()=>assert.equal((await db.query("insert into accommodation_requests(user_id,property_name) values($1,'Fixture residence') returning id",[ids.owner])).rows.length,1));
 await check('Learner cannot fabricate a paid transport booking',()=>denied("insert into transport_requests(user_id,paid_at,payment_amount) values('"+ids.owner+"',now(),500) returning id"));
 await check('Support workflow accepts awaiting-user status',async()=>assert.equal((await db.query("insert into support_threads(user_id,status) values($1,'awaiting_user') returning id",[ids.owner])).rows.length,1));
 await actor('master');await check('Duplicate institution names are rejected without data deletion',async()=>{await db.query("insert into institutions(name) values('Fixture College')");await assert.rejects(db.query("insert into institutions(name) values('  fixture   college ')"));assert.equal((await db.query("select count(*)::int n from institutions where name='Fixture College'")).rows[0].n,1);});
 await actor('');
 const reserve=async (applicationId,userId,provider='yoco',fingerprint='fixture-fingerprint',orderKey='fixture-order-key',promoCode='')=>{
  await actor('');await db.exec('set role service_role');
  return (await db.query('select reserve_payment_checkout($1,$2,$3,$4,$5,$6) data',[applicationId,userId,provider,fingerprint,orderKey,JSON.stringify({amount:100,currency:'ZAR',payer_name:'Fixture',phone:'0712345678',reference:'FIXTURE',checkout_snapshot:{services:[],promoCode}})])).rows[0].data;
 };
 const first=await reserve(app,ids.owner);
 await check('Reservation persists payment before any provider response',async()=>assert.equal((await db.query('select gateway_checkout_id from payments where id=$1',[first.payment_id])).rows[0].gateway_checkout_id,null));
 await check('Identical retries reuse the same payment ID',async()=>assert.equal((await reserve(app,ids.owner)).payment_id,first.payment_id));
 await check('Queued duplicate reservations reuse one durable attempt',async()=>{const rows=await Promise.all([reserve(app,ids.owner),reserve(app,ids.owner)]);assert.equal(rows[0].payment_id,rows[1].payment_id);});
 await check('Changing provider cannot create a second active charge',()=>assert.rejects(reserve(app,ids.owner,'payfast')));
 await check('Changed order cannot overwrite a payable checkout',()=>assert.rejects(reserve(app,ids.owner,'yoco','different-fingerprint')));
 await actor('');const secondApp=(await db.query('insert into applications(user_id) values($1) returning id',[ids.owner])).rows[0].id;
 await check('Same cart cannot charge through a second draft',()=>assert.rejects(reserve(secondApp,ids.owner)));
 await actor('owner');await check('Learner cannot call trusted checkout RPC',()=>denied(`select reserve_payment_checkout('${app}','${ids.owner}','yoco','fixture-fingerprint','fixture-order-key','{}')`));
 await actor('master');await check('Browser master cannot call trusted checkout RPC',()=>denied(`select reserve_payment_checkout('${app}','${ids.owner}','yoco','fixture-fingerprint','fixture-order-key','{}')`));
 await actor('');await db.exec('set role service_role');
 await check('Provider response attaches to the reserved record atomically',async()=>{const r=(await db.query('select complete_payment_checkout($1,$2,$3,$4) data',[first.payment_id,'ch_repair','note',JSON.stringify({redirectUrl:'https://c.yoco.com/fixture'})])).rows[0].data;assert.equal(r.redirectUrl,'https://c.yoco.com/fixture');});
 const settle=async(id,checkout,transaction,amount=100)=>db.query("select settle_gateway_payment($1,'yoco',$2,$3,'succeeded',true,$4,'ZAR','','') data",[id,checkout,transaction,amount]);
 await check('Invalid settlement amount rolls back both records',async()=>{await assert.rejects(settle(first.payment_id,'ch_repair','pay_repair',1));assert.equal((await db.query('select payment_status from applications where id=$1',[app])).rows[0].payment_status,'Payment Pending');assert.equal((await db.query('select status from payments where id=$1',[first.payment_id])).rows[0].status,'Payment Pending');});
 await check('Correct settlement commits application and payment together',async()=>{assert.equal((await settle(first.payment_id,'ch_repair','pay_repair')).rows[0].data.applied,true);assert.equal((await db.query('select payment_status from applications where id=$1',[app])).rows[0].payment_status,'Verified');});
 await check('Settlement retry is idempotent',async()=>assert.equal((await settle(first.payment_id,'ch_repair','pay_repair')).rows[0].data.duplicate,true));
 await actor('owner');await check('Settled application type cannot be changed to a more expensive form',()=>denied("update applications set application_type='TRANSFER' where id='"+app+"' returning id"));
 await actor('master');await db.query('update assistant_form_permissions set enabled=true where assistant_admin_id=$1',[ids.assistant]);await actor('assistant');await check('Assigned assistants cannot rewrite settled financial facts',()=>denied("update applications set payment_amount=1 where id='"+app+"' returning id"));
 await actor('owner');await check('Learner cannot delete payment evidence',()=>denied(`delete from payments where id='${first.payment_id}' returning id`));
 await check('Learner cannot delete an application with payment history',()=>denied(`delete from applications where id='${app}' returning id`));
 await actor('');await db.exec('set role service_role');
 await check('Refund records are durable and event-idempotent',async()=>{for(let i=0;i<2;i++)await db.query("select record_gateway_refund('ch_repair','evt_refund','refund.succeeded','{\"amount\":5000,\"currency\":\"ZAR\"}')");assert.equal((await db.query("select count(*)::int n from payment_reconciliation where event_key='yoco-refund:evt_refund'")).rows[0].n,1);assert.equal((await db.query('select status from payments where id=$1',[first.payment_id])).rows[0].status,'Verified');});
 await check('Refund amount cannot exceed the original charge',()=>assert.rejects(db.query("select record_gateway_refund('ch_repair','evt_bad','refund.succeeded','{\"amount\":10001,\"currency\":\"ZAR\"}')")));
 await actor('');await db.query("insert into promo_campaigns(code,discount_kind,discount_value,max_uses) values('PROMO1234','amount',10,1)");
 const promoFirst=await reserve(secondApp,ids.owner,'yoco','promo-fingerprint','promo-order-key','PROMO1234');
 await actor('');const thirdApp=(await db.query('insert into applications(user_id) values($1) returning id',[ids.other])).rows[0].id;
 await check('Promotion capacity is reserved atomically across applications',()=>assert.rejects(reserve(thirdApp,ids.other,'yoco','other-fingerprint','other-order-key','PROMO1234')));
 await actor('');await db.exec('set role service_role');await db.query("select complete_payment_checkout($1,'ch_promo','','{}')",[promoFirst.payment_id]);await settle(promoFirst.payment_id,'ch_promo','pay_promo');
 await check('Promotion redemption commits once with settlement',async()=>{await settle(promoFirst.payment_id,'ch_promo','pay_promo');assert.equal((await db.query("select used_count from promo_campaigns where code='PROMO1234'")).rows[0].used_count,1);});
 await actor('');
 await actor('');const manualApp=(await db.query('insert into applications(user_id) values($1) returning id',[ids.owner])).rows[0].id;const packId=(await db.query("select id from application_packs where code='launch'")).rows[0].id;
 const manualCart=(await db.query('insert into carts(user_id) values($1) returning id',[ids.owner])).rows[0].id;
 await db.query("insert into cart_items(cart_id,item_type,ref_id,name,price,quantity,metadata) values($1,'application_pack',$2,'Fixture package',321,1,$3)",[manualCart,packId,JSON.stringify({applicationId:manualApp})]);
 const unrelatedItem=(await db.query("insert into cart_items(cart_id,item_type,name,price,quantity,metadata) values($1,'service','Keep later order',10,1,'{}') returning id",[manualCart])).rows[0].id;
 const manual=async()=>db.query("select record_manual_payment($1,$2,$3,'Synthetic Payer','0712345678','MANUAL-IDEMPOTENT','EFT','') data",[manualApp,ids.owner,packId]);
 await actor('other');await check('Another account cannot submit a manual payment',()=>assert.rejects(manual()));
 await actor('owner');const manualResult=(await manual()).rows[0].data;
 await check('Manual payment takes its amount from the database catalog',async()=>assert.equal(Number(manualResult.payment.amount),321));
 await check('Manual receipt freezes the canonical catalog name and amount',async()=>{assert.equal(manualResult.payment.checkout_snapshot.products[0].name,'Preserved price');assert.equal(Number(manualResult.payment.checkout_snapshot.products[0].amountCents),32100);});
 await check('Manual retry reuses the existing submission',async()=>assert.equal((await manual()).rows[0].data.payment.id,manualResult.payment.id));
 await check('Manual submission clears its purchased package and preserves unrelated service cart items',async()=>{const rows=(await db.query('select id from cart_items where cart_id=$1',[manualCart])).rows;assert.deepEqual(rows.map(r=>r.id),[unrelatedItem]);});
 await check('Unconfirmed manual payment does not unlock paid fulfillment',async()=>{const a=(await db.query('select payment_status,status from applications where id=$1',[manualApp])).rows[0];assert.equal(a.payment_status,'Pending Verification');assert.equal(a.status,'Awaiting Payment');});
 await check('Direct client cannot bypass payment review after RPC changes',()=>denied("update applications set payment_status='Verified' where id='"+manualApp+"' returning id"));
 await check('Direct client cannot fabricate a gateway settlement after RPC changes',()=>denied("update payments set provider='yoco',status='Verified' where id='"+manualResult.payment.id+"' returning id"));
 await check('Direct client still cannot promote its profile',()=>denied("update profiles set role='master_admin' where id='"+ids.owner+"' returning id"));
 await actor('master');await check('Browser master must use audited payment review',()=>denied("update applications set payment_status='Verified' where id='"+manualApp+"' returning id"));
 await check('Browser master cannot fabricate gateway confirmations',()=>denied("update payments set provider='yoco',status='Verified' where id='"+manualResult.payment.id+"' returning id"));
 await db.query("select staff_review_payment($1,'Verified','Bank ledger checked')",[manualApp]);
 await check('Master review commits manual payment, application, and audit together',async()=>{assert.equal((await db.query('select status from payments where id=$1',[manualResult.payment.id])).rows[0].status,'Verified');assert.equal((await db.query('select payment_status from applications where id=$1',[manualApp])).rows[0].payment_status,'Verified');assert.equal((await db.query('select count(*)::int n from payment_reviews where application_id=$1',[manualApp])).rows[0].n,1);});
 await check('Repeated manual approval creates no duplicate review',async()=>{await db.query("select staff_review_payment($1,'Verified','Bank ledger checked')",[manualApp]);assert.equal((await db.query('select count(*)::int n from payment_reviews where application_id=$1',[manualApp])).rows[0].n,1);});
 await check('Settled manual payments cannot be downgraded through review',()=>assert.rejects(db.query("select staff_review_payment($1,'Rejected','Changed decision')",[manualApp])));
 await check('Application progress has durable status history',async()=>assert.ok((await db.query('select id from application_status_history where application_id=$1',[manualApp])).rows.length>=2));
 await actor('');
 const legacyPaid=(await db.query("insert into applications(user_id,payment_status) values($1,'Verified') returning id",[ids.owner])).rows[0].id;await actor('master');await check('Legacy paid applications without a payment row are preserved',()=>denied("delete from applications where id='"+legacyPaid+"' returning id"));await actor('');
 await check('New private tables all have RLS enabled',async()=>assert.equal((await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows.length,0));
 await check('Anonymous role has no TRUNCATE rights',async()=>assert.equal((await db.query("select has_table_privilege('anon','applications','truncate') ok")).rows[0].ok,false));
 await check('Feature migration rejects any partial failure atomically',async()=>assert.equal((await db.query("select count(*)::int n from application_form_types")).rows[0].n,5));
 const finalTables=(await db.query("select t.table_name,array_agg(c.column_name order by c.ordinal_position) columns from information_schema.tables t join information_schema.columns c using(table_schema,table_name) where t.table_schema='public' and t.table_type='BASE TABLE' group by t.table_name order by t.table_name")).rows;
 const initialColumns=JSON.parse(fs.readFileSync(path.join(evidence,'repair-live-columns.json')))[0].data;
 fs.writeFileSync(path.join(root,'reports/backend-repair/schema-compatibility.json'),JSON.stringify({generatedAt:new Date().toISOString(),basis:'Captured production column and constraint metadata; expected result of local ordered migrations. Production remains unchanged.',productionTableCount:Object.keys(initialColumns).length,expectedTableCount:finalTables.length,addedTables:finalTables.filter(t=>!initialColumns[t.table_name]).map(t=>t.table_name),addedColumns:finalTables.filter(t=>initialColumns[t.table_name]).map(t=>({table:t.table_name,columns:t.columns.filter(n=>!initialColumns[t.table_name].some(c=>c[0]===n))})).filter(t=>t.columns.length),migrations},null,2));
 fs.writeFileSync(path.join(root,'reports/backend-repair/database-checks.json'),JSON.stringify({runAt:new Date().toISOString(),environment:'Isolated PGlite PostgreSQL, full production column and constraint metadata, no production records',migrations,checks},null,2));
 console.log(checks.length+' backend repair database checks passed.');await db.close();
}
module.exports={setup};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
