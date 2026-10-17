/* Read-only production backup. Never restores, migrates, or changes accounts. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync,spawn}=require('node:child_process');
const {pipeline}=require('node:stream/promises');
const {Readable}=require('node:stream');
const root=path.resolve(__dirname,'..');
function pgDumpPath(env){const portable=path.join(root,'.backend-repair/runtime/pgsql17/pgsql/bin/pg_dump.exe');return env.KAGIE_PG_DUMP||(fs.existsSync(portable)?portable:'pg_dump');}
function readConfig(){
 const env={};
 for(const name of ['kagie-api/.env','.env.local','.backend-repair/backup.env.local']){
  const file=path.join(root,name);if(!fs.existsSync(file))continue;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
   const m=line.match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;
   const value=m[2].replace(/^(['"])([\s\S]*)\1$/,'$2');if(value)env[m[1]]=value;
  }
 }
 return {...env,...process.env};
}
function configStatus(env){
 let valid=false,projectMatch=false;
 try{const u=new URL(env.KAGIE_BACKUP_DATABASE_URL);valid=['postgres:','postgresql:'].includes(u.protocol)&&!['localhost','127.0.0.1','YOUR_HOST'].includes(u.hostname)&&!!u.password&&!/^(YOUR_|\[?YOUR_|PASSWORD$|placeholder)/i.test(u.password)&&u.port!=='6543';}catch{}
 try{const db=new URL(env.KAGIE_BACKUP_DATABASE_URL),site=new URL(env.SUPABASE_URL),ref=site.hostname.match(/^([a-z]{20})\.supabase\.co$/)?.[1];projectMatch=!!ref&&site.protocol==='https:'&&(db.hostname===`db.${ref}.supabase.co`||db.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(db.username)===`postgres.${ref}`);}catch{}
 const pg=pgDumpPath(env);
 const version=spawnSync(pg,['--version'],{encoding:'utf8',windowsHide:true});
 let serviceKeyAllowed=/^sb_secret_/.test(env.SUPABASE_SERVICE_ROLE_KEY||'');try{serviceKeyAllowed ||= JSON.parse(Buffer.from(env.SUPABASE_SERVICE_ROLE_KEY.split('.')[1],'base64url')).role==='service_role';}catch{}
 return {databaseConnectionConfigured:valid,databaseProjectMatchesStorage:projectMatch,postgresClientAvailable:version.status===0,postgresClientCompatible:version.status===0&&Number(version.stdout.match(/(\d+)\./)?.[1])>=17,postgresClientVersion:version.status===0?version.stdout.trim():null,storageCredentialsConfigured:!!env.SUPABASE_URL&&serviceKeyAllowed,encryptionKeyConfigured:/^[a-f0-9]{64}$/i.test(env.KAGIE_BACKUP_ENCRYPTION_KEY||'')};
}
async function encryptStream(input,output,key){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 // Open exclusively before streaming; an existing recovery artifact is never overwritten.
 let fd;try{fd=fs.openSync(output,'wx',0o600);}catch(error){input.destroy();throw error;}
 try{fs.writeSync(fd,Buffer.concat([Buffer.from('KAGIEBK1'),iv]));
  await pipeline(input,cipher,fs.createWriteStream(output,{fd,autoClose:false}));
  fs.writeSync(fd,cipher.getAuthTag());fs.fsyncSync(fd);
 }catch(error){fs.closeSync(fd);fs.rmSync(output,{force:true});throw error;}
 fs.closeSync(fd);
}
async function encryptFile(input,output,key){return encryptStream(fs.createReadStream(input),output,key);}
async function main(){
 const env=readConfig(),status=configStatus(env);
 if(process.argv.includes('--check')){console.log(JSON.stringify({...status,backupCreated:false},null,2));return;}
 if(!Object.entries(status).filter(([k])=>k.endsWith('Configured')||k.endsWith('Available')||k.endsWith('Compatible')||k==='databaseProjectMatchesStorage').every(([,v])=>v===true))throw Error('Backup prerequisites are incomplete. Run --check. Configure the ignored .backend-repair/backup.env.local file; never paste credentials into chat.');
 const u=new URL(env.KAGIE_BACKUP_DATABASE_URL),key=Buffer.from(env.KAGIE_BACKUP_ENCRYPTION_KEY,'hex');
 const backupRoot=path.join(root,'.backend-repair/backups');fs.mkdirSync(backupRoot,{recursive:true,mode:0o700});
 const dir=fs.mkdtempSync(path.join(backupRoot,new Date().toISOString().replace(/[:.]/g,'-')+'-'));
 const pgEnv={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:'verify-full',PGCONNECT_TIMEOUT:'20'};
 const dump=path.join(dir,'database.dump.enc');
 const child=spawn(pgDumpPath(env),['--format=custom','--no-owner','--compress=6'],{env:pgEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const completion=new Promise(resolve=>{child.on('error',()=>resolve(-1));child.on('close',resolve);});child.stderr.resume();
 try{await encryptStream(child.stdout,dump,key);if(await completion!==0)throw Error('dump failed');}
 catch{child.kill();await completion;fs.rmSync(dump,{force:true});throw Error('Database dump failed. No successful backup is recorded. Check connection, TLS certificate, client version, and database permissions locally.');}
 const {createClient}=require('@supabase/supabase-js');const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const buckets=await client.storage.listBuckets();if(buckets.error)throw Error('Storage bucket inventory failed; backup remains incomplete.');
 const manifest={format:'KAGIEBK1/AES-256-GCM/12-byte-IV/16-byte-tag',startedAt:path.basename(dir),completedAt:null,database:'database.dump.enc',storage:[],buckets:buckets.data,restoreVerified:false,consistency:'Database snapshot and Storage copy are not one atomic snapshot. Schedule a write freeze and compare object versions before approval.'};
 async function copyPrefix(bucket,prefix=''){
  for(let offset=0;;offset+=100){const result=await client.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});if(result.error)throw Error('Storage inventory failed; backup incomplete.');
   for(const object of result.data){const name=prefix?prefix+'/'+object.name:object.name;if(!object.id){await copyPrefix(bucket,name);continue;}
    const downloaded=await client.storage.from(bucket).download(name);if(downloaded.error)throw Error('Storage download failed; backup incomplete.');
    const bytes=Buffer.from(await downloaded.data.arrayBuffer());const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const safe=crypto.createHash('sha256').update(bucket+'/'+name).digest('hex')+'.enc';
    const encrypted=Buffer.concat([Buffer.from('KAGIEBK1'),iv,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);fs.writeFileSync(path.join(dir,safe),encrypted,{mode:0o600,flag:'wx'});
    manifest.storage.push({bucket,name,file:safe,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),metadata:object});
   }if(result.data.length<100)break;
  }
 }
 for(const bucket of buckets.data)await copyPrefix(bucket.id);
 manifest.completedAt=new Date().toISOString();
 await encryptStream(Readable.from([Buffer.from(JSON.stringify(manifest,null,2))]),path.join(dir,'manifest.json.enc'),key);
 const hashes=fs.readdirSync(dir).filter(f=>f.endsWith('.enc')).map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex')}));
 fs.writeFileSync(path.join(dir,'checksums.json'),JSON.stringify(hashes,null,2));
 fs.writeFileSync(path.join(root,'reports/backend-repair/backup-status.json'),JSON.stringify({backupCreated:true,completedAt:manifest.completedAt,encrypted:true,objectCount:manifest.storage.length,restoreVerified:false,location:'Ignored private backup directory; keep a second offline copy and escrow the key separately'},null,2));
 console.log('Encrypted database and Storage backup completed. Restore rehearsal is still required.');
}
module.exports={readConfig,configStatus,encryptFile,encryptStream,pgDumpPath};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
