(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const {icon, artwork} = window.KagieServiceIcons;
  const pageName = document.body.dataset.servicePage;
  let api, user;
  const roundIcon = (name, tone = "") => `<span class="ms-round-icon${tone ? ' ms-round-icon--' + tone : ''}">${icon(name)}</span>`;
  const arrow = () => `<span class="ms-chevron">${icon('chevron')}</span>`;
  const row = (title, description, href, name, flat = false) => `<a class="ms-row" href="${escape(href)}">${flat ? roundIcon(name) : `<span class="ms-row__art">${artwork(name)}</span>`}<span class="ms-row__copy"><span class="ms-row__title">${escape(title)}</span><span class="ms-row__description">${escape(description)}</span></span>${arrow()}</a>`;
  const button = (text, href, name) => `<a class="ms-button" href="${escape(href)}">${name ? icon(name) : ''}${escape(text)}</a>`;
  const intro = (title, text, art, blue = false) => `<section class="ms-intro"><div class="ms-intro__art${blue ? ' ms-intro__art--blue' : ''}">${artwork(art)}</div><h2>${escape(title)}</h2><p>${escape(text)}</p></section>`;
  const messageNode = '<p class="ms-message" id="message" role="status" aria-live="polite"></p>';
  const field = (name, label, options = {}) => {
    const attributes = `id="${name}" name="${name}" ${options.required ? 'required' : ''} ${options.autocomplete ? `autocomplete="${options.autocomplete}"` : ''}`;
    let control;
    if(options.select) control = `<select ${attributes}><option value="">Select an option</option>${options.select.map(value=>`<option>${escape(value)}</option>`).join('')}</select>`;
    else if(options.textarea) control = `<textarea ${attributes} placeholder="${escape(options.placeholder || '')}" maxlength="2000"></textarea>`;
    else control = `<input ${attributes} type="${options.type || 'text'}" placeholder="${escape(options.placeholder || '')}" ${options.maxlength ? `maxlength="${options.maxlength}"` : ''} ${options.readonly ? 'readonly' : ''} />`;
    return `<div class="ms-field"><label for="${name}">${escape(label)}</label>${control}</div>`;
  };
  const serviceHint = '<p class="ms-help" id="servicePrice"></p>';
  const detailFields = fields => `<section class="ms-request-details" id="requestDetails" hidden><h3>Institution details</h3><p>These details help Kagie route your assistance request.</p><div class="ms-fields-grid">${fields}</div></section>`;
  const noteField = () => field('note','Extra note (optional)',{textarea:true,placeholder:'Anything else the Kagie team should know?'});
  const institutionField = () => field('institution','Institution',{required:true,placeholder:'e.g. University of Johannesburg'});
  const studentField = () => field('studentNo','Student number',{required:true,placeholder:'Enter your student number'});
  const identityField = () => field('idNumber','ID / passport number',{required:true,placeholder:'Enter your ID or passport number',maxlength:24});

  function setMessage(text, state = 'info') {
    const node = $('message');
    if(!node) return;
    node.textContent = text;
    node.dataset.state = state;
    node.setAttribute('role',state==='error'?'alert':'status');
  }
  function footerIcons() {
    document.querySelectorAll('.kagie-shared-bottom-nav .bottom-nav-icon').forEach(node => {
      if(node.querySelector('svg')) return;
      node.innerHTML = icon(node.textContent.trim());
    });
    // More Services is outside the shared nav's five destinations.
    // Do not incorrectly announce App Home as the current page.
    document.querySelectorAll('.kagie-shared-bottom-nav [aria-current]').forEach(node => {
      node.classList.remove('active'); node.removeAttribute('aria-current');
    });
  }
  function renderHome() {
    return `<nav class="ms-list ms-list--services" aria-label="More services">${[
      ['Funding Assist','Get bursary and funding information and guidance.','funding-assist.html','funding'],
      ['Change Email','Update the email linked to your student portal.','change-email.html','email'],
      ['Re-Apply Help','Get help with a fresh or corrected application.','re-apply.html','reapply'],
      ['Forgot PIN','Recover or reset your portal PIN.','forgot-pin.html','pin'],
      ['Forgot Student Number','Find your student number using your personal details.','forgot-student-number.html','student'],
      ['Help & Support','Get help from our team if you need assistance.','help-support.html','support']
    ].map(args=>row(...args)).join('')}</nav>`;
  }
  function renderFunding() {
    return `<div class="ms-hub"><section class="ms-hero"><div class="ms-hero__art">${artwork('funding')}</div><h2>Funding Assist</h2><p>Get bursary and funding information, requirements and guidance to help fund your studies.</p></section><nav class="ms-list ms-list--compact" aria-label="Funding assistance">${[
      ['Available Bursaries','Find current bursaries for your course and institution.','available-bursaries.html','list'],
      ['Funding Checklist','See what documents and requirements you need.','funding-checklist.html','check'],
      ['How to Apply','Step-by-step guide to apply for funding.','funding-guide.html','cap'],
      ['Eligibility & Requirements','Check if you qualify and what you need.','funding-requirements.html','person'],
      ['Funding Support','Get help from our team if you need assistance.','funding-support.html','people']
    ].map(args=>row(...args,true)).join('')}</nav><section class="ms-guide-card"><div class="ms-guide-card__copy"><span class="ms-bulb" aria-hidden="true">💡</span><div><h3>Not sure where to start?</h3><p>Use our short guide to find the next funding step for you.</p></div></div>${button('Start Funding Guide','funding-guide.html','arrow')}</section></div>`;
  }
  function renderEmail() {
    return `${intro('Update Your Email','Change the email linked to your student portal.','email')}<form class="ms-form" id="serviceForm" novalidate>
      ${field('currentEmail','Current email',{type:'email',required:true,autocomplete:'email'})}
      ${field('newEmail','New email',{type:'email',required:true,placeholder:'Enter your new email',autocomplete:'email'})}
      ${field('confirmEmail','Confirm new email',{type:'email',required:true,placeholder:'Enter your new email again',autocomplete:'email'})}
      ${detailFields(institutionField()+studentField()+identityField()+noteField())}
      <button class="ms-button" type="submit" id="submitButton">Continue</button>${serviceHint}
      <p class="ms-help">Kagie assists with your institution portal email. Your Kagie sign-in email stays the same.</p>${messageNode}</form>`;
  }
  function renderPin() {
    return `${intro('Reset Your PIN','Recover your institution portal PIN with help from Kagie.','pin',true)}<form class="ms-form" id="serviceForm" novalidate>
      ${identityField()}${detailFields(institutionField()+studentField()+field('phone','Cellphone',{type:'tel',required:true,autocomplete:'tel',placeholder:'Phone number for follow-up'})+noteField())}
      <button class="ms-button" type="submit" id="submitButton">Request PIN Help</button>${serviceHint}
      <p class="ms-help">Kagie will guide your portal recovery. Need help with your Kagie password? <a href="../forgot-password.html">Reset your password</a>.</p>${messageNode}</form>`;
  }
  function renderStudentNumber() {
    return `${intro('Recover Your Student Number','Find your institution student number using your personal details.','student')}<form class="ms-form" id="serviceForm" novalidate>
      ${identityField()}${field('dob','Date of birth',{type:'date',required:true,autocomplete:'bday'})}
      ${detailFields(institutionField()+field('fullName','Full name',{required:true,autocomplete:'name',placeholder:'Your name on the institution record'})+field('phone','Cellphone',{type:'tel',required:true,autocomplete:'tel',placeholder:'Phone number for follow-up'})+field('email','Email (optional)',{type:'email',autocomplete:'email',placeholder:'Email on your application'})+noteField())}
      <button class="ms-button" type="submit" id="submitButton">Find Student Number</button>${serviceHint}
      <p class="ms-help">Kagie verifies the institution details before providing recovery assistance.</p>${messageNode}</form>`;
  }
  function renderReapply() {
    if(new URLSearchParams(location.search).get('request') === 'correction') {
      return `${intro('Correct an Existing Application','Tell us which application needs attention and Kagie will help with the next step.','reapply')}<form class="ms-form" id="serviceForm" novalidate>
        ${institutionField()+studentField()+field('intake','Target intake or year',{required:true,placeholder:'e.g. 2027 first semester'})}
        ${field('pin','Portal PIN (optional)',{type:'password',autocomplete:'off',placeholder:'Only if needed for assisted portal access'})}
        ${field('password','Portal password (optional)',{type:'password',autocomplete:'off',placeholder:'Only if needed for assisted portal access'})}
        ${noteField()}<button class="ms-button" type="submit" id="submitButton">Add Request to Cart</button>${serviceHint}${messageNode}</form>`;
    }
    return `${intro('Get Help to Re-Apply','Need to make a new application or correct an existing one? We’re here to help.','reapply')}<nav class="ms-list ms-list--compact" aria-label="Re-application help">${[
      ['Start a New Application','Begin a fresh application.','../forms.html','cap'],
      ['Correct an Existing Application','Update or fix your application.','re-apply.html?request=correction','search'],
      ['Check Application Status','See how your application is progressing.','../Dashboard.html','chart'],
      ['Contact Support','Get help from our team.','help-support.html','headset']
    ].map(args=>row(...args,true)).join('')}</nav>`;
  }
  function renderFundingSupport() {
    return `${intro('Get Funding Support','Tell Kagie what funding help you need.','support')}<form class="ms-form" id="serviceForm" novalidate>
      ${field('fundingType','Funding type',{required:true,select:['NSFAS guidance','Bursary finder support','Funding document checklist']})}
      ${field('fieldOfStudy','Field of study',{required:true,placeholder:'e.g. Nursing or Civil Engineering'})}
      ${field('institution','Preferred institution (optional)',{placeholder:'Institution or shortlist name'})}
      ${field('deadline','Important deadline (optional)',{type:'date'})}${noteField()}
      <button class="ms-button" type="submit" id="submitButton">Add Funding Request to Cart</button>${serviceHint}
      <p class="ms-help">For a general funding question, <a href="../personal-assistance.html">contact our support team</a>.</p>${messageNode}</form>`;
  }
  function renderHelp() {
    return `${intro('We’re Here to Help','Find the right help for your Kagie journey.','support')}<nav class="ms-list ms-list--compact" aria-label="Support options">${[
      ['Contact Kagie Support','Send a message to our team.','../personal-assistance.html','headset'],
      ['Track Support Requests','Read replies and follow your requests.','../personal-assistance.html','list'],
      ['Check Application Status','View your application and next steps.','../Dashboard.html','chart'],
      ['Funding Support','Get help with funding and bursary requirements.','funding-support.html','cap']
    ].map(args=>row(...args,true)).join('')}</nav>`;
  }
  const checklist = [
    ['id','Certified ID copy','A clear copy of your ID. Check the provider’s certification requirements.','document','blue'],
    ['results','Latest academic results','Your most recent school or academic results.','list',''],
    ['residence','Proof of residence','Your own or your parent/guardian’s proof of address.','target','blue'],
    ['income','Proof of income','Income documents or an affidavit, as requested by the provider.','document','orange'],
    ['motivation','Motivation letter','Explain your study plans and why you need funding.','document','blue'],
    ['additional','Additional documents','Registration, acceptance or other documents requested by the provider.','document','']
  ];
  function renderChecklist() {
    return `<p class="ms-copy">Make sure you have the required documents before applying.</p><div class="ms-progress"><progress id="checklistProgress" max="6" value="0" aria-label="Funding documents completed"></progress><p id="checklistCount" aria-live="polite">0 of 6 completed</p></div><div class="ms-checklist">${checklist.map(([id,title,text,name,tone])=>`<label class="ms-check"><input type="checkbox" data-checklist-item="${id}" aria-label="${escape(title)} completed"/><span class="ms-check-mark">${icon('check')}</span>${roundIcon(name,tone)}<span class="ms-row__copy"><span class="ms-row__title">${escape(title)}</span><span class="ms-row__description">${escape(text)}</span></span>${icon('chevron')}</label>`).join('')}</div><button class="ms-button" type="button" id="downloadChecklist">${icon('document')}Download Checklist (PDF)</button><p class="ms-help" style="margin-top:12px">Requirements vary by bursary. Check the official provider’s list. <a href="../upload.html">Open My Documents</a>.</p>${messageNode}`;
  }
  function renderGuide() {
    return `<p class="ms-copy">A simple way to prepare for your funding application.</p><ol class="ms-steps">${[
      ['Find a funding opportunity','Browse available bursaries and choose opportunities that match your study plans.'],
      ['Check the requirements','Read the provider’s eligibility rules, supported courses and institutions, and closing date.'],
      ['Prepare your documents','Use the funding checklist, then prepare the documents requested by that provider.'],
      ['Apply through the stated channel','Use the provider’s official application route. Keep a copy of what you submit.'],
      ['Track the outcome','Save your reference number and follow updates. Ask Kagie for help if you are unsure about a step.']
    ].map(([title,text])=>`<li><strong>${escape(title)}</strong><p>${escape(text)}</p></li>`).join('')}</ol><div class="ms-support-links">${button('Browse Available Bursaries','available-bursaries.html','search')}${button('Open Funding Checklist','funding-checklist.html','check')}</div>`;
  }
  function renderRequirements() {
    return `<p class="ms-copy">Each provider sets its own eligibility rules. Check these before you apply.</p>${[
      ['Academic requirements','Check the required marks, study level, qualification and field of study against the provider’s current information.'],
      ['Personal requirements','Check any nationality, age, location or household-income rules. Do not assume one bursary’s rules apply to another.'],
      ['Institution and course','Make sure your institution and intended course are supported. Check whether an acceptance or registration letter is required.'],
      ['Supporting documents','Prepare clear, complete documents. Certification and document-age requirements depend on the provider.'],
      ['Dates and application channel','Confirm the closing date and use the official application route shown by the provider.']
    ].map(([title,text])=>`<section class="ms-detail-card"><h2>${escape(title)}</h2><p>${escape(text)}</p></section>`).join('')}${button('View Available Bursaries','available-bursaries.html','arrow')}`;
  }
  function renderBursaries() {
    return `<p class="ms-copy">Find bursaries and funding opportunities for your course and institution.</p><div class="ms-search">${icon('search')}<label for="bursarySearch" class="ms-help" style="position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden">Search bursaries</label><input type="search" id="bursarySearch" placeholder="Search bursaries..." autocomplete="off" /></div><div class="ms-filters" role="group" aria-label="Bursary category">${[['all','All'],['nsfas','NSFAS'],['university','Universities'],['private','Private']].map(([value,title])=>`<button class="ms-filter" type="button" data-bursary-filter="${value}" aria-pressed="${value==='all'}">${title}</button>`).join('')}</div><div class="ms-list ms-list--bursaries" id="bursaryResults" aria-live="polite"><p class="ms-copy">Loading available bursaries…</p></div>`;
  }
  function validVisibleFields(form) {
    const invalid = [...form.querySelectorAll('input,select,textarea')].find(control => !control.closest('[hidden]') && !control.checkValidity());
    if(!invalid) return true;
    invalid.reportValidity(); invalid.focus(); return false;
  }
  function prefill(form, profile) {
    const values = {currentEmail:profile.email || user.email,fullName:profile.fullName || user.fullName,phone:profile.phone || user.phone,email:profile.email || user.email,idNumber:profile.idNumber,dob:profile.dob || profile.dateOfBirth};
    for(const [key,value] of Object.entries(values)) {
      const input = form.elements.namedItem(key);
      if(input && !input.value && value) input.value = value;
    }
  }
  function bindRequest(code) {
    const form = $('serviceForm');
    if(!form) return;
    const service = (api.getServiceCatalog() || []).find(item => (item.code || item.id)===code);
    const submit = $('submitButton');
    if(!service || !Number.isFinite(Number(service.price)) || Number(service.price)<0) {
      submit.disabled = true; setMessage('This service is currently unavailable. Please contact Kagie support.','error'); return;
    }
    $('servicePrice').textContent = `Assisted service · R${Number(service.price).toLocaleString('en-ZA')} · Payment in Cart`;
    prefill(form,api.getProfile?.(user.id) || {});
    if(api.getProfileAsync) api.getProfileAsync(user.id).then(profile => prefill(form,profile || {})).catch(()=>{});
    let saving = false;
    form.addEventListener('submit',async event => {
      event.preventDefault();
      if(saving) return;
      setMessage('');
      if(!validVisibleFields(form)) return;
      if(form.elements.dob?.value && new Date(form.elements.dob.value+'T00:00:00')>new Date()) {setMessage('Your date of birth cannot be in the future.','error');form.elements.dob.focus();return;}
      if(code==='change_email') {
        if(form.elements.newEmail.value.trim().toLowerCase()!==form.elements.confirmEmail.value.trim().toLowerCase()) {setMessage('Your new email addresses do not match.','error');form.elements.confirmEmail.focus();return;}
        if(form.elements.newEmail.value.trim().toLowerCase()===form.elements.currentEmail.value.trim().toLowerCase()) {setMessage('Enter a new email address that is different from the current one.','error');form.elements.newEmail.focus();return;}
      }
      const details = $('requestDetails');
      if(details?.hidden) {
        details.hidden = false;
        submit.textContent = 'Add Request to Cart';
        details.querySelector('input,select,textarea')?.focus();
        return;
      }
      const values = Object.fromEntries(new FormData(form));
      const payload = Object.fromEntries(Object.entries(values).filter(([key])=>key!=='confirmEmail').map(([key,value])=>[key,String(value).trim()]));
      // Preserve the service/cart contract used by checkout and staff workflows.
      const item = {type:'service',serviceCode:code,serviceName:service.name,servicePrice:Number(service.price),price:Number(service.price),...payload};
      const text = submit.textContent;
      saving = true; submit.disabled = true; submit.textContent = 'Adding request…'; form.setAttribute('aria-busy','true');
      try {
        if(api.addCartItemAsync) await api.addCartItemAsync(item,user.id);
        else api.addCartItem(item,user.id);
        setMessage('Your request was added to Cart.','success');
        location.assign('../cart.html');
      } catch(error) {
        setMessage(error.message || 'Your request could not be added. Please try again.','error');
      } finally {saving=false;submit.disabled=false;submit.textContent=text;form.removeAttribute('aria-busy');}
    });
  }
  function checklistPdf(completed) {
    const ascii = text => String(text).replace(/[^\x20-\x7e]/g,' ').replace(/([\\()])/g,'\\$1');
    const lines = ['KAGIE - FUNDING CHECKLIST',`${completed.size} of ${checklist.length} completed`,'',...checklist.flatMap(([id,title,text])=>[`${completed.has(id)?'[x]':'[ ]'} ${title}`,...text.replace(/’/g,"'").match(/.{1,76}(?:\s|$)|.{1,76}/g).map(line=>'    '+line.trim()),'']),'Requirements vary by bursary. Check the official provider documents.','This checklist records your own preparation; it is not document verification.'];
    const stream = `BT /F1 12 Tf 48 780 Td 18 TL ${lines.map((line,index)=>(index?'T* ':'')+`(${ascii(line)}) Tj`).join('\n')} ET`;
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Blob([pdf],{type:'application/pdf'});
  }
  function bindChecklist() {
    const storageKey = `kagie_funding_checklist_${user.id}`;
    const inputs = [...document.querySelectorAll('[data-checklist-item]')];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if(Array.isArray(saved)) inputs.forEach(input => {input.checked=saved.includes(input.dataset.checklistItem);});
    } catch {setMessage('Your saved checklist could not be loaded. You can still use the checklist.');}
    const updateProgress = () => {const count=inputs.filter(input=>input.checked).length;$('checklistProgress').value=count;$('checklistCount').textContent=`${count} of ${inputs.length} completed`;};
    inputs.forEach(input => input.addEventListener('change',() => {
      updateProgress();
      try {localStorage.setItem(storageKey,JSON.stringify(inputs.filter(item=>item.checked).map(item=>item.dataset.checklistItem)));setMessage('');}
      catch {setMessage('Checklist changes will last for this visit. This browser could not save them.','error');}
    }));
    updateProgress();
    $('downloadChecklist').addEventListener('click',() => {
      const blob=checklistPdf(new Set(inputs.filter(input=>input.checked).map(input=>input.dataset.checklistItem)));
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url;link.download='Kagie-Funding-Checklist.pdf';document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    });
  }
  function safeLink(value, asset = false) {
    if(!value) return '';
    try {
      const url=new URL(value,location.href);
      if(url.protocol==='https:' || (url.origin===location.origin && url.protocol==='http:')) return url.href;
      if(asset && /^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
    } catch {}
    return '';
  }
  function isFunding(article) {
    return /\b(bursar(?:y|ies)|funding|nsfas|scholarship(?:s)?)\b/i.test([article.category,article.title,...(article.tags || [])].join(' '));
  }
  function category(article) {
    const text=[article.title,article.company,article.category,...(article.tags || [])].join(' ');
    if(/nsfas/i.test(text)) return 'nsfas';
    if(/universit/i.test(text) && !/private/i.test(text)) return 'university';
    if(/private|company|corporate/i.test(text)) return 'private';
    if(/government|public|department/i.test(text)) return 'government';
    return 'other';
  }
  function deadlineInfo(article) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(article.closingDate || '') ? new Date(article.closingDate+'T23:59:59') : new Date(article.closingDate || '');
    if(Number.isNaN(date.getTime())) return {state:'',label:'',dateLabel:''};
    const days=(date.getTime()-Date.now())/86400000;
    return {state:days<0?'closed':days<7?'soon':'open',label:days<0?'Closed':days<7?'Closing Soon':'Open',dateLabel:date.toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'})};
  }
  const logo = article => {
    const url=safeLink(article.imageUrl,true);
    return `<span class="ms-bursary-logo">${url?`<img src="${escape(url)}" alt="" loading="lazy" />`:escape((article.company || article.title).split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase())}</span>`;
  };
  function articleRow(article) {
    const deadline=deadlineInfo(article);
    return `<a class="ms-row" href="bursary-details.html?id=${encodeURIComponent(article.id)}">${logo(article)}<span class="ms-row__copy"><span class="ms-row__title">${escape(article.title)}</span><span class="ms-row__description">${escape(article.summary || article.company || 'View funding information and requirements.')}</span><span class="ms-tags"><span class="ms-tag">${escape(article.category || article.company || 'Funding')}</span>${deadline.label?`<span class="ms-tag ms-tag--${deadline.state}">${deadline.label}</span>`:''}</span>${deadline.dateLabel?`<span class="ms-row__description">Closes ${escape(deadline.dateLabel)}</span>`:''}</span>${arrow()}</a>`;
  }
  async function getFundingArticles() {
    const articles = api.getCareerArticlesAsync ? await api.getCareerArticlesAsync() : api.getCareerArticles?.() || [];
    return articles.filter(article => article.status==='published' && isFunding(article));
  }
  async function bindBursaries() {
    let selected='all', articles=[];
    const results=$('bursaryResults');
    function renderResults() {
      const search=$('bursarySearch').value.trim().toLowerCase();
      const filtered=articles.filter(article=>(selected==='all' || category(article)===selected) && [article.title,article.company,article.summary,article.category,...(article.tags || [])].join(' ').toLowerCase().includes(search));
      results.innerHTML=filtered.length?filtered.map(articleRow).join(''):`<div class="ms-empty"><h2>${articles.length?'No matching bursaries':'No bursaries published yet'}</h2><p>${articles.length?'Try another search or category.':'Funding opportunities published by Kagie will appear here. You can prepare your documents in the meantime.'}</p>${button('Open Funding Checklist','funding-checklist.html','check')}</div>`;
    }
    $('bursarySearch').addEventListener('input',renderResults);
    document.querySelectorAll('[data-bursary-filter]').forEach(filter=>filter.addEventListener('click',()=>{
      selected=filter.dataset.bursaryFilter;
      document.querySelectorAll('[data-bursary-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===filter)));
      renderResults();
    }));
    async function load() {
      results.innerHTML='<p class="ms-copy">Loading available bursaries…</p>';
      try {articles=await getFundingArticles();renderResults();}
      catch {results.innerHTML='<div class="ms-empty" role="alert"><h2>Bursaries could not load</h2><p>Please try again when your connection is available.</p><button type="button" class="ms-button" id="retryBursaries">Try Again</button></div>';$('retryBursaries').addEventListener('click',load,{once:true});}
    }
    await load();
  }
  async function renderBursaryDetail() {
    const content=$('serviceContent');
    try {
      const id=new URLSearchParams(location.search).get('id');
      const article=(await getFundingArticles()).find(item=>item.id===id);
      if(!article) {content.innerHTML='<div class="ms-empty"><h2>Bursary not available</h2><p>This funding opportunity may no longer be published.</p>'+button('Back to Available Bursaries','available-bursaries.html','back')+'</div>';return;}
      const deadline=deadlineInfo(article), apply=safeLink(article.applicationUrl);
      content.innerHTML=`<section class="ms-intro">${logo(article)}<h2 style="margin-top:12px">${escape(article.title)}</h2><p>${escape(article.company)}</p>${deadline.label?`<span class="ms-tag ms-tag--${deadline.state}">${deadline.label}</span>`:''}</section><section class="ms-detail-card"><h2>About this bursary</h2>${(article.body || article.summary || 'Check the official provider information for the full funding details.').split(/\n\s*\n/).map(text=>`<p>${escape(text).replace(/\n/g,'<br>')}</p>`).join('')}</section>${article.requirements?.length?`<section class="ms-detail-card"><h2>Eligibility & Requirements</h2><ul>${article.requirements.map(value=>`<li>${escape(value)}</li>`).join('')}</ul></section>`:''}${article.tags?.length?`<section class="ms-detail-card"><h2>Funding information</h2><div class="ms-tags">${article.tags.map(tag=>`<span class="ms-tag">${escape(tag)}</span>`).join('')}</div></section>`:''}${deadline.dateLabel?`<section class="ms-detail-card"><h2>Closing date</h2><p>${escape(deadline.dateLabel)}</p></section>`:''}<div class="ms-support-links">${apply && deadline.state!=='closed'?`<a class="ms-button" href="${escape(apply)}" target="_blank" rel="noopener noreferrer">Continue to Official Website ${icon('arrow')}</a><p class="ms-help">You are leaving Kagie. Confirm the provider’s requirements before applying.</p>`:''}${button('Open Funding Checklist','funding-checklist.html','check')}${button('Get Funding Support','funding-support.html','headset')}</div>`;
    } catch {content.innerHTML='<div class="ms-empty" role="alert"><h2>Bursary details could not load</h2><p>Please try again.</p><button class="ms-button" id="retryDetail" type="button">Try Again</button></div>';$('retryDetail').addEventListener('click',renderBursaryDetail,{once:true});}
  }
  async function main() {
    footerIcons();
    api=window.KagieAPI;
    try {
      if(!api) throw new Error('Kagie services could not start. Please reload this page.');
      const restored=api.resolveSessionUser ? await api.resolveSessionUser({attempts:2,delayMs:200}) : await api.restoreSession();
      if(!restored || !['user','learner','student'].includes(restored.role)) {location.replace('../login.html?app=1');return;}
      user=api.requireRole('user');
      const templates={index:renderHome,funding:renderFunding,'change-email':renderEmail,'forgot-pin':renderPin,'forgot-student-number':renderStudentNumber,reapply:renderReapply,'funding-support':renderFundingSupport,help:renderHelp,checklist:renderChecklist,guide:renderGuide,requirements:renderRequirements,bursaries:renderBursaries};
      $('serviceContent').innerHTML=templates[pageName]?.() || '<p class="ms-copy">Loading bursary details…</p>';
      if(pageName==='checklist') bindChecklist();
      if(pageName==='bursaries') await bindBursaries();
      if(pageName==='detail') await renderBursaryDetail();
      const requestCodes={'change-email':'change_email','forgot-pin':'forgot_pin','forgot-student-number':'forgot_student_number',reapply:'re_apply','funding-support':'funding_assist'};
      if(requestCodes[pageName]) bindRequest(requestCodes[pageName]);
    } catch(error) {
      $('serviceContent').innerHTML=`<div class="ms-empty" role="alert"><h2>Services could not load</h2><p>${escape(error.message || 'Please try again.')}</p><button class="ms-button" type="button" id="retryPage">Try Again</button></div>`;
      $('retryPage').addEventListener('click',main,{once:true});
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',main,{once:true});
  else void main();
})();
