var pageRecs=[], curPage=1;

var COLS = ['Site ID','Name','Format','City','Size (sqft)','Open Date','Status'];

function init() {
  document.querySelector('#sitesTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page){
  curPage = page||1;
  var search=(document.getElementById('search')||{}).value||'';
  // manager sites come from /manager/api/sites which returns all state sites (no pagination needed from backend but keep consistent)
  var res=await fetch('/manager/api/sites');
  var d=await res.json();
  var items = d.items||[];
  // client-side filter only for sites (small dataset, no pagination API on manager sites)
  if (search) {
    var sl=search.toLowerCase();
    items=items.filter(function(s){ return (s.site_id+s.site_name+s.city+s.status).toLowerCase().includes(sl); });
  }
  pageRecs=items;
  document.getElementById('subtitle').textContent=fmt(d.total)+' sites in your state.';
  renderRows(items);
}

function doSearch(){ load(1); }

document.addEventListener('DOMContentLoaded',function(){
  var s=document.getElementById('search');
  if(s) s.addEventListener('keydown',function(e){ if(e.key==='Enter') doSearch(); });
});

function renderRows(items){
  document.getElementById('tbody').innerHTML=items.length?items.map(function(s){
    return '<tr>'+
    '<td>'+badge(s.site_id,'sky')+'</td>'+
    '<td><strong>'+s.site_name+'</strong></td>'+
    '<td>'+s.site_format+'</td>'+
    '<td>'+s.city+'</td>'+
    '<td>'+fmt(s.store_size)+' sqft</td>'+
    '<td>'+s.open_date+'</td>'+
    '<td>'+statusBadge(s.status)+'</td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8;">No sites found.</td></tr>';
}

window.onload=init;
