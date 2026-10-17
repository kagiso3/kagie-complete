(function () {
  const labels = {pending:'Payment pending',processing:'Payment processing',successful:'Payment successful',failed:'Payment failed',cancelled:'Payment cancelled',refunded:'Payment refunded',review:'Payment requires reconciliation'};
  function mount(root, api) {
    if (!root || root.dataset.yocoMounted) return () => {};
    root.dataset.yocoMounted = 'true';
    root.innerHTML = '<h2>Pay securely with Yoco</h2><p>Your total is checked by Kagie before opening hosted checkout.</p><form data-yoco-form><label>Payer name<input name="payerName" autocomplete="name" required maxlength="160"></label><label>Phone<input name="phone" type="tel" autocomplete="tel" required minlength="9" maxlength="30"></label><label>Payment reference<input name="reference" required maxlength="100"></label><button type="submit">Continue to Yoco</button></form><div role="status" aria-live="polite" data-yoco-status></div><dl data-yoco-receipt hidden></dl><button type="button" data-yoco-refresh hidden>Refresh payment status</button><a data-yoco-resume hidden>Resume the same Yoco checkout</a><a data-yoco-login href="login.html" hidden>Sign in to view your payment</a>';
    const form=root.querySelector('form'), status=root.querySelector('[data-yoco-status]'), receipt=root.querySelector('dl'), refresh=root.querySelector('[data-yoco-refresh]'), resume=root.querySelector('[data-yoco-resume]');
    let stopped=false,timer=0,busy=false,paymentId='',user=null,polls=0,checking=false;
    const isReturn=location.pathname.endsWith('/payment.html');
    const hint=new URLSearchParams(location.search).get('result');
    const key=()=> 'kagie_yoco_attempt_v1:'+user.id;
    function later(){clearTimeout(timer);if(!stopped && polls++<30)timer=setTimeout(check,Math.min(15000,3000+polls*500));}
    function line(label,value){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;receipt.append(dt,dd);}
    async function check() {
      if(stopped||!paymentId||checking)return;
      checking=true;refresh.disabled=true;
      try {
        const data=await api.getYocoPaymentStatusAsync(paymentId);if(stopped)return;
        const pending=['pending','processing'].includes(data.status);
        status.textContent=(pending && hint==='cancelled' ? 'Payment cancelled at checkout' : labels[data.status]||labels.pending)+ (pending && hint==='cancelled' ? '. Confirmation remains pending. No payment is confirmed. Refresh or resume the same checkout.' : pending ? '. Waiting for verified confirmation. You can close this page and check again later.' : '');
        receipt.replaceChildren();receipt.hidden=false;
        line('Amount',new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(data.amountCents/100));
        for(const product of data.products||[])line('Purchase',product.name+' × '+product.quantity);
        line('Payment method',data.method||'Yoco hosted checkout');
        if(data.paidAt)line('Paid at',new Date(data.paidAt).toLocaleString('en-ZA'));
        line('Payment reference',data.reference||data.paymentId);line('Attempt',data.paymentId);
        if(['successful','refunded'].includes(data.status))line('Transaction reference',data.transactionReference||data.checkoutId);
        if(data.mode==='test')line('Environment','Yoco test payment');
        refresh.hidden=false;resume.hidden=!data.redirectUrl;
        if(data.redirectUrl){const url=new URL(data.redirectUrl);if(url.protocol==='https:'&&url.hostname==='c.yoco.com'&&!url.username&&!url.password&&!url.port)resume.href=url.href;else resume.hidden=true;}
        form.hidden=pending||data.status==='successful'||data.status==='refunded'||data.status==='review'||!!data.redirectUrl;
        if(pending)later();else clearTimeout(timer);
        if(!isReturn && data.status==='successful'){
          const items=await (api.getCartAsync?api.getCartAsync(user.id):Promise.resolve([]));
          if(items.length){status.textContent+=' Review your cart before making another purchase.';form.hidden=false;}
        }
      }catch(error){if(!stopped){status.textContent=error.message||'Confirmation is delayed. Refresh shortly; do not make a second payment.';refresh.hidden=false;form.hidden=true;later();}}
      finally{checking=false;if(!stopped)refresh.disabled=false;}
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy||!form.reportValidity())return;
      busy=true;const button=form.querySelector('button');button.disabled=true;button.textContent='Preparing secure checkout…';
      try {
        const data=await api.startYocoCheckoutAsync(Object.fromEntries(new FormData(form)));
        if(stopped)return;
        paymentId=data.paymentId;status.textContent='Opening Yoco. Your payment is pending until verified.';
        location.assign(data.redirectUrl);
      }catch(error){if(!stopped)status.textContent=error.message||'Could not start checkout. Your order is preserved.';}
      finally{busy=false;if(!stopped){button.disabled=false;button.textContent='Continue to Yoco';}}
    });
    refresh.addEventListener('click',()=>{polls=0;void check();});
    const onFocus=()=>{if(paymentId){polls=0;void check();}};
    window.addEventListener('focus',onFocus);
    (async()=>{
      try {
        if(window.__kagieRuntimeConfigPromise)await window.__kagieRuntimeConfigPromise;
        user=await api.restoreSession();if(stopped)return;
        if(!user){form.hidden=true;root.querySelector('[data-yoco-login]').hidden=false;status.textContent='Sign in to securely check your payment.';return;}
        if(!isReturn && api.getSettings?.().payments?.yocoEnabled === false){form.hidden=true;status.textContent='Card checkout is currently unavailable. Use the bank-transfer option or contact Kagie support.';return;}
        let stored={};try{stored=JSON.parse(localStorage.getItem(key())||'{}');}catch{}
        paymentId=new URLSearchParams(location.search).get('attempt')||stored.paymentId||'';
        form.elements.payerName.value=user.fullName||user.name||'';form.elements.phone.value=user.phone||'';
        form.elements.reference.value=stored.reference||'KAG-'+user.id.replace(/[^a-z0-9]/gi,'').slice(-10).toUpperCase();
        if(paymentId){form.hidden=true;await check();}
        else if(isReturn){form.hidden=true;status.textContent='No payment attempt was specified. Open checkout or your dashboard to find your reference.';}
      }catch(error){if(!stopped){form.hidden=true;status.textContent=error.message||'Please sign in again.';}}
    })();
    return ()=>{stopped=true;clearTimeout(timer);window.removeEventListener('focus',onFocus);delete root.dataset.yocoMounted;};
  }
  window.KagieYoco={mount};
  const start=()=>document.querySelectorAll('[data-yoco-root][data-yoco-auto]').forEach(root=>mount(root,window.KagieAPI));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
