var _pg=1,_per=20;

function vmField(l,v){return`<div class="vm-row"><div class="vm-label">${l}</div><div class="vm-value">${v||'—'}</div></div>`;}
function openView(r){
  var sc={'Delivered':'badge-success','In Transit':'badge-sky','Pending':'badge-warning'};
  var bc=sc[r.delivery_status]||'badge-sky';
  document.getElementById('vmBody').innerHTML=`<div class="vm-grid">
    ${vmField('Shipment ID',r.shipment_id)}
    ${vmField('Site',r.site_id)}
    ${vmField('Product',r.product_id)}
    ${vmField('Quantity',fmt(r.quantity))}
    ${vmField('Status','<span class="badge '+bc+'">'+(r.delivery_status||'—')+'</span>')}
    ${vmField('Transport Type',r.transportation_type)}
  </div>`;
  document.getElementById('viewModal').classList.add('open');
}

async function tblLoad(pg){
  _pg=pg||1;
  var search=(document.getElementById('tblSearch')||{}).value||'';
  var url='/admin/api/logistics?page='+_pg+'&per_page='+_per+(search?'&search='+encodeURIComponent(search):'');
  try{
    var d=await fetch(url).then(r=>r.json());
    document.getElementById('tblCount').textContent='Total: '+fmt(d.total)+' shipments';
    var tb=document.getElementById('tblBody');
    if(!d.items||!d.items.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--slate-400);">No records.</td></tr>';document.getElementById('tblPgn').innerHTML='';return;}
    var sc={'Delivered':'badge-success','In Transit':'badge-sky','Pending':'badge-warning'};
    tb.innerHTML=d.items.map((r,i)=>{
      var bc=sc[r.delivery_status]||'badge-sky';
      var ri=JSON.stringify(r).replace(/'/g,"&#39;");
      return`<tr>
        <td style="color:var(--slate-400);">${(_pg-1)*_per+i+1}</td>
        <td style="font-size:11px;font-family:monospace;">${r.shipment_id||'—'}</td>
        <td><span class="badge badge-sky">${r.site_id||'—'}</span></td>
        <td style="font-size:12px;">${r.product_id||'—'}</td>
        <td style="text-align:right;">${fmt(r.quantity)}</td>
        <td><span class="badge ${bc}">${r.delivery_status||'—'}</span></td>
        <td style="font-size:12px;">${r.transportation_type||'—'}</td>
        <td><button class="btn-eye" onclick='openView(${ri})'>👁 View</button></td>
      </tr>`;
    }).join('');
    renderPgn(d,_pg,tblLoad,'tblPgn');
  }catch(e){console.error(e);}
}
function renderPgn(d,pg,fn,id){var p='';if(d.has_prev)p+=`<button onclick="${fn.name}(${pg-1})">‹</button>`;var s=Math.max(1,pg-2),e=Math.min(d.pages,pg+2);for(var n=s;n<=e;n++)p+=`<button class="${n===pg?'active':''}" onclick="${fn.name}(${n})">${n}</button>`;if(d.has_next)p+=`<button onclick="${fn.name}(${pg+1})">›</button>`;document.getElementById(id).innerHTML=p;}
document.addEventListener('click',e=>{if(e.target.id==='viewModal')e.target.classList.remove('open');});
tblLoad(1);
