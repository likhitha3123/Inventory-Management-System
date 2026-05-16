var pageRecs = [], curPage = 1;

var COLS = ['Customer ID','Age','Income Bracket','Actions'];

function init() {
  document.querySelector('#custTable thead tr').innerHTML = COLS.map(c=>`<th>${c}</th>`).join('');
  load(1);
}

async function load(page) {
  curPage = page;
  var search = (document.getElementById('search')||{}).value||'';
  var url = '/admin/api/customers-list?page='+page+(search?'&search='+encodeURIComponent(search):'');
  var d = await fetch(url).then(r=>r.json());
  pageRecs = d.items;
  document.getElementById('subtitle').textContent = fmt(d.total)+' customers total.';
  renderRows(d.items);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() { load(1); }

document.addEventListener('DOMContentLoaded', function(){
  var s = document.getElementById('search');
  if (s) s.addEventListener('keydown', function(e){ if(e.key==='Enter') doSearch(); });
});

var _custCache=[];
function renderRows(items) {
  _custCache=items;
  document.getElementById('tbody').innerHTML = items.length
    ? items.map(c=>`<tr>`+
        `<td>${badge(c.customer_id,'purple')}</td>`+
        `<td>${c.age||'—'}</td>`+
        `<td>${c.income_bracket||'—'}</td>`+
        `<td class="action-btns">
          <button class="btn btn-icon btn-icon-view" title="View All Details" onclick="viewCustDetail('${c.customer_id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </td>`+
      `</tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;padding:30px;color:#94a3b8;">No customers.</td></tr>';
}

function viewCustDetail(custId) {
  var c = _custCache.find(x=>x.customer_id===custId);
  if (!c) return;
  showDetailModal('Customer Details', `
    <div class="detail-grid">
      <div class="dg-row"><span class="dg-label">Customer ID</span><span class="dg-val">${badge(c.customer_id,'purple')}</span></div>
      <div class="dg-row"><span class="dg-label">Age</span><span class="dg-val">${c.age||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Gender</span><span class="dg-val">${c.gender||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Income Bracket</span><span class="dg-val">${c.income_bracket||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Purchase Frequency</span><span class="dg-val">${fmt(c.purchase_frequency)}</span></div>
      <div class="dg-row"><span class="dg-label">Avg Spend</span><span class="dg-val">₹${fmt(c.average_spend,2)}</span></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="closeDetailModal()">Close</button>
    </div>
  `);
}

window.onload = init;
