var allUsers = [];
var curSearch = '';
var editMode = false;
var editId = null;
var allStates = [];

var COLS = ['Name', 'Email', 'Role', 'Status', 'Actions'];

function roleBadge(r) {
  var cfg = {
    analyst: { bg: '#ede9fe', color: '#5b21b6' },
    manager: { bg: '#dbeafe', color: '#1e40af' }
  };
  var c = cfg[r] || { bg: '#f1f5f9', color: '#475569' };
  var icons = { analyst: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>', manager: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' };
  var icon = icons[r] || '';
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:700;background:${c.bg};color:${c.color};">${icon} ${r}</span>`;
}

async function load() {
  var url = '/admin/api/users' + (curSearch ? '?search=' + curSearch : '');
  var [users, states] = await Promise.all([
    fetch(url).then(r => r.json()),
    fetch('/admin/api/states').then(r => r.json())
  ]);
  allUsers = users;
  allStates = states;
  renderTable();
  renderStats();
}

function renderStats() {
  document.getElementById('statAnalysts').textContent = allUsers.filter(u => u.role === 'analyst').length;
  document.getElementById('statManagers').textContent = allUsers.filter(u => u.role === 'manager').length;
  var allocated = allUsers.filter(u => u.role === 'manager' && u.state_id).length;
  document.getElementById('statStates').textContent = allocated;
  document.getElementById('statAvail').textContent = allStates.length - allocated;
}

function renderTable() {
  document.querySelector('#anaTable thead tr').innerHTML = COLS.map(c => `<th>${c}</th>`).join('');
  document.getElementById('anaTbody').innerHTML = allUsers.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.is_first_login ? '<span class="badge badge-warning">Pending</span>' : '<span class="badge badge-success">Active</span>'}</td>
      <td class="action-btns">
        <button class="btn btn-icon btn-icon-edit" title="Edit User" onclick="openEdit(${u.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn btn-icon btn-icon-delete" title="Delete User" onclick="deleteUser(${u.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function doSearch() {
  curSearch = document.getElementById('anaSearch').value;
  load();
}

function openCreate() {
  editMode = false; editId = null;
  document.getElementById('modalTitle').textContent = "Add User";
  document.getElementById('createForm').reset();
  clearAllFieldErrors(document.getElementById('createForm'));
  hideAlert('uAlert');
  document.getElementById('stateWrap').style.display = 'none';
  openModal('userModal');
}

function openEdit(id) {
  var u = allUsers.find(x => x.id === id);
  if (!u) return;
  editMode = true; editId = id;
  document.getElementById('modalTitle').textContent = "Edit User";
  document.getElementById('cName').value = u.name;
  document.getElementById('cEmail').value = u.email;
  document.getElementById('cRole').value = u.role;
  clearAllFieldErrors(document.getElementById('createForm'));
  hideAlert('uAlert');
  toggleState();
  loadStates(u.state_id);
  openModal('userModal');
}

function toggleState() {
  var role = document.getElementById('cRole').value;
  document.getElementById('stateWrap').style.display = (role === 'manager') ? 'block' : 'none';
}

document.getElementById('createForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var name  = document.getElementById('cName').value.trim();
  var email = document.getElementById('cEmail').value.trim();
  var role  = document.getElementById('cRole').value;
  var state = document.getElementById('cState').value;

  var rules = {
    'cName':  [INV_VALIDATORS.required, INV_VALIDATORS.minLength(2)],
    'cEmail': [INV_VALIDATORS.required, INV_VALIDATORS.email],
    'cRole':  [INV_VALIDATORS.required],
  };
  if (role === 'manager') rules['cState'] = [INV_VALIDATORS.required];
  var valid = validateForm(this, rules);
  if (!valid) return;
  hideAlert('uAlert');

  var url, method, body;
  if (editMode) {
    url = '/admin/api/users/' + editId; method = 'PUT';
    body = { name, email, role, state_id: state };
  } else {
    url = '/admin/api/users'; method = 'POST';
    body = role === 'manager' ? { name, email, role, state_id: state } : { name, email, role };
  }

  var btn = this.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = 'Saving…';
  try {
    var res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    var d = await res.json();
    if (d.error) { showAlert('uAlert', friendlyError(d.error, 'user'), 'error'); return; }
    closeModal('userModal');
    load();
    if (d.email_sent === true) showToast('User saved & welcome email sent.', 'success');
    else if (d.email_sent === false) showToast('User saved. Email could not be sent.', 'warning');
    else showToast('User saved successfully.', 'success');
  } catch(er) { showAlert('uAlert','Unable to connect to server. Please try again.','error'); }
  finally { btn.disabled = false; btn.textContent = editMode ? 'Save Changes' : 'Add User'; }
});

async function deleteUser(id) {
  await doDelete('/admin/api/users/'+id, function(){ load(); }, 'user');
}

async function loadStates(selectedId) {
  try {
    var res = await fetch('/admin/api/states');
    var states = await res.json();
    var dropdown = document.getElementById('cState');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">Select State</option>';
    states.forEach(s => {
      var disabled = (s.taken && s.id != selectedId) ? 'disabled' : '';
      var selected = s.id == selectedId ? 'selected' : '';
      dropdown.innerHTML += `<option value="${s.id}" ${disabled} ${selected}>${s.name} ${s.taken ? '(Allocated)' : ''}</option>`;
    });
  } catch(err) { console.error('States load error:', err); }
}

var csf = document.getElementById('createStateForm');
if (csf) csf.addEventListener('submit', async function(e){
  e.preventDefault();
  var name = document.getElementById('sName').value.trim();
  if(!name) { setFieldError(document.getElementById('sName'), 'State name is required.'); return; }
  var btn = document.getElementById('sBtn'); btn.disabled=true;
  try {
    var res = await fetch('/admin/api/states',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state_name:name})});
    var d = await res.json();
    if(d.state_id){
      closeModal('stateModal'); this.reset();
      allStates.push({id:d.state_id,name:d.state_name});
      loadStates();
      showToast('State added successfully.','success');
    } else showAlert('sAlert', friendlyError(d.error), 'error');
  } catch(er) { showAlert('sAlert','Unable to connect to server.','error'); }
  finally { btn.disabled=false; }
});

document.addEventListener('DOMContentLoaded', () => { loadStates(); load(); });
