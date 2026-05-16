var pageRecs=[], curPage=1;

var COLS = ['Timestamp','User','Action','Table','Record ID','Detail'];

function init(){
  document.querySelector('#auditTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page){
  curPage=page;
  var search=(document.getElementById('search')||{}).value||'';
  var url='/admin/api/audit-log?page='+page+(search?'&search='+encodeURIComponent(search):'');
  var d=await fetch(url).then(r=>r.json());
  pageRecs=d.items;
  document.getElementById('subtitle').textContent=fmt(d.total)+' audit entries.';
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
    var cls=l.action==='CREATE'?'success':l.action==='DELETE'?'danger':l.action==='UPDATE'?'warning':'sky';
    return '<tr><td style="font-size:11px;color:#64748b;">'+l.created_at+'</td>'+
    '<td>'+badge(l.user||'System','sky')+'</td>'+
    '<td>'+badge(l.action,cls)+'</td><td>'+badge(l.table_name,'sky')+'</td>'+
    '<td>'+l.record_id+'</td><td style="font-size:12px;color:#475569;max-width:260px;white-space:normal;">'+l.detail+'</td></tr>';
  }).join(''):'<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">No audit entries.</td></tr>';
}

window.onload=init;
