const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');const {encryptFile,configStatus,readConfig}=require('./backup-backend.cjs');
async function main(){
 const root=path.resolve(__dirname,'..'),dir=path.join(root,'.backend-repair/backup-test');await fs.mkdir(dir,{recursive:true});
 const key=crypto.randomBytes(32),env={...process.env,KAGIE_BACKUP_ENCRYPTION_KEY:key.toString('hex')};
 // readConfig deliberately prefers a local file over shell env. Test with the
 // real private key if one exists, without printing or changing its value.
 const configured=readConfig().KAGIE_BACKUP_ENCRYPTION_KEY;const actual=/^[a-f0-9]{64}$/i.test(configured||'')?Buffer.from(configured,'hex'):key;
 env.KAGIE_BACKUP_ENCRYPTION_KEY=actual.toString('hex');
 const input=path.join(dir,'source.txt'),encrypted=path.join(dir,'source.enc'),output=path.join(dir,'restored.txt');
 await fs.writeFile(input,'Synthetic backup integrity fixture only.');await fs.rm(encrypted,{force:true});await encryptFile(input,encrypted,actual);await fs.rm(output,{force:true});
 await assert.rejects(encryptFile(input,encrypted,actual),{code:'EEXIST'});
 let run=spawnSync(process.execPath,['scripts/decrypt-backup.cjs',encrypted,output],{cwd:root,env,encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);assert.equal(await fs.readFile(output,'utf8'),await fs.readFile(input,'utf8'));
 run=spawnSync(process.execPath,['scripts/decrypt-backup.cjs',encrypted,output],{cwd:root,env,encoding:'utf8',windowsHide:true});assert.notEqual(run.status,0,'Never overwrite existing recovery files');
 const damaged=await fs.readFile(encrypted);damaged[22]^=1;await fs.writeFile(encrypted,damaged);await fs.rm(output);
 run=spawnSync(process.execPath,['scripts/decrypt-backup.cjs',encrypted,output],{cwd:root,env,encoding:'utf8',windowsHide:true});assert.notEqual(run.status,0);await assert.rejects(fs.stat(output));await assert.rejects(fs.stat(output+'.partial'));
 run=spawnSync(process.execPath,['scripts/decrypt-backup.cjs',encrypted,path.join(root,'unsafe-restore.txt')],{cwd:root,env,encoding:'utf8',windowsHide:true});assert.notEqual(run.status,0);
 const status=configStatus({KAGIE_BACKUP_DATABASE_URL:'postgresql://user:YOUR_PASSWORD@localhost:6543/postgres',KAGIE_PG_DUMP:'nonexistent-fixture-client'});assert.equal(status.databaseConnectionConfigured,false);assert.equal(status.postgresClientAvailable,false);assert.ok(!JSON.stringify(status).includes('YOUR_PASSWORD'));
 const ref='abcdefghijklmnopqrst',common={SUPABASE_URL:`https://${ref}.supabase.co`,KAGIE_PG_DUMP:'nonexistent-fixture-client'};
 assert.equal(configStatus({...common,KAGIE_BACKUP_DATABASE_URL:`postgresql://postgres:synthetic@db.${ref}.supabase.co/postgres`}).databaseProjectMatchesStorage,true);
 assert.equal(configStatus({...common,KAGIE_BACKUP_DATABASE_URL:'postgresql://postgres:synthetic@db.ztfcxnowjtvonltevrqe.supabase.co/postgres'}).databaseProjectMatchesStorage,false);
 await fs.writeFile(path.join(root,'reports/backend-repair/backup-checks.json'),JSON.stringify({runAt:new Date().toISOString(),environment:'Synthetic local encryption/decryption only. No production backup or restore.',checks:['Matching database and Storage project accepted','Mismatched database and Storage project rejected','Existing ciphertext preserved','Authenticated encryption round-trip','Existing output preserved','Tamper detected','Failed plaintext removed','Private output directory enforced','Placeholder and transaction-pooler rejected','Missing PostgreSQL client detected','Status omits connection secrets'].map(name=>({name,passed:true}))},null,2));
 console.log('11 backup recovery utility checks passed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
