const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
async function main(){
 const root=path.resolve(__dirname,'..'),folder=path.join(root,'.backend-repair/dependency-tests');fs.mkdirSync(folder,{recursive:true});
 const XLSX=require('xlsx');const rows=[['School','Province','Code'],['Synthetic isiZulu School','KwaZulu-Natal','KZN-01'],['École fixture','Gauteng','GP-02']];
 const checks=[];for(const extension of ['xlsx','xls']){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'Schools');const file=path.join(folder,'fixture.'+extension);XLSX.writeFile(book,file);const read=XLSX.readFile(file);assert.deepEqual(XLSX.utils.sheet_to_json(read.Sheets.Schools,{header:1}),rows);checks.push({name:extension+' catalog input preserves Unicode and cell values',passed:true});}
 fs.writeFileSync(path.join(root,'reports/backend-repair/dependency-checks.json'),JSON.stringify({runAt:new Date().toISOString(),version:XLSX.version,scope:'Offline catalog parser compatibility after replacing vulnerable dependency',checks},null,2));console.log('2 spreadsheet dependency compatibility checks passed.');
}main().catch(e=>{console.error(e.message);process.exitCode=1;});
