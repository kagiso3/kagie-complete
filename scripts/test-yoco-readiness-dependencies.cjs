const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),postcss=require('postcss');
async function main(){
 const dir=path.join(root,'.backend-repair/postcss-regression'),project=path.join(dir,'project');fs.mkdirSync(project,{recursive:true});
 const marker='SYNTHETIC_PRIVATE_MAP_CONTENT',map=path.join(dir,'private.map');fs.writeFileSync(map,JSON.stringify({version:3,sources:['private.txt'],sourcesContent:[marker],names:[],mappings:'AAAA'}));
 const checks=[];const check=async(name,fn)=>{await fn();checks.push({name,passed:true});};
 await check('Every locked PostCSS copy uses the reviewed 8.5.30 security patch',async()=>{const packages=require('../package-lock.json').packages;const copies=Object.entries(packages).filter(([name])=>name.endsWith('node_modules/postcss'));assert.ok(copies.length);assert.ok(copies.every(([,p])=>p.version==='8.5.30'));assert.equal(require('postcss/package.json').version,'8.5.30');});
 for(const [name,annotation,options]of [['Traversal source map cannot disclose a file outside the CSS directory','../private.map',{from:path.join(project,'input.css'),to:path.join(project,'output.css')}],['Absolute source map without a CSS origin cannot disclose local content',map.replaceAll('\\','/'),{to:path.join(project,'output.css')}]] )await check(name,async()=>{const result=await postcss().process('a{color:red}/*# sourceMappingURL='+annotation+' */',options);assert.ok(!String(result.map||'').includes(marker));assert.ok(!result.css.includes(marker));});
 await check('Normal CSS still parses and serializes',async()=>{const result=await postcss().process('a { color: red }',{from:undefined});assert.ok(result.css.includes('color: red'));});
 fs.writeFileSync(path.join(root,'reports/yoco-readiness/dependency-regression-checks.json'),JSON.stringify({runAt:new Date().toISOString(),scope:'Synthetic PostCSS local-file-disclosure regressions; no real secrets',checks},null,2));console.log(checks.length+' dependency security regression checks passed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
