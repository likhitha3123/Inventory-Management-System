var pageRecs = [], curPage = 1;

var COLS = ['Product ID','Name','Category','Subcategory','Unit Price','Unit Cost'];

async function init() {
  document.querySelector('#prodTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  try {
    var res = await fetch('/admin/api/products?dropdown=1');
    var d = await res.json();
    var fCat = document.getElementById('fCategory');
    if (fCat && d.categories) {
      d.categories.forEach(function(c){ fCat.innerHTML += '<option value="'+c.id+'">'+c.name+'</option>'; });
    }
  } catch(e){}
  await load(1);
}

async function load(page) {
  curPage = page;
  var catId  = (document.getElementById('fCategory')||{}).value||'';
  var search = (document.getElementById('search')||{}).value||'';
  var url = '/manager/api/products?page='+page;
  if (catId)  url += '&category_id='+catId;
  if (search) url += '&search='+encodeURIComponent(search);
  var d = await fetch(url).then(r=>r.json());
  pageRecs = d.items;
  document.getElementById('subtitle').textContent = fmt(d.total)+' products in your sites.';
  renderRows(d.items);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() { load(1); }

document.addEventListener('DOMContentLoaded', function(){
  var s = document.getElementById('search');
  if (s) s.addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(); });
});

function renderRows(items) {
  document.getElementById('tbody').innerHTML = items.length
    ? items.map(function(p){
        return '<tr>'+
          '<td>'+badge(p.product_id,'sky')+'</td>'+
          '<td><strong>'+(p.product_name||'—')+'</strong></td>'+
          '<td>'+(p.category || '—')+'</td>'+
          '<td>'+(p.subcategory || '—')+'</td>'+
          '<td>₹'+fmt(p.unit_price,2)+'</td>'+
          '<td>₹'+fmt(p.unit_cost,2)+'</td>'+
        '</tr>';
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">No products found.</td></tr>';
}

async function openAddModal() {
  // HTML IDs: aSite, aProd, aQty, addAlert, addModal
  var [sr, pr] = await Promise.all([
    fetch('/manager/api/sites').then(r=>r.json()),
    fetch('/manager/api/products?dropdown=1').then(r=>r.json())
  ]);
  document.getElementById('aSite').innerHTML = '<option value="">— Select Site —</option>'+
    sr.items.map(function(s){ return '<option value="'+s.site_id+'">'+s.site_id+' – '+s.site_name+'</option>'; }).join('');
  document.getElementById('aProd').innerHTML = '<option value="">— Select Product —</option>'+
    pr.items.map(function(p){ return '<option value="'+p.product_id+'">'+p.product_id+' – '+p.product_name+'</option>'; }).join('');
  // document.getElementById('aQty').value = '';
  hideAlert('addAlert');
  openModal('addModal');
}

async function submitAdd() {
  var siteId    = document.getElementById('aSite').value;
  var productId = document.getElementById('aProd').value;
  if (!siteId||!productId) {
    showAlert('addAlert','Please fill in all fields.','error'); return;
  }
  var res = await fetch('/manager/api/products',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({site_id:siteId,product_id:productId})});
  var d = await res.json();
  if (res.ok) {
    showAlert('addAlert','Product added to inventory!','success');
    load(curPage);
    setTimeout(function(){ closeModal('addModal'); },1200);
  } else {
    showAlert('addAlert',d.error||'Failed to add product.','error');
  }
}

window.onload = init;
