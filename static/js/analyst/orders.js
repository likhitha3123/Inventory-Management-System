var _pg=1,_per=20;

function vmField(l,v){return`<div class="vm-row"><div class="vm-label">${l}</div><div class="vm-value">${v||'—'}</div></div>`;}
function openView(r){
  var sc={'accepted':'badge-success','rejected':'badge-danger','pending':'badge-warning'};
  var bc=sc[r.status]||'badge-sky';
  var st=r.status?r.status.charAt(0).toUpperCase()+r.status.slice(1):'—';
  document.getElementById('vmBody').innerHTML=`<div class="vm-grid">
    ${vmField('Order Ref',r.order_ref)}
    ${vmField('Customer',r.customer_id)}
    ${vmField('Site',r.site_id)}
    ${vmField('Product',r.product_id)}
    ${vmField('Units',fmt(r.units))}
    ${vmField('Unit Price','₹'+fmt(r.unit_price,2))}
    ${vmField('Total Amount','₹'+fmt(r.total_amount,2))}
    ${vmField('Status','<span class="badge '+bc+'">'+st+'</span>')}
    ${vmField('Note',r.manager_note)}
    ${vmField('Created',r.created_at)}
  </div>`;
  document.getElementById('viewModal').classList.add('open');
}

async function tblLoad(pg){
  _pg=pg||1;
  var search=(document.getElementById('tblSearch')||{}).value||'';
  var url='/admin/api/sales-orders?page='+_pg+'&per_page='+_per+(search?'&search='+encodeURIComponent(search):'');
  try{
    var d=await fetch(url).then(r=>r.json());
    document.getElementById('tblCount').textContent='Total: '+fmt(d.total)+' orders';
    var tb=document.getElementById('tblBody');
    if(!d.items||!d.items.length){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--slate-400);">No records.</td></tr>';document.getElementById('tblPgn').innerHTML='';return;}
    var sc={'accepted':'badge-success','rejected':'badge-danger','pending':'badge-warning'};
    tb.innerHTML=d.items.map((r,i)=>{
      var bc=sc[r.status]||'badge-sky';
      var st=r.status?r.status.charAt(0).toUpperCase()+r.status.slice(1):'—';
      var ri=JSON.stringify(r).replace(/'/g,"&#39;");
      return`<tr>
        <td style="color:var(--slate-400);">${(_pg-1)*_per+i+1}</td>
        <td style="font-family:monospace;font-size:11px;font-weight:600;">${r.order_ref||'—'}</td>
        <td style="font-size:12px;">${r.customer_id||'—'}</td>
        <td><span class="badge badge-sky">${r.site_id||'—'}</span></td>
        <td><span class="badge ${bc}">${st}</span></td>
        <td style="text-align:right;font-weight:600;">₹${fmt(r.total_amount,2)}</td>
        <td><button class="btn-eye" onclick='openView(${ri})'>👁 View</button></td>
      </tr>`;
    }).join('');
    renderPgn(d,_pg,tblLoad,'tblPgn');
  }catch(e){console.error(e);}
}
function renderPgn(d,pg,fn,id){var p='';if(d.has_prev)p+=`<button onclick="${fn.name}(${pg-1})">‹</button>`;var s=Math.max(1,pg-2),e=Math.min(d.pages,pg+2);for(var n=s;n<=e;n++)p+=`<button class="${n===pg?'active':''}" onclick="${fn.name}(${n})">${n}</button>`;if(d.has_next)p+=`<button onclick="${fn.name}(${pg+1})">›</button>`;document.getElementById(id).innerHTML=p;}
document.addEventListener('click',e=>{if(e.target.id==='viewModal')e.target.classList.remove('open');});
tblLoad(1);
