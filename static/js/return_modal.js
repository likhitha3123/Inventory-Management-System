/**
 * return_modal.js — Shared Return Modal for Sales Orders & Purchase Orders
 * Usage: include after base.js, call openReturnModal('sales'|'purchase', apiBase)
 * apiBase: '/admin' or '/manager'
 */

(function() {

// ── Inject modal HTML once ──────────────────────────────
function ensureReturnModal() {
  if (document.getElementById('returnModal')) return;
  var el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-overlay" id="returnModal">
      <div class="modal" style="max-width:540px;">
        <div class="modal-header">
          <h3 class="modal-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-2px;margin-right:6px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            Process Return
          </h3>
          <button class="modal-close" onclick="closeModal('returnModal')">✕</button>
        </div>
        <div id="returnAlert" class="alert" style="display:none;"></div>

        <!-- Type badge -->
        <div id="returnTypeBadge" style="margin-bottom:14px;"></div>

        <!-- Step 1: Order dropdown -->
        <div class="form-group" id="returnStep1">
          <label class="form-label">Select Completed Order <span class="required-star">*</span></label>
          <select id="returnOrderSel" class="form-control" onchange="onReturnOrderChange()">
            <option value="">— Loading orders… —</option>
          </select>
          <div id="returnOrderInfo" style="display:none;margin-top:10px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:12px 14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;">
              <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:2px;">PRODUCT</span><span id="retProdName" style="font-weight:600;color:#1e293b;"></span></div>
              <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:2px;">ORDERED QTY</span><span id="retMaxQty" style="font-weight:700;color:#0284c7;font-size:14px;"></span></div>
              <div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:2px;">UNIT PRICE</span><span id="retUnitPrice" style="font-weight:600;color:#059669;"></span></div>
            </div>
          </div>
        </div>

        <!-- Step 2: Qty + reason -->
        <div id="returnStep2" style="display:none;">
          <div class="form-group">
            <label class="form-label">Return Quantity <span class="required-star">*</span></label>
            <input type="number" id="returnQty" class="form-control" min="1" placeholder="e.g. 5" oninput="calcReturnTotal()"/>
            <div style="margin-top:6px;font-size:11px;color:#64748b;" id="returnQtyHint"></div>
          </div>

          <!-- Live total preview -->
          <div id="returnTotalPreview" style="display:none;background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:10px;padding:14px 18px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:600;color:#93c5fd;">Return Total</span>
              <span id="returnTotalAmt" style="font-size:18px;font-weight:800;color:#fff;"></span>
            </div>
            <div id="returnEffect" style="font-size:11px;color:#60a5fa;margin-top:4px;"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Reason <span style="font-size:11px;font-weight:400;color:#94a3b8;">(optional)</span></label>
            <textarea id="returnReason" class="form-control" rows="3" placeholder="Damaged goods, wrong product, quality issue…" style="resize:vertical;"></textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-outline" onclick="closeModal('returnModal')">Cancel</button>
          <button class="btn btn-primary" id="returnSubmitBtn" onclick="submitReturn()" style="display:none;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            Process Return
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el.firstElementChild);
}

// ── Open modal ──────────────────────────────────────────
window.openReturnModal = function(orderType, apiBase) {
  ensureReturnModal();
  window._retType    = orderType;   // 'sales' | 'purchase'
  window._retApiBase = apiBase;     // '/admin' | '/manager'
  window._retOrders  = [];

  // Reset
  hideAlert('returnAlert');
  document.getElementById('returnOrderSel').innerHTML = '<option value="">Loading…</option>';
  document.getElementById('returnOrderInfo').style.display = 'none';
  document.getElementById('returnStep2').style.display = 'none';
  document.getElementById('returnSubmitBtn').style.display = 'none';
  document.getElementById('returnTotalPreview').style.display = 'none';
  if (document.getElementById('returnQty')) document.getElementById('returnQty').value = '';
  if (document.getElementById('returnReason')) document.getElementById('returnReason').value = '';

  // Type badge
  var isSales = orderType === 'sales';
  document.getElementById('returnTypeBadge').innerHTML = isSales
    ? '<div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:8px;padding:9px 14px;font-size:12px;color:#1d4ed8;font-weight:600;display:flex;align-items:center;gap:8px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Sales Order Return — returned stock will be added back to inventory</div>'
    : '<div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:8px;padding:9px 14px;font-size:12px;color:#c2410c;font-weight:600;display:flex;align-items:center;gap:8px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Purchase Order Return — stock will be removed from inventory</div>';

  openModal('returnModal');

  // Load orders
  fetch(apiBase + '/api/returns/delivered-orders?type=' + orderType)
    .then(r => r.json())
    .then(d => {
      window._retOrders = d.items || [];
      var sel = document.getElementById('returnOrderSel');
      if (!window._retOrders.length) {
        sel.innerHTML = '<option value="">No completed orders available</option>';
        return;
      }
      sel.innerHTML = '<option value="">— Select an order —</option>' +
        window._retOrders.map((o, i) =>
          `<option value="${i}">${o.label}</option>`
        ).join('');
    })
    .catch(() => {
      document.getElementById('returnOrderSel').innerHTML = '<option value="">Failed to load orders</option>';
    });
};

// ── Order selection change ──────────────────────────────
window.onReturnOrderChange = function() {
  var idx = document.getElementById('returnOrderSel').value;
  if (idx === '') {
    document.getElementById('returnOrderInfo').style.display = 'none';
    document.getElementById('returnStep2').style.display = 'none';
    document.getElementById('returnSubmitBtn').style.display = 'none';
    return;
  }
  var o = window._retOrders[parseInt(idx)];
  window._retSelected = o;

  document.getElementById('retProdName').textContent  = o.product_name || o.product_id;
  document.getElementById('retMaxQty').textContent    = o.quantity;
  document.getElementById('retUnitPrice').textContent = '₹' + (o.unit_price || 0).toFixed(2);
  document.getElementById('returnOrderInfo').style.display = 'block';
  document.getElementById('returnQtyHint').textContent = `Maximum returnable: ${o.quantity} units`;
  document.getElementById('returnQty').max = o.quantity;
  document.getElementById('returnQty').value = '';
  document.getElementById('returnTotalPreview').style.display = 'none';
  document.getElementById('returnStep2').style.display = 'block';
  document.getElementById('returnSubmitBtn').style.display = 'flex';
};

// ── Live total calc ─────────────────────────────────────
window.calcReturnTotal = function() {
  var o   = window._retSelected;
  var qty = parseInt(document.getElementById('returnQty').value) || 0;
  if (!o || qty <= 0) { document.getElementById('returnTotalPreview').style.display = 'none'; return; }
  var total = (o.unit_price || 0) * qty;
  document.getElementById('returnTotalAmt').textContent = '₹' + total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  var isSales = window._retType === 'sales';
  document.getElementById('returnEffect').textContent = isSales
    ? `+${qty} units returned to inventory  •  ₹${total.toFixed(2)} credited`
    : `-${qty} units removed from inventory  •  ₹${total.toFixed(2)} deducted`;
  document.getElementById('returnTotalPreview').style.display = 'block';
};

// ── Submit ──────────────────────────────────────────────
window.submitReturn = async function() {
  hideAlert('returnAlert');
  var o      = window._retSelected;
  var qty    = parseInt(document.getElementById('returnQty').value) || 0;
  var reason = document.getElementById('returnReason').value.trim();

  if (!o) { showAlert('returnAlert', 'Please select an order.', 'error'); return; }
  if (qty <= 0) { showAlert('returnAlert', 'Please enter a valid return quantity.', 'error'); return; }
  if (qty > o.quantity) { showAlert('returnAlert', `Return qty cannot exceed ${o.quantity}.`, 'error'); return; }

  var btn = document.getElementById('returnSubmitBtn');
  btn.disabled = true; btn.innerHTML = 'Processing…';

  try {
    var res = await fetch(window._retApiBase + '/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_type: window._retType,
        order_id:   o.order_id,
        product_id: o.product_id,
        return_qty: qty,
        reason:     reason
      })
    });
    var d = await res.json();
    if (d.ok) {
      closeModal('returnModal');
      showToast(d.message, 'success');
      // Refresh the current page table if load() exists
      if (typeof load === 'function') load(typeof curPage !== 'undefined' ? curPage : 1);
    } else {
      showAlert('returnAlert', friendlyError(d.error, 'return'), 'error');
    }
  } catch (e) {
    showAlert('returnAlert', 'Unable to connect to server. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> Process Return';
  }
};

})();
