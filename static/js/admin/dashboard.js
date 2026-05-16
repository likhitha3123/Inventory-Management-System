// Chart.js CDN loaded in HTML
var charts = {};

async function loadDashboard(){
  try {
    var res = await fetch('/admin/api/dashboard');
    var d   = await res.json();
    var s   = d.stats;

    document.getElementById('statProducts').textContent  = fmt(s.products);
    document.getElementById('statRevenue').textContent   = '₹'+fmt(s.revenue);
    document.getElementById('statShipments').textContent = fmt(s.shipments);
    document.getElementById('statLowStock').textContent  = fmt(s.low_stock);
    document.getElementById('statSales').textContent     = fmt(s.sales);
    document.getElementById('statSites').textContent     = fmt(s.sites);
    document.getElementById('statPromos').textContent    = fmt(s.promos);

    // =========================
    // RESPONSIVE FIX ONLY
    // =========================
    // When screen width is small, stack first 2 charts vertically
    function makeChartsResponsive() {
      var revenueCard = document.getElementById('chartRevenue')?.closest('.col-md-6');
      var topCard     = document.getElementById('chartTopProducts')?.closest('.col-md-6');

      if (window.innerWidth < 768) {
        if (revenueCard) {
          revenueCard.classList.remove('col-md-6');
          revenueCard.classList.add('col-12');
        }

        if (topCard) {
          topCard.classList.remove('col-md-6');
          topCard.classList.add('col-12');
        }
      } else {
        if (revenueCard) {
          revenueCard.classList.remove('col-12');
          revenueCard.classList.add('col-md-6');
        }

        if (topCard) {
          topCard.classList.remove('col-12');
          topCard.classList.add('col-md-6');
        }
      }
    }

    makeChartsResponsive();
    window.addEventListener('resize', makeChartsResponsive);

    // 1. Revenue last 7 days — Line chart
    var revLabels = (d.chart_revenue||[]).map(r=>r.date.slice(5));
    var revData   = (d.chart_revenue||[]).map(r=>r.revenue);

    destroyChart('chartRevenue');

    charts.revenue = new Chart(document.getElementById('chartRevenue'), {
      type: 'line',
      data: {
        labels: revLabels,
        datasets: [{
          label: 'Revenue (₹)',
          data: revData,
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#0284c7',
          pointRadius: 4,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              label:v=>'₹'+fmt(v.raw,2)
            }
          }
        },
        scales:{
          y:{
            beginAtZero:true,
            ticks:{
              callback:v=>'₹'+fmt(v)
            }
          }
        }
      }
    });

    // 2. Top products — Horizontal bar chart
    var topLabels = (d.chart_top_products||[]).map(r=>r.product_id);
    var topData   = (d.chart_top_products||[]).map(r=>r.revenue);

    destroyChart('chartTopProducts');

    charts.top = new Chart(document.getElementById('chartTopProducts'), {
      type: 'bar',
      data: {
        labels: topLabels,
        datasets: [{
          label: 'Revenue',
          data: topData,
          backgroundColor: ['#0ea5e9','#06b6d4','#8b5cf6','#f59e0b','#10b981','#ef4444'],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis:'y',
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{
            callbacks:{
              label:v=>'₹'+fmt(v.raw,2)
            }
          }
        },
        scales:{
          x:{
            beginAtZero:true,
            ticks:{
              callback:v=>'₹'+fmt(v)
            }
          }
        }
      }
    });

    // 3. Sales Order status — Donut
    var soData = d.chart_so_status || [0,0,0];

    destroyChart('chartSOStatus');

    charts.so = new Chart(document.getElementById('chartSOStatus'), {
      type: 'doughnut',
      data: {
        labels: ['Pending','Accepted','Rejected'],
        datasets: [{
          data: soData,
          backgroundColor:['#f59e0b','#10b981','#ef4444'],
          borderWidth:0
        }]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom'}
        },
        cutout:'65%'
      }
    });

    // 4. Shipment status — Donut
    var shipData = d.chart_shipment_status || [0,0,0];

    destroyChart('chartShipment');

    charts.ship = new Chart(document.getElementById('chartShipment'), {
      type: 'doughnut',
      data: {
        labels: ['Pending','In Transit','Delivered'],
        datasets: [{
          data: shipData,
          backgroundColor:['#94a3b8','#0ea5e9','#10b981'],
          borderWidth:0
        }]
      },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom'}
        },
        cutout:'65%'
      }
    });

    // notifications
    try {
      var nr = await fetch('/admin/api/notifications').then(r=>r.json());
      var badge = document.getElementById('msgBadge');

      if(badge && nr.pending_count>0){
        badge.style.display='inline';
        badge.textContent=nr.pending_count;
      }
    } catch(e) {}

  } catch(e){
    console.error(e);
  }
}

function destroyChart(id){
  var el = document.getElementById(id);

  if (el && el._chart) {
    el._chart.destroy();
  }

  if (charts[id.replace('chart','').toLowerCase()]) {
    try {
      charts[id.replace('chart','').toLowerCase()].destroy();
    } catch(e){}
  }
}

loadDashboard();