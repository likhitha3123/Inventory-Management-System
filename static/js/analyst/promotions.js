var _pg=1,_per=20;

function vmField(l,v){return`<div class="vm-row"><div class="vm-label">${l}</div><div class="vm-value">${v||'—'}</div></div>`;}
function openView(r){
  document.getElementById('vmBody').innerHTML=`<div class="vm-grid">
    ${vmField('Promotion ID',r.promotion_id)}
    ${vmField('Product',r.product_id)}
    ${vmField('Site',r.site_id)}
    ${vmField('Start Date',r.start_date)}
    ${vmField('End Date',r.end_date)}
    ${vmField('Discount Type',r.discount_type)}
    ${vmField('Discount Amount',r.discount_amount!=null?fmt(r.discount_amount,2):'—')}
  </div>`;
  document.getElementById('viewModal').classList.add('open');
}

async function tblLoad(pg){
  _pg=pg||1;
  var search=(document.getElementById('tblSearch')||{}).value||'';
  var url='/admin/api/promotions?page='+_pg+'&per_page='+_per+(search?'&search='+encodeURIComponent(search):'');
  try{
    var d=await fetch(url).then(r=>r.json());
    document.getElementById('tblCount').textContent='Total: '+fmt(d.total)+' records';
    var tb=document.getElementById('tblBody');
    if(!d.items||!d.items.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--slate-400);">No records.</td></tr>';document.getElementById('tblPgn').innerHTML='';return;}
    tb.innerHTML=d.items.map((r,i)=>{
      var ri=JSON.stringify(r).replace(/'/g,"&#39;");
      var dtCls=r.discount_type==='Percentage'?'badge-warning':'badge-sky';
      return`<tr>
        <td style="color:var(--slate-400);">${(_pg-1)*_per+i+1}</td>
        <td style="font-size:11px;font-family:monospace;">${r.promotion_id||'—'}</td>
        <td style="font-size:12px;">${r.product_id||'—'}</td>
        <td><span class="badge badge-sky">${r.site_id||'—'}</span></td>
        <td style="font-size:12px;">${r.start_date||'—'}</td>
        <td style="font-size:12px;">${r.end_date||'—'}</td>
        <td><span class="badge ${dtCls}">${r.discount_type||'—'}</span></td>
        <td style="text-align:right;font-weight:600;color:var(--warning);">${r.discount_amount!=null?fmt(r.discount_amount,2):'—'}</td>
        <td><button class="btn-eye" onclick='openView(${ri})'>👁 View</button></td>
      </tr>`;
    }).join('');
    renderPgn(d,_pg,tblLoad,'tblPgn');
  }catch(e){console.error(e);}
}
function renderPgn(d,pg,fn,id){var p='';if(d.has_prev)p+=`<button onclick="${fn.name}(${pg-1})">‹</button>`;var s=Math.max(1,pg-2),e=Math.min(d.pages,pg+2);for(var n=s;n<=e;n++)p+=`<button class="${n===pg?'active':''}" onclick="${fn.name}(${n})">${n}</button>`;if(d.has_next)p+=`<button onclick="${fn.name}(${pg+1})">›</button>`;document.getElementById(id).innerHTML=p;}
document.addEventListener('click',e=>{if(e.target.id==='viewModal')e.target.classList.remove('open');});
tblLoad(1);
