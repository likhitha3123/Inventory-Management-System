var pageRecs = [], curPage = 1, curStatus = '';

async function load(page, status) {
  curPage   = page;
  curStatus = (status !== undefined ? status : curStatus);
  var url   = '/admin/api/messages?page=' + page;
  if (curStatus) url += '&status=' + curStatus;
  try {
    var res = await fetch(url);
    var d   = await res.json();
    pageRecs = d.items;
    document.getElementById('subtitle').textContent = fmt(d.total) + ' messages.';
    document.getElementById('sTotal').textContent   = d.total;
    document.getElementById('sPending').textContent = d.pending_count;
    fetchCounts();
    renderRows(d.items);
    document.getElementById('pgn').innerHTML = buildPagination(d, function(p){ load(p); });
  } catch(e) { console.error(e); }
}

async function fetchCounts() {
  try {
    var a = await fetch('/admin/api/messages?status=accepted&page=1');
    var ad = await a.json(); document.getElementById('sAccepted').textContent = ad.total;
    var r = await fetch('/admin/api/messages?status=rejected&page=1');
    var rd = await r.json(); document.getElementById('sRejected').textContent = rd.total;
  } catch(e) {}
}

// ── Update thead to match simplified fields ──────────
document.addEventListener('DOMContentLoaded', function() {
  var thead = document.querySelector('#msgTable thead tr, table thead tr');
  if (thead) thead.innerHTML = '<th>Date</th><th>Name</th><th>Email</th><th>Joining As</th><th>Status</th><th>Actions</th>';
});

