var pageRecs = [], curPage = 1;

var COLS = ['Customer','Site','Product','Date','Units Sold','Revenue','Discounts','Returns'];

function init() {
  document.querySelector('#salesTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page) {
  curPage = page;
  var search = (document.getElementById('search')||{}).value||'';
  var url = '/manager/api/sales?page='+page+(search?'&search='+encodeURIComponent(search):'');
  var d = await fetch(url).then(r=>r.json());
  pageRecs = d.items;
  document.getElementById('subtitle').textContent = fmt(d.total)+' sales in your state.';
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
    ? items.map(function(s){
        return '<tr>'+
          '<td>'+badge(s.customer_id||'—','purple')+'</td>'+
          '<td>'+badge(s.site_id,'sky')+'</td>'+
          '<td>'+(s.product_id||'—')+'</td>'+
          '<td>'+s.date+'</td>'+
          '<td>'+fmt(s.units_sold)+'</td>'+
          '<td>₹'+fmt(s.revenue,2)+'</td>'+
          '<td>'+(s.discounts>0?'<span style="color:#d97706">-₹'+fmt(s.discounts,2)+'</span>':'—')+'</td>'+
          '<td>'+(s.returns>0?badge(s.returns,'danger'):'0')+'</td>'+
        '</tr>';
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8;">No records.</td></tr>';
}

window.onload = init;
