// Existing automated scripts, captured individually; failures never disappear behind a later command.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'reports/yoco-readiness');
const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
async function main(){
 const final=process.argv.includes('--final'),manifestFile=final?'final-verification.json':'full-suite.json';
 fs.mkdirSync(out,{recursive:true});const manifest={startedAt:new Date().toISOString(),node:process.version,scope:'Local synthetic automated suites and builds. No production deployment or migrations.',results:[]};
 const rootScripts=Object.keys(require('../package.json').scripts).filter(s=>s.startsWith('test:'));
 const commands=final?[...['vercel-build','build:web','test:checkout','test:auth:google','test:backend:audit'].map(s=>['run',s]),['run','typecheck','--workspace','kagie-landing']]:[...['vercel-build','build:web'].map(s=>['run',s]),['run','typecheck','--workspace','kagie-mobile'],...rootScripts.map(s=>['run',s]),['run','test:oauth','--workspace','kagie-mobile'],['audit','--json']];
 for(const args of commands){
  const name=args.join(' '),file=(final?'final_':'')+name.replace(/[^a-z0-9-]/gi,'_')+'.log',log=fs.openSync(path.join(out,file),'w'),started=Date.now();
  console.log('START npm '+name);let timedOut=false;
  const child=spawn(process.execPath,[npm,...args],{cwd:root,env:process.env,windowsHide:true,stdio:['ignore',log,log]});
  const timer=setTimeout(()=>{timedOut=true;child.kill();},8*60*1000);
  const code=await new Promise(resolve=>{child.on('error',()=>resolve(-1));child.on('close',resolve);});clearTimeout(timer);fs.closeSync(log);
  manifest.results.push({command:'npm '+name,exitCode:code,timedOut,durationMs:Date.now()-started,log:file});manifest.updatedAt=new Date().toISOString();
  fs.writeFileSync(path.join(out,manifestFile),JSON.stringify(manifest,null,2));console.log((code===0?'PASS ':'FAIL ')+name+' ('+Math.round((Date.now()-started)/1000)+'s)');
 }
 manifest.completedAt=new Date().toISOString();fs.writeFileSync(path.join(out,manifestFile),JSON.stringify(manifest,null,2));
 console.log(JSON.stringify({passed:manifest.results.filter(r=>r.exitCode===0).length,failed:manifest.results.filter(r=>r.exitCode!==0).length}));
 if(manifest.results.some(r=>r.exitCode!==0))process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
