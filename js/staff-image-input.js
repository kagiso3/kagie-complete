(function () {
 'use strict';
 const D=window.KagieStaffData;
 function mount(container,path='') {
  const input=container.querySelector('input[name="image"]'); if(!input)return;
  input.accept='image/jpeg,image/png,image/webp';
  const box=document.createElement('div');box.className='image-drop';box.tabIndex=0;box.setAttribute('role','button');box.setAttribute('aria-label','Choose or drop an image');
  box.innerHTML='<strong>Choose a picture or drag it here</strong><small>JPG, PNG or WEBP · up to 8 MB</small><img class="content-image" hidden alt="Opportunity image preview"><span class="form-error" role="alert"></span>';
  input.after(box);
  const remove=document.createElement('button');remove.type='button';remove.className='row-btn';remove.textContent='Remove picture';box.after(remove);
  const removed=document.createElement('input');removed.type='hidden';removed.name='remove_image';removed.value='0';box.after(removed);
  const img=box.querySelector('img'), error=box.querySelector('[role="alert"]');let generation=0,objectUrl;
  const revoke=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;};
  async function select(file) {
   const current=++generation;error.textContent='';
   try {await D.validateImage(file);if(current!==generation)return;revoke();objectUrl=URL.createObjectURL(file);img.src=objectUrl;img.hidden=false;removed.value='0';}
   catch(err){if(current!==generation)return;input.value='';error.textContent=err.message;}
  }
  box.addEventListener('click',()=>input.click());box.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();input.click();}});
  input.addEventListener('change',()=>{if(input.files[0])select(input.files[0]);});
  box.addEventListener('dragover',event=>{event.preventDefault();box.classList.add('dragging');});
  box.addEventListener('dragleave',()=>box.classList.remove('dragging'));
  box.addEventListener('drop',event=>{event.preventDefault();box.classList.remove('dragging');const files=event.dataTransfer.files;if(files.length!==1){error.textContent='Drop one picture at a time.';return;}const transfer=new DataTransfer();transfer.items.add(files[0]);input.files=transfer.files;select(files[0]);});
  remove.addEventListener('click',()=>{generation++;revoke();input.value='';img.hidden=true;removed.value='1';error.textContent='';});
  if(path)D.documentUrl(path).then(url=>{if(!generation){img.src=url;img.hidden=false;}}).catch(err=>{error.textContent='Existing image could not load: '+err.message;});
  const dialog=container.closest('dialog');dialog?.addEventListener('close',revoke,{once:true});
 }
 window.KagieStaffImages={mount};
})();
