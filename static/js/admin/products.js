var pageRecs = [], curPage = 1, editId = null;
var categories = [], subcategories = [];

var COLS = ['', 'Name', 'Category', 'Price', 'Actions'];

async function init() {
  document.querySelector('#prodTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  const data = await fetch('/admin/api/products?dropdown=1').then(r=>r.json());
  categories    = data.categories    || [];
  subcategories = data.subcategories || [];
  var fCat = document.getElementById('fCategory');
  if (fCat) categories.forEach(c=>{ fCat.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
  populateCatDropdowns('cpCat','cpSub',null,null);
  populateCatDropdowns('eCat','eSub',null,null);
  await load(1);
}

function populateCatDropdowns(catElId, subElId, selCat, selSub) {
  var cEl = document.getElementById(catElId);
  if (cEl) {
    cEl.innerHTML = '<option value="">— Category —</option>'+categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    if (selCat) cEl.value = selCat;
  }
  updateSubs(catElId, subElId, selSub);
}

function updateSubs(catElId, subElId, selSub) {
  var cEl = document.getElementById(catElId);
  var sEl = document.getElementById(subElId);
  if (!sEl) return;
  var catVal = cEl ? parseInt(cEl.value)||0 : 0;
  var filtered = catVal ? subcategories.filter(s=>s.category_id===catVal) : subcategories;
  sEl.innerHTML = '<option value="">— Subcategory —</option>'+filtered.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  if (selSub) sEl.value = selSub;
}

async function load(page) {
  curPage = page;
  var catId  = (document.getElementById('fCategory')||{}).value||'';
  document.querySelector('#prodTable thead tr').innerHTML = ['', 'Name', 'Category', 'Price', 'Actions'].map(c=>`<th>${c}</th>`).join('');
  var search = (document.getElementById('search')||{}).value||'';
  var url = '/admin/api/products?page='+page+(catId?'&category_id='+catId:'')+(search?'&search='+encodeURIComponent(search):'');
  var d = await fetch(url).then(r=>r.json());
  pageRecs = d.items;
  document.getElementById('subtitle').textContent = fmt(d.total)+' products total.';
  renderRows(d.items);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() { load(1); }

document.addEventListener('DOMContentLoaded', function(){
  var s = document.getElementById('search');
  if (s) s.addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(); });
  var cpCat = document.getElementById('cpCat');
  if (cpCat) cpCat.addEventListener('change', function(){ updateSubs('cpCat','cpSub',null); });
  var eCat = document.getElementById('eCat');
  if (eCat) eCat.addEventListener('change', function(){ updateSubs('eCat','eSub',null); });
});

function shelfBadge(days){
  var cls = days<=10?'danger':days<=20?'warning':'success';
  return `<span class="badge badge-${cls}">${days}d</span>`;
}

var _allProductsCache = [];
function renderRows(items) {
  _allProductsCache = items;
  document.getElementById('tbody').innerHTML = items.length
    ? items.map(p=>
        `<tr>
          <td>${badge(p.product_id,'sky')}</td>
          <td><strong>${p.product_name}</strong></td>
          <td>${p.category||'—'}</td>
          <td>₹${fmt(p.unit_price,2)}</td>
          <td class="action-btns">
            <button class="btn btn-icon btn-icon-view" title="View All Details" onclick="viewProductDetail(${p.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-icon btn-icon-edit" title="Edit Product" onclick='openEdit(${JSON.stringify(p)})'>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon btn-icon-delete" title="Delete Product" onclick="delProd(${p.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </td>
        </tr>`
      ).join('')
    : `<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No products found.</td></tr>`;
}

function viewProductDetail(id) {
  var p = _allProductsCache.find(x=>x.id===id);
  if (!p) return;
  showDetailModal('Product Details', `
    <div class="detail-grid">
      <div class="dg-row"><span class="dg-label">Product ID</span><span class="dg-val">${badge(p.product_id,'sky')}</span></div>
      <div class="dg-row"><span class="dg-label">Name</span><span class="dg-val"><strong>${p.product_name}</strong></span></div>
      <div class="dg-row"><span class="dg-label">Category</span><span class="dg-val">${p.category||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Subcategory</span><span class="dg-val">${p.subcategory||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Unit Cost</span><span class="dg-val">₹${fmt(p.unit_cost,2)}</span></div>
      <div class="dg-row"><span class="dg-label">Unit Price</span><span class="dg-val">₹${fmt(p.unit_price,2)}</span></div>
      <div class="dg-row"><span class="dg-label">Shelf Life</span><span class="dg-val">${p.shelf_life} days</span></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="closeDetailModal()">Close</button>
      <button class="btn btn-primary" onclick="closeDetailModal();openEdit(${JSON.stringify(p).replace(/"/g,'&quot;')})">Edit</button>
    </div>
  `);
}

function openEdit(p) {
  editId = p.id;
  document.getElementById('eName').value  = p.product_name;
  document.getElementById('eCost').value  = p.unit_cost;
  document.getElementById('ePrice').value = p.unit_price;
  document.getElementById('eShelf').value = p.shelf_life;
  populateCatDropdowns('eCat','eSub', p.category_id, p.subcategory_id);
  clearAllFieldErrors(document.getElementById('editForm'));
  hideAlert('eAlert');
  openModal('editModal');
}

document.getElementById('createForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var valid = validateForm(this, {
    'cpName':  [INV_VALIDATORS.required, INV_VALIDATORS.minLength(2)],
    'cpCat':   [INV_VALIDATORS.required],
    'cpSub':   [INV_VALIDATORS.required],
    'cpCost':  [INV_VALIDATORS.required, INV_VALIDATORS.positiveNumber],
    'cpPrice': [INV_VALIDATORS.required, INV_VALIDATORS.positiveNumber],
    'cpShelf': [INV_VALIDATORS.required, INV_VALIDATORS.nonZeroNumber],
  });
  if (!valid) return;
  hideAlert('cAlert');
  var btn=document.getElementById('cBtn'); btn.disabled=true; btn.textContent='Saving…';
  var body={
    product_name: document.getElementById('cpName').value.trim(),
    category_id: document.getElementById('cpCat').value,
    subcategory_id: document.getElementById('cpSub').value,
    unit_cost: document.getElementById('cpCost').value,
    unit_price: document.getElementById('cpPrice').value,
    shelf_life: document.getElementById('cpShelf').value
  };
  try {
    var res=await fetch('/admin/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await res.json();
    if(d.ok){ closeModal('createModal'); this.reset(); updateSubs('cpCat','cpSub',null); load(curPage); showToast('Product created successfully.','success'); }
    else showAlert('cAlert', friendlyError(d.error, 'product'), 'error');
  } catch(er){ showAlert('cAlert','Unable to connect to server. Please try again.','error'); }
  finally{ btn.disabled=false; btn.textContent='Create Product'; }
});

