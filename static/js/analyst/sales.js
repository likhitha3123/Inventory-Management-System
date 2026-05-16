/* ── Sales page — view-only table with eye modal ── */
var _pg=1, _per=20;

function vmField(label, value){
  return `<div class="vm-row"><div class="vm-label">${label}</div><div class="vm-value">${value||'—'}</div></div>`;
}
function openView(r){
  var disc=parseFloat(r.discounts||0), rev=parseFloat(r.revenue||0), net=rev-disc;
  document.getElementById('vmBody').innerHTML=`<div class="vm-grid">
    ${vmField('Date', r.date)}
    ${vmField('Site', r.site_id)}
    ${vmField('Product', r.product_id)}
    ${vmField('Customer', r.customer_id)}
    ${vmField('Units Sold', fmt(r.units_sold))}
    ${vmField('Revenue', '₹'+fmt(rev,2))}
    ${vmField('Discount', disc>0?'-₹'+fmt(disc,2):'—')}
    ${vmField('Net Revenue', '₹'+fmt(net,2))}
    ${vmField('Returns', fmt(r.returns))}
  </div>`;
  document.getElementById('viewModal').classList.add('open');
}

async function tblLoad(pg){
  _pg=pg||1;
  var search=(document.getElementById('tblSearch')||{}).value||'';
  var url='/admin/api/sales?page='+_pg+'&per_page='+_per+(search?'&search='+encodeURIComponent(search):'');
  try{
    var d=await fetch(url).then(r=>r.json());
    document.getElementById('tblCount').textContent='Total: '+fmt(d.total)+' records';
    var tb=document.getElementById('tblBody');
    if(!d.items||!d.items.length){
      tb.innerHTML='<tr><td colspan="11" style="text-align:center;padding:28px;color:var(--slate-400);">No records found.</td></tr>';
      document.getElementById('tblPgn').innerHTML=''; return;
    }
    tb.innerHTML=d.items.map((s,i)=>{
      var disc=parseFloat(s.discounts||0), rev=parseFloat(s.revenue||0), net=rev-disc;
      var ri=JSON.stringify(s).replace(/'/g,"&#39;");
      return `<tr>
        <td style="color:var(--slate-400);">${(_pg-1)*_per+i+1}</td>
        <td>${s.date||'—'}</td>
        <td><span class="badge badge-sky">${s.site_id||'—'}</span></td>
        <td style="font-size:12px;">${s.product_id||'—'}</td>
        <td style="font-size:12px;">${s.customer_id||'—'}</td>
        <td style="text-align:right;">${fmt(s.units_sold)}</td>
        <td style="text-align:right;">₹${fmt(rev,2)}</td>
        <td style="text-align:right;color:var(--danger);">${disc>0?'-₹'+fmt(disc,2):'—'}</td>
        <td style="text-align:right;color:var(--success);font-weight:600;">₹${fmt(net,2)}</td>
        <td style="text-align:right;">${s.returns>0?'<span class="badge badge-danger">'+s.returns+'</span>':'0'}</td>
        <td><button class="btn-eye" onclick='openView(${ri})'>👁 View</button></td>
      </tr>`;
    }).join('');
    renderPgn(d, _pg, tblLoad, 'tblPgn');
  }catch(e){console.error(e);}
}

function renderPgn(d, pg, fn, id){
  var p='';
  if(d.has_prev) p+=`<button onclick="${fn.name}(${pg-1})">‹</button>`;
  var s=Math.max(1,pg-2), e=Math.min(d.pages,pg+2);
  for(var n=s;n<=e;n++) p+=`<button class="${n===pg?'active':''}" onclick="${fn.name}(${n})">${n}</button>`;
  if(d.has_next) p+=`<button onclick="${fn.name}(${pg+1})">›</button>`;
  document.getElementById(id).innerHTML=p;
}

document.addEventListener('click', e=>{ if(e.target.id==='viewModal') e.target.classList.remove('open'); });
tblLoad(1);
