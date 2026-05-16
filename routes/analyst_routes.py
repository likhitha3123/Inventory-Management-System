from flask import Blueprint, render_template, jsonify
from models.db import db
from models.records import Sale, Inventory, Logistics, Product, Site, Promotion, States
from models.managers import Manager
from models.user import User
from sqlalchemy import func, extract
from routes.auth_routes import login_required, role_required
from models.sales_order import SalesOrder
from models.catogery import Category

analyst_bp = Blueprint('analyst', __name__, url_prefix='/analyst')

# ─────────────────────────────────────────────────────────────
#  PAGE ROUTES
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/dashboard')
@login_required
@role_required("analyst")
def dashboard():
    return render_template('analyst/dashboard.html')

@analyst_bp.route('/sales')
@login_required
@role_required("analyst")
def sales():
    return render_template('analyst/sales.html')

@analyst_bp.route('/inventory')
@login_required
@role_required("analyst")
def inventory():
    return render_template('analyst/inventory.html')

@analyst_bp.route('/promotions')
@login_required
@role_required("analyst")
def promotions():
    return render_template('analyst/promotions.html')

@analyst_bp.route('/logistics')
@login_required
@role_required("analyst")
def logistics():
    return render_template('analyst/logistics.html')

@analyst_bp.route('/orders')
@login_required
@role_required("analyst")
def orders():
    return render_template('analyst/orders.html')

@analyst_bp.route('/managers')
@login_required
@role_required("analyst")
def managers_view():
    return render_template('analyst/managers.html')

# ─────────────────────────────────────────────────────────────
#  SHARED STATS (used by dashboard)
# ─────────────────────────────────────────────────────────────
def get_stats():
    return {
        'revenue':        round(float(db.session.query(func.sum(Sale.revenue)).scalar() or 0)),
        'sales':          Sale.query.count(),
        'products':       Product.query.count(),
        'sites':          Site.query.count(),
        'managers':       Manager.query.count(),
        'shipments':      Logistics.query.count(),
        'orders':         SalesOrder.query.count(),
        'low_stock':      Inventory.query.filter(func.lower(Inventory.stockout_flag) == 'yes').count(),
        'delivered':      Logistics.query.filter_by(delivery_status='Delivered').count(),
        'pending_orders': SalesOrder.query.filter_by(status='pending').count(),
        'total_inventory':int(db.session.query(func.sum(Inventory.ending_inventory)).scalar() or 0),
        'promotions':     Promotion.query.count(),
    }