document.getElementById('editForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var valid = validateForm(this, {
    'eName':  [INV_VALIDATORS.required, INV_VALIDATORS.minLength(2)],
    'eCat':   [INV_VALIDATORS.required],
    'eSub':   [INV_VALIDATORS.required],
    'eCost':  [INV_VALIDATORS.required, INV_VALIDATORS.positiveNumber],
    'ePrice': [INV_VALIDATORS.required, INV_VALIDATORS.positiveNumber],
    'eShelf': [INV_VALIDATORS.required, INV_VALIDATORS.nonZeroNumber],
  });
  if (!valid) return;
  hideAlert('eAlert');
  var btn=document.getElementById('eBtn'); btn.disabled=true; btn.textContent='Saving…';
  var body={
    product_name: document.getElementById('eName').value.trim(),
    category_id: document.getElementById('eCat').value,
    subcategory_id: document.getElementById('eSub').value,
    unit_cost: document.getElementById('eCost').value,
    unit_price: document.getElementById('ePrice').value,
    shelf_life: document.getElementById('eShelf').value
  };
  try {
    var res=await fetch('/admin/api/products/'+editId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await res.json();
    if(d.ok){ closeModal('editModal'); load(curPage); showToast('Product updated successfully.','success'); }
    else showAlert('eAlert', friendlyError(d.error, 'product'), 'error');
  } catch(er){ showAlert('eAlert','Unable to connect to server. Please try again.','error'); }
  finally{ btn.disabled=false; btn.textContent='Save Changes'; }
});

async function delProd(id){
  await doDelete('/admin/api/products/'+id, function(){ load(curPage); }, 'product');
}

async function quickAddCategory() {
  var name = prompt("Enter category name:");
  if (!name) return;
  try {
    var res = await fetch('/admin/api/categories', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    var d = await res.json();
    if (res.ok && d.id) {
      categories.push({id:d.id,name:d.name});
      populateCatDropdowns('cpCat','cpSub',d.id,null);
      populateCatDropdowns('eCat','eSub',d.id,null);
      document.getElementById('cpCat').value = d.id;
      updateSubs('cpCat','cpSub',null);
      showToast('Category added successfully.','success');
    } else { showToast(friendlyError(d.error,'product'),'error'); }
  } catch(e){ showToast('Unable to connect to server.','error'); }
}

async function quickAddSubcategory() {
  var catId = document.getElementById('cpCat').value;
  if (!catId) { showToast('Please select a category first.','warning'); return; }
  var name = prompt("Enter subcategory name:");
  if (!name) return;
  try {
    var res = await fetch('/admin/api/subcategories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,category_id:parseInt(catId)})});
    var d = await res.json();
    if (res.ok && d.id) {
      subcategories.push({id:d.id,name:d.name,category_id:parseInt(catId)});
      updateSubs('cpCat','cpSub',d.id);
      document.getElementById('cpSub').value = d.id;
      showToast('Subcategory added successfully.','success');
    } else { showToast(friendlyError(d.error,'product'),'error'); }
  } catch(e){ showToast('Unable to connect to server.','error'); }
}

window.onload = init;
