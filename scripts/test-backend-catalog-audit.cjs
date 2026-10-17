/* Actual Supabase SDK -> loopback REST fixture -> actual PostgreSQL.
 * No cloud clients, .env loading, live accounts, or production data. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(path.join(root, '.admin-test-runtime/node_modules/@electric-sql/pglite/dist/index.cjs'));
const db = new PGlite();
const checks=[]; const requests=[];
let origin, server, fault, requestQueue=Promise.resolve();
const ident = v => {assert.match(v,/^[a-z_]+$/i);return `"${v}"`;};
const today=new Date().toISOString().slice(0,10);
const dateAfter=n=>new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const servicePath=path.join(root,'kagie-api/dist/modules/applications/applications.service.js');
function freshService(){delete require.cache[servicePath];return require(servicePath);}
function parseFilter(field,expression,params){
  const dot=expression.indexOf('.');const op=expression.slice(0,dot);let value=expression.slice(dot+1);
  if(op==='is'&&value==='null')return `${ident(field)} is null`;
  if(op==='in'){
    assert.ok(value.startsWith('(')&&value.endsWith(')'));const values=value.slice(1,-1).split(',').map(v=>v.replace(/^"|"$/g,''));
    return `${ident(field)} in (${values.map(v=>{params.push(v);return '$'+params.length;}).join(',')})`;
  }
  const operators={eq:'=',neq:'<>',lte:'<=',gte:'>='};assert.ok(operators[op],`Unsupported fixture filter ${op}`);
  params.push(value);return `${ident(field)} ${operators[op]} $${params.length}`;
}
async function rest(req,res,body){
  const url=new URL(req.url,origin);const table=url.pathname.replace(/^\/rest\/v1\//,'');
  const record={method:req.method,table,query:url.search,body};requests.push(record);
  if(fault&&fault.method===req.method&&fault.table===table){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'fixture_failure',message:'fixture-private-secret: database refused write'}));return;}
  const params=[];const predicates=[];
  for(const [key,value] of url.searchParams){
    if(['select','order'].includes(key))continue;
    if(key==='or'){
      assert.ok(value.startsWith('(')&&value.endsWith(')'));
      const terms=value.slice(1,-1).match(/[^,]+\.in\.\([^)]*\)|[^,]+/g)||[];
      predicates.push('('+terms.map(term=>{const i=term.indexOf('.');return parseFilter(term.slice(0,i),term.slice(i+1),params);}).join(' or ')+')');
    }else predicates.push(parseFilter(key,value,params));
  }
  const where=predicates.length?' where '+predicates.join(' and '):'';
  const select=url.searchParams.get('select')||'*';
  const fields=select==='*'?'*':select.split(',').map(ident).join(',');
  let sql;const method=req.method;
  if(method==='POST'){
    const keys=Object.keys(body);params.length=0;
    sql=`insert into public.${ident(table)}(${keys.map(ident).join(',')}) values(${keys.map(k=>{params.push(typeof body[k]==='object'&&body[k]!==null?JSON.stringify(body[k]):body[k]);return '$'+params.length;}).join(',')}) returning ${fields}`;
  }else if(method==='PATCH'){
    const pairs=Object.entries(body).map(([key,value])=>{params.push(typeof value==='object'&&value!==null?JSON.stringify(value):value);return `${ident(key)}=$${params.length}`;});
    sql=`update public.${ident(table)} set ${pairs.join(',')}${where} returning ${fields}`;
  }else if(method==='DELETE')sql=`delete from public.${ident(table)}${where} returning ${fields}`;
  else{
    const order=url.searchParams.get('order');const orderSql=order?' order by '+order.split(',').map(term=>{const [key,dir]=term.split('.');assert.ok(['asc','desc'].includes(dir));return ident(key)+' '+dir;}).join(','):'';
    sql=`select ${fields} from public.${ident(table)}${where}${orderSql}`;
  }
  await db.exec('begin');
  try{
    await db.exec('set local role '+(req.headers.apikey==='fixture-anon'?'anon':'service_role'));
    const result=await db.query(sql,params);await db.exec('commit');
    const single=String(req.headers.accept).includes('vnd.pgrst.object');
    if(single&&result.rows.length!==1){res.writeHead(406,{'content-type':'application/json'});res.end(JSON.stringify({code:'PGRST116',details:`The result contains ${result.rows.length} rows`,message:'JSON object requested, multiple (or no) rows returned'}));return;}
    res.writeHead(method==='POST'?201:200,{'content-type':'application/json','content-range':`0-${Math.max(0,result.rows.length-1)}/${result.rows.length}`});
    res.end(method==='HEAD'?undefined:JSON.stringify(single?result.rows[0]:result.rows));
  }catch(error){await db.exec('rollback');res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({code:error.code,message:error.message}));}
}
async function check(name,fn){try{await fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,message:error.message});}}
async function rejectsStatus(fn,status){let error;try{await fn();}catch(e){error=e;}assert.ok(error,'Expected service error');assert.equal(error.status,status);assert.ok(!error.message.includes('fixture-private-secret'));}
async function main(){
  await db.waitReady;
  const metadata=JSON.parse(await fs.readFile(path.join(root,'reports/backend-audit/data-storage-metadata.json'),'utf8'));
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
    create schema kagie_private;grant usage on schema public,kagie_private to anon,authenticated,service_role;
    create function public.current_role() returns text language sql as $$select 'user'::text$$;
    create function kagie_private.account_active() returns boolean language sql as $$select false$$;`);
  for(const table of ['institutions','application_packs']){
    const columns=metadata.columns.filter(c=>c.table===table);
    await db.exec(`create table public.${ident(table)}(${columns.map(c=>`${ident(c.column)} ${c.type}${c.default==null?'':' default '+c.default}${c.nullable==='NO'?' not null':''}`).join(',')},primary key(id));grant all on public.${ident(table)} to service_role;`);
  }
  // The migration also manages papers; the exact paper RLS behavior is covered in
  // test-backend-data-audit.cjs. This table only satisfies that DDL dependency.
  await db.exec("create table public.question_papers(id uuid primary key,status text);");
  await db.exec(await fs.readFile(path.join(root,'supabase/migrations/20261015052736_backend_audit_catalog_access.sql'),'utf8'));
  server=http.createServer(async(req,res)=>{
    try{let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):undefined;requestQueue=requestQueue.then(()=>rest(req,res,body)).catch(error=>{res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({message:error.message}));});}
    catch(error){res.writeHead(500);res.end(JSON.stringify({message:error.message}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  Object.assign(process.env,{NODE_ENV:'production',SUPABASE_URL:origin,SUPABASE_ANON_KEY:'fixture-anon',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'});
  const actualFetch=global.fetch;global.fetch=(url,init)=>{assert.equal(new URL(url).origin,origin,'Supabase requests must remain on loopback');return actualFetch(url,init);};
  let service=freshService();
  const input={name:'Persistent Fixture University',province:'Gauteng',type:'University',year:String(new Date().getUTCFullYear()+1),shortName:'PFU',openingDate:dateAfter(-2),closingDate:dateAfter(40),faculties:[{name:'Science',courses:['Mathematics']}],manualStatus:''};
  let created;
  await check('empty shared catalog stays empty instead of repopulating static seeds',async()=>assert.deepEqual(await service.listInstitutions(),[]));
  await check('create persists actual live columns and extended metadata in PostgreSQL',async()=>{
    created=await service.addInstitutionCatalogEntry(input);assert.equal(created.name,input.name);assert.deepEqual(created.faculties,input.faculties);
    const row=(await db.query('select * from public.institutions where id=$1',[created.id])).rows[0];
    assert.equal(row.institution_type,'University');assert.equal(row.is_visible,true);assert.equal(row.application_status,'auto');assert.equal(row.catalog_metadata.year,input.year);assert.equal(row.catalog_metadata.shortName,'PFU');
  });
  await check('cold service reload reads durable faculty/year edits',async()=>{service=freshService();const rows=await service.listInstitutions();assert.equal(rows.length,1);assert.equal(rows[0].year,input.year);assert.deepEqual(rows[0].faculties,input.faculties);});
  await check('reference catalog uses durable institution data and available years',async()=>{const r=await service.getReferenceCatalog();assert.equal(r.institutions.length,1);assert.equal(r.institutions[0].id,created.id);assert.ok(r.institutionYears.includes(input.year));assert.equal(r.prospectus[0].institution,input.name);});
  await check('duplicate institution/year rejected without a second database row',async()=>{await rejectsStatus(()=>service.addInstitutionCatalogEntry({...input,name:input.name.toUpperCase()}),409);assert.equal((await db.query('select count(*)::integer as n from public.institutions')).rows[0].n,1);});
  await check('update persists visibility/status/faculties and retains unrelated metadata',async()=>{
    await db.query("update public.institutions set catalog_metadata=catalog_metadata||'{\"applicationFee\":25}' where id=$1",[created.id]);
    const changed=await service.updateInstitutionCatalogEntry(created.id,{manualStatus:'closed',isActive:false,faculties:[{name:'Commerce',courses:['Accounting']}]});assert.equal(changed.status,'closed');
    service=freshService();assert.equal((await service.listInstitutions()).length,0);const admin=await service.listInstitutions({includeInactive:true});assert.equal(admin[0].faculties[0].name,'Commerce');
    assert.equal((await db.query('select catalog_metadata from public.institutions where id=$1',[created.id])).rows[0].catalog_metadata.applicationFee,25);
  });
  await check('unrelated name edit preserves manual closure',async()=>{const r=await service.updateInstitutionCatalogEntry(created.id,{name:'Renamed Fixture University'});assert.equal(r.manualStatus,'closed');assert.equal(r.isActive,false);});
  await check('explicit auto status reopens a visible institution inside its dates',async()=>{const r=await service.updateInstitutionCatalogEntry(created.id,{manualStatus:'',isActive:true});assert.equal(r.status,'open');assert.equal(r.manualStatus,'');});
  await check('database-side edits appear without restarting or stale catalog cache',async()=>{await db.query("update public.institutions set name='Externally Changed Fixture' where id=$1",[created.id]);assert.equal((await service.listInstitutions())[0].name,'Externally Changed Fixture');});
  await check('legacy rows map institution_type/is_visible/application_status without new columns',async()=>{
    await db.query("insert into public.institutions(name,institution_type,province,is_visible,application_status,closing_date) values('Legacy Fixture','TVET','Limpopo',true,'open',$1)",[dateAfter(20)]);
    const row=(await service.listInstitutions({search:'legacy',type:'TVET'}))[0];assert.equal(row.type,'TVET');assert.equal(row.isActive,true);assert.deepEqual(row.faculties,[]);
  });
  await check('catalog filters read persisted year, province, status and faculties',async()=>{
    const rows=await service.listInstitutions({year:input.year,province:'Gauteng',status:'open',search:'Accounting'});assert.equal(rows.length,1);assert.equal(rows[0].id,created.id);
  });
  for(const [method,action] of [['POST',()=>service.addInstitutionCatalogEntry({...input,name:'Rejected Create'})],['PATCH',()=>service.updateInstitutionCatalogEntry(created.id,{name:'Rejected Update'})],['DELETE',()=>service.deleteInstitutionCatalogEntry(created.id)]]){
    await check(`${method} database failure is surfaced without local success`,async()=>{fault={method,table:'institutions'};try{await rejectsStatus(action,503);}finally{fault=null;}assert.equal((await db.query('select name from public.institutions where id=$1',[created.id])).rows[0].name,'Externally Changed Fixture');});
  }
  await check('catalog read failure is surfaced without seed fallback',async()=>{fault={method:'GET',table:'institutions'};try{await rejectsStatus(()=>service.listInstitutions(),503);}finally{fault=null;}});
  await check('delete persists across service reloads',async()=>{assert.deepEqual(await service.deleteInstitutionCatalogEntry(created.id),{success:true});service=freshService();assert.equal((await service.listInstitutions({includeInactive:true})).some(r=>r.id===created.id),false);});
  await check('missing delete/update return 404 rather than success',async()=>{await rejectsStatus(()=>service.deleteInstitutionCatalogEntry(created.id),404);await rejectsStatus(()=>service.updateInstitutionCatalogEntry(created.id,{name:'Missing'}),404);});
  const {getPublicStats}=require(path.join(root,'kagie-api/dist/modules/public/public.service.js'));
  await check('public statistics fail honestly while opportunities table is absent',async()=>{let error;try{await getPublicStats();}catch(e){error=e;}assert.ok(error);assert.equal(error.message,'Public stats data is unavailable.');});
  await db.exec("create table public.career_articles(id uuid default gen_random_uuid(),status text,content_type text);grant select on public.career_articles to anon;insert into public.career_articles(status,content_type) values('published','job'),('published','internship'),('draft','job'),('published','article');");
  await db.query("insert into public.institutions(name,is_visible,application_status,opening_date,closing_date) values('Hidden Stats',false,'open',$1,$2),('Closed Stats',true,'closed',$1,$2),('Expired Stats',true,'open',$1,$3),('Future Stats',true,'open',$4,$2),('Soon Stats',true,'closing_soon',$1,$5)",[dateAfter(-10),dateAfter(20),dateAfter(-1),dateAfter(2),dateAfter(4)]);
  await check('public stats count actual visible/open dates and published opportunity types',async()=>{const r=await getPublicStats();assert.equal(r.openInstitutions,2);assert.equal(r.publishedOpportunities,2);assert.ok(r.generatedAt);});
  await check('catalog status and public count agree on future/expired/hidden rows',async()=>{const rows=await service.listInstitutions();const open=rows.filter(r=>r.status!=='closed').length;assert.equal(open,(await getPublicStats()).openInstitutions);});
  await check('statistics use actual live schema fields with exact count requests',async()=>{const calls=requests.filter(r=>r.method==='HEAD'&&r.table==='institutions');assert.ok(calls.length);assert.ok(calls.every(r=>!r.query.includes('is_active')&&!r.query.includes('manual_status')));});
  const report={runtime:'Actual Supabase SDK over loopback HTTP to actual PostgreSQL/PGlite',liveDatabaseChanged:false,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
  await fs.writeFile(path.join(root,'reports/backend-audit/catalog-checks.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.close();});
