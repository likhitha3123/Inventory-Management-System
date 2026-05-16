var pageRecs = [], curPage = 1;
var allCustomers = [], allSites = [], allStates = [], rowCount = 0;

// ── COLS: View | Order Ref | Customer | Site | Status | Transhipment | Actions
var COLS = ['View', 'Order Ref', 'Customer', 'Site', 'Status', 'Transhipment', 'Actions'];

// ── Status badges ──────────────────────────────────────
var STATUS_CFG = {
  pending:    { bg:'#fef9c3', color:'#854d0e', border:'#fde047', label:'Pending' },
  accepted:   { bg:'#dbeafe', color:'#1e40af', border:'#93c5fd', label:'Accepted' },
  rejected:   { bg:'#fee2e2', color:'#991b1b', border:'#fca5a5', label:'Rejected' },
  in_transit: { bg:'#ede9fe', color:'#5b21b6', border:'#c4b5fd', label:'In Transit' },
  delivered:  { bg:'#dcfce7', color:'#14532d', border:'#86efac', label:'Delivered' }
};

function statusBadgeSO(s) {
  var c = STATUS_CFG[s] || STATUS_CFG.pending;
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${c.bg};color:${c.color};border:1.5px solid ${c.border};">${c.label}</span>`;
}

// ── Transport icons ────────────────────────────────────
var TRANSPORT_SVG = {
  Road: { icon:'🛣', label:'Road', bg:'#dbeafe', color:'#1e40af', border:'#93c5fd' },
  Air:  { icon:'✈', label:'Air',  bg:'#ede9fe', color:'#5b21b6', border:'#c4b5fd' },
  Rail: { icon:'🚂', label:'Rail', bg:'#fef3c7', color:'#92400e', border:'#fcd34d' },
  Sea:  { icon:'🚢', label:'Sea',  bg:'#ccfbf1', color:'#134e4a', border:'#5eead4' }
};

function transportBadge(t) {
  var c = TRANSPORT_SVG[t] || { icon:'📦', label:t||'—', bg:'#f1f5f9', color:'#475569', border:'#cbd5e1' };
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:14px;font-size:11px;font-weight:700;background:${c.bg};color:${c.color};border:1.5px solid ${c.border};">${c.icon} ${c.label}</span>`;
}

