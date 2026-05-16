/* ── Analytics Dashboard — all charts loaded in parallel ── */
function showErr(m){var e=document.getElementById('errBox');if(e){e.style.display='block';e.textContent='⚠ '+m;}}

async function load(){
  try{
    var [dDash,dSales,dInv,dLog,dOrd,dPromo,dMgr,
         dMonUnits,dSeasonQ,dTurnover,dStkSales,dInvSite,
         dAge,dPromoFx,dDelThru] = await Promise.all([
      fetch('/analyst/api/dashboard').then(r=>r.json()),
      fetch('/analyst/api/sales').then(r=>r.json()),
      fetch('/analyst/api/inventory').then(r=>r.json()),
      fetch('/analyst/api/logistics').then(r=>r.json()),
      fetch('/analyst/api/orders').then(r=>r.json()),
      fetch('/analyst/api/promotions').then(r=>r.json()),
      fetch('/analyst/api/managers').then(r=>r.json()),
      fetch('/analyst/api/monthly-units').then(r=>r.json()),
      fetch('/analyst/api/seasonal-quarter').then(r=>r.json()),
      fetch('/analyst/api/inv-turnover').then(r=>r.json()),
      fetch('/analyst/api/stock-vs-sales').then(r=>r.json()),
      fetch('/analyst/api/inv-by-site').then(r=>r.json()),
      fetch('/analyst/api/customer-age').then(r=>r.json()),
      fetch('/analyst/api/promo-effect').then(r=>r.json()),
      fetch('/analyst/api/delivery-throughput').then(r=>r.json()),
    ]);

    /* ── KPIs ── */
    var s=dDash.stats||{};
    setKPI('kRevenue','₹'+fmt(s.revenue));
    setKPI('kSales',fmt(s.sales));
    setKPI('kProducts',fmt(s.products));
    setKPI('kSites',fmt(s.sites));
    setKPI('kShipments',fmt(s.shipments));
    setKPI('kOrders',fmt(s.orders));
    setKPI('kManagers',fmt(s.managers));
    setKPI('kLowStock',fmt(s.low_stock));
    setKPI('kDelivered',fmt(s.delivered));
    setKPI('kPending',fmt(s.pending_orders));
    setKPI('kInventory',fmt(s.total_inventory));
    setKPI('kPromos',fmt(s.promotions));
    var dcS=document.getElementById('dcSites');if(dcS)dcS.textContent=fmt(s.sites);
    var dcO=document.getElementById('dcOrders');if(dcO)dcO.textContent=fmt(s.orders);
    var dcSh=document.getElementById('dcShip');if(dcSh)dcSh.textContent=fmt(s.shipments);

    /* ══════════════════════════════════════════════════════
       #1  Monthly Revenue (LINE) + Units Sold (BAR) — combo
    ══════════════════════════════════════════════════════ */
    if(dMonUnits.data&&dMonUnits.data.length){
      var md=dMonUnits.data;
      var ctx1=document.getElementById('cMonthly');
      if(ctx1){
        new Chart(ctx1,{type:'bar',
          data:{labels:md.map(x=>x.month),datasets:[
            /* Units — bar (background, right axis) */
            {type:'bar',   label:'Units Sold', data:md.map(x=>x.units),
             backgroundColor:'#10b98130',borderColor:'#10b981',borderWidth:1,
             borderRadius:4,yAxisID:'y2',order:2,barPercentage:.9,categoryPercentage:.9},
            /* Revenue — line (foreground, left axis) */
            {type:'line',  label:'Revenue (₹)', data:md.map(x=>x.revenue),
             borderColor:'#0ea5e9',backgroundColor:'#0ea5e915',fill:true,
             borderWidth:2.5,pointBackgroundColor:'#0ea5e9',pointRadius:3,
             pointHoverRadius:6,tension:.4,yAxisID:'y',order:1},
          ]},
          options:{
            responsive:true,maintainAspectRatio:true,
            plugins:{
              legend:{display:true,position:'top',labels:{font:{size:10},boxWidth:10,padding:10}},
              tooltip:{mode:'index',intersect:false,callbacks:{
                label:b=>b.datasetIndex===1
                  ?' ₹'+(b.parsed.y||0).toLocaleString('en-IN')
                  :' '+(b.parsed.y||0).toLocaleString('en-IN')+' units'
              }}
            },
            scales:{
              y: {position:'left', beginAtZero:false,grid:{color:'#f1f5f9'},
                  ticks:{font:{size:10},callback:v=>{
                    if(v>=1e7)return'₹'+(v/1e7).toFixed(1)+'Cr';
                    if(v>=1e5)return'₹'+(v/1e5).toFixed(1)+'L';
                    if(v>=1000)return'₹'+(v/1000).toFixed(0)+'K';
                    return'₹'+v;}}},
              y2:{position:'right',beginAtZero:true,grid:{display:false},
                  ticks:{font:{size:10},callback:v=>v>=1000?(v/1000).toFixed(0)+'K':v},
                  title:{display:true,text:'Units',font:{size:9},color:'#94a3b8'}},
              x: {grid:{display:false},ticks:{font:{size:10},maxRotation:40,autoSkip:true}}
            }
          }
        });
      }
    }

    /* ══ Revenue by Site — horizontal bar (easier to read) ════ */
    if(dSales.rev_by_site&&dSales.rev_by_site.length)
      mkHBar('cRevSite',dSales.rev_by_site.map(x=>x.site_id),dSales.rev_by_site.map(x=>x.revenue),
        dSales.rev_by_site.map((_,i)=>PALETTE[i%PALETTE.length]),' ₹');

    /* ══ #2 Seasonal Quarter — donut (shows share of annual revenue) ═ */
    if(dSeasonQ.quarters&&dSeasonQ.quarters.length){
      var sq=dSeasonQ.quarters;
      var sqCtx=document.getElementById('cSeasonQ');
      if(sqCtx){
        new Chart(sqCtx,{type:'doughnut',
          data:{labels:sq.map(x=>x.q),datasets:[{data:sq.map(x=>x.rev),
            backgroundColor:['#0ea5e9','#10b981','#f59e0b','#0369a1'],
            borderWidth:2,hoverOffset:8}]},
          options:{responsive:true,maintainAspectRatio:true,cutout:'55%',
            plugins:{
              legend:{display:true,position:'bottom',labels:{font:{size:10},boxWidth:10,padding:6}},
              tooltip:{callbacks:{label:b=>{
                var t=b.dataset.data.reduce((a,c)=>a+c,0);
                return ` ${b.label}: ₹${b.parsed.toLocaleString('en-IN')} (${t?Math.round(b.parsed/t*100):0}%)`;
              }}}
            }
          }
        });
      }
    }

    /* ══ Site donut ════════════════════════════════════════ */
    if(dSales.site_pie&&dSales.site_pie.length){
      var sl=dSales.site_pie.map(x=>x.site_id),sc=sl.map((_,i)=>PALETTE[i%PALETTE.length]);
      mkDonut('cSitePie',sl,dSales.site_pie.map(x=>x.revenue),sc);
      mkLegend('lgSitePie',sl,sc);
    }

    /* ══ Top Products hbar ═════════════════════════════════ */
    if(dSales.top_products&&dSales.top_products.length)
      mkHBar('cTopProducts',dSales.top_products.map(x=>x.product_id),
        dSales.top_products.map(x=>x.units),
        dSales.top_products.map((_,i)=>PALETTE[i%PALETTE.length]),' units');

    /* ══ Revenue by Category — horizontal bar ══════════════ */
    if(dSales.rev_category&&dSales.rev_category.length)
      mkHBar('cRevCategory',dSales.rev_category.map(x=>x.cat),dSales.rev_category.map(x=>x.revenue),
        dSales.rev_category.map((_,i)=>PALETTE[i%PALETTE.length]),' ₹');

    /* ══ Order status — horizontal bar (clearer than donut) ═ */
    if(dOrd.order_status&&dOrd.order_status.length){
      var om={'pending':'#f59e0b','accepted':'#10b981','rejected':'#ef4444'};
      var ol=dOrd.order_status.map(x=>x.status.charAt(0).toUpperCase()+x.status.slice(1));
      var oc=dOrd.order_status.map(x=>om[x.status]||'#94a3b8');
      mkHBar('cOrderStatus',ol,dOrd.order_status.map(x=>x.count),oc,' orders');
    }

    /* ══ #4 Inventory Turnover — BUBBLE chart ══════════════ */
    if(dTurnover.items&&dTurnover.items.length){
      var tv=dTurnover.items;
      var maxRev=Math.max(...tv.map(x=>x.revenue))||1;
      var med=tv.map(x=>x.turnover).sort((a,b)=>a-b)[Math.floor(tv.length/2)]||1;
      var fast=tv.filter(x=>x.turnover>=med);
      var slow=tv.filter(x=>x.turnover<med);
      function toBubble(arr){
        return arr.map(x=>({
          x:x.avg_inv,y:x.turnover,
          r:Math.max(5,Math.round(16*(x.revenue/maxRev))),
          r_actual:x.revenue,label:x.cat
        }));
      }
      mkBubble('cTurnover',[
        {label:'Fast-moving',data:toBubble(fast),
         backgroundColor:'#10b98177',borderColor:'#10b981',borderWidth:1.5},
        {label:'Slow-moving',data:toBubble(slow),
         backgroundColor:'#ef444477',borderColor:'#ef4444',borderWidth:1.5},
      ]);
    }

    /* ══ #5 Stock vs Sales — 3-colour scatter ══════════════ */
    if(dStkSales.points&&dStkSales.points.length){
      var pts=dStkSales.points;
      var medS=pts.map(p=>p.stock).sort((a,b)=>a-b)[Math.floor(pts.length/2)]||1;
      var medU=pts.map(p=>p.units).sort((a,b)=>a-b)[Math.floor(pts.length/2)]||1;
      var over=[],under=[],ok=[];
      pts.forEach(p=>{
        var pt={x:p.stock,y:p.units};
        if(p.stock>medS&&p.units<medU) over.push(pt);
        else if(p.stock<medS&&p.units>medU) under.push(pt);
        else ok.push(pt);
      });
      mkScatter2('cStockVsSales',[
        {label:'Overstocked',data:over,backgroundColor:'#ef444488',borderColor:'#ef4444',pointRadius:5,pointHoverRadius:7},
        {label:'Understocked',data:under,backgroundColor:'#f59e0b88',borderColor:'#f59e0b',pointRadius:5,pointHoverRadius:7},
        {label:'Healthy',data:ok,backgroundColor:'#0ea5e988',borderColor:'#0ea5e9',pointRadius:4,pointHoverRadius:6},
      ]);
    }

    /* ══ #6 Inventory by site — MULTI-LINE
       Stacked bar alternative commented in charts_helper.js ═ */
    if(dInvSite.sites&&dInvSite.sites.length){
      var sv=dInvSite.sites;
      mkMultiLine('cInvLine',sv.map(x=>x.site_id),[
        {label:'Opening Stock',data:sv.map(x=>x.opening),borderColor:'#0ea5e9',backgroundColor:'transparent',borderWidth:2,pointRadius:3,tension:.35},
        {label:'Ending Stock', data:sv.map(x=>x.ending), borderColor:'#10b981',backgroundColor:'transparent',borderWidth:2,pointRadius:3,tension:.35},
        {label:'Replenishment',data:sv.map(x=>x.replen), borderColor:'#f59e0b',backgroundColor:'transparent',borderWidth:2,borderDash:[4,3],pointRadius:3,tension:.35},
      ]);
      /*
      ── STACKED BAR ALTERNATIVE: uncomment below + change canvas id in HTML ──
      mkStacked('cInvStacked', sv.map(x=>x.site_id), [
        {label:'Opening Stock',  data:sv.map(x=>x.opening), backgroundColor:'#0ea5e9aa'},
        {label:'Replenishment',  data:sv.map(x=>x.replen),  backgroundColor:'#f59e0baa'},
        {label:'Ending Stock',   data:sv.map(x=>x.ending),  backgroundColor:'#10b981aa'},
      ]);
      */
    }

    /* ══ Stock vs Replenishment — line chart per site ══════ */
    if(dInv.stock_by_site&&dInv.replen_by_site&&dInv.stock_by_site.length){
      var t8=dInv.stock_by_site.slice(0,10).map(x=>x.site_id);
      var rm={}; dInv.replen_by_site.forEach(x=>{rm[x.site_id]=x.replen;});
      mkGrouped('cStockVsReplen',t8,[
        {label:'Ending Stock', data:t8.map(s=>{var m=dInv.stock_by_site.find(x=>x.site_id===s);return m?m.stock:0;}),
         backgroundColor:'#10b981cc',borderRadius:4,barPercentage:.7},
        {label:'Replenishment',data:t8.map(s=>rm[s]||0),
         backgroundColor:'#f59e0bcc',borderRadius:4,barPercentage:.7},
      ]);
    }

    /* ══ Delivery status — donut ═══════════════════════════ */
    if(dLog.delivery_status&&dLog.delivery_status.length){
      var dm={'Pending':'#f59e0b','In Transit':'#0ea5e9','Delivered':'#10b981','Unknown':'#94a3b8'};
      var dl=dLog.delivery_status.map(x=>x.status);
      var dc2=dl.map(x=>dm[x]||'#94a3b8');
      mkDonut('cDelivery',dl,dLog.delivery_status.map(x=>x.count),dc2);
      mkLegend('lgDelivery',dl,dc2);
    }

    /* ══ #9 Delivery throughput — line chart across sites ══ */
    if(dDelThru.sites&&dDelThru.sites.length){
      var dt=dDelThru.sites;
      mkLine('cDeliveryThru',dt.map(x=>x.site_id),dt.map(x=>x.avg_qty),'#0ea5e9');
    }

    /* ══ Transport mode — donut ════════════════════════════ */
    if(dLog.transport&&dLog.transport.length){
      var tl=dLog.transport.map(x=>x.type);
      var tc=tl.map((_,i)=>PALETTE[i%PALETTE.length]);
      mkDonut('cTransport',tl,dLog.transport.map(x=>x.count),tc);
      mkLegend('lgTransport',tl,tc);
    }

    /* ══ Shipments by site — bar ═══════════════════════════ */
    if(dLog.shipments_by_site&&dLog.shipments_by_site.length){
      var sc=dLog.shipments_by_site.map(x=>x.count);
      mkBar('cShipSite',dLog.shipments_by_site.map(x=>x.site_id),sc,
        dLog.shipments_by_site.map((_,i)=>PALETTE[i%PALETTE.length]),'',Math.ceil(Math.max(...sc)*1.3));
    }

    /* ══ #7 Customer age — bar ═════════════════════════════ */
    if(dAge.groups&&dAge.groups.length)
      mkBar('cAgeGroup',dAge.groups.map(x=>x.group),dAge.groups.map(x=>x.count),
        ['#0ea5e9','#10b981','#f59e0b','#0369a1','#ef4444']);

    /* ══ #8 Promo effect — only Before + During (no After) ═
       Per requirement: "after is empty so remove that column" ═ */
    if(dPromoFx.periods&&dPromoFx.periods.length){
      /* filter out "After Promo" since no data exists */
      var pe=dPromoFx.periods.filter(x=>x.label!=='After Promo');
      if(pe.length){
        var ctx8=document.getElementById('cPromoEffect');
        if(ctx8){
          new Chart(ctx8,{type:'bar',
            data:{labels:pe.map(x=>x.label),
              datasets:[{data:pe.map(x=>x.rev),
                backgroundColor:pe.map(x=>x.label==='During Promo'?'#0ea5e9cc':'#94a3b8cc'),
                borderColor:    pe.map(x=>x.label==='During Promo'?'#0ea5e9':'#94a3b8'),
                borderWidth:1.5,borderRadius:6,barPercentage:.5}]},
            options:{responsive:true,maintainAspectRatio:true,
              plugins:{legend:{display:false},
                tooltip:{callbacks:{label:b=>' ₹'+(b.parsed.y||0).toLocaleString('en-IN')}}},
              scales:{
                y:{beginAtZero:true,grid:{color:'#f1f5f9'},
                   ticks:{font:{size:10},callback:v=>{if(v>=1e5)return'₹'+(v/1e5).toFixed(1)+'L';if(v>=1000)return'₹'+(v/1000).toFixed(0)+'K';return'₹'+v;}}},
                x:{grid:{display:false},ticks:{font:{size:12,weight:'600'}}}
              }
            }
          });
        }
      }
    }

    /* ══ Promo vs Non-Promo — line chart for contrast ══════ */
    if(dPromo.promo_sales){
      var pv=[Math.round(dPromo.promo_sales.with_promo||0),Math.round(dPromo.promo_sales.without_promo||0)];
      var ctxPvN=document.getElementById('cPromoVsNon');
      if(ctxPvN){
        new Chart(ctxPvN,{type:'bar',
          data:{labels:['With Promo','Without Promo'],
            datasets:[{data:pv,
              backgroundColor:['#0ea5e9cc','#94a3b8cc'],
              borderColor:['#0ea5e9','#94a3b8'],
              borderWidth:1.5,borderRadius:8,barPercentage:.4}]},
          options:{responsive:true,maintainAspectRatio:true,
            plugins:{legend:{display:false},
              tooltip:{callbacks:{label:b=>' ₹'+(b.parsed.y||0).toLocaleString('en-IN')}}},
            scales:{
              y:{beginAtZero:true,grid:{color:'#f1f5f9'},
                 ticks:{font:{size:10},callback:v=>{if(v>=1e5)return'₹'+(v/1e5).toFixed(1)+'L';if(v>=1000)return'₹'+(v/1000).toFixed(0)+'K';return'₹'+v;}}},
              x:{grid:{display:false},ticks:{font:{size:12,weight:'600'}}}
            }
          }
        });
      }
    }

    /* ══ #4 Revenue by Manager's State — ALL states, line chart ══
       Uses all states (already filtered to only those with revenue in API).
       Line chart is better than bar when there are many state labels.
    ════════════════════════════════════════════════════════════ */
    if(dMgr.mgr_revenue&&dMgr.mgr_revenue.length){
      var mr=dMgr.mgr_revenue;
      var ctxMgr=document.getElementById('cMgrRev');
      if(ctxMgr){
        var maxR=Math.max(...mr.map(x=>x.revenue))||1;
        var minR=Math.min(...mr.map(x=>x.revenue))||0;
        var padR=(maxR-minR)*.25||maxR*.2;
        new Chart(ctxMgr,{type:'line',
          data:{
            labels:mr.map(x=>x.state),
            datasets:[{
              data:mr.map(x=>x.revenue),
              fill:true,backgroundColor:'#0ea5e912',
              borderColor:'#0ea5e9',borderWidth:2.5,
              /* colour points: has_manager=sky, no manager=amber */
              pointBackgroundColor:mr.map(x=>x.has_manager?'#0ea5e9':'#f59e0b'),
              pointBorderColor:mr.map(x=>x.has_manager?'#0284c7':'#d97706'),
              pointRadius:5,pointHoverRadius:8,tension:.3
            }]
          },
          options:{responsive:true,maintainAspectRatio:true,
            plugins:{
              legend:{display:false},
              tooltip:{callbacks:{
                label:b=>{
                  var st=mr[b.dataIndex];
                  return ` ₹${(b.parsed.y||0).toLocaleString('en-IN')} ${st&&!st.has_manager?' (no manager)':''}`;
                }
              }}
            },
            scales:{
              y:{min:Math.max(0,minR-padR),suggestedMax:maxR+padR*.5,
                 grid:{color:'#f1f5f9'},
                 ticks:{font:{size:10},callback:v=>{if(v>=1e5)return'₹'+(v/1e5).toFixed(1)+'L';if(v>=1000)return'₹'+(v/1000).toFixed(0)+'K';return'₹'+v;}}},
              x:{grid:{display:false},ticks:{font:{size:9},maxRotation:40,autoSkip:false}}
            }
          }
        });
      }
    }

  }catch(e){showErr(e.message);console.error(e);}
}
load();
