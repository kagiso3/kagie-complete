/* Disposable PostgreSQL 17, synthetic data, no network except localhost. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),net=require('node:net');
const {spawnSync,spawn}=require('node:child_process');
const {Readable}=require('node:stream');
const {setup}=require('./test-backend-repair-database.cjs');
const {encryptStream}=require('./backup-backend.cjs');
const {Client}=require('../.backend-repair/runtime-node/node_modules/pg');
const root=path.resolve(__dirname,'..'),bin=path.join(root,'.backend-repair/runtime/pgsql17/pgsql/bin');
async function main(){
 const checks=[],clients=[];const check=async(name,fn)=>{await fn();checks.push({name,passed:true});console.log('PASS '+name);};
 const base=path.join(root,'.backend-repair/postgres-tests');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'run-'));
 const data=path.join(dir,'cluster'),pw=crypto.randomBytes(24).toString('hex'),pwfile=path.join(dir,'password');fs.writeFileSync(pwfile,pw,{mode:0o600,flag:'wx'});
 const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const n=server.address().port;server.close(()=>resolve(n));});});
 function command(name,args,extra={}){const result=spawnSync(path.join(bin,name+'.exe'),args,{windowsHide:true,encoding:'utf8',...(name==='pg_ctl'?{stdio:'ignore'}:{}),...extra});if(result.status!==0)throw Error(name+' failed: '+(result.stderr||result.error?.message||result.stdout||'see the private PostgreSQL log'));return result;}
 let started=false;
 const connect=async database=>{const c=new Client({host:'127.0.0.1',port,user:'postgres',password:pw,database,connectionTimeoutMillis:10000});await c.connect();clients.push(c);return c;};
 try{
  command('initdb',['-D',data,'-U','postgres','--pwfile',pwfile,'--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C']);fs.unlinkSync(pwfile);
  command('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  const db=await connect('postgres');await db.query('create extension pgcrypto');
  await setup({db:{exec:sql=>db.query(sql),query:(...args)=>db.query(...args)}});
  const owner='70000000-0000-4000-8000-000000000001',other='70000000-0000-4000-8000-000000000002';
  for(const [id,name]of[[owner,'owner'],[other,'other']]){await db.query('insert into auth.users(id,email) values($1,$2)',[id,name+'@synthetic.invalid']);await db.query("insert into profiles(id,user_id,email,role) values($1,$1,$2,'user')",[id,name+'@synthetic.invalid']);}
  const app=(await db.query('insert into applications(user_id) values($1) returning id',[owner])).rows[0].id;
  const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>n.endsWith('.sql')).sort();
  await check('All migrations apply on PostgreSQL 17 without deleting existing identities or applications',async()=>{for(const name of migrations)await db.query(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,2);assert.equal((await db.query('select user_id from applications where id=$1',[app])).rows[0].user_id,owner);});
  await check('Pending migration SQL is repeatable on PostgreSQL 17',async()=>{for(const name of migrations.filter(n=>n.startsWith('20261015')))await db.query(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));});
  const a=await connect('postgres'),b=await connect('postgres');await a.query('set role service_role');await b.query('set role service_role');
  const payment=JSON.stringify({amount:10,currency:'ZAR',reference:'ATTACKER-CHOSEN',checkout_snapshot:{gatewayMode:'test',containsApplicationPack:false,products:[{name:'Forgot PIN',quantity:1,amountCents:1000}],services:[]}});
  const reserve=c=>c.query("select reserve_yoco_checkout($1,$2,'yoco','concurrent-fingerprint','concurrent-order',$3) result",[app,owner,payment]);
  let attempt;
  await check('Two independent connections reserve exactly one checkout and one server reference',async()=>{const r=await Promise.all([reserve(a),reserve(b)]);attempt=r[0].rows[0].result;assert.equal(attempt.payment_id,r[1].rows[0].result.payment_id);assert.match(attempt.reference,/^KAG-YOCO-[A-F0-9]{32}$/);assert.notEqual(attempt.reference,'ATTACKER-CHOSEN');assert.equal((await db.query('select count(*)::int n from payments')).rows[0].n,1);});
  await check('Provider and order races cannot create a second active charge',async()=>{const r=await Promise.allSettled([a.query("select reserve_payment_checkout($1,$2,'payfast','different','concurrent-order',$3)",[app,owner,payment]),b.query("select reserve_yoco_checkout($1,$2,'yoco','different','other-order',$3)",[app,owner,payment])]);assert.ok(r.every(x=>x.status==='rejected'));assert.equal((await db.query('select count(*)::int n from payments')).rows[0].n,1);});
  await a.query("select complete_payment_checkout($1,'ch_local','','{}')",[attempt.payment_id]);
  const settle=(c,event='evt_concurrent',success=true)=>c.query("select process_yoco_payment_event($1,$2,$3,$4,'ch_local','pay_local',$5,$6,1000,'ZAR','test','','') result",[event,'msg_'+event,crypto.createHash('sha256').update(event).digest('hex'),attempt.payment_id,success?'succeeded':'failed',success]);
  await check('Concurrent duplicate deliveries commit one settlement and one ledger event',async()=>{const r=await Promise.all([settle(a),settle(b)]);assert.equal(r.filter(x=>x.rows[0].result.applied).length,1);assert.equal((await db.query('select count(*)::int n from payment_webhook_events')).rows[0].n,1);assert.equal((await db.query('select status from payments where id=$1',[attempt.payment_id])).rows[0].status,'Verified');});
  await check('Late failure cannot reverse a verified payment on a second connection',async()=>{await settle(b,'evt_late_failure',false);assert.equal((await db.query('select status from payments where id=$1',[attempt.payment_id])).rows[0].status,'Verified');});
  await check('Pinned references cannot change even through the trusted checkout role',async()=>{await assert.rejects(a.query("update payments set reference='FORGED' where id=$1",[attempt.payment_id]));});
  await check('Separate authenticated connection cannot read another owner’s payment',async()=>{await b.query('reset role');await b.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await b.query('set role authenticated');assert.equal((await b.query('select id from payments where id=$1',[attempt.payment_id])).rows.length,0);await b.query('reset role');});
  // Model Storage metadata plus separately encrypted object bytes; no claim of a cloud Storage API rehearsal.
  await db.query("insert into storage.objects(bucket_id,name,owner_id) values('kagie-documents',$1,$2)",[owner+'/fixture.pdf',owner]);
  await db.query("insert into documents(user_id,application_id,document_type,file_name,file_url) values($1,$2,'ID','fixture.pdf',$3)",[owner,app,owner+'/fixture.pdf']);
  const object=Buffer.from('%PDF synthetic fixture bytes only'),key=crypto.randomBytes(32),env={...process.env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'postgres',PGPASSWORD:pw,PGDATABASE:'postgres',PGSSLMODE:'disable',KAGIE_BACKUP_ENCRYPTION_KEY:key.toString('hex')};
  await check('pg_dump output is encrypted directly, without a plaintext dump intermediate',async()=>{const child=spawn(path.join(bin,'pg_dump.exe'),['--format=custom','--no-owner','--compress=6'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stderr.resume();const closed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});await encryptStream(child.stdout,path.join(dir,'database.enc'),key);assert.equal(await closed,0);assert.ok(!fs.existsSync(path.join(dir,'database.dump.partial')));await encryptStream(Readable.from([object]),path.join(dir,'object.enc'),key);});
  await check('Authenticated decryption and pg_restore recover database and object fixture in isolation',async()=>{for(const file of ['database','object']){const r=spawnSync(process.execPath,['scripts/decrypt-backup.cjs',path.join(dir,file+'.enc'),path.join(dir,file+'.restored')],{cwd:root,env,windowsHide:true,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
   await db.query('create database restored_fixture');command('pg_restore',['--no-owner','--exit-on-error','--dbname','restored_fixture',path.join(dir,'database.restored')],{env});
   const restored=await connect('restored_fixture');for(const table of ['auth.users','public.profiles','public.applications','public.documents','public.payments','public.payment_webhook_events','storage.objects']){assert.deepEqual((await restored.query('select row_to_json(t) row from '+table+' t order by id')).rows,(await db.query('select row_to_json(t) row from '+table+' t order by id')).rows,table+' differs after restore');}
   assert.deepEqual(fs.readFileSync(path.join(dir,'object.restored')),object);assert.equal((await restored.query('select reference from payments where id=$1',[attempt.payment_id])).rows[0].reference,attempt.reference);
  });
  fs.writeFileSync(path.join(root,'reports/yoco-readiness/postgres-checks.json'),JSON.stringify({runAt:new Date().toISOString(),scope:'Disposable localhost PostgreSQL 17.11, independent connections and synthetic restore. Not Supabase cloud staging or a production backup.',migrations:migrations.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'supabase/migrations',file))).digest('hex')})),checks},null,2));
  console.log(checks.length+' independent PostgreSQL checks passed.');
 }finally{for(const c of clients)await c.end().catch(()=>{});if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);fs.rmSync(pwfile,{force:true});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