function renderRows(items) {
  var tb = document.getElementById('tbody');
  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">No messages found.</td></tr>';
    return;
  }
  tb.innerHTML = items.map(function(m) {
    var statusBadgeHtml = m.status === 'pending'  ? badge('Pending','warning')
                        : m.status === 'accepted' ? badge('Accepted','success')
                        : badge('Rejected','danger');
    var joinBadge = m.join_type === 'customer'
      ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:14px;font-size:11px;font-weight:700;background:#dbeafe;color:#1e40af;">🛒 Customer</span>'
      : m.join_type === 'supplier'
      ? '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:14px;font-size:11px;font-weight:700;background:#d1fae5;color:#065f46;">🏭 Supplier</span>'
      : '—';
    return '<tr id="mr-'+m.id+'">' +
      '<td style="font-size:12px;color:#64748b;">' + m.created_at.substring(0,10) + '</td>' +
      '<td><strong>' + m.first_name + ' ' + m.last_name + '</strong></td>' +
      '<td><a href="mailto:' + m.email + '" style="color:#0284c7;font-size:12px;">' + m.email + '</a></td>' +
      '<td>' + joinBadge + '</td>' +
      '<td>' + statusBadgeHtml + '</td>' +
      '<td class="action-btns">' +
        '<button class="btn btn-icon btn-icon-view" title="View Message" onclick="viewMsg('+JSON.stringify(m).replace(/"/g,'&quot;')+')">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</button>' +
        (m.status === 'pending'
          ? '<button class="btn btn-icon btn-icon-approve" title="Accept" onclick="doAction('+m.id+',\'accepted\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
            '</button>' +
            '<button class="btn btn-icon btn-icon-reject" title="Reject" onclick="doAction('+m.id+',\'rejected\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>' : '') +
        '<button class="btn btn-icon btn-icon-reply" title="Reply by Email" onclick="openReply('+JSON.stringify(m).replace(/"/g,'&quot;')+')">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>' +
        '</button>' +
      '</td></tr>';
  }).join('');
}

document.getElementById('search').addEventListener('input', function() {
  renderRows(clientSearch(pageRecs, this.value));
});

function filterMsgs(status) {
  curStatus = status;
  document.querySelectorAll('.page-actions .btn').forEach(b => b.classList.remove('filter-btn-active'));
  var map = {'':'filterAll','pending':'filterPending','accepted':'filterAccepted','rejected':'filterRejected'};
  var el = document.getElementById(map[status]);
  if (el) el.classList.add('filter-btn-active');
  load(1, status);
}

// ── View modal ─────────────────────────────────────────
function viewMsg(m) {
  var joinHtml = m.join_type === 'customer'
    ? '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dbeafe;color:#1e40af;">🛒 Customer</span>'
    : m.join_type === 'supplier'
    ? '<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#d1fae5;color:#065f46;">🏭 Supplier</span>'
    : '—';

  document.getElementById('msgDetail').innerHTML =
    '<div style="padding:0 0 14px;">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:14px;">' +
      '<div><div style="font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:4px;">FROM</div>' +
        '<div style="font-size:15px;font-weight:700;color:#1e293b;">' + m.first_name + ' ' + (m.last_name||'') + '</div>' +
        '<div style="font-size:12px;color:#0284c7;margin-top:2px;"><a href="mailto:'+m.email+'" style="color:#0284c7;">' + m.email + '</a></div></div>' +
      '<div><div style="font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:4px;">JOINING AS</div>' +
        joinHtml +
        '<div style="margin-top:10px;"><div style="font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:3px;">DATE</div>' +
        '<div style="font-size:12px;color:#64748b;">' + m.created_at + '</div></div></div>' +
    '</div>' +
    '<div style="font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:.4px;">Message</div>' +
    '<div style="font-size:14px;color:#334155;line-height:1.75;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;white-space:pre-wrap;">' + m.message + '</div>' +
    '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;font-size:13px;">Status: ' +
      (m.status==='pending' ? badge('Pending','warning') : m.status==='accepted' ? badge('Accepted','success') : badge('Rejected','danger')) +
    '</div></div>';

  var actDiv = document.getElementById('msgActions');
  if (m.status === 'pending') {
    actDiv.innerHTML =
      '<button class="btn btn-outline" onclick="closeModal(\'viewModal\')">Close</button>' +
      '<button class="btn btn-danger" onclick="doAction('+m.id+',\'rejected\')">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject' +
      '</button>' +
      '<button class="btn btn-primary" onclick="doAction('+m.id+',\'accepted\')">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Accept' +
      '</button>';
  } else {
    actDiv.innerHTML =
      '<button class="btn btn-outline" onclick="closeModal(\'viewModal\')">Close</button>' +
      '<button class="btn btn-reply" onclick="openReply('+JSON.stringify(m).replace(/"/g,'&quot;')+')" style="background:#7c3aed;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg> Reply by Email' +
      '</button>';
  }
  openModal('viewModal');
}

// ── Accept / Reject ────────────────────────────────────
async function doAction(id, status) {
  try {
    var res = await fetch('/admin/api/messages/'+id, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({status: status})
    });
    var d = await res.json();
    if (res.ok) {
      closeModal('viewModal');
      load(curPage);
      loadNotifications();
      showToast(status==='accepted' ? 'Message accepted.' : 'Message rejected.', 'success');
    } else { showToast(friendlyError(d.error), 'error'); }
  } catch(e) { showToast('Unable to connect to server.', 'error'); }
}

// ── Reply modal ────────────────────────────────────────
function openReply(m) {
  if (typeof m === 'string') m = JSON.parse(m);
  closeModal('viewModal');
  if (!document.getElementById('replyModal')) {
    var el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-overlay" id="replyModal">
        <div class="modal" style="max-width:520px;">
          <div class="modal-header">
            <h3 class="modal-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-2px;margin-right:6px;"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
              Reply to Message
            </h3>
            <button class="modal-close" onclick="closeModal('replyModal')">✕</button>
          </div>
          <div id="replyAlert" class="alert" style="display:none;"></div>
          <div id="replyMeta" style="background:#f8fafc;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:13px;"></div>
          <div class="form-group">
            <label class="form-label">Your Reply <span class="required-star">*</span></label>
            <textarea id="replyText" class="form-control" rows="6" placeholder="Write your reply…" style="resize:vertical;min-height:120px;"></textarea>
          </div>
          <div style="background:#eff6ff;border-radius:8px;padding:9px 13px;margin-bottom:14px;font-size:11px;color:#1d4ed8;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            This reply will be sent to the sender's email address.
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-outline" onclick="closeModal('replyModal')">Cancel</button>
            <button class="btn btn-primary" id="replyBtn" onclick="sendReply()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send Reply
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el.firstElementChild);
  }
  window._replyMsgId = m.id;
  document.getElementById('replyMeta').innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
    '<div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:2px;">TO</span>' +
    '<strong>' + m.first_name + ' ' + m.last_name + '</strong><br>' +
    '<span style="color:#0284c7;font-size:12px;">' + m.email + '</span></div>' +
    '<div><span style="font-size:10px;color:#94a3b8;font-weight:700;display:block;margin-bottom:2px;">REGARDING</span>' +
    '<span style="font-size:12px;">' + (m.join_type==='customer'?'Customer enquiry':'Supplier enquiry') + '</span></div></div>';
  document.getElementById('replyText').value = '';
  hideAlert('replyAlert');
  openModal('replyModal');
}

async function sendReply() {
  var text = document.getElementById('replyText').value.trim();
  if (!text) { setFieldError(document.getElementById('replyText'), 'Reply message is required.'); return; }
  var btn = document.getElementById('replyBtn');
  btn.disabled = true; btn.innerHTML = 'Sending…';
  try {
    var res = await fetch('/admin/api/messages/' + window._replyMsgId + '/reply', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reply: text})
    });
    var d = await res.json();
    if (d.ok) { closeModal('replyModal'); showToast('Reply sent to sender\'s email.','success'); }
    else showAlert('replyAlert', friendlyError(d.error), 'error');
  } catch(e) { showAlert('replyAlert','Unable to connect to server. Please try again.','error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Reply';
  }
}

load(1, '');
