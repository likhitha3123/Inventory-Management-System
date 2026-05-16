var pageRecs=[], curPage=1, editId=null;
var COLS=['Promotion ID','Product','Site','Amount','Actions'];

function init(){
  document.querySelector('#promoTable thead tr').innerHTML=COLS.map(c=>`<th>${c}</th>`).join('');
  loadStates();
  load(1);
}

async function load(page){
  curPage=page;
  var search=(document.getElementById('search')||{}).value||'';
  var d=await fetch('/admin/api/promotions?page='+page+(search?'&search='+encodeURIComponent(search):'')).then(r=>r.json());
  pageRecs=d.items||[];
  var s=d.summary||{};
  document.getElementById('sTotal').textContent=d.total||0;
  document.getElementById('sPct').textContent=s.percentage||0;
  document.getElementById('sFlat').textContent=s.flat||0;
  document.getElementById('sSites').textContent=s.sites||0;
  var sub=document.getElementById('subtitle');if(sub)sub.textContent=fmt(d.total)+' promotions total.';
  renderRows(pageRecs);
  document.getElementById('pgn').innerHTML=buildPagination(d,load);
}

function doSearch(){load(1);}
document.addEventListener('DOMContentLoaded',function(){
  var s=document.getElementById('search');
  if(s)s.addEventListener('keydown',function(e){if(e.key==='Enter')doSearch();});
});

function renderRows(items){
  document.getElementById('tbody').innerHTML=items.length?items.map(function(p){
    var amt=p.discount_type==='Percentage'?p.discount_amount+'%':'₹'+fmt(p.discount_amount,2);
    var tb=p.discount_type==='Percentage'?badge('Percentage','warning'):badge('Flat','success');
    return '<tr><td><strong>'+p.promotion_id+'</strong></td>'+
      '<td>'+p.product_id+'</td><td>'+badge(p.site_id,'sky')+'</td>'+
      '<td>'+p.start_date+'</td><td>'+p.end_date+'</td>'+
      '<td>'+tb+'</td><td><strong>'+amt+'</strong></td>'+
      '<td style="display:flex;gap:6px;">'+
        '<button class="btn btn-outline btn-sm" onclick=\'openEdit('+JSON.stringify(p)+')\'>✏️</button>'+
        '<button class="btn btn-icon btn-icon-delete" title="Delete" onclick="delPromo('+p.id+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>'+
      '</td></tr>';
  }).join(''):'<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No records.</td></tr>';
}

// ── CREATE MODAL ─────────────────────────────────────────
var _states=[], _sitesMap={};

async function loadStates(){
  var d=await fetch('/admin/api/states-with-sites').then(r=>r.json());
  _states=d.items||[];
  var sel=document.getElementById('cState');
  sel.innerHTML='<option value="">— Select State —</option>';
  _states.forEach(s=>{
    sel.innerHTML+=`<option value="${s.state_id}">${s.state_name}</option>`;
    _sitesMap[s.state_id]=s.sites;
  });
}

function onStateChange(){
  var stateId=document.getElementById('cState').value;
  var siteSel=document.getElementById('cSite');
  siteSel.innerHTML='<option value="">— Select Site —</option>';
  document.getElementById('cProduct').innerHTML='<option value="">— Select Product —</option>';
  if(!stateId)return;
  var sites=_sitesMap[stateId]||[];
  sites.forEach(s=>{siteSel.innerHTML+=`<option value="${s.site_id}">${s.site_id} – ${s.site_name}</option>`;});
}

async function onSiteChange(){
  var siteId=document.getElementById('cSite').value;
  var prodSel=document.getElementById('cProduct');
  prodSel.innerHTML='<option value="">Loading…</option>';
  if(!siteId){prodSel.innerHTML='<option value="">— Select Product —</option>';return;}
  var d=await fetch('/admin/api/products-at-site?site_id='+siteId).then(r=>r.json());
  prodSel.innerHTML='<option value="">— Select Product —</option>';
  (d.items||[]).forEach(p=>{
    prodSel.innerHTML+=`<option value="${p.product_id}" ${p.has_promo?'disabled':''}>
      ${p.product_name}${p.has_promo?' (promo exists)':''}</option>`;
  });
}