// ── Progress tracker builder ───────────────────────────
var PROGRESS_STEPS = [
  { key:'pending',    label:'Order Placed', svgPath:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { key:'accepted',   label:'Accepted',     svgPath:'<polyline points="20 6 9 17 4 12"/>' },
  { key:'in_transit', label:'In Transit',   svgPath:'<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>' },
  { key:'delivered',  label:'Delivered',    svgPath:'<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/>' }
];

function buildProgressTracker(status) {
  if (status === 'rejected') {
    return `<div style="background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;font-size:13px;font-weight:700;color:#dc2626;">✕ Order Rejected</div>`;
  }
  var statusOrder = ['pending','accepted','in_transit','delivered'];
  var curIdx = statusOrder.indexOf(status);
  var html = '<div class="progress-tracker">';
  PROGRESS_STEPS.forEach((step, i) => {
    var done   = i < curIdx;
    var active = i === curIdx;
    var circleBg     = done ? '#16a34a' : active ? '#fff' : '#f1f5f9';
    var circleBorder = done || active ? '#16a34a' : '#cbd5e1';
    var iconColor    = done ? '#fff' : active ? '#16a34a' : '#94a3b8';
    var labelColor   = done || active ? '#1e293b' : '#94a3b8';
    var labelWeight  = active ? '700' : '500';
    var inner = done
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2">${step.svgPath}</svg>`;
    html += `<div class="prog-step">
      <div class="prog-circle" style="background:${circleBg};border:2.5px solid ${circleBorder};">${inner}</div>
      <div class="prog-label" style="color:${labelColor};font-weight:${labelWeight};">${step.label}</div>
    </div>`;
    if (i < PROGRESS_STEPS.length - 1) {
      var lineColor = done ? '#16a34a' : '#e2e8f0';
      html += `<div class="prog-line" style="background:${lineColor};"></div>`;
    }
  });
  html += '</div>';
  return html;
}

// ── Init ───────────────────────────────────────────────
async function init() {
  document.querySelector('#soTable thead tr').innerHTML =
    COLS.map(c => `<th>${c}</th>`).join('');

  const [cr, sr] = await Promise.all([
    fetch('/manager/api/customers-dropdown').then(r => r.json()),
    fetch('/manager/api/sites?dropdown=1').then(r => r.json())
  ]);

  allCustomers = cr.items || [];
  allSites = sr.items || [];

  var custEl = document.getElementById('soCustomer');
  allCustomers.forEach(c => {
    custEl.innerHTML += `<option value="${c.customer_id}">${c.customer_id}</option>`;
  });

  filterSites();
  await load(1);
}

// ── Site filter ────────────────────────────────────────
function filterSites() {
  var siteEl = document.getElementById('soSite');

  siteEl.innerHTML =
    '<option value="">— Select Site —</option>' +
    allSites.map(s =>
      `<option value="${s.site_id}">
        ${s.site_id} – ${s.site_name}
      </option>`
    ).join('');

  document.getElementById('productsContainer').innerHTML = '';
  document.getElementById('orderTotal').textContent = '0.00';
  document.getElementById('siteMsg').textContent = '';

  window._siteInv = [];
  rowCount = 0;
}

async function onSiteChange() {
  var siteId = document.getElementById('soSite').value;
  document.getElementById('productsContainer').innerHTML = '';
  document.getElementById('orderTotal').textContent = '0.00';
  rowCount = 0;
  if (!siteId) { document.getElementById('siteMsg').textContent = ''; return; }
  document.getElementById('siteMsg').textContent = 'Loading inventory…';
  var d = await fetch('/manager/api/inventory-by-site?site_id=' + siteId).then(r => r.json());
  window._siteInv = d.items || [];
  if (!window._siteInv.length) { document.getElementById('siteMsg').textContent = '⚠ No stock at this site.'; return; }
  document.getElementById('siteMsg').textContent = window._siteInv.length + ' products available.';
  addProductRow();
}

function addProductRow() {
  var inv = window._siteInv || [];
  if (!inv.length) { showToast('Select a site first.','warning'); return; }
  rowCount++;
  var idx = rowCount;
  var prodOpts = inv.map(i => {
    var price = i.has_promo ? i.discounted_price : i.unit_price;
    return `<option value="${i.product_id}" data-price="${price}" data-stock="${i.ending_inventory}">${i.label || i.product_id} (Stock: ${i.ending_inventory})</option>`;
  }).join('');
  var div = document.createElement('div');
  div.className = 'product-row'; div.id = 'pr' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 80px 1fr 30px;gap:8px;align-items:end;padding:9px 0;border-bottom:1px solid #f1f5f9;';
  div.innerHTML = `
    <div><label style="font-size:11px;color:#64748b;font-weight:600;">Product</label>
    <select class="form-control" onchange="onProdChange(this)"><option value="">— Select —</option>${prodOpts}</select></div>
    <div><label style="font-size:11px;color:#64748b;font-weight:600;">Qty</label>
    <input type="number" class="form-control" min="1" value="1" oninput="calcTotal()"/></div>
    <div><label style="font-size:11px;color:#64748b;font-weight:600;">Line Total</label>
    <input type="text" class="form-control" readonly style="background:#f0f9ff;font-weight:700;color:#0284c7;"/></div>
    <div><label style="font-size:11px;">&nbsp;</label>
    <button type="button" class="btn btn-danger btn-sm" style="width:100%;padding:8px 4px;" onclick="removeRow('pr${idx}')">✕</button></div>`;
  document.getElementById('productsContainer').appendChild(div);
  calcTotal();
}

function onProdChange(sel) {
  calcTotal();
}
function removeRow(id) { var el = document.getElementById(id); if (el) { el.remove(); calcTotal(); } }
function calcTotal() {
  var total = 0;
  document.querySelectorAll('.product-row').forEach(function (row) {
    var sel = row.querySelector('select');
    var qty = parseInt(row.querySelector('input[type="number"]').value) || 0;
    var opt = sel.options[sel.selectedIndex];
    var price = opt && opt.value ? parseFloat(opt.dataset.price || 0) : 0;
    var line = Math.round(price * qty * 100) / 100;
    var amtEl = row.querySelector('input[readonly]');
    if (amtEl) amtEl.value = line > 0 ? '₹' + line.toFixed(2) : '';
    total += line;
  });
  var totEl = document.getElementById('orderTotal');
  if (totEl) totEl.textContent = total.toFixed(2);
}

async function submitOrder() {
  hideAlert('cAlert');
  var custId = document.getElementById('soCustomer').value;
  var siteId = document.getElementById('soSite').value;
  if (!custId || !siteId) { showAlert('cAlert', 'Select customer and site.', 'error'); return; }
  var items = []; var valid = true;
  document.querySelectorAll('.product-row').forEach(function (row) {
    var sel = row.querySelector('select');
    var pid = sel.value;
    var qty = parseInt(row.querySelector('input[type="number"]').value) || 0;
    var opt = sel.options[sel.selectedIndex];
    var stock = pid ? parseInt(opt.dataset.stock || 0) : 0;
    if (pid && qty > 0) {
      if (qty > stock) { valid = false; showAlert('cAlert', 'Qty for ' + pid + ' exceeds stock (' + stock + ').', 'error'); }
      else items.push({ product_id: pid, quantity: qty, unit_price: parseFloat(opt.dataset.price || 0) });
    }
  });
  if (!items.length) { showAlert('cAlert', 'Add at least one product.', 'error'); return; }
  if (!valid) return;
  var btn = document.getElementById('cBtn'); btn.disabled = true; btn.textContent = 'Placing…';
  try {
    var res = await fetch('/manager/api/sales-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_id: custId, site_id: siteId, items: items }) });
    var d = await res.json();
    if (d.ok) { closeModal('createModal'); resetForm(); load(1); showToast('Sales order placed successfully.', 'success'); }
    else showAlert('cAlert', friendlyError(d.error), 'error');
  } catch (er) { showAlert('cAlert', 'Unable to connect to server.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Place Order'; }
}

function resetForm() {
  document.getElementById('soCustomer').value = '';
  filterSites();
  document.getElementById('productsContainer').innerHTML = '';
  document.getElementById('orderTotal').textContent = '0.00';
  document.getElementById('siteMsg').textContent = '';
  window._siteInv = []; rowCount = 0;
}

// ── Load orders ────────────────────────────────────────
async function load(page) {
  curPage = page;
  var status = document.getElementById('fStatus').value;
  var search = (document.getElementById('search') || {}).value || '';
  var url = '/admin/api/sales-orders?page=' + page + (status ? '&status=' + status : '') + (search ? '&search=' + encodeURIComponent(search) : '');
  var d = await fetch(url).then(r => r.json());
  pageRecs = d.items || [];
  document.getElementById('subtitle').textContent = fmt(d.total || 0) + ' sales orders.';
  renderRows(pageRecs);
  document.getElementById('pgn').innerHTML = buildPagination(d, load);
}

function doSearch() { load(1); }
document.addEventListener('DOMContentLoaded', function () {
  var s = document.getElementById('search');
  if (s) s.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
});

// ── Render rows: View | Ref | Customer | Site | Status | Transhipment | Actions ──
function renderRows(items) {
  document.getElementById('tbody').innerHTML = items.length
    ? items.map(o => {
        // ── Transhipment column ──
        // Shows transport type if in_transit or delivered; select picker if accepted; — otherwise
        var transhipmentCell = '—';
        if (o.status === 'accepted') {
          // Show transport type selector + "Mark In Transit" button
          var tOpts = ['Road','Air','Rail','Sea'].map(t =>
            `<option value="${t}">${TRANSPORT_SVG[t].icon} ${t}</option>`
          ).join('');
          transhipmentCell = `
            <div style="display:flex;flex-direction:column;gap:5px;min-width:160px;">
              <select id="tp_${o.id}" class="form-control" style="font-size:11px;padding:4px 8px;height:auto;">
                ${tOpts}
              </select>
              <button class="btn-intransit" onclick="markInTransit(${o.id})">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/></svg>
                Mark In Transit
              </button>
            </div>`;
        } else if (o.status === 'in_transit') {
          transhipmentCell = transportBadge(o.transport_type || 'Road');
        } else if (o.status === 'delivered') {
          transhipmentCell = transportBadge(o.transport_type || 'Road');
        }

        // ── Actions column ──
        var actCell = '';
        if (o.status === 'pending') {
          actCell = `
            <div class="action-btns">
              <button class="btn btn-icon btn-icon-approve" title="Accept Order" onclick="actOrder(${o.id},'accept')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="btn btn-icon btn-icon-reject" title="Reject Order" onclick="actOrder(${o.id},'reject')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>`;
        } else if (o.status === 'accepted') {
          // No actions — user must choose transport & click Mark In Transit in the transhipment column
          actCell = `<span style="font-size:11px;color:#94a3b8;">Select transport →</span>`;
        } else if (o.status === 'in_transit') {
          actCell = `
            <button class="btn-deliver" onclick="markDelivered(${o.id})">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Delivered
            </button>`;
        } else if (o.status === 'delivered') {
          actCell = `<div class="action-btns">
            <span class="badge badge-success" style="font-size:11px;">✓ Complete</span>
          </div>`;
        } else if (o.status === 'rejected') {
          actCell = `<span class="badge badge-danger" style="font-size:11px;">✕ Rejected</span>`;
        }

        return `<tr>
          <td class="action-btns">
            <button class="btn btn-icon btn-icon-view" title="View Order Details" onclick="viewOrder(${o.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-icon" title="Download Invoice" style="background:#eff6ff;border:1.5px solid #bfdbfe;color:#2563eb;" onclick="downloadSOInvoice(${o.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </td>
          <td><strong style="color:#0284c7;">${o.order_ref}</strong></td>
          <td>${badge(o.customer_id, 'purple')}</td>
          <td>${badge(o.site_id, 'sky')}</td>
          <td>${statusBadgeSO(o.status)}</td>
          <td>${transhipmentCell}</td>
          <td>${actCell}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8;">No sales orders found.</td></tr>`;
}

// ── View order detail modal ────────────────────────────
async function viewOrder(id) {
  var o = pageRecs.find(x => x.id === id);
  if (!o) return;

  var itemRows = (o.items || []).map(i => `
    <tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:8px 10px;font-size:12px;">${i.product_id}</td>
      <td style="padding:8px 10px;font-size:12px;">${i.product_name}</td>
      <td style="padding:8px 10px;font-size:12px;text-align:center;">${fmt(i.quantity)}</td>
      <td style="padding:8px 10px;font-size:12px;">₹${fmt(i.unit_price, 2)}</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:700;">₹${fmt(i.line_total, 2)}</td>
    </tr>`).join('');

  document.getElementById('viewContent').innerHTML = `
    ${buildProgressTracker(o.status)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;background:#f8fafc;border-radius:10px;padding:14px;font-size:13px;">
      <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">ORDER REF</span><strong style="color:#0284c7;">${o.order_ref}</strong></div>
      <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">STATUS</span>${statusBadgeSO(o.status)}</div>
      <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">CUSTOMER</span>${badge(o.customer_id, 'purple')}</div>
      <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">SITE</span>${badge(o.site_id, 'sky')}</div>
      <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">PLACED BY</span>${o.placed_by} (${o.placed_by_role})</div>
      <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">DATE</span>${o.created_at}</div>
      ${o.note ? `<div style="grid-column:span 2;"><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:3px;">NOTE</span><span style="color:#dc2626;">${o.note}</span></div>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead style="background:#f0f9ff;"><tr>
        <th style="padding:8px 10px;text-align:left;font-size:11px;">Product ID</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;">Name</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;">Qty</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;">Unit Price</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="margin-top:10px;background:linear-gradient(135deg,#0284c7,#0369a1);color:#fff;padding:14px 20px;border-radius:10px;font-size:15px;font-weight:700;text-align:right;box-shadow:0 4px 12px rgba(2,132,199,.25);">
      Total: ₹${fmt(o.total_amount, 2)}
    </div>`;

  // Action buttons at bottom of modal
  var actDiv = document.getElementById('viewActions');
  if (o.status === 'pending') {
    actDiv.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal('viewModal')">Close</button>
      <button class="btn-invoice" onclick="downloadSOInvoice(${o.id})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Invoice
      </button>
      <button class="btn btn-danger" onclick="actOrder(${o.id},'reject')">✕ Reject</button>
      <button class="btn btn-success" onclick="actOrder(${o.id},'accept')">✓ Accept</button>`;
  } else if (o.status === 'accepted') {
    actDiv.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal('viewModal')">Close</button>
      <button class="btn-invoice" onclick="downloadSOInvoice(${o.id})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Invoice
      </button>
      <span style="font-size:12px;color:#64748b;">Choose transport → Mark In Transit</span>`;
  } else if (o.status === 'in_transit') {
    actDiv.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal('viewModal')">Close</button>
      <button class="btn-invoice" onclick="downloadSOInvoice(${o.id})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Invoice
      </button>
      <button class="btn btn-success" onclick="markDelivered(${o.id})">✓ Mark Delivered</button>`;
  } else {
    actDiv.innerHTML = `
      <button class="btn btn-outline" onclick="closeModal('viewModal')">Close</button>
      <button class="btn-invoice" onclick="downloadSOInvoice(${o.id})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Invoice
      </button>`;
  }

  openModal('viewModal');
}

// ── Accept / Reject ────────────────────────────────────
async function actOrder(id, action) {
  if (!confirm(action === 'accept' ? 'Accept this order?' : 'Reject this order?')) return;
  var note = action === 'reject' ? (prompt('Reason (optional):') || '') : '';
  var res = await fetch('/admin/api/sales-orders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, note: note }) });
  var d = await res.json();
  if (d.ok) { closeModal('viewModal'); load(curPage); showToast(action === 'accept' ? 'Order accepted.' : 'Order rejected.', 'success'); }
  else showToast(friendlyError(d.error, 'order'), 'error');
}

// ── Mark In Transit (from table transport picker) ──────
async function markInTransit(id) {
  var tpEl = document.getElementById('tp_' + id);
  var transport = tpEl ? tpEl.value : 'Road';
  if (!confirm('Mark as In Transit with transport: ' + transport + '?')) return;

  // First set transport on the linked logistics shipments
  var res = await fetch('/admin/api/sales-orders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'in_transit', transport_type: transport }) });
  var d = await res.json();
  if (d.ok) { load(curPage); showToast('Order marked In Transit via ' + transport + '.', 'success'); }
  else showToast(friendlyError(d.error, 'order'), 'error');
}

// ── Mark Delivered ─────────────────────────────────────
async function markDelivered(id) {
  if (!confirm('Mark as Delivered? Inventory will be updated.')) return;
  var res = await fetch('/admin/api/sales-orders/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delivered' }) });
  var d = await res.json();
  if (d.ok) { closeModal('viewModal'); load(curPage); showToast('Order delivered! Inventory updated.', 'success'); }
  else showToast(friendlyError(d.error, 'order'), 'error');
}


// ── Download Invoice ───────────────────────────────────
function downloadSOInvoice(id) {
  showToast('Generating invoice PDF…', 'success');
  var a = document.createElement('a');
  a.href = '/admin/api/invoices/sales-order/' + id;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

window.onload = init;
