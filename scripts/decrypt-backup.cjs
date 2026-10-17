// Local recovery utility; decrypts only. It never connects to a database.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');const {readConfig}=require('./backup-backend.cjs');
async function main(){
 const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw Error('Usage: node scripts/decrypt-backup.cjs ENCRYPTED_FILE PRIVATE_OUTPUT_FILE');
 const input=path.resolve(inputArg),output=path.resolve(outputArg),root=path.resolve(__dirname,'../.backend-repair');
 if(!output.startsWith(root+path.sep))throw Error('Decrypted output must stay inside the ignored .backend-repair directory.');
 if(fs.existsSync(output))throw Error('Output exists; refusing to overwrite.');
 const key=readConfig().KAGIE_BACKUP_ENCRYPTION_KEY;if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('Configure the backup encryption key locally.');
 const stat=fs.statSync(input);if(stat.size<36)throw Error('Invalid encrypted backup');
 const fd=fs.openSync(input,'r'),head=Buffer.alloc(20),tag=Buffer.alloc(16);fs.readSync(fd,head,0,20,0);fs.readSync(fd,tag,0,16,stat.size-16);fs.closeSync(fd);
 if(head.subarray(0,8).toString()!=='KAGIEBK1')throw Error('Unsupported backup format');
 const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),head.subarray(8));decipher.setAuthTag(tag);
 const temp=output+'.partial';if(fs.existsSync(temp))throw Error('Partial recovery output exists; preserve and review it before retrying.');try{await pipeline(fs.createReadStream(input,{start:20,end:stat.size-17}),decipher,fs.createWriteStream(temp,{flags:'wx',mode:0o600}));fs.renameSync(temp,output);}catch(e){fs.rmSync(temp,{force:true});throw Error('Backup authentication failed; no usable decrypted output was created.');}
 console.log('Local backup file authenticated and decrypted. No database action was performed.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