document.getElementById('createForm').addEventListener('submit',async function(e){
  e.preventDefault();hideAlert('cAlert');
  var body={
    site_id:document.getElementById('cSite').value,
    product_id:document.getElementById('cProduct').value,
    start_date:document.getElementById('cStartDate').value,
    end_date:document.getElementById('cEndDate').value,
    discount_type:document.getElementById('cType').value,
    discount_amount:Number(document.getElementById('cAmt').value)
  };
  var valid = validateForm(document.getElementById('createForm'), {
    'cState':     [INV_VALIDATORS.required],
    'cSite':      [INV_VALIDATORS.required],
    'cProduct':   [INV_VALIDATORS.required],
    'cStartDate': [INV_VALIDATORS.required],
    'cEndDate':   [INV_VALIDATORS.required],
    'cAmt':       [INV_VALIDATORS.required, INV_VALIDATORS.positiveNumber],
  });
  if (!valid) return;
  var btn=document.getElementById('cBtn');btn.disabled=true;btn.textContent='Creating…';
  try{
    var res=await fetch('/admin/api/promotions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var r=await res.json();
    if(r.ok){closeModal('createModal');document.getElementById('createForm').reset();load(1);showToast('Promotion created successfully.','success');}
    else showAlert('cAlert', friendlyError(r.error), 'error');
  }catch(er){showAlert('cAlert','Unable to connect to server. Please try again.','error');}
  finally{btn.disabled=false;btn.textContent='Create';}
});

// ── EDIT MODAL ───────────────────────────────────────────
function openEdit(p){
  editId=p.id;
  document.getElementById('eType').value=p.discount_type;
  document.getElementById('eAmt').value=p.discount_amount;
  document.getElementById('eStartDate').value=p.start_date;
  document.getElementById('eEndDate').value=p.end_date;
  clearAllFieldErrors(document.getElementById('editForm'));hideAlert('eAlert');openModal('editModal');
}

document.getElementById('editForm').addEventListener('submit',async function(e){
  e.preventDefault();hideAlert('eAlert');
  var d={
    discount_type:document.getElementById('eType').value,
    discount_amount:Number(document.getElementById('eAmt').value),
    start_date:document.getElementById('eStartDate').value,
    end_date:document.getElementById('eEndDate').value
  };
  var btn=document.getElementById('eBtn');btn.disabled=true;btn.textContent='Saving…';
  try{
    var res=await fetch('/admin/api/promotions/'+editId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    var r=await res.json();
    if(r.ok){closeModal('editModal');load(curPage);showToast('Promotion updated successfully.','success');}
    else showAlert('eAlert', friendlyError(r.error), 'error');
  }catch(er){showAlert('eAlert','Unable to connect to server. Please try again.','error');}
  finally{btn.disabled=false;btn.textContent='Save';}
});

async function delPromo(id){
  await doDelete('/admin/api/promotions/'+id,function(){load(curPage);},'promotion');
}


function viewPromoDetail(p) {
  if (typeof p === 'string') p = JSON.parse(p);
  var amt = p.discount_type==='Percentage' ? p.discount_amount+'%' : '₹'+fmt(p.discount_amount,2);
  showDetailModal('Promotion Details', `
    <div class="detail-grid">
      <div class="dg-row"><span class="dg-label">Promotion ID</span><span class="dg-val"><strong>${p.promotion_id}</strong></span></div>
      <div class="dg-row"><span class="dg-label">Product</span><span class="dg-val">${p.product_id}</span></div>
      <div class="dg-row"><span class="dg-label">Site</span><span class="dg-val">${badge(p.site_id,'sky')}</span></div>
      <div class="dg-row"><span class="dg-label">Start Date</span><span class="dg-val">${p.start_date}</span></div>
      <div class="dg-row"><span class="dg-label">End Date</span><span class="dg-val">${p.end_date}</span></div>
      <div class="dg-row"><span class="dg-label">Type</span><span class="dg-val">${p.discount_type==='Percentage'?badge('Percentage','warning'):badge('Flat','success')}</span></div>
      <div class="dg-row"><span class="dg-label">Amount</span><span class="dg-val"><strong>${amt}</strong></span></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="closeDetailModal()">Close</button>
      <button class="btn btn-primary" onclick="closeDetailModal();openEdit(${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit</button>
    </div>
  `);
}
window.onload=init;
