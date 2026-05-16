var pageRecs=[], curPage=1, editId=null;

var COLS = ['Shipment ID','Site','Product','Status','Actions'];

function init() {
  document.querySelector('#logisticsTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page){
  curPage=page;
  var search=(document.getElementById('search')||{}).value||'';
  var url='/admin/api/logistics?page='+page+(search?'&search='+encodeURIComponent(search):'');
  var d=await fetch(url).then(r=>r.json());
  pageRecs=d.items;
  document.getElementById('subtitle').textContent=fmt(d.total)+' shipments total.';
  renderRows(d.items);
  document.getElementById('pgn').innerHTML=buildPagination(d,load);
}

function doSearch(){ load(1); }

document.addEventListener('DOMContentLoaded',function(){
  var s=document.getElementById('search');
  if(s) s.addEventListener('keydown',function(e){ if(e.key==='Enter') doSearch(); });
});

function renderRows(items){
  document.getElementById('tbody').innerHTML=items.length?items.map(function(l){
    return '<tr><td><strong>'+l.shipment_id+'</strong></td><td>'+badge(l.site_id,'sky')+'</td>'+
    '<td>'+l.product_id+'</td><td>'+l.shipment_date+'</td>'+
    '<td>'+fmt(l.quantity)+'</td><td>'+statusBadge(l.delivery_status)+'</td>'+
    '<td>'+badge(l.transportation_type,'purple')+'</td>'+
    '<td>'+
    (l.delivery_status==='Delivered'
      ? '<span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:5px 10px;border-radius:8px;border:1.5px solid #86efac;"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#16a34a\" stroke-width=\"2.5\" style=\"vertical-align:-1px;margin-right:4px\"><polyline points=\"20 6 9 17 4 12\"/></svg>Delivered</span>'
      : '<div class=\"action-btns\"><button class=\"btn btn-icon btn-icon-edit\" title=\"Edit\" onclick=\'openEdit('+JSON.stringify(l)+')\'><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg></button><button class=\"btn btn-icon btn-icon-delete\" title=\"Delete\" onclick=\"delLog('+l.id+')\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6\"/><path d=\"M10 11v6M14 11v6\"/><path d=\"M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2\"/></svg></button></div>')+
    '</td></tr>';
  }).join(''):'<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">No records.</td></tr>';
}

function openEdit(l){
  editId=l.id;
  document.getElementById('eStatus').value    = l.delivery_status;
  document.getElementById('eTransport').value = l.transportation_type;
  // document.getElementById('eQty').value       = l.quantity;
  clearAllFieldErrors(document.getElementById('editForm')); hideAlert('eAlert'); openModal('editModal');
}

document.getElementById('editForm').addEventListener('submit',async function(e){
  e.preventDefault(); hideAlert('eAlert');
  var btn=document.getElementById('eBtn'); btn.disabled=true; btn.textContent='Saving…';
  var d={delivery_status:document.getElementById('eStatus').value,transportation_type:document.getElementById('eTransport').value }; //quantity:document.getElementById('eQty').value};
  try{
    var res=await fetch('/admin/api/logistics/'+editId,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    var r=await res.json();
    if(r.ok){closeModal('editModal');load(curPage);}
    else showAlert('eAlert', friendlyError(r.error), 'error');
  }catch(er){showAlert('eAlert','Unable to connect to server. Please try again.','error');}
  finally{btn.disabled=false;btn.textContent='Save';}
});

async function delLog(id){
  await doDelete('/admin/api/logistics/'+id,function(){ load(curPage); },'logistics');
}

async function markDelivered(id){
  if(!confirm('Mark as Delivered? This will reduce inventory.'))return;
  var res=await fetch('/admin/api/logistics/'+id+'/deliver',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  var d=await res.json();
  if(d.ok)load(curPage);
  else showToast(friendlyError(d.error),'error');
}

window.onload=init;
