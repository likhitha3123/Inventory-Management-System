var pageRecs = [], curPage = 1;

var COLS = ['Customer','Site','Product','Revenue','Actions'];

async function init() {
  document.querySelector('#salesTable thead tr').innerHTML =
    COLS.map(c => `<th>${c}</th>`).join('');
    
  await load(1);
}

async function load(page) {
  curPage = page;

  var search = (document.getElementById('search') || {}).value || '';
  var url = '/admin/api/sales?page=' + page;

  if (search) url += '&search=' + encodeURIComponent(search);

  var res = await fetch(url);
  var d = await res.json();

  pageRecs = d.items;

  document.getElementById('subtitle').textContent =
    fmt(d.total) + ' sale records.';

  renderRows(d.items);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() {
  load(1);
}

document.addEventListener('DOMContentLoaded', function () {
  var s = document.getElementById('search');
  if (s) {
    s.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doSearch();
    });
  }
});

var _salesCache=[];
function renderRows(items) {
  _salesCache=items;
  document.getElementById('tbody').innerHTML = items.length
    ? items.map((s,idx) => `
        <tr>
          <td>${badge(s.customer_id || '—', 'purple')}</td>
          <td>${badge(s.site_id, 'sky')}</td>
          <td>${s.product_id || '—'}</td>
          <td>₹${fmt(s.revenue, 2)}</td>
          <td class="action-btns">
            <button class="btn btn-icon btn-icon-view" title="View All Details" onclick="viewSaleDetail(${idx})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-icon btn-icon-delete" title="Delete" onclick="delSale(${s.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No records.</td></tr>`;
}

function viewSaleDetail(idx) {
  var s = _salesCache[idx];
  if (!s) return;
  showDetailModal('Sale Details', `
    <div class="detail-grid">
      <div class="dg-row"><span class="dg-label">Customer</span><span class="dg-val">${badge(s.customer_id||'—','purple')}</span></div>
      <div class="dg-row"><span class="dg-label">Site</span><span class="dg-val">${badge(s.site_id,'sky')}</span></div>
      <div class="dg-row"><span class="dg-label">Product</span><span class="dg-val">${s.product_id||'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Date</span><span class="dg-val">${s.date}</span></div>
      <div class="dg-row"><span class="dg-label">Units Sold</span><span class="dg-val">${fmt(s.units_sold)}</span></div>
      <div class="dg-row"><span class="dg-label">Revenue</span><span class="dg-val"><strong>₹${fmt(s.revenue,2)}</strong></span></div>
      <div class="dg-row"><span class="dg-label">Discounts</span><span class="dg-val">${s.discounts>0?'₹'+fmt(s.discounts,2):'—'}</span></div>
      <div class="dg-row"><span class="dg-label">Returns</span><span class="dg-val">${s.returns>0?badge(s.returns,'danger'):'0'}</span></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="closeDetailModal()">Close</button>
    </div>
  `);
}

async function delSale(id) {
  await doDelete('/admin/api/sales/' + id, function () {
    load(curPage);
  });
}

window.onload = init;