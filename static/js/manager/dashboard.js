var charts = {};

async function load(){
  try {
    var res = await fetch('/manager/api/dashboard');
    var d   = await res.json();
    var s   = d.stats;

    document.getElementById('statSites').textContent   = s.sites;
    document.getElementById('statRevenue').textContent = '₹'+fmt(s.revenue);
    document.getElementById('statLow').textContent     = fmt(s.low_stock);
    if(document.getElementById('statOrders'))
      document.getElementById('statOrders').textContent = fmt(s.pending_orders||0);

    // 1. Revenue last 7 days — Line chart
    var revLabels = (d.chart_revenue||[]).map(r=>r.date.slice(5));
    var revData   = (d.chart_revenue||[]).map(r=>r.revenue);
    if(charts.revenue) charts.revenue.destroy();
    charts.revenue = new Chart(document.getElementById('chartRevenue'), {
      type: 'line',
      data: {
        labels: revLabels,
        datasets: [{
          label: 'Revenue (₹)', data: revData,
          borderColor: '#0ea5e9', backgroundColor:'rgba(14,165,233,0.1)',
          borderWidth:2.5, pointBackgroundColor:'#0284c7', pointRadius:4, fill:true, tension:0.4
        }]
      },
      options:{ responsive:true,maintainAspectRatio:true, maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>'₹'+fmt(v.raw,2)}}},
        scales:{y:{beginAtZero:true,ticks:{callback:v=>'₹'+fmt(v)}}} }
    });

    // 2. Top products by revenue — Horizontal bar
    var topLabels = (d.chart_top_products||[]).map(r=>r.product_id);
    var topData   = (d.chart_top_products||[]).map(r=>r.revenue);
    if(charts.top) charts.top.destroy();
    charts.top = new Chart(document.getElementById('chartTopProducts'), {
      type: 'bar',
      data: { labels:topLabels, datasets:[{label:'Revenue',data:topData,
        backgroundColor:['#0ea5e9','#06b6d4','#8b5cf6','#f59e0b','#10b981','#ef4444'],borderRadius:6}] },
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:v=>'₹'+fmt(v.raw,2)}}},
        scales:{x:{beginAtZero:true,ticks:{callback:v=>'₹'+fmt(v)}}} }
    });

    // 3. Sales Order status — Donut
    if(charts.so) charts.so.destroy();
    charts.so = new Chart(document.getElementById('chartSOStatus'), {
      type: 'doughnut',
      data:{ labels:['Pending','Accepted','Rejected'],
        datasets:[{data:d.chart_so_status||[0,0,0],
          backgroundColor:['#f59e0b','#10b981','#ef4444'],borderWidth:0}] },
      options:{responsive:true,maintainAspectRatio:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},cutout:'65%'}
    });

    // 4. Shipment status — Donut
    if(charts.ship) charts.ship.destroy();
    charts.ship = new Chart(document.getElementById('chartShipment'), {
      type: 'doughnut',
      data:{ labels:['Pending','In Transit','Delivered'],
        datasets:[{data:d.chart_shipment_status||[0,0,0],
          backgroundColor:['#94a3b8','#0ea5e9','#10b981'],borderWidth:0}] },
      options:{responsive:true,maintainAspectRatio:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},cutout:'65%'}
    });

  } catch(e){ console.error(e); }
}

load();