@analyst_bp.route('/api/dashboard')
@login_required
@role_required("analyst")
def api_dashboard():
    try:
        return jsonify({'stats': get_stats()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ─────────────────────────────────────────────────────────────
#  SALES API
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/api/sales')
@login_required
@role_required("analyst")
def api_sales():
    try:
        # Monthly revenue (DB-safe: works in PostgreSQL & SQLite)
        monthly_q = db.session.query(
            extract('year', Sale.date).label('year'),
            extract('month', Sale.date).label('month'),
            func.sum(Sale.revenue).label('revenue')
        ).group_by('year', 'month')\
         .order_by('year', 'month').all()

        monthly = [
            {
                'month': f"{int(r.year)}-{int(r.month):02d}",
                'revenue': float(r.revenue or 0)
            }
            for r in monthly_q[-18:]
        ]

        #  Revenue by site (top 12)
        rev_site = db.session.query(
            Sale.site_id,
            func.sum(Sale.revenue)
        ).group_by(Sale.site_id)\
         .order_by(func.sum(Sale.revenue).desc())\
         .limit(12).all()

        #  Site pie (top 8)
        site_pie = db.session.query(
            Sale.site_id,
            func.sum(Sale.revenue)
        ).group_by(Sale.site_id)\
         .order_by(func.sum(Sale.revenue).desc())\
         .limit(8).all()

        #  Top products
        top_products = db.session.query(
            Sale.product_id,
            func.sum(Sale.units_sold)
        ).group_by(Sale.product_id)\
         .order_by(func.sum(Sale.units_sold).desc())\
         .limit(10).all()

        #  Revenue by category (safe JOIN)
        rev_category = db.session.query(
                Category.name,
                func.sum(Sale.revenue)
            ).join(Product, Product.category_id == Category.id)\
            .join(Sale, Sale.product_id == Product.product_id, isouter=True)\
            .group_by(Category.name)\
            .order_by(func.sum(Sale.revenue).desc())\
            .limit(10).all()

        #  Stats
        stats = {
            'total_revenue': round(float(db.session.query(func.sum(Sale.revenue)).scalar() or 0)),
            'total_sales':   Sale.query.count(),
            'total_sites':   db.session.query(Sale.site_id).distinct().count(),
            'total_products':db.session.query(Sale.product_id).distinct().count(),
        }

        #  Final response
        return jsonify({
            'success': True,
            'stats': stats,
            'monthly': monthly,
            'rev_by_site': [{'site_id': r[0], 'revenue': float(r[1] or 0)} for r in rev_site],
            'site_pie': [{'site_id': r[0], 'revenue': float(r[1] or 0)} for r in site_pie],
            'top_products': [{'product_id': r[0], 'units': int(r[1] or 0)} for r in top_products],
            'rev_category': [{'cat': r[0], 'revenue': float(r[1] or 0)}for r in rev_category]
        })

    except Exception as e:
        import traceback

        db.session.rollback()   #  critical

        print(traceback.format_exc())  #  debug in terminal

        return jsonify({
            'success': False,
            'error': 'Unable to load sales data. Please try again later.'
        }), 500
# ─────────────────────────────────────────────────────────────
#  INVENTORY API
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/api/inventory')
@login_required
@role_required("analyst")
def api_inventory():
    try:
        stock_by_site = db.session.query(
            Inventory.site_id, func.sum(Inventory.ending_inventory)
        ).group_by(Inventory.site_id)\
         .order_by(func.sum(Inventory.ending_inventory).desc()).limit(12).all()

        replen_by_site = db.session.query(
            Inventory.site_id, func.sum(Inventory.replenishment)
        ).group_by(Inventory.site_id)\
         .order_by(func.sum(Inventory.replenishment).desc()).limit(10).all()

        stock_health = db.session.query(Inventory.stockout_flag, func.count())\
            .group_by(Inventory.stockout_flag).all()

        inv_category = db.session.query(
                Category.name,
                func.sum(Sale.revenue)
            ).join(Product, Product.category_id == Category.id)\
            .join(Sale, Sale.product_id == Product.product_id, isouter=True)\
            .group_by(Category.name)\
            .order_by(func.sum(Sale.revenue).desc())\
            .limit(10).all()

        stats = {
            'total_stock':   int(db.session.query(func.sum(Inventory.ending_inventory)).scalar() or 0),
            'total_replen':  int(db.session.query(func.sum(Inventory.replenishment)).scalar() or 0),
            'low_stock':     Inventory.query.filter(func.lower(Inventory.stockout_flag) == 'yes').count(),
            'sites_tracked': db.session.query(Inventory.site_id).distinct().count(),
        }

        return jsonify({
            'stats': stats,
            'stock_by_site':  [{'site_id': r[0], 'stock': int(r[1] or 0)} for r in stock_by_site],
            'replen_by_site': [{'site_id': r[0], 'replen': int(r[1] or 0)} for r in replen_by_site],
            'stock_health':   [{'flag': r[0] or 'Unknown', 'count': int(r[1] or 0)} for r in stock_health],
            'inv_category':   [{'cat': r[0], 'stock':float(r[1] or 0)}for r in inv_category]
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# ─────────────────────────────────────────────────────────────
#  PROMOTIONS API
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/api/promotions')
@login_required
@role_required("analyst")
def api_promotions():
    try:
        promo_product_ids = {p.product_id for p in Promotion.query.all()}
        with_promo = 0
        without_promo = 0
        for s in Sale.query.all():
            if s.product_id in promo_product_ids:
                with_promo += float(s.revenue or 0)
            else:
                without_promo += float(s.revenue or 0)

        promo_by_cat = db.session.query(
            Product.category_id, func.count(Promotion.id)
        ).join(Promotion, Promotion.product_id == Product.product_id)\
         .group_by(Product.category_id)\
         .order_by(func.count(Promotion.id).desc()).limit(10).all()

        stats = {
            'total_promos':   Promotion.query.count(),
            'promo_revenue':  round(with_promo),
            'normal_revenue': round(without_promo),
            'uplift_pct':     round((with_promo / (without_promo or 1)) * 100 - 100, 1) if without_promo else 0,
        }

        return jsonify({
            'stats': stats,
            'promo_sales':   {'with_promo': round(with_promo), 'without_promo': round(without_promo)},
            'promo_by_cat':  [{'cat': str(r[0]), 'count': int(r[1] or 0)} for r in promo_by_cat],
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# ─────────────────────────────────────────────────────────────
#  LOGISTICS API
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/api/logistics')
@login_required
@role_required("analyst")
def api_logistics():
    try:
        delivery = db.session.query(Logistics.delivery_status, func.count())\
            .group_by(Logistics.delivery_status).all()

        transport = db.session.query(Logistics.transportation_type, func.count())\
            .group_by(Logistics.transportation_type).all()

        shipments_by_site = db.session.query(Logistics.site_id, func.count())\
            .group_by(Logistics.site_id)\
            .order_by(func.count().desc()).limit(12).all()

        stats = {
            'total_shipments': Logistics.query.count(),
            'delivered':       Logistics.query.filter_by(delivery_status='Delivered').count(),
            'in_transit':      Logistics.query.filter_by(delivery_status='In Transit').count(),
            'pending':         Logistics.query.filter_by(delivery_status='Pending').count(),
        }

        return jsonify({
            'stats': stats,
            'delivery_status':   [{'status': r[0] or 'Unknown', 'count': int(r[1] or 0)} for r in delivery],
            'transport':         [{'type': r[0] or 'Unknown', 'count': int(r[1] or 0)} for r in transport],
            'shipments_by_site': [{'site_id': r[0], 'count': int(r[1] or 0)} for r in shipments_by_site],
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# ─────────────────────────────────────────────────────────────
#  ORDERS API
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/api/orders')
@login_required
@role_required("analyst")
def api_orders():
    try:
        order_status = db.session.query(SalesOrder.status, func.count())\
            .group_by(SalesOrder.status).all()

        orders_by_site = db.session.query(SalesOrder.site_id, func.count())\
            .group_by(SalesOrder.site_id)\
            .order_by(func.count().desc()).limit(12).all()

        stats = {
            'total_orders':   SalesOrder.query.count(),
            'accepted':       SalesOrder.query.filter_by(status='accepted').count(),
            'rejected':       SalesOrder.query.filter_by(status='rejected').count(),
            'pending':        SalesOrder.query.filter_by(status='pending').count(),
        }

        return jsonify({
            'stats': stats,
            'order_status':   [{'status': r[0], 'count': int(r[1] or 0)} for r in order_status],
            'orders_by_site': [{'site_id': r[0], 'count': int(r[1] or 0)} for r in orders_by_site],
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# ─────────────────────────────────────────────────────────────
#  MANAGERS API
# ─────────────────────────────────────────────────────────────
@analyst_bp.route('/api/managers')
@login_required
@role_required("analyst")
def api_managers():
    try:
        mgr_rev = []
        mgr_ship = []
        # Include ALL states that have sites — not just those with assigned managers
        all_states = States.query.all()
        mgr_state_map = {m.state_id: m for m in Manager.query.all()}
        for state in all_states:
            state_sites = [s.site_id for s in Site.query.filter_by(state_id=state.state_id).all()]
            if not state_sites:
                continue
            rev   = db.session.query(func.sum(Sale.revenue)).filter(Sale.site_id.in_(state_sites)).scalar() or 0
            if float(rev) == 0:
                continue  # skip states with zero revenue
            ships = Logistics.query.filter(Logistics.site_id.in_(state_sites)).count()
            ords  = SalesOrder.query.filter(SalesOrder.site_id.in_(state_sites)).count()
            mgr_rev.append({'state': state.state_name, 'revenue': round(float(rev)),
                            'has_manager': state.state_id in mgr_state_map})
            mgr_ship.append({'state': state.state_name, 'shipments': ships, 'orders': ords})
        mgr_rev.sort(key=lambda x: x['revenue'], reverse=True)
        mgr_ship.sort(key=lambda x: x['shipments'], reverse=True)

        stats = {
            'total_managers': Manager.query.count(),
            'total_states':   len(mgr_rev),
            'top_state':      mgr_rev[0]['state'] if mgr_rev else '—',
            'top_revenue':    mgr_rev[0]['revenue'] if mgr_rev else 0,
        }

        return jsonify({
            'stats': stats,
            'mgr_revenue':   mgr_rev,
            'mgr_shipments': mgr_ship,
        })
    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500

# ─────────────────────────────────────────────────────────────
#  NEW GRAPH APIs
# ─────────────────────────────────────────────────────────────

# ── Monthly with units (for grouped bar #1) ─────────────────
@analyst_bp.route('/api/monthly-units')
@login_required
@role_required("analyst")
def api_monthly_units():
    try:
        from datetime import datetime
        q = db.session.query(
            extract('year',  Sale.date).label('yr'),
            extract('month', Sale.date).label('mo'),
            func.sum(Sale.revenue).label('rev'),
            func.sum(Sale.units_sold).label('units')
        ).group_by('yr','mo').order_by('yr','mo').all()
        data = [{'month': f"{int(r.yr)}-{int(r.mo):02d}",
                 'revenue': round(float(r.rev or 0)),
                 'units':   int(r.units or 0)} for r in q[-24:]]
        return jsonify({'data': data})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Seasonal revenue by quarter (#2) ────────────────────────
@analyst_bp.route('/api/seasonal-quarter')
@login_required
@role_required("analyst")
def api_seasonal_quarter():
    try:
        q = db.session.query(
            extract('year',  Sale.date).label('yr'),
            extract('month', Sale.date).label('mo'),
            func.sum(Sale.revenue).label('rev')
        ).group_by('yr','mo').order_by('yr','mo').all()
        qtrs = {'Q1 Jan–Mar': 0, 'Q2 Apr–Jun': 0, 'Q3 Jul–Sep': 0, 'Q4 Oct–Dec': 0}
        for r in q:
            m = int(r.mo)
            v = float(r.rev or 0)
            if   m <= 3:  qtrs['Q1 Jan–Mar'] += v
            elif m <= 6:  qtrs['Q2 Apr–Jun'] += v
            elif m <= 9:  qtrs['Q3 Jul–Sep'] += v
            else:         qtrs['Q4 Oct–Dec'] += v
        return jsonify({'quarters': [{'q': k, 'rev': round(v)} for k, v in qtrs.items()]})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Inventory turnover by category (#4) — bubble chart ──────
@analyst_bp.route('/api/inv-turnover')
@login_required
@role_required("analyst")
def api_inv_turnover():
    try:
        sold = db.session.query(
            Category.name.label('cat'),
            func.sum(Sale.units_sold).label('units'),
            func.sum(Sale.revenue).label('rev')
        ).join(Product, Product.category_id == Category.id)\
         .join(Sale, Sale.product_id == Product.product_id)\
         .group_by(Category.name).all()

        avg_inv = db.session.query(
            Category.name.label('cat'),
            func.avg(Inventory.ending_inventory).label('avg_inv')
        ).join(Product, Product.category_id == Category.id)\
         .join(Inventory, Inventory.product_id == Product.product_id)\
         .group_by(Category.name).all()

        inv_map = {r.cat: float(r.avg_inv or 1) for r in avg_inv}
        result = []
        for r in sold:
            ai = inv_map.get(r.cat, 1) or 1
            result.append({
                'cat':      r.cat,
                'units':    int(r.units or 0),
                'revenue':  round(float(r.rev or 0)),
                'avg_inv':  round(ai, 1),
                'turnover': round(int(r.units or 0) / ai, 2)
            })
        result.sort(key=lambda x: x['turnover'], reverse=True)
        return jsonify({'items': result})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Stock level vs sales volume scatter (#5) ─────────────────
@analyst_bp.route('/api/stock-vs-sales')
@login_required
@role_required("analyst")
def api_stock_vs_sales():
    try:
        inv_q = db.session.query(
            Inventory.product_id,
            func.avg(Inventory.ending_inventory).label('avg_stock')
        ).group_by(Inventory.product_id).all()

        sales_q = db.session.query(
            Sale.product_id,
            func.sum(Sale.units_sold).label('total_units')
        ).group_by(Sale.product_id).all()

        s_map = {r.product_id: int(r.total_units or 0) for r in sales_q}
        pts = [{'product_id': r.product_id,
                'stock': round(float(r.avg_stock or 0), 1),
                'units': s_map.get(r.product_id, 0)} for r in inv_q]
        return jsonify({'points': pts})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Inventory levels by site — stacked data (#6) ─────────────
@analyst_bp.route('/api/inv-by-site')
@login_required
@role_required("analyst")
def api_inv_by_site():
    try:
        q = db.session.query(
            Inventory.site_id,
            func.sum(Inventory.beginning_inventory).label('opening'),
            func.sum(Inventory.ending_inventory).label('ending'),
            func.sum(Inventory.replenishment).label('replen')
        ).group_by(Inventory.site_id)\
         .order_by(func.sum(Inventory.ending_inventory).desc()).limit(12).all()
        return jsonify({'sites': [{'site_id': r.site_id,
            'opening': int(r.opening or 0),
            'ending':  int(r.ending  or 0),
            'replen':  int(r.replen  or 0)} for r in q]})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Customer age distribution (#7) ───────────────────────────
@analyst_bp.route('/api/customer-age')
@login_required
@role_required("analyst")
def api_customer_age():
    try:
        from models.records import Customer
        from sqlalchemy import case
        bucket = case(
            (Customer.age.between(18, 25), '18-25'),
            (Customer.age.between(26, 35), '26-35'),
            (Customer.age.between(36, 45), '36-45'),
            (Customer.age.between(46, 55), '46-55'),
            else_='55+'
        ).label('grp')
        q = db.session.query(bucket, func.count().label('cnt'))\
              .group_by('grp').all()
        order = ['18-25','26-35','36-45','46-55','55+']
        d = {r.grp: int(r.cnt) for r in q}
        return jsonify({'groups': [{'group': g, 'count': d.get(g, 0)} for g in order]})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Promo effectiveness before/during/after (#8) ─────────────
@analyst_bp.route('/api/promo-effect')
@login_required
@role_required("analyst")
def api_promo_effect():
    try:
        from datetime import timedelta
        before = during = after = 0.0
        for p in Promotion.query.all():
            if not p.start_date or not p.end_date: continue
            dur = max((p.end_date - p.start_date).days, 1)
            b_start = p.start_date - timedelta(days=dur)
            a_end   = p.end_date   + timedelta(days=dur)
            def rev(s, e):
                return float(db.session.query(func.sum(Sale.revenue))
                    .filter(Sale.product_id == p.product_id,
                            Sale.site_id    == p.site_id,
                            Sale.date >= s, Sale.date <= e)
                    .scalar() or 0)
            before += rev(b_start,    p.start_date)
            during += rev(p.start_date, p.end_date)
            after  += rev(p.end_date,   a_end)
        return jsonify({'periods': [
            {'label': 'Before Promo', 'rev': round(before)},
            {'label': 'During Promo', 'rev': round(during)},
            {'label': 'After Promo',  'rev': round(after)},
        ]})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# ── Avg delivery throughput by site (#9) ─────────────────────
@analyst_bp.route('/api/delivery-throughput')
@login_required
@role_required("analyst")
def api_delivery_throughput():
    try:
        q = db.session.query(
            Logistics.site_id,
            func.count().label('shipments'),
            func.avg(Logistics.quantity).label('avg_qty')
        ).group_by(Logistics.site_id)\
         .order_by(func.avg(Logistics.quantity).desc()).limit(12).all()
        return jsonify({'sites': [{'site_id': r.site_id,
            'shipments': int(r.shipments or 0),
            'avg_qty':   round(float(r.avg_qty or 0), 1)} for r in q]})
    except Exception as e:
        import traceback; print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
