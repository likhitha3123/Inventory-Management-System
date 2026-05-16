/* ── Analyst Charts Helper ──────────────────────────────────
   Colours match theme.css exactly:
     sky-500=#0ea5e9  sky-600=#0284c7  sky-700=#0369a1
     success=#10b981  warning=#f59e0b  danger=#ef4444
     slate-400=#94a3b8  slate-600=#475569
──────────────────────────────────────────────────────────── */
var PALETTE = [
  '#0ea5e9','#10b981','#f59e0b','#0369a1',
  '#ef4444','#06b6d4','#475569','#38bdf8',
  '#059669','#d97706','#dc2626','#0284c7'
];

/* ── Utilities ───────────────────────────────────────────── */
function setKPI(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
function showErr(m){var e=document.getElementById('errBox');if(e){e.style.display='block';e.textContent='⚠ '+m;}}

function mkLegend(id,labels,colors){
  var el=document.getElementById(id);if(!el)return;
  el.innerHTML=labels.map((l,i)=>
    `<span><b style="background:${colors[i%colors.length]}"></b>${l}</span>`
  ).join('');
}

/* Compact shared default options — no overflow */
function _o(extra){
  return Object.assign({
    responsive:true, maintainAspectRatio:true,
    plugins:{legend:{display:false}}
  }, extra||{});
}

/* Y-axis tick formatter (₹ prefix optional) */
function _ytick(prefix){
  return v=>{
    if(v>=1e7) return (prefix||'')+(v/1e7).toFixed(1)+'Cr';
    if(v>=1e5) return (prefix||'')+(v/1e5).toFixed(1)+'L';
    if(v>=1000)return (prefix||'')+(v/1000).toFixed(0)+'K';
    return (prefix||'')+v;
  };
}

/* ── Vertical bar ────────────────────────────────────────── */
function mkBar(id,labels,data,colors,prefix,sugMax){
  var ctx=document.getElementById(id);if(!ctx||!data||!data.length)return;
  var bg=Array.isArray(colors)?colors:labels.map((_,i)=>PALETTE[i%PALETTE.length]);
  new Chart(ctx,{type:'bar',
    data:{labels,datasets:[{data,backgroundColor:bg,borderRadius:5,borderSkipped:false,barPercentage:.7,categoryPercentage:.8}]},
    options:_o({
      plugins:{legend:{display:false},tooltip:{callbacks:{label:b=>' '+(prefix||'')+(b.parsed.y||0).toLocaleString('en-IN')}}},
      scales:{
        y:{beginAtZero:true,suggestedMax:sugMax||undefined,grid:{color:'#f1f5f9'},
           ticks:{font:{size:10},callback:_ytick(prefix)}},
        x:{grid:{display:false},ticks:{font:{size:10},maxRotation:40,autoSkip:true}}
      }
    })
  });
}

/* ── Horizontal bar ─────────────────────────────────────── */
function mkHBar(id,labels,data,colors,suffix){
  var ctx=document.getElementById(id);if(!ctx||!data||!data.length)return;
  new Chart(ctx,{type:'bar',
    data:{labels,datasets:[{data,backgroundColor:colors||labels.map((_,i)=>PALETTE[i%PALETTE.length]),borderRadius:4,barPercentage:.7,categoryPercentage:.8}]},
    options:_o({
      indexAxis:'y',
      plugins:{legend:{display:false},tooltip:{callbacks:{label:b=>' '+(b.parsed.x||0).toLocaleString('en-IN')+(suffix||'')}}},
      scales:{
        x:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:10}}},
        y:{grid:{display:false},ticks:{font:{size:10}}}
      }
    })
  });
}

/* ── Line (smart Y-axis so flat data isn't crushed) ─────── */
function mkLine(id,labels,data,color){
  var ctx=document.getElementById(id);if(!ctx||!data||!data.length)return;
  var maxV=Math.max(...data)||1,minV=Math.min(...data)||0;
  var pad=(maxV-minV)*.35||maxV*.2;
  new Chart(ctx,{type:'line',
    data:{labels,datasets:[{data,fill:true,backgroundColor:(color||'#0ea5e9')+'18',
      borderColor:color||'#0ea5e9',borderWidth:2.5,
      pointBackgroundColor:color||'#0ea5e9',pointRadius:3,pointHoverRadius:5,tension:.4}]},
    options:_o({
      plugins:{legend:{display:false},tooltip:{callbacks:{label:b=>' ₹'+(b.parsed.y||0).toLocaleString('en-IN')}}},
      scales:{
        y:{min:Math.max(0,minV-pad),suggestedMax:maxV+pad*.5,grid:{color:'#f1f5f9'},
           ticks:{font:{size:10},callback:_ytick('₹')}},
        x:{grid:{display:false},ticks:{font:{size:10},maxRotation:40,autoSkip:true}}
      }
    })
  });
}

