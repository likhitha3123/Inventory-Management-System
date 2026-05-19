// ── Active nav link ────────────────────────────────────
(function(){
  var seg = window.location.pathname.split('/').filter(Boolean).pop();
  document.querySelectorAll('.nav-link[data-page]').forEach(function(a){
    if(a.dataset.page === seg) a.classList.add('active');
  });
})();

// ── Mobile Sidebar Toggle ─────────────────────────────
(function(){
  var toggle  = document.getElementById('sidebarToggle');
  var sidebar = document.querySelector('.sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  if(!toggle || !sidebar) return;
  function openSidebar(){ sidebar.classList.add('open'); if(overlay) overlay.classList.add('show'); }
  function closeSidebar(){ sidebar.classList.remove('open'); if(overlay) overlay.classList.remove('show'); }
  toggle.addEventListener('click', function(){ sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); });
  if(overlay) overlay.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-link').forEach(function(a){
    a.addEventListener('click', function(){ if(window.innerWidth<=768) closeSidebar(); });
  });
})();

// ── Number formatter ──────────────────────────────────
function fmt(n, dec){
  if(n===null||n===undefined) return '—';
  return Number(n).toLocaleString('en-IN',{minimumFractionDigits:dec||0,maximumFractionDigits:dec||0});
}

// ── Badge helper ──────────────────────────────────────
function badge(text, cls){
  return '<span class="badge badge-'+cls+'">'+text+'</span>';
}
function statusBadge(s){
  if(s==='Active'||s==='Delivered'||s==='In Stock') return badge(s,'success');
  if(s==='Inactive'||s==='Cancelled'||s==='Stockout') return badge(s,'danger');
  return badge(s,'warning');
}

// ── Pagination builder ────────────────────────────────
function buildPagination(data, fn){
  if(!data||data.pages<=1) return '';
  var h='<div class="pagination">';
  if(data.has_prev) h+='<button class="page-btn" data-p="'+(data.page-1)+'">&#8249;</button>';
  for(var p=1;p<=data.pages;p++){
    if(p===1||p===data.pages||(p>=data.page-2&&p<=data.page+2)){
      h+='<button class="page-btn'+(p===data.page?' active':'')+'" data-p="'+p+'">'+p+'</button>';
    } else if(p===data.page-3||p===data.page+3){
      h+='<span class="page-btn" style="cursor:default">…</span>';
    }
  }
  if(data.has_next) h+='<button class="page-btn" data-p="'+(data.page+1)+'">&#8250;</button>';
  h+='</div>';
  setTimeout(function(){
    document.querySelectorAll('.pagination .page-btn[data-p]').forEach(function(b){
      b.addEventListener('click',function(){ fn(Number(b.dataset.p)); });
    });
  },0);
  return h;
}

// ── Client-side search ────────────────────────────────
function clientSearch(rows, q){
  if(!q) return rows;
  q=q.toLowerCase();
  return rows.filter(function(r){
    return Object.values(r).some(function(v){ return v!==null&&v!==undefined&&String(v).toLowerCase().indexOf(q)!==-1; });
  });
}

// ── Modal open/close ──────────────────────────────────
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

// ── Alert helpers ─────────────────────────────────────
function showAlert(id, text, type){
  var el=document.getElementById(id);
  if(!el) return;
  el.textContent=text; el.className='alert alert-'+(type||'error'); el.style.display='flex';
  el.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function hideAlert(id){
  var el=document.getElementById(id); if(el) el.style.display='none';
}

// ── Field-level validation helpers ───────────────────
function setFieldError(inputEl, message) {
  if (!inputEl) return;
  inputEl.classList.add('field-error');
  var wrapper = inputEl.closest('.form-group') || inputEl.parentElement;
  var existing = wrapper.querySelector('.field-error-msg');
  if (existing) existing.remove();
  var msg = document.createElement('div');
  msg.className = 'field-error-msg';
  msg.textContent = message;
  wrapper.appendChild(msg);
}
function clearFieldError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('field-error');
  var wrapper = inputEl.closest('.form-group') || inputEl.parentElement;
  var existing = wrapper.querySelector('.field-error-msg');
  if (existing) existing.remove();
}
function clearAllFieldErrors(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('.field-error').forEach(function(el){ el.classList.remove('field-error'); });
  formEl.querySelectorAll('.field-error-msg').forEach(function(el){ el.remove(); });
}

