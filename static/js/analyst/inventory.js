var _pg=1,_per=20;

function vmField(label, value){
  return `<div class="vm-row"><div class="vm-label">${label}</div><div class="vm-value">${value||'—'}</div></div>`;
}
function openView(r){
  var isLow=(r.stockout_flag||'').toLowerCase()==='yes';
  document.getElementById('vmBody').innerHTML=`<div class="vm-grid">
    ${vmField('Site', r.site_id)}
    ${vmField('Product', r.product_id)}
    ${vmField('Period', r.period)}
    ${vmField('Opening Stock', fmt(r.beginning_inventory))}
    ${vmField('Ending Stock', fmt(r.ending_inventory))}
    ${vmField('Replenishment', fmt(r.replenishment))}
    ${vmField('Stockout Flag', isLow?'<span class="badge badge-danger">⚠ Low/Stockout</span>':'<span class="badge badge-success">✓ OK</span>')}
  </div>`;
  document.getElementById('viewModal').classList.add('open');
}

async function tblLoad(pg){
  _pg=pg||1;
  var search=(document.getElementById('tblSearch')||{}).value||'';
  var url='/admin/api/inventory?page='+_pg+'&per_page='+_per+(search?'&search='+encodeURIComponent(search):'');
  try{
    var d=await fetch(url).then(r=>r.json());
    document.getElementById('tblCount').textContent='Total: '+fmt(d.total)+' records';
    var tb=document.getElementById('tblBody');
    if(!d.items||!d.items.length){
      tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--slate-400);">No records.</td></tr>';
      document.getElementById('tblPgn').innerHTML=''; return;
    }
    tb.innerHTML=d.items.map((r,i)=>{
      var isLow=(r.stockout_flag||'').toLowerCase()==='yes';
      var ri=JSON.stringify(r).replace(/'/g,"&#39;");
      return `<tr>
        <td style="color:var(--slate-400);">${(_pg-1)*_per+i+1}</td>
        <td><span class="badge badge-sky">${r.site_id||'—'}</span></td>
        <td style="font-size:12px;">${r.product_id||'—'}</td>
        <td style="text-align:right;">${fmt(r.beginning_inventory)}</td>
        <td style="text-align:right;font-weight:600;">${fmt(r.ending_inventory)}</td>
        <td style="text-align:right;color:var(--warning);font-weight:600;">${fmt(r.replenishment)}</td>
        <td>${isLow?'<span class="badge badge-danger">⚠ Low</span>':'<span class="badge badge-success">✓ OK</span>'}</td>
        <td><button class="btn-eye" onclick='openView(${ri})'>👁 View</button></td>
      </tr>`;
    }).join('');
    renderPgn(d,_pg,tblLoad,'tblPgn');
  }catch(e){console.error(e);}
}

function renderPgn(d,pg,fn,id){
  var p='';
  if(d.has_prev)p+=`<button onclick="${fn.name}(${pg-1})">‹</button>`;
  var s=Math.max(1,pg-2),e=Math.min(d.pages,pg+2);
  for(var n=s;n<=e;n++)p+=`<button class="${n===pg?'active':''}" onclick="${fn.name}(${n})">${n}</button>`;
  if(d.has_next)p+=`<button onclick="${fn.name}(${pg+1})">›</button>`;
  document.getElementById(id).innerHTML=p;
}
document.addEventListener('click',e=>{if(e.target.id==='viewModal')e.target.classList.remove('open');});
tblLoad(1);
