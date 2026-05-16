var pageRecs=[], curPage=1;

var COLS = ['Shipment ID','Site ID','Product','Date','Qty','Status','Transport','Actions'];

function init() {
  document.querySelector('#logisticsTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page){
  curPage=page;
  var search=(document.getElementById('search')||{}).value||'';
  var soId=new URLSearchParams(window.location.search).get('so_id')||'';
  var url='/manager/api/logistics?page='+page+(search?'&search='+encodeURIComponent(search):'')+(soId?'&so_id='+soId:'');
  var d=await fetch(url).then(r=>r.json());
  pageRecs=d.items;
  document.getElementById('subtitle').textContent=fmt(d.total)+' shipments in your state.';
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
    var actionCell;
    if(l.delivery_status==='Delivered'){
      actionCell='<span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:5px 10px;border-radius:8px;border:1.5px solid #86efac;">✅ Delivered</span>';
    } else {
      actionCell='<button class="btn btn-success btn-sm" onclick="markDelivered('+l.id+')">✅ Deliver</button>';
    }
    return '<tr>'+
    '<td><strong>'+l.shipment_id+'</strong></td>'+
    '<td>'+badge(l.site_id,'sky')+'</td>'+
    '<td>'+l.product_id+'</td>'+
    '<td>'+l.shipment_date+'</td>'+
    '<td>'+fmt(l.quantity)+'</td>'+
    '<td>'+statusBadge(l.delivery_status)+'</td>'+
    '<td>'+badge(l.transportation_type,'purple')+'</td>'+
    '<td>'+actionCell+'</td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">No records.</td></tr>';
}

async function markDelivered(id){
  if(!confirm('Mark as Delivered? This will reduce site inventory and cannot be undone.'))return;
  var res=await fetch('/manager/api/logistics/'+id+'/deliver',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  var d=await res.json();
  if(d.ok) load(curPage);
  else alert(d.error||'Error');
}

window.onload=init;