// ── Validation rules ─────────────────────────────────
var INV_VALIDATORS = {
  required: function(val) {
    return (val === null || val === undefined || String(val).trim() === '') ? 'This field is required.' : null;
  },
  minLength: function(min) {
    return function(val) {
      return (val && val.trim().length < min) ? 'Must be at least '+min+' characters.' : null;
    };
  },
  maxLength: function(max) {
    return function(val) {
      return (val && val.trim().length > max) ? 'Cannot exceed '+max+' characters.' : null;
    };
  },
  email: function(val) {
    if (!val) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) ? null : 'Please enter a valid email address (e.g. user@example.com).';
  },
  phone: function(val) {
    if (!val) return null;
    return /^[\d\s\+\-\(\)]{7,15}$/.test(val.trim()) ? null : 'Please enter a valid phone number.';
  },
  positiveNumber: function(val) {
    if (val === '' || val === null || val === undefined) return null;
    return (!isNaN(val) && Number(val) >= 0) ? null : 'Please enter a valid positive number.';
  },
  nonZeroNumber: function(val) {
    if (val === '' || val === null || val === undefined) return null;
    return (!isNaN(val) && Number(val) > 0) ? null : 'Please enter a number greater than zero.';
  },
  dateRange: function(startId, endId) {
    return function() {
      var s = document.getElementById(startId), e = document.getElementById(endId);
      if (!s || !e || !s.value || !e.value) return null;
      return new Date(s.value) <= new Date(e.value) ? null : 'End date must be after start date.';
    };
  }
};

// ── Validate a form using rules map ──────────────────
// rules: { fieldId: [validator1, validator2, ...] }
function validateForm(formEl, rules) {
  clearAllFieldErrors(formEl);
  var valid = true;
  var firstError = null;
  Object.keys(rules).forEach(function(fieldId) {
    var el = document.getElementById(fieldId);
    var val = el ? (el.value || '') : '';
    var fieldRules = rules[fieldId];
    for (var i = 0; i < fieldRules.length; i++) {
      var rule = fieldRules[i];
      var error = typeof rule === 'function' ? rule(val) : null;
      if (error) {
        setFieldError(el, error);
        if (!firstError) firstError = el;
        valid = false;
        break;
      }
    }
  });
  if (firstError) {
    firstError.focus();
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return valid;
}

// ── Auto-clear field errors on input ─────────────────
document.addEventListener('input', function(e) {
  if (e.target.classList.contains('field-error')) {
    clearFieldError(e.target);
  }
});
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('field-error')) {
    clearFieldError(e.target);
  }
});

