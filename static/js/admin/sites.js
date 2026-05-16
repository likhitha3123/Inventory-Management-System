var pageRecs = [], curPage = 1, editId = null, allStates = [];

var COLS = ['Site ID','Name','City','Status','Actions'];

async function init() {
  document.querySelector('#sitesTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  var res = await fetch('/admin/api/states');
  allStates = await res.json();
  buildStateDropdown();
  await load(1);
}

function buildStateDropdown() {
  var opts = '<option value="">— Select State —</option>'+allStates.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  ['cpState','eState'].forEach(id=>{ var el=document.getElementById(id); if(el) el.innerHTML=opts; });
  var fState = document.getElementById('fState');
  if (fState) fState.innerHTML = '<option value="">All States</option>'+allStates.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
}

async function load(page) {
  curPage = page;
  var stateId = (document.getElementById('fState')||{}).value||'';
  var search  = (document.getElementById('search')||{}).value||'';
  var url = '/admin/api/sites?page='+page+(stateId?'&state_id='+stateId:'')+(search?'&search='+encodeURIComponent(search):'');
  var d = await fetch(url).then(r=>r.json());
  pageRecs = d.items;
  if (d.summary) {
    document.getElementById('sTotal').textContent = d.summary.total;
    document.getElementById('sActive').textContent = d.summary.active;
    document.getElementById('sInact').textContent = d.summary.inactive;
    document.getElementById('sReg').textContent = d.summary.regions;
  }
  document.getElementById('subtitle').textContent = fmt(d.total)+' sites total.';
  renderRows(d.items);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() { load(1); }

document.addEventListener('DOMContentLoaded', function(){
  var s = document.getElementById('search');
  if (s) s.addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(); });
});

var _allSitesCache=[];
function renderRows(items) {
  _allSitesCache=items;
  document.getElementById('tbody').innerHTML = items.length
    ? items.map(s=>`<tr>`+
        `<td>${badge(s.site_id,'sky')}</td><td><strong>${s.site_name}</strong></td>`+
        `<td>${s.city||'—'}</td>`+
        `<td>${statusBadge(s.status)}</td>`+
        `<td class="action-btns">`+
          `<button class="btn btn-icon btn-icon-view" title="View Details" onclick="viewSiteDetail(${s.id})"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>`+
          `<button class="btn btn-icon btn-icon-edit" title="Edit Site" onclick='openEdit(${JSON.stringify(s)})'>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>`+
          `<button class="btn btn-icon btn-icon-delete" title="Delete Site" onclick="delSite(${s.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>`+
        `</td></tr>`
      ).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No sites found.</td></tr>';
}

function openEdit(s){
  editId=s.id;
  document.getElementById('eSName').value   = s.site_name;
  document.getElementById('eFormat').value  = s.site_format||'';
  document.getElementById('eRegion').value  = s.region||'';
  document.getElementById('eCity').value    = s.city||'';
  document.getElementById('eState').value   = s.state_id||'';
  document.getElementById('eSize').value    = s.store_size||0;
  document.getElementById('eStatus').value  = s.status||'Active';
  clearAllFieldErrors(document.getElementById('editForm'));
  hideAlert('eAlert'); openModal('editModal');
}

document.getElementById('createForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var form = this;
  var valid = validateForm(form, {
    'cpName':  [INV_VALIDATORS.required, INV_VALIDATORS.minLength(2)],
    'cpCity':  [INV_VALIDATORS.required],
    'cpState': [INV_VALIDATORS.required],
  });
  if (!valid) return;
  hideAlert('cAlert');
  var btn=document.getElementById('cBtn'); btn.disabled=true; btn.textContent='Saving…';
  var d={
    site_name: document.getElementById('cpName').value.trim(),
    site_format: document.getElementById('cpFormat').value,
    region: document.getElementById('cpRegion').value.trim(),
    city: document.getElementById('cpCity').value.trim(),
    state_id: document.getElementById('cpState').value,
    store_size: document.getElementById('cpSize').value,
    status: document.getElementById('cpStatus').value
  };
  try{
    var res=await fetch('/admin/api/sites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    var r=await res.json();
    if(r.ok){ closeModal('createModal'); form.reset(); load(curPage); showToast('Site created successfully.','success'); }
    else showAlert('cAlert', friendlyError(r.error, 'site'), 'error');
  }catch(er){ showAlert('cAlert','Unable to connect to server. Please try again.','error'); }
  finally{ btn.disabled=false; btn.textContent='Create Site'; }
});

document.getElementById('editForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var form = this;
  var valid = validateForm(form, {
    'eSName': [INV_VALIDATORS.required, INV_VALIDATORS.minLength(2)],
    'eCity':  [INV_VALIDATORS.required],
  });
  if (!valid) return;
  hideAlert('eAlert');
  var btn=document.getElementById('eBtn'); btn.disabled=true; btn.textContent='Saving…';
  var d={
    site_name: document.getElementById('eSName').value.trim(),
    site_format: document.getElementById('eFormat').value,
    region: document.getElementById('eRegion').value.trim(),
    city: document.getElementById('eCity').value.trim(),
    state_id: document.getElementById('eState').value,
    store_size: document.getElementById('eSize').value,
    status: document.getElementById('eStatus').value
  };
  try{
    var res=await fetch('/admin/api/sites/'+editId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    var r=await res.json();
    if(r.ok){ closeModal('editModal'); load(curPage); showToast('Site updated successfully.','success'); }
    else showAlert('eAlert', friendlyError(r.error, 'site'), 'error');
  }catch(er){ showAlert('eAlert','Unable to connect to server. Please try again.','error'); }
  finally{ btn.disabled=false; btn.textContent='Save Changes'; }
});

async function delSite(id){
  await doDelete('/admin/api/sites/'+id, function(){ load(curPage); }, 'site');
}


function viewSiteDetail(id) {
  var s = _allSitesCache.find(x=>x.id===id);
  if (!s) return;
  showDetailModal('Site Details', `
    <div class="detail-grid">
      <div class="dg-row"><span class="dg-label">Site ID</span><span class="dg-val">${badge(s.site_id,'sky')}</span></div>
      <div class="dg-row"><span class="dg-label">Name</span><span class="dg-val"><strong>${s.site_name}</strong></span></div>
      <div class="dg-row"><span class="dg-label">Format</span><span class="dg-val">${s.site_format||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Region</span><span class="dg-val">${s.region||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">City</span><span class="dg-val">${s.city||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">State</span><span class="dg-val">${badge(s.state_name||'—','sky')}</span></div>
      <div class="dg-row"><span class="dg-label">Store Size</span><span class="dg-val">${fmt(s.store_size)} sqft</span></div>
      <div class="dg-row"><span class="dg-label">Open Date</span><span class="dg-val">${s.open_date||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Status</span><span class="dg-val">${statusBadge(s.status)}</span></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="closeDetailModal()">Close</button>
      <button class="btn btn-primary" onclick="closeDetailModal();openEdit(${JSON.stringify(s).replace(/"/g,'&quot;')})">Edit</button>
    </div>
  `);
}

window.onload = init;
