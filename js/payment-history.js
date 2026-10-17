(function(){
 const labels={pending:'Payment pending',processing:'Payment processing',successful:'Payment successful',failed:'Payment failed',cancelled:'Payment cancelled',refunded:'Payment refunded',review:'Payment requires reconciliation'};
 const status=document.getElementById('historyStatus'),list=document.getElementById('paymentHistory'),more=document.getElementById('historyMore');
 let offset=0,busy=false;const shown=new Set();
 const money=cents=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);
 async function load(){
  if(busy)return;busy=true;more.disabled=true;
  try{
   const data=await window.KagieAPI.getPaymentHistoryAsync(offset);
   for(const p of data.payments){
    if(shown.has(p.paymentId))continue;shown.add(p.paymentId);
    const article=document.createElement('article');article.setAttribute('data-yoco-root','');
    const title=document.createElement('h2');title.textContent=p.reference||p.paymentId;article.append(title);
    const dl=document.createElement('dl');article.append(dl);
    const line=(label,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);};
    for(const product of p.products||[])line('Purchase',product.name+' × '+product.quantity);
    line('Amount',money(p.amountCents));line('Payment method',p.method);line('Status',labels[p.status]||'Payment pending');
    if(p.createdAt)line('Created',new Date(p.createdAt).toLocaleString('en-ZA'));
    if(p.paidAt)line('Paid at',new Date(p.paidAt).toLocaleString('en-ZA'));
    if(p.transactionReference)line('Transaction reference',p.transactionReference);
    if(p.mode==='test')line('Environment','Yoco test payment');
    if(p.method==='Yoco hosted checkout'){const link=document.createElement('a');link.href='payment.html?attempt='+encodeURIComponent(p.paymentId);link.textContent=['successful','refunded'].includes(p.status)?'Open receipt':'Check or resume this payment';article.append(link);}
    list.append(article);
   }
   offset=data.nextOffset;more.hidden=offset===null;more.textContent='Load more payments';
   status.textContent=shown.size?'Showing your recorded payments.':'No payments recorded yet.';
  }catch(error){status.textContent=error.message||'Payment history is temporarily unavailable. Try again.';more.hidden=false;more.textContent='Retry payment history';}
  finally{busy=false;more.disabled=false;}
 }
 more.addEventListener('click',load);
 (async()=>{try{if(window.__kagieRuntimeConfigPromise)await window.__kagieRuntimeConfigPromise;
  const user=await window.KagieAPI.restoreSession();if(!user){status.textContent='Sign in to view your payments.';const a=document.createElement('a');a.href='login.html';a.textContent='Sign in';list.append(a);return;}await load();
 }catch(error){status.textContent=error.message||'Please sign in again.';}})();
})();