/* ── Donut ───────────────────────────────────────────────── */
function mkDonut(id,labels,data,colors){
  var ctx=document.getElementById(id);if(!ctx||!data||!data.length)return;
  new Chart(ctx,{type:'doughnut',
    data:{labels,datasets:[{data,backgroundColor:colors||labels.map((_,i)=>PALETTE[i%PALETTE.length]),borderWidth:2,hoverOffset:6}]},
    options:_o({
      cutout:'60%',
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:b=>{var t=b.dataset.data.reduce((a,c)=>a+c,0);
          return ` ${b.label}: ${b.parsed.toLocaleString('en-IN')} (${t?Math.round(b.parsed/t*100):0}%)`;}}}
      }
    })
  });
}

/* ── Grouped bar ─────────────────────────────────────────── */
function mkGrouped(id,labels,datasets){
  var ctx=document.getElementById(id);if(!ctx)return;
  new Chart(ctx,{type:'bar',data:{labels,datasets},
    options:_o({
      plugins:{legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:10,padding:8}}},
      scales:{
        y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:10},callback:_ytick()}},
        x:{grid:{display:false},ticks:{font:{size:10},maxRotation:40,autoSkip:true}}
      }
    })
  });
}

/* ── Scatter (2 datasets for colour-coding) ─────────────── */
function mkScatter2(id,datasets){
  var ctx=document.getElementById(id);if(!ctx)return;
  new Chart(ctx,{type:'scatter',data:{datasets},
    options:_o({
      plugins:{legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:9,padding:8}}},
      scales:{
        x:{grid:{color:'#f1f5f9'},ticks:{font:{size:10}},
           title:{display:true,text:'Avg Stock Level',font:{size:10},color:'#64748b'}},
        y:{grid:{color:'#f1f5f9'},ticks:{font:{size:10}},
           title:{display:true,text:'Units Sold',font:{size:10},color:'#64748b'}}
      }
    })
  });
}

/* ── Bubble chart (turnover) ─────────────────────────────── */
function mkBubble(id,datasets){
  var ctx=document.getElementById(id);if(!ctx)return;
  new Chart(ctx,{type:'bubble',data:{datasets},
    options:_o({
      plugins:{legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:9,padding:8}},
        tooltip:{callbacks:{label:b=>`${b.dataset.label}: turnover ${b.parsed.y.toFixed(2)}x, stock ${b.parsed.x.toFixed(0)}, rev ₹${(b.raw.r_actual||0).toLocaleString('en-IN')}`}}
      },
      scales:{
        x:{grid:{color:'#f1f5f9'},ticks:{font:{size:10}},
           title:{display:true,text:'Avg Stock',font:{size:10},color:'#64748b'}},
        y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:10}},
           title:{display:true,text:'Turnover Rate',font:{size:10},color:'#64748b'}}
      }
    })
  });
}

/* ── Multi-line chart (for inventory by site) ────────────── */
function mkMultiLine(id,labels,datasets){
  var ctx=document.getElementById(id);if(!ctx)return;
  new Chart(ctx,{type:'line',data:{labels,datasets},
    options:_o({
      plugins:{legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:10,padding:8}}},
      scales:{
        y:{beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:10},callback:_ytick()}},
        x:{grid:{display:false},ticks:{font:{size:10},maxRotation:40,autoSkip:true}}
      }
    })
  });
}

/* ── STACKED bar (commented-out alternative for #6) ──────
   To use: replace cInvLine canvas id with cInvStacked in HTML,
   then call mkStacked instead of mkMultiLine in dashboard.js

function mkStacked(id,labels,datasets){
  var ctx=document.getElementById(id);if(!ctx)return;
  new Chart(ctx,{type:'bar',data:{labels,datasets},
    options:_o({
      plugins:{legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:10,padding:8}}},
      scales:{
        y:{stacked:true,beginAtZero:true,grid:{color:'#f1f5f9'},ticks:{font:{size:10},callback:_ytick()}},
        x:{stacked:true,grid:{display:false},ticks:{font:{size:10},maxRotation:40,autoSkip:true}}
      }
    })
  });
}
─────────────────────────────────────────────────────────── */