// ── Human-friendly error translator ──────────────────
function friendlyError(raw, context) {
  if (!raw) return 'Something went wrong. Please try again.';
  var r = String(raw).toLowerCase();
  context = context || '';

  // Foreign key / dependency errors
  if (r.includes('foreign key') || r.includes('referenced') || r.includes('violates') || r.includes('constraint')) {
    if (context === 'site' || r.includes('site')) {
      return 'This site cannot be deleted because it has linked inventory, products, or orders. Please remove those records first.';
    }
    if (context === 'product' || r.includes('product')) {
      return 'This product cannot be deleted because it is used in inventory, orders, or promotions. Remove those records first.';
    }
    if (context === 'supplier' || r.includes('supplier')) {
      return 'This supplier cannot be deleted because they have associated products or purchase orders.';
    }
    if (context === 'customer' || r.includes('customer')) {
      return 'This customer cannot be deleted because they have existing orders on record.';
    }
    if (context === 'promotion' || r.includes('promotion')) {
      return 'This promotion cannot be removed because it is linked to active orders.';
    }
    if (context === 'user' || r.includes('user')) {
      return 'This user cannot be deleted because they have associated records in the system.';
    }
    return 'This record cannot be deleted because it is referenced by other data in the system. Please remove related records first.';
  }

  // Duplicate / unique constraint
  if (r.includes('unique') || r.includes('duplicate') || r.includes('already exists')) {
    if (r.includes('email')) return 'This email address is already registered. Please use a different email.';
    if (r.includes('name')) return 'A record with this name already exists. Please use a unique name.';
    if (r.includes('phone')) return 'This phone number is already in use.';
    return 'A duplicate entry was detected. This record already exists.';
  }

  // Not found
  if (r.includes('not found') || r.includes('does not exist') || r.includes('no such')) {
    return 'The requested record was not found. It may have been deleted.';
  }

  // Permission / auth errors
  if (r.includes('unauthorized') || r.includes('permission') || r.includes('forbidden') || r.includes('access denied')) {
    return 'You do not have permission to perform this action. Contact your administrator.';
  }

  // Network
  if (r.includes('network') || r.includes('fetch') || r.includes('connection')) {
    return 'Unable to connect to the server. Please check your internet connection and try again.';
  }

  // Timeout
  if (r.includes('timeout') || r.includes('timed out')) {
    return 'The request took too long. Please try again in a moment.';
  }

  // Stock / inventory
  if (r.includes('stock') || r.includes('quantity') || r.includes('inventory')) {
    return 'Insufficient stock available for this operation.';
  }

  // Date errors
  if (r.includes('date') || r.includes('invalid date')) {
    return 'Please enter a valid date.';
  }

  // Return cleaned-up version of the original if no match
  // Remove SQL/technical noise
  var clean = raw.replace(/\(ProgrammingError\).*|DETAIL:.*|LINE \d+.*|psycopg.*|sqlalchemy.*|Error\s*:/gi, '').trim();
  return clean || 'An unexpected error occurred. Please try again.';
}

// ── Confirm delete + fetch DELETE (friendly errors) ──
async function doDelete(url, onSuccess, context) {
  if(!confirm('Are you sure you want to delete this record? This action cannot be undone.')) return;
  try{
    var res = await fetch(url, {method:'DELETE'});
    var d = await res.json();
    if(res.ok && d.ok !== false){
      onSuccess && onSuccess();
      showToast('Record deleted successfully.', 'success');
    } else {
      var msg = friendlyError(d.error || d.message || 'Delete failed.', context);
      showToast(msg, 'error');
    }
  }catch(e){
    showToast('Unable to connect to server. Please try again.', 'error');
  }
}

// ── Toast notification ────────────────────────────────
function showToast(msg, type) {
  var existing = document.getElementById('invToast');
  if (existing) existing.remove();
  var t = document.createElement('div');
  t.id = 'invToast';
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:14px 20px;border-radius:10px;'+
    'font-size:13px;font-weight:500;max-width:380px;box-shadow:0 8px 24px rgba(0,0,0,.15);'+
    'display:flex;align-items:center;gap:10px;animation:slideInToast .3s ease;';
  if (type === 'success') {
    t.style.background = '#f0fdf4'; t.style.color = '#166534'; t.style.border = '1px solid #bbf7d0';
    t.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' + msg;
  } else if (type === 'warning') {
    t.style.background = '#fffbeb'; t.style.color = '#92400e'; t.style.border = '1px solid #fde68a';
    t.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' + msg;
  } else {
    t.style.background = '#fef2f2'; t.style.color = '#991b1b'; t.style.border = '1px solid #fecaca';
    t.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' + msg;
  }
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.remove(); }, 5000);
}

