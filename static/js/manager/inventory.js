var pageRecs = [], curPage = 1;

var COLS = ['Site ID','Product ID','Beginning Inv','Ending Inv','Replenishment','Stockout'];

function init() {
  document.querySelector('#invTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page) {
  curPage = page;
  var search = (document.getElementById('search')||{}).value||'';
  var url = '/manager/api/inventory?page='+page+(search?'&search='+encodeURIComponent(search):'');
  var d = await fetch(url).then(r=>r.json());
  pageRecs = d.items;
  document.getElementById('subtitle').textContent = fmt(d.total)+' records in your state.';
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
    ? items.map(function(i){
        return '<tr>'+
          '<td>'+badge(i.site_id,'sky')+'</td>'+
          '<td>'+i.product_id+'</td>'+
          '<td>'+fmt(i.beginning_inventory)+'</td>'+
          '<td><strong>'+fmt(i.ending_inventory)+'</strong></td>'+
          '<td>'+fmt(i.replenishment)+'</td>'+
          '<td>'+(i.stockout_flag==='Yes'?badge('Stockout','danger'):badge('In Stock','success'))+'</td>'+
        '</tr>';
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">No records.</td></tr>';
}

window.onload = init;
