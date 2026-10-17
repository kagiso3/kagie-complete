const { hostedUrl, diagnostic } = require('./_yoco');
const { assertActiveActor } = require('./_admin-auth');
const json = (statusCode, value, origin) => ({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, OPTIONS'},body:JSON.stringify(value)});
function receipt(pay){
 let state=['Verified','Paid'].includes(pay.status)?'successful':pay.status==='Refunded'?'refunded':pay.status==='Failed'?'failed':pay.status==='Cancelled'?'cancelled':pay.gateway_checkout_id?'processing':'pending';
 // Historical unpinned gateway rows are retained, but do not become verified receipts.
 if(['successful','refunded'].includes(state)&&(!pay.provider||['yoco','payfast'].includes(pay.provider)&&(!pay.gateway_payment_id||!pay.paid_at)||pay.provider==='yoco'&&!['test','live'].includes(pay.gateway_mode)))state='review';
 const products=Array.isArray(pay.checkout_snapshot?.products)?pay.checkout_snapshot.products:[];
 const data={paymentId:pay.id,applicationId:pay.application_id,status:state,amountCents:Number(pay.expected_amount_cents??Math.round(Number(pay.amount)*100)),currency:pay.currency,reference:pay.reference,checkoutId:pay.gateway_checkout_id||null,paidAt:pay.paid_at||null,createdAt:pay.created_at,updatedAt:pay.updated_at,mode:pay.gateway_mode,method:pay.provider==='yoco'?'Yoco hosted checkout':pay.provider==='payfast'?'PayFast':'Bank transfer',
  products:products.slice(0,100).map(p=>({name:String(p.name||'Kagie purchase').slice(0,300),quantity:Number(p.quantity),amountCents:Number(p.amountCents)}))};
 if(['successful','refunded'].includes(state))data.transactionReference=pay.gateway_payment_id||pay.reference;
 return data;
}
exports.handler = async event => {
 const origin=event.headers?.origin||event.headers?.Origin||'*';
 if(event.httpMethod==='OPTIONS')return json(200,{ok:true},origin);
 if(event.httpMethod!=='GET')return json(405,{message:'Method not allowed.'},origin);
 const token=String(event.headers?.authorization||event.headers?.Authorization||'').match(/^Bearer\s+(\S+)$/i)?.[1];
 if(!token)return json(401,{message:'Please sign in to check your payment.'},origin);
 const id=String(event.queryStringParameters?.paymentId||'');
 const history=event.queryStringParameters?.history==='1';
 const offset=Number(event.queryStringParameters?.offset||0);
 if(history&&(!Number.isSafeInteger(offset)||offset<0||offset>10000))return json(400,{message:'Invalid history page.'},origin);
 if(!history&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return json(400,{message:'A payment attempt is required.'},origin);
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return json(503,{message:'Payment status is temporarily unavailable.'},origin);
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 async function get(path,auth=headers){const res=await fetch(base+path,{headers:auth,signal:AbortSignal.timeout(10000)});if(!res.ok)throw Object.assign(new Error('Dependency unavailable'),{status:res.status});return res.json();}
 try {
  let actor;try{actor=await get('/auth/v1/user',{apikey:key,Authorization:`Bearer ${token}`});}catch(e){if([401,403].includes(e.status))return json(401,{message:'Please sign in again.'},origin);throw e;}
  if(!actor?.id)return json(401,{message:'Please sign in again.'},origin);
  const profile=(await get(`/rest/v1/profiles?id=eq.${encodeURIComponent(actor.id)}&select=*&limit=1`))[0];
  if(!profile||profile.is_active===false)return json(403,{message:'This account is unavailable.'},origin);
  try{assertActiveActor(actor,profile);}catch{return json(403,{message:'This account is unavailable.'},origin);}
  if(history){
   const rows=await get(`/rest/v1/payments?user_id=eq.${encodeURIComponent(actor.id)}&select=*&order=created_at.desc,id.desc&limit=21&offset=${offset}`);
   const appIds=[...new Set(rows.map(p=>p.application_id))];
   const apps=appIds.length?await get(`/rest/v1/applications?id=in.(${appIds.map(encodeURIComponent).join(',')})&user_id=eq.${encodeURIComponent(actor.id)}&select=id`):[];
   const owned=new Set(apps.map(a=>a.id));
   return json(200,{data:{payments:rows.slice(0,20).filter(p=>owned.has(p.application_id)).map(receipt),nextOffset:rows.length>20?offset+20:null}},origin);
  }
  const pay=(await get(`/rest/v1/payments?id=eq.${id}&user_id=eq.${encodeURIComponent(actor.id)}&provider=eq.yoco&select=*&limit=1`))[0];
  if(!pay)return json(404,{message:'Payment not found.'},origin);
  const app=(await get(`/rest/v1/applications?id=eq.${encodeURIComponent(pay.application_id)}&user_id=eq.${encodeURIComponent(actor.id)}&select=id&limit=1`))[0];
  if(!app)return json(404,{message:'Payment not found.'},origin);
  const data=receipt(pay),state=data.status;
  if(!['successful','refunded'].includes(state)){
   const lease=(await get(`/rest/v1/payment_checkout_leases?payment_id=eq.${id}&user_id=eq.${encodeURIComponent(actor.id)}&select=response&limit=1`))[0];
   if(hostedUrl(lease?.response?.redirectUrl))data.redirectUrl=lease.response.redirectUrl;
  }
  return json(200,{data},origin);
 }catch(error){diagnostic('status',error);return json(503,{message:'Confirmation is delayed. Your payment record is preserved; refresh shortly.'},origin);}
};
