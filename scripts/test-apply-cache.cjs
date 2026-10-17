const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function main() {
  const listeners = new Map();
  const records = new Map();
  let fetchImpl;
  let failCacheWrite = false;
  const scope = {
    URL, Response,
    self: { location: { origin:'https://kagie.test' }, addEventListener:(name,fn)=>listeners.set(name,fn) },
    caches: {
      match:async request=>records.get(typeof request==='string'?request:request.url)?.clone(),
      open:async()=>({put:async(request,response)=>{if(failCacheWrite)throw new Error('Cache full');records.set(request.url,response.clone());}})
    },
    fetch:request=>fetchImpl(request)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),scope);
  function dispatch(url) {
    const pending=[];
    let response;
    listeners.get('fetch')({request:new Request(url), waitUntil:promise=>pending.push(promise), respondWith:promise=>response=promise});
    return {response,settle:async()=>{await Promise.all(pending);}};
  }

  const versioned='https://kagie.test/js/forms-page.js?v=test';
  records.set(versioned,new Response('cached version'));
  let finishFetch;
  fetchImpl=()=>new Promise(resolve=>{finishFetch=resolve;});
  const hit=dispatch(versioned);
  assert.equal(await (await hit.response).text(),'cached version');
  finishFetch(new Response('refreshed version'));
  await hit.settle();
  assert.equal(await records.get(versioned).clone().text(),'refreshed version');
  console.log('PASS Versioned scripts return cached bytes before the network and refresh in the background');

  fetchImpl=async()=>new Response('new version');
  const miss=dispatch('https://kagie.test/js/forms-page.js?v=next');
  assert.equal(await (await miss.response).text(),'new version');
  await miss.settle();
  console.log('PASS A new script version never reuses a different version');

  const plain='https://kagie.test/js/backend.js';
  records.set(plain,new Response('old script'));
  const latest=dispatch(plain);
  assert.equal(await (await latest.response).text(),'new version');
  await latest.settle();
  console.log('PASS Unversioned scripts continue to prefer the network');

  fetchImpl=async()=>new Response('outage',{status:503});
  const outage=dispatch(versioned);
  assert.equal(await (await outage.response).text(),'refreshed version');
  await outage.settle();
  assert.equal(await records.get(versioned).clone().text(),'refreshed version');
  console.log('PASS An HTTP failure cannot overwrite a working cached script');

  fetchImpl=async()=>{throw new Error('offline');};
  const offline=dispatch(plain);
  assert.equal(await (await offline.response).text(),'new version');
  await offline.settle();
  const empty=dispatch('https://kagie.test/js/missing.js');
  assert.equal((await empty.response).type,'error');
  await empty.settle();
  console.log('PASS Offline requests use matching cache entries or return a valid network error');

  failCacheWrite=true;
  fetchImpl=async()=>new Response('live response');
  const full=dispatch('https://kagie.test/js/new.js?v=test');
  assert.equal(await (await full.response).text(),'live response');
  await full.settle();
  assert.equal(dispatch('https://kagie.test/api/runtime-config').response,undefined);
  console.log('PASS Cache storage failures do not break live scripts and API requests bypass the cache');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