// ── Notification Bell ──────────────────────────────────
async function loadNotifications(){
  try{
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 8000);
    var res = await fetch('/admin/api/notifications', {
      signal: controller.signal });
    clearTimeout(timeout);
    if(!res.ok) return;
    var d = await res.json();
    var res = await fetch('/admin/api/notifications');
    if(!res.ok) return;
    var d = await res.json();
    var count = d.pending_count;
    var dot = document.getElementById('notifDot');
    if(dot) dot.style.display = count > 0 ? 'block' : 'none';
    var badge_el = document.getElementById('msgBadge');
    if(badge_el){
      if(count > 0){ badge_el.textContent = count; badge_el.style.display = 'inline'; }
      else { badge_el.style.display = 'none'; }
    }
    var list = document.getElementById('notifList');
    if(list){
      if(d.recent.length === 0){
        list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:#94a3b8;">No pending messages</div>';
      } else {
        list.innerHTML = d.recent.map(function(m){
          return '<div style="padding:11px 16px;border-bottom:1px solid #f8fafc;cursor:pointer;" onclick="window.location=\'/admin/messages\'">'+
            '<div style="font-size:13px;font-weight:600;color:#1e293b;">'+m.first_name+' '+m.last_name+'</div>'+
            '<div style="font-size:12px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+m.message.substring(0,60)+'</div>'+
            '<div style="font-size:11px;color:#94a3b8;margin-top:3px;">'+m.created_at.substring(0,10)+'</div>'+
          '</div>';
        }).join('');
      }
    }
  }catch(e){
  console.error('Notification Error:', e);
}
}

function toggleNotifPanel(){
  var panel = document.getElementById('notifPanel');
  if(!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e){
  var btn   = document.getElementById('notifBtn');
  var panel = document.getElementById('notifPanel');
  if(panel && btn && !btn.contains(e.target) && !panel.contains(e.target)){
    panel.style.display = 'none';
  }
});

if(window.location.pathname.startsWith('/admin')){
  loadNotifications();
  setInterval(loadNotifications, 30000);
}

// ── Toast animation CSS injection ────────────────────
(function(){
  var s = document.createElement('style');
  s.textContent = '@keyframes slideInToast{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}'+
    '.field-error{border-color:#ef4444!important;background:#fff5f5!important;}'+
    '.field-error-msg{color:#ef4444;font-size:11.5px;margin-top:4px;display:flex;align-items:center;gap:4px;}'+
    '.field-error-msg::before{content:"⚠";font-size:11px;}'+
    '.form-label .required-star{color:#ef4444;margin-left:2px;}';
  document.head.appendChild(s);
})();

// ── Universal Detail Modal ─────────────────────────────
// Inject modal HTML on first call
function _ensureDetailModal() {
  if (document.getElementById('_detailModal')) return;
  var el = document.createElement('div');
  el.innerHTML = `
    <div class="modal-overlay" id="_detailModal">
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <h3 class="modal-title" id="_detailTitle">Details</h3>
          <button class="modal-close" onclick="closeDetailModal()">✕</button>
        </div>
        <div id="_detailBody"></div>
      </div>
    </div>
    <style>
      .detail-grid{display:flex;flex-direction:column;gap:0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;}
      .dg-row{display:grid;grid-template-columns:140px 1fr;gap:12px;padding:9px 14px;border-bottom:1px solid #f1f5f9;font-size:13px;}
      .dg-row:last-child{border-bottom:none;}
      .dg-row:nth-child(even){background:#f8fafc;}
      .dg-label{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;padding-top:2px;}
      .dg-val{color:#1e293b;font-size:13px;}
    </style>`;
  document.body.appendChild(el.firstElementChild);
  // inject style
  var style = el.querySelector('style');
  if (style) document.head.appendChild(style);
}

function showDetailModal(title, bodyHtml) {
  _ensureDetailModal();
  document.getElementById('_detailTitle').textContent = title;
  document.getElementById('_detailBody').innerHTML = bodyHtml;
  openModal('_detailModal');
}
function closeDetailModal() { closeModal('_detailModal'); }
