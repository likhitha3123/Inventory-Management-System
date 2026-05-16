var pageRecs = [], curPage = 1, allStates = [];

var COLS = ['Site ID', 'Product ID', 'Ending Inv', 'Stockout', 'Actions'];

async function init() {
  try {
    document.querySelector('#invTable thead tr').innerHTML = COLS.map(c => `<th>${c}</th>`).join('');
    const stateData = await fetch('/admin/api/states').then(r => r.json());
    allStates = stateData || [];
    var stateEl = document.getElementById('fState');
    if (stateEl) allStates.forEach(s => { stateEl.innerHTML += `<option value="${s.id}">${s.name}</option>`; });
    await load(1);
  } catch (e) { console.error('Init error:', e); }
}

async function load(page) {
  curPage = page;
  var stateId  = (document.getElementById('fState')   || {}).value || '';
  var search   = (document.getElementById('search')   || {}).value || '';
  var stockFilter = (document.getElementById('fStock') || {}).value || '';
  var url = '/admin/api/inventory?page=' + page
    + (stateId    ? '&state_id='   + stateId                    : '')
    + (search     ? '&search='     + encodeURIComponent(search) : '')
    + (stockFilter? '&stockout='   + stockFilter                 : '');
  var d = await fetch(url).then(r => r.json());
  pageRecs = d.items;
  document.getElementById('subtitle').textContent = fmt(d.total) + ' records total.';
  renderRows(d.items);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() { load(1); }

document.addEventListener('DOMContentLoaded', function () {
  var s = document.getElementById('search');
  if (s) s.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  // Stock filter pill buttons
  document.querySelectorAll('.stock-pill').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.stock-pill').forEach(b => b.classList.remove('stock-pill-active'));
      this.classList.add('stock-pill-active');
      var fStock = document.getElementById('fStock');
      if (fStock) fStock.value = this.dataset.val;
      load(1);
    });
  });
});

var _invCache = [];
function renderRows(items) {
  _invCache = items;
  document.getElementById('tbody').innerHTML = items.length
    ? items.map((i, idx) => {
      var isOut = i.stockout_flag === 'Yes';
      var sf = isOut ? badge('Stockout', 'danger') : badge('In Stock', 'success');
      return `<tr>
        <td>${badge(i.site_id, 'sky')}</td>
        <td style="font-weight:600;">${i.product_id}</td>
        <td><strong style="color:${isOut ? '#dc2626' : '#0284c7'};">${fmt(i.ending_inventory)}</strong></td>
        <td>${sf}</td>
        <td class="action-btns">
          <button class="btn btn-icon btn-icon-view" title="View Inventory Flow" onclick="viewInvDetail(${idx})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:30px;color:#94a3b8;">No records found.</td></tr>';
}

function viewInvDetail(idx) {
  var i = _invCache[idx];
  if (!i) return;

  var isOut  = i.stockout_flag === 'Yes';
  var sf     = isOut ? badge('Stockout', 'danger') : badge('In Stock', 'success');
  var begin  = i.beginning_inventory || 0;
  var replen = i.replenishment || 0;
  var ending = i.ending_inventory || 0;
  var sold   = i.units_sold || Math.max(0, begin + replen - ending);
  var balanced = (begin + replen - sold) === ending;

  var flowHtml = `
    <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:1.5px solid #bae6fd;border-radius:12px;padding:18px 16px;margin-top:14px;">
      <div style="font-size:11px;font-weight:800;color:#0284c7;letter-spacing:.8px;margin-bottom:14px;display:flex;align-items:center;gap:6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        INVENTORY FLOW
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">

        <div style="flex:1;min-width:70px;background:#fff;border:2px solid #93c5fd;border-radius:12px;padding:14px 10px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#1d4ed8;line-height:1;">${fmt(begin)}</div>
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px;">Beginning</div>
        </div>

        <div style="font-size:20px;font-weight:700;color:#16a34a;">+</div>

        <div style="flex:1;min-width:70px;background:#fff;border:2px solid #6ee7b7;border-radius:12px;padding:14px 10px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#059669;line-height:1;">${fmt(replen)}</div>
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px;">Replenished</div>
        </div>

        <div style="font-size:20px;font-weight:700;color:#dc2626;">−</div>

        <div style="flex:1;min-width:70px;background:#fff;border:2px solid #fca5a5;border-radius:12px;padding:14px 10px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#dc2626;line-height:1;">${fmt(sold)}</div>
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px;">Units Sold</div>
        </div>

        <div style="font-size:20px;font-weight:700;color:#7c3aed;">=</div>

        <div style="flex:1;min-width:70px;background:${ending === 0 ? '#fff5f5' : '#f0fdf4'};border:2px solid ${ending === 0 ? '#fca5a5' : '#86efac'};border-radius:12px;padding:14px 10px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:${ending === 0 ? '#dc2626' : '#16a34a'};line-height:1;">${fmt(ending)}</div>
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-top:4px;">Ending</div>
        </div>

      </div>
      <div style="margin-top:10px;padding:7px 12px;background:${balanced ? '#f0fdf4' : '#fffbeb'};border:1px solid ${balanced ? '#bbf7d0' : '#fde68a'};border-radius:6px;font-size:11px;color:${balanced ? '#166534' : '#92400e'};">
        ${balanced
          ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" style="vertical-align:-1px;margin-right:3px;"><polyline points="20 6 9 17 4 12"/></svg> Formula balanced: ${fmt(begin)} + ${fmt(replen)} − ${fmt(sold)} = ${fmt(ending)}`
          : `<strong>Note:</strong> Computed ending (${fmt(begin + replen - sold)}) differs from recorded ending (${fmt(ending)}).`
        }
      </div>
    </div>`;

  _ensureDetailModal();
  document.getElementById('_detailTitle').innerHTML = `
    <span style="display:inline-flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      Inventory Details
    </span>`;

  document.getElementById('_detailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px;font-size:13px;">
      <div>
        <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:4px;">SITE</div>
        ${badge(i.site_id, 'sky')}
      </div>
      <div>
        <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:4px;">PRODUCT</div>
        <strong>${i.product_id}</strong>
      </div>
      <div>
        <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:4px;">STATUS</div>
        ${sf}
      </div>
      <div>
        <div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:4px;">REPLENISHMENT</div>
        <strong>${fmt(replen)}</strong>
      </div>
    </div>
    ${flowHtml}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
      <button class="btn btn-outline" onclick="closeDetailModal()">Close</button>
    </div>`;

  var modal = document.querySelector('#_detailModal .modal');
  if (modal) modal.style.maxWidth = '580px';
  openModal('_detailModal');
}

window.onload = init;