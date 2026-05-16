from flask import Blueprint, render_template, request, jsonify, session
from models.records import Site, Inventory, Logistics, Sale, Product, Customer, Supplier,States
from models.purchase_order import PurchaseOrder
from models.sales_order import SalesOrder
from models.managers import Manager
from models.db import db
from routes.auth_routes import login_required, role_required, handle_errors, audit
from sqlalchemy import func
import uuid
from datetime import datetime, timedelta

manager_bp = Blueprint('manager', __name__, url_prefix='/manager')

# ── Helper: get manager object ──────────────────────────
def get_manager():
    return Manager.query.filter_by(user_id=session['user_id']).first()

# ── Helper: get ALL site IDs (all managers see all sites) ──
def get_site_ids():
    return [s.site_id for s in Site.query.all()]

# ── Page routes ────────────────────────────────────────
@manager_bp.route('/dashboard')
@login_required
@role_required('manager')
def dashboard():
    return render_template('manager/dashboard.html')

@manager_bp.route('/inventory')
@login_required
@role_required('manager')
def inventory():
    return render_template('manager/inventory.html')

@manager_bp.route('/sales')
@login_required
@role_required('manager')
def sales():
    return render_template('manager/sales.html')

@manager_bp.route('/logistics')
@login_required
@role_required('manager')
def logistics():
    return render_template('manager/logistics.html')

@manager_bp.route('/sites')
@login_required
@role_required('manager')
def sites():
    return render_template('manager/sites.html')

@manager_bp.route('/products')
@login_required
@role_required('manager')
def products():
    return render_template('manager/products.html')

# ── API: dashboard ─────────────────────────────────────



@manager_bp.route('/api/dashboard')
@login_required
@role_required('manager')
def api_dashboard():
    sids = get_site_ids()

    #  If no sites → return empty safely
    if not sids:
        return jsonify({
            'stats': {
                'sites': 0,
                'revenue': 0,
                'sales': 0,
                'low_stock': 0,
                'shipments': 0,
                'pending_orders': 0
            },
            'chart_revenue': [],
            'chart_top_products': [],
            'chart_so_status': [0,0,0],
            'chart_shipment_status': [0,0,0]
        })

    # ───────── STATS ─────────
    rev = db.session.query(func.coalesce(func.sum(Sale.revenue), 0))\
        .filter(Sale.site_id.in_(sids)).scalar()

    stats = {
        'sites': len(sids),
        'revenue': float(rev),
        'sales': Sale.query.filter(Sale.site_id.in_(sids)).count(),
        'low_stock': Inventory.query.filter(
            Inventory.site_id.in_(sids),
            func.lower(Inventory.stockout_flag) == 'yes'
        ).count(),
        'shipments': Logistics.query.filter(
            Logistics.site_id.in_(sids)
        ).count(),
        'pending_orders': SalesOrder.query.filter(
            SalesOrder.site_id.in_(sids),
            SalesOrder.status == 'pending'
        ).count()
    }

    # ───────── REVENUE LAST 7 DAYS ─────────
    import pytz as _pyt_m2
    last7 = datetime.now(_pyt_m2.timezone('Asia/Kolkata')).replace(tzinfo=None) - timedelta(days=6)

    # rev_trend = db.session.query(
    # Sale.date,
    # func.sum(Sale.revenue)
    # ).group_by(Sale.date).order_by(Sale.date).all()

    rev_trend = db.session.query(
    func.to_char(Sale.date, 'YYYY-MM'),
        func.sum(Sale.revenue)
    ).filter( Sale.site_id.in_(sids)).group_by(
        func.to_char(Sale.date, 'YYYY-MM')
    ).order_by(func.to_char(Sale.date, 'YYYY-MM')).all()
    # ───────── TOP PRODUCTS (NAME FIXED) ─────────
    top_products = db.session.query(
        Product.product_name,
        func.coalesce(func.sum(Sale.revenue), 0)
    ).join(Product, Product.product_id == Sale.product_id)\
     .filter(Sale.site_id.in_(sids))\
     .group_by(Product.product_name)\
     .order_by(func.sum(Sale.revenue).desc())\
     .limit(6).all()

    # ───────── SALES ORDER STATUS ─────────
    so = dict(
        db.session.query(SalesOrder.status, func.count())
        .filter(SalesOrder.site_id.in_(sids))
        .group_by(SalesOrder.status).all()
    )

    # ───────── SHIPMENT STATUS ─────────
    ship = dict(
        db.session.query(Logistics.delivery_status, func.count())
        .filter(Logistics.site_id.in_(sids))
        .group_by(Logistics.delivery_status).all()
    )

    # ───────── FINAL RESPONSE ─────────
    return jsonify({
        'stats': stats,
        'chart_revenue': [{'date': str(r[0]), 'revenue': float(r[1] or 0)} for r in rev_trend],
        'chart_top_products': [{'product_id': r[0], 'revenue': float(r[1] or 0)} for r in top_products],
        'chart_so_status': [so.get('pending',0), so.get('accepted',0), so.get('rejected',0)],
        'chart_shipment_status': [ship.get('Pending',0), ship.get('In Transit',0), ship.get('Delivered',0)]
  })
# ── API: inventory GET list / POST add product / PUT update stock ──
@manager_bp.route('/api/inventory', methods=['GET'])
@login_required
@role_required('manager')
@handle_errors
def api_inventory():
    sids = get_site_ids()
        # GET
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = Inventory.query.filter(Inventory.site_id.in_(sids))
    if search:
        q = q.filter(db.or_(Inventory.site_id.ilike(f'%{search}%'), Inventory.product_id.ilike(f'%{search}%')))
    pag = q.paginate(page=page, per_page=10, error_out=False)

    return jsonify({
        'items': [{
            'id': i.id,
            'site_id': i.site_id,
            'product_id': i.product_id,
            'beginning_inventory': i.beginning_inventory,
            'ending_inventory': i.ending_inventory,
            'replenishment': i.replenishment,
            'stockout_flag': i.stockout_flag
        } for i in pag.items],
        'total': pag.total,
        'page': pag.page,
        'pages': pag.pages,
        'has_prev': pag.has_prev,
        'has_next': pag.has_next
    })

# ── API: products for manager's sites ─────────────────
@manager_bp.route('/api/products', methods=['GET', 'POST'])
@login_required
@role_required('manager')
@handle_errors
def api_products():
    sids = get_site_ids()
    if request.method == 'POST':
        # Manager adds product to inventory for their sites
        d = request.get_json()
        site_id    = d.get('site_id')
        product_id = d.get('product_id')
        if site_id not in sids:
            return jsonify({'error': 'Site not in your state'}), 403
        inv = Inventory.query.filter_by(site_id=site_id, product_id=product_id).first()
        if inv:
            return jsonify({'error': 'Product already allocated to this site'}), 403
        else:
            inv = Inventory(site_id=site_id, product_id=product_id,
                beginning_inventory=0, ending_inventory=0, replenishment=0,
                stockout_flag='Yes')
            db.session.add(inv)
        db.session.commit()
        return jsonify({'ok': True})

    # Dropdown / list – products available in manager's sites
    if request.args.get('dropdown') == '1':
        # Return all products (to let manager pick which to add to inventory)
        items = Product.query.all()
        return jsonify({'items': [{'product_id': p.product_id, 'product_name': p.product_name,
            'unit_price': p.unit_price} for p in items]})

    # Products currently in inventory for this manager's sites
    page        = request.args.get('page', 1, type=int)
    category_id = request.args.get('category_id', '', type=str)
    search      = request.args.get('search', '').strip()
    inv_records = Inventory.query.filter(Inventory.site_id.in_(sids)).all()
    product_ids = list(set([i.product_id for i in inv_records]))
    q = Product.query.filter(Product.product_id.in_(product_ids))
    if category_id:
        q = q.filter_by(category_id=int(category_id))
    if search:
        q = q.filter(Product.product_name.ilike(f'%{search}%'))
    pag = q.paginate(page=page, per_page=20)
    return jsonify({'items': [{'product_id': p.product_id, 'product_name': p.product_name,
        'unit_price': p.unit_price, 'unit_cost': p.unit_cost,
        'category_id': p.category_id,
        'subcategory_id': p.subcategory_id,
        'category': p.category.name if p.category else '',
        'subcategory': p.subcategory.name if p.subcategory else ''
        }
        for p in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

# ── API: sales ─────────────────────────────────────────
@manager_bp.route('/api/sales')
@login_required
@role_required('manager')
def api_sales():
    sids = get_site_ids()
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = Sale.query.filter(Sale.site_id.in_(sids))
    if search:
        q = q.filter(db.or_(Sale.site_id.ilike(f'%{search}%'), Sale.product_id.ilike(f'%{search}%'), Sale.customer_id.ilike(f'%{search}%')))
    pag = q.order_by(Sale.date.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [{'id': s.id, 'date': str(s.date), 'site_id': s.site_id,
        'product_id': s.product_id, 'customer_id': s.customer_id, 'units_sold': s.units_sold,
        'revenue': s.revenue, 'discounts': s.discounts, 'returns': s.returns} for s in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

# ── API: logistics ─────────────────────────────────────
@manager_bp.route('/api/logistics')
@login_required
@role_required('manager')
def api_logistics():
    sids = get_site_ids()
    page    = request.args.get('page', 1, type=int)
    per_page= request.args.get('per_page', 20, type=int)
    search  = request.args.get('search', '').strip()
    so_id   = request.args.get('so_id', '', type=str)
    q = Logistics.query.filter(Logistics.site_id.in_(sids))
    if so_id:
        q = q.filter(Logistics.sales_order_id == int(so_id))
    if search:
        q = q.filter(db.or_(Logistics.shipment_id.ilike(f'%{search}%'), Logistics.site_id.ilike(f'%{search}%'), Logistics.product_id.ilike(f'%{search}%'), Logistics.delivery_status.ilike(f'%{search}%')))
    pag = q.order_by(Logistics.shipment_date.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({'items': [{'id': l.id, 'shipment_id': l.shipment_id, 'site_id': l.site_id,
        'product_id': l.product_id, 'shipment_date': str(l.shipment_date),
        'quantity': l.quantity, 'delivery_status': l.delivery_status,
        'transportation_type': l.transportation_type,
        'sales_order_id': getattr(l, 'sales_order_id', None)} for l in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

# ── API: sites ─────────────────────────────────────────
@manager_bp.route('/api/sites')
@login_required
@role_required('manager')
def api_sites():
    items = Site.query.order_by(Site.site_name).all()
    if request.args.get('dropdown') == '1':
        return jsonify({'items': [{'site_id': s.site_id, 'site_name': s.site_name} for s in items]})
    return jsonify({'items': [{'site_id': s.site_id, 'site_name': s.site_name,
        'site_format': s.site_format, 'city': s.city, 'store_size': s.store_size,
        'open_date': str(s.open_date), 'status': s.status} for s in items],
        'total': len(items)})


# ══════════════════════════════════════════════════════════
#  MANAGER: PURCHASE ORDERS (restricted to manager's sites)
# ══════════════════════════════════════════════════════════

@manager_bp.route('/purchase-orders')
@login_required
@role_required('manager')
def purchase_orders():
    return render_template('manager/purchase_orders.html')

@manager_bp.route('/api/purchase-orders', methods=['GET', 'POST'])
@login_required
@role_required('manager')
@handle_errors
def api_purchase_orders():
    from routes.auth_routes import audit
    sids = get_site_ids()
    if request.method == 'POST':
        d = request.get_json()
        site_id    = d.get('site_id', '').strip()
        product_id = d.get('product_id', '').strip()
        qty        = int(d.get('quantity', 0))
        supplier_id = d.get('supplier_id')
        exp_del     = d.get('expected_delivery')
        if site_id not in sids:
            return jsonify({'error': 'Not your site'}), 403
        if not all([supplier_id, site_id, product_id, qty]):
            return jsonify({'error': 'All fields required'}), 400
        count = PurchaseOrder.query.count() + 1
        po_num = f'PO-{count:04d}'
        while PurchaseOrder.query.filter_by(po_number=po_num).first():
            count += 1
            po_num = f'PO-{count:04d}'
        user_email = session.get('email', 'manager')
        po = PurchaseOrder(
            po_number=po_num,
            supplier_id=int(supplier_id),
            site_id=site_id,
            product_id=product_id,
            quantity=qty,
            expected_delivery=exp_del,
            status='sent',
            placed_by=user_email,
            placed_by_role='manager'
        )
        db.session.add(po)
        db.session.commit()
        audit('CREATE', 'purchase_orders', po.id, f'Manager created PO: {po_num} for site {site_id}')
        sup = Supplier.query.get(int(supplier_id))
        try:
            from app import mail
            from utils.email import send_po_to_supplier
            send_po_to_supplier(mail, sup.email, sup.supplier_name, po)
        except Exception:
            pass
        return jsonify({'ok': True, 'po_number': po_num, 'id': po.id})
    # GET - only POs for manager's sites
    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    q = PurchaseOrder.query.filter(PurchaseOrder.site_id.in_(sids))
    if status:
        q = q.filter_by(status=status)
    pag = q.order_by(PurchaseOrder.created_at.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [po.to_dict() for po in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@manager_bp.route('/api/purchase-orders/<int:pid>', methods=['PUT'])
@login_required
@role_required('manager')
@handle_errors
def api_purchase_order(pid):
    from routes.auth_routes import audit
    from models.records import Inventory
    sids = get_site_ids()
    po = PurchaseOrder.query.get_or_404(pid)
    if po.site_id not in sids:
        return jsonify({'error': 'Not your site'}), 403
    d = request.get_json()
    action = d.get('action', d.get('status', ''))
    if action == 'received':
        if po.status not in ('sent', 'draft'):
            return jsonify({'error': 'Only sent or draft orders can be marked as received'}), 400
        po.status = 'received'
        # Update inventory replenishment
        inv = Inventory.query.filter_by(site_id=po.site_id, product_id=po.product_id).first()
        if inv:
            inv.replenishment = (inv.replenishment or 0) + po.quantity
            inv.ending_inventory = (inv.ending_inventory or 0) + po.quantity
            inv.stockout_flag = 'No' if (inv.ending_inventory or 0) > 0 else 'Yes'
        db.session.commit()
        audit('UPDATE', 'purchase_orders', pid, f'Manager marked PO {po.po_number} received → inventory updated')
        return jsonify({'ok': True})
    elif action in ('cancelled', 'cancel'):
        if po.status in ('received', 'cancelled'):
            return jsonify({'error': 'Cannot cancel a received or already cancelled order'}), 400
        po.status = 'cancelled'
        db.session.commit()
        audit('UPDATE', 'purchase_orders', pid, f'Manager cancelled PO {po.po_number}')
        return jsonify({'ok': True})
    else:
        po.status = d.get('status', po.status)
        db.session.commit()
        audit('UPDATE', 'purchase_orders', pid, f'Manager updated PO {po.po_number} → {po.status}')
        return jsonify({'ok': True})


@manager_bp.route('/customers')
@login_required
@role_required('manager')
def customers():
    return render_template('manager/customers.html')

@manager_bp.route('/api/customers', methods=['GET'])
@login_required
@role_required('manager')
def api_customers():
    from models.records import Customer
    # mgr = get_manager()
    # state_id = mgr.state_id if mgr else None
    q = Customer.query
    # if state_id:
    #     q = q.filter_by(state_id=state_id)
    search = request.args.get('search', '').strip()
    if search:
        q = q.filter(db.or_(
            Customer.customer_id.ilike(f'%{search}%'),
            Customer.email.ilike(f'%{search}%') if hasattr(Customer, 'email') else False,
        ))
    items = q.order_by(Customer.id).limit(200).all()
    def cust_dict(c):
        d = {'id': c.id, 'customer_id': c.customer_id, 'age': c.age, 'gender': c.gender,
             'income_bracket': c.income_bracket, 'purchase_frequency': c.purchase_frequency,
             'average_spend': c.average_spend}
        if hasattr(c, 'email'): d['email'] = c.email
        if hasattr(c, 'phone'): d['phone'] = c.phone
        if hasattr(c, 'state_id'): d['state_id'] = c.state_id
        return d
    return jsonify({'items': [cust_dict(c) for c in items], 'total': len(items)})


@manager_bp.route('/api/states', methods=['GET'])
@login_required
@role_required('manager')
def api_states():
    from models.records import States
    states = States.query.order_by(States.state_name).all()
    return jsonify([{'id': s.state_id, 'name': s.state_name} for s in states])

@manager_bp.route('/api/customers-dropdown', methods=['GET'])
@login_required
@role_required('manager')
def api_customers_dropdown():
    """Customers dropdown for SO creation - all customers visible to all managers."""
    from models.records import Customer
    items = Customer.query.order_by(Customer.id).all()
    def cust_dict(c):
        d = {'id': c.id, 'customer_id': c.customer_id}
        if hasattr(c, 'email'): d['email'] = c.email or ''
        return d
    return jsonify({'items': [cust_dict(c) for c in items]})

@manager_bp.route('/api/suppliers', methods=['GET'])
@login_required
@role_required('manager')
def api_suppliers():
    items = Supplier.query.order_by(Supplier.id).all()
    return jsonify({'items': [{'id': s.id, 'supplier_pk': s.supplier_pk,
        'supplier_name': s.supplier_name, 'email': s.email} for s in items]})



@manager_bp.route('/api/inventory-by-site', methods=['GET'])
@login_required
@role_required('manager')
def api_inventory_by_site():
    site_id = request.args.get('site_id', '').strip()
    sids = get_site_ids()
    if not site_id or site_id not in sids:
        return jsonify({'items': []})
    items = Inventory.query.filter_by(site_id=site_id).all()
    result = []
    for i in items:
        if (i.ending_inventory or 0) <= 0: continue
        prod = Product.query.filter_by(product_id=i.product_id).first()
        name = prod.product_name if prod else i.product_id
        sub  = (prod.subcategory.name if prod and prod.subcategory else '')
        label = (name + ' (' + sub + ')') if sub else name
        from datetime import date as _td
        _today = _td.today()
        from models.records import Promotion as _Pr
        ap = _Pr.query.filter_by(site_id=site_id, product_id=i.product_id)            .filter(_Pr.start_date <= _today, _Pr.end_date >= _today).first()
        base_p = (prod.unit_price or 0) if prod else 0
        if ap and ap.discount_type == 'Percentage':
            dp = round(base_p * (1 - ap.discount_amount / 100), 2)
        elif ap and ap.discount_type == 'Flat':
            dp = max(0, round(base_p - ap.discount_amount, 2))
        else:
            dp = base_p
        result.append({'product_id': i.product_id, 'label': label,
            'product_name': name, 'subcategory': sub,
            'ending_inventory': i.ending_inventory or 0,
            'unit_price': base_p, 'discounted_price': dp,
            'has_promo': ap is not None,
            'discount_type': ap.discount_type if ap else None,
            'discount_amount': ap.discount_amount if ap else 0})
    return jsonify({'items': result})

# ══════════════════════════════════════════════════════════
#  SALES ORDERS (Manager - restricted to manager's sites)
# ══════════════════════════════════════════════════════════

@manager_bp.route('/sales-orders')
@login_required
@role_required('manager')
def sales_orders():
    return render_template('manager/sales_orders.html')

@manager_bp.route('/api/sales-orders', methods=['GET', 'POST'])
@login_required
@role_required('manager')
@handle_errors
def api_sales_orders():
    from models.sales_order import SalesOrder, SalesOrderItem
    sids = get_site_ids()
    if request.method == 'POST':
        d = request.get_json()
        customer_id = d.get('customer_id', '').strip()
        site_id     = d.get('site_id', '').strip()
        items_data  = d.get('items', [])
        if site_id not in sids:
            return jsonify({'error': 'Site not in your state'}), 403
        if not customer_id or not site_id or not items_data:
            return jsonify({'error': 'Customer, site and at least one product required'}), 400
        count = SalesOrder.query.count() + 1
        ref = f'SO-{count:04d}'
        while SalesOrder.query.filter_by(order_ref=ref).first():
            count += 1; ref = f'SO-{count:04d}'
        total = 0.0
        so = SalesOrder(order_ref=ref, customer_id=customer_id, site_id=site_id,
                        status='pending', placed_by=session.get('email','manager'),
                        placed_by_role='manager')
        db.session.add(so)
        db.session.flush()
        for it in items_data:
            prod = Product.query.filter_by(product_id=it.get('product_id')).first()
            base_price = prod.unit_price if prod else 0.0
            price = float(it.get('unit_price', base_price)) or base_price
            qty   = int(it.get('quantity', 0))
            line  = round(price * qty, 2)
            total += line
            db.session.add(SalesOrderItem(order_id=so.id, product_id=it['product_id'],
                                          quantity=qty, unit_price=price, line_total=line))
        so.total_amount = round(total, 2)
        db.session.commit()
        audit('CREATE', 'sales_orders', so.id, f'Manager created SO {ref}')
        return jsonify({'ok': True, 'order_ref': ref, 'id': so.id})

    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    search = request.args.get('search', '').strip()
    q = SalesOrder.query.filter(SalesOrder.site_id.in_(sids))
    if status: q = q.filter_by(status=status)
    if search: q = q.filter(db.or_(SalesOrder.order_ref.ilike(f'%{search}%'),
                                    SalesOrder.customer_id.ilike(f'%{search}%')))
    pag = q.order_by(SalesOrder.created_at.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [o.to_dict() for o in pag.items],
                    'total': pag.total, 'page': pag.page, 'pages': pag.pages,
                    'has_prev': pag.has_prev, 'has_next': pag.has_next})

@manager_bp.route('/api/sales-orders/<int:oid>', methods=['PUT'])
@login_required
@role_required('manager')
@handle_errors
def api_sales_order_action(oid):
    from models.sales_order import SalesOrder
    from models.records import Logistics
    sids = get_site_ids()
    so = SalesOrder.query.get_or_404(oid)
    if so.site_id not in sids:
        return jsonify({'error': 'Not your site'}), 403
    d = request.get_json()
    action = d.get('action')
    if action not in ('accept', 'reject', 'in_transit', 'delivered'):
        return jsonify({'error': 'Invalid action'}), 400
    if so.status != 'pending':
        return jsonify({'error': 'Order already processed'}), 400
    if action == 'accept':
        so.status = 'accepted'
        db.session.flush()
        import uuid as _uuid
        for it in so.items:
            ship_id = 'SHP-' + str(_uuid.uuid4())[:8].upper()
            log = Logistics(shipment_id=ship_id, site_id=so.site_id,
                            product_id=it.product_id, quantity=it.quantity,
                            delivery_status='Pending', transportation_type='Road')
            log.sales_order_id = so.id
            db.session.add(log)
        db.session.commit()
        audit('UPDATE', 'sales_orders', oid, f'Manager accepted SO {so.order_ref}')
        return jsonify({'ok': True, 'status': so.status, 'order_ref': so.order_ref})
    else:
        so.status = 'rejected'
        so.note   = d.get('note', '')
        db.session.commit()
        audit('UPDATE', 'sales_orders', oid, f'Manager rejected SO {so.order_ref}')
        return jsonify({'ok': True, 'status': so.status})

@manager_bp.route('/api/logistics/<int:lid>', methods=['PUT', 'DELETE'])
@login_required
@role_required('manager')
@handle_errors
def api_logistic_update(lid):
    sids = get_site_ids()
    l = Logistics.query.get_or_404(lid)
    if l.site_id not in sids:
        return jsonify({'error': 'Not your site'}), 403
    if request.method == 'DELETE':
        db.session.delete(l); db.session.commit()
        audit('UPDATE', 'logistics', lid, 'Deleted shipment')
        return jsonify({'ok': True})
    d = request.get_json()
    if l.delivery_status in ('Delivered', 'Cancelled'):
        return jsonify({'error': f'{l.delivery_status} shipments cannot be modified.'}), 400
    old_status            = l.delivery_status
    l.delivery_status     = d.get('delivery_status', l.delivery_status)
    l.transportation_type = d.get('transportation_type', l.transportation_type)
    l.quantity            = d.get('quantity', l.quantity)
    if old_status != 'Delivered' and l.delivery_status == 'Delivered':
        inv = Inventory.query.filter_by(site_id=l.site_id, product_id=l.product_id).first()
        if inv:
            inv.ending_inventory = max(0, (inv.ending_inventory or 0) - l.quantity)
            inv.stockout_flag    = 'Yes' if inv.ending_inventory == 0 else 'No'
        from models.sales_order import SalesOrder
        from datetime import date as _date, datetime as _dt_m
        import pytz as _pytz_m
        so_id = getattr(l, 'sales_order_id', None)
        if so_id:
            so = SalesOrder.query.get(so_id)
            if so:
                prod_m = Product.query.filter_by(product_id=l.product_id).first()
                base_pm = prod_m.unit_price if prod_m else 0.0
                from datetime import date as _today_m
                today_m = _today_m.today()
                ap_m = Promotion.query.filter_by(
                    site_id=so.site_id, product_id=l.product_id
                ).filter(Promotion.start_date <= today_m, Promotion.end_date >= today_m).first()
                if ap_m and ap_m.discount_type == 'Percentage':
                    price = round(base_pm * (1 - ap_m.discount_amount / 100), 2)
                elif ap_m and ap_m.discount_type == 'Flat':
                    price = max(0, round(base_pm - ap_m.discount_amount, 2))
                else:
                    price = base_pm
                disc_m = round((base_pm - price) * l.quantity, 2)
                sale = Sale(site_id=l.site_id, product_id=l.product_id,
                            customer_id=so.customer_id, units_sold=l.quantity,
                            revenue=round(price*l.quantity,2), discounts=disc_m, returns=0,
                            date=_dt_m.now(_pytz_m.timezone('Asia/Kolkata')).date())
                db.session.add(sale)
        audit('UPDATE', 'logistics', lid, f'Delivered {l.shipment_id}')
    else:
        audit('UPDATE', 'logistics', lid, f'Updated shipment {l.shipment_id}')
    db.session.commit()
    return jsonify({'ok': True})


@manager_bp.route('/api/logistics/<int:lid>/deliver', methods=['PUT'])
@login_required
@role_required('manager')
@handle_errors
def api_logistic_deliver(lid):
    from models.records import Inventory
    sids = get_site_ids()
    l = Logistics.query.get_or_404(lid)
    if l.site_id not in sids:
        return jsonify({'error': 'Not your site'}), 403
    if l.delivery_status == 'Delivered':
        return jsonify({'error': 'Already delivered'}), 400
    l.delivery_status = 'Delivered'
    inv = Inventory.query.filter_by(site_id=l.site_id, product_id=l.product_id).first()
    if inv:
        inv.ending_inventory = max(0, (inv.ending_inventory or 0) - l.quantity)
        inv.stockout_flag    = 'Yes' if inv.ending_inventory == 0 else 'No'
    db.session.commit()
    audit('UPDATE', 'logistics', lid, f'Delivered {l.shipment_id} → inventory reduced')
    return jsonify({'ok': True})

# ── RETURNS (Manager) ─────────────────────────────────
@manager_bp.route('/api/returns/delivered-orders', methods=['GET'])
@login_required
@role_required('manager')
def api_mgr_delivered_orders():
    from models.sales_order import SalesOrder, SalesOrderItem
    from models.purchase_order import PurchaseOrder
    sids = get_site_ids()
    order_type = request.args.get('type', 'sales')

    if order_type == 'sales':
        orders = SalesOrder.query.filter_by(status='delivered').filter(
            SalesOrder.site_id.in_(sids)).order_by(SalesOrder.id.desc()).all()
        result = []
        for o in orders:
            for item in o.items:
                result.append({
                    'order_id': o.id, 'order_ref': o.order_ref,
                    'product_id': item.product_id,
                    'product_name': item.product.product_name if item.product else '',
                    'site_id': o.site_id, 'quantity': item.quantity,
                    'unit_price': item.unit_price,
                    'label': f"{o.order_ref} — {item.product_id} (qty: {item.quantity})"
                })
        return jsonify({'items': result})
    else:
        orders = PurchaseOrder.query.filter_by(status='received').filter(
            PurchaseOrder.site_id.in_(sids)).order_by(PurchaseOrder.id.desc()).all()
        result = []
        for o in orders:
            prod = o.product
            result.append({
                'order_id': o.id, 'order_ref': o.po_number,
                'product_id': o.product_id,
                'product_name': prod.product_name if prod else '',
                'site_id': o.site_id, 'quantity': o.quantity,
                'unit_price': prod.unit_cost if prod else 0.0,
                'label': f"{o.po_number} — {o.product_id} (qty: {o.quantity})"
            })
        return jsonify({'items': result})


@manager_bp.route('/api/returns', methods=['POST'])
@login_required
@role_required('manager')
def api_mgr_create_return():
    """Proxy to admin return logic, scoped to manager sites."""
    from flask import current_app
    from models.returns import OrderReturn
    from models.records import Inventory, Sale, Product
    from models.sales_order import SalesOrder, SalesOrderItem
    from models.purchase_order import PurchaseOrder
    from flask_login import current_user

    sids = get_site_ids()
    d = request.get_json() or {}
    order_type = d.get('order_type')
    order_id   = d.get('order_id')
    product_id = d.get('product_id')
    return_qty = int(d.get('return_qty', 0))
    reason     = d.get('reason', '').strip()

    if order_type not in ('sales', 'purchase'):
        return jsonify({'error': 'Invalid order type'}), 400
    if not order_id or not product_id or return_qty <= 0:
        return jsonify({'error': 'Order, product, and a positive return quantity are required'}), 400

    if order_type == 'sales':
        so = SalesOrder.query.get_or_404(order_id)
        if so.site_id not in sids:
            return jsonify({'error': 'Not your site'}), 403
        if so.status != 'delivered':
            return jsonify({'error': 'Only delivered sales orders can be returned'}), 400
        item = SalesOrderItem.query.filter_by(order_id=order_id, product_id=product_id).first()
        if not item:
            return jsonify({'error': 'Product not found in this order'}), 404
        if return_qty > item.quantity:
            return jsonify({'error': f'Return qty exceeds ordered qty ({item.quantity})'}), 400
        unit_price = item.unit_price
        return_amount = round(unit_price * return_qty, 2)
        inv = Inventory.query.filter_by(site_id=so.site_id, product_id=product_id).first()
        if inv:
            inv.ending_inventory = (inv.ending_inventory or 0) + return_qty
            inv.stockout_flag = 'No'
        sale = Sale.query.filter_by(site_id=so.site_id, product_id=product_id,
                                    customer_id=so.customer_id).order_by(Sale.date.desc()).first()
        if sale:
            sale.returns = (sale.returns or 0) + return_qty
            sale.revenue = max(0, (sale.revenue or 0) - return_amount)
        ret_count  = OrderReturn.query.count() + 1
        return_ref = f'RET-SO-{ret_count:04d}'
        ret = OrderReturn(return_ref=return_ref, order_type='sales', order_id=order_id,
            order_ref=so.order_ref, product_id=product_id, site_id=so.site_id,
            return_qty=return_qty, unit_price=unit_price, return_amount=return_amount,
            reason=reason, created_by=session.get('email', 'manager'))
        db.session.add(ret)
        db.session.commit()
        from routes.auth_routes import audit
        audit('CREATE', 'order_returns', ret.id, f'Manager SO return {return_ref}: {return_qty}x {product_id}')
        return jsonify({'ok': True, 'return_ref': return_ref, 'return_amount': return_amount,
                        'message': f'Return processed. {return_qty} units added back to inventory. ₹{return_amount:,.2f} credited.'})
    else:
        po = PurchaseOrder.query.get_or_404(order_id)

        if po.status != 'received':
            return jsonify({'error': 'Only received purchase orders can be returned'}), 400

        if return_qty > po.quantity:
            return jsonify({'error': f'Return qty exceeds PO qty ({po.quantity})'}), 400

        prod = Product.query.filter_by(product_id=po.product_id).first()
        unit_cost = prod.unit_cost if prod else 0.0
        return_amount = round(unit_cost * return_qty, 2)
        inv = Inventory.query.filter_by(site_id=po.site_id, product_id=po.product_id).first()
        if inv:
            inv.ending_inventory = max(0, (inv.ending_inventory or 0) - return_qty)
            inv.replenishment    = max(0, (inv.replenishment or 0) - return_qty)
            inv.stockout_flag = 'Yes' if inv.ending_inventory == 0 else 'No'
        ret_count  = OrderReturn.query.count() + 1
        return_ref = f'RET-PO-{ret_count:04d}'
        ret = OrderReturn(return_ref=return_ref, order_type='purchase', order_id=order_id,
            order_ref=po.po_number, product_id=po.product_id, site_id=po.site_id,
            return_qty=return_qty, unit_price=unit_cost, return_amount=return_amount,
            reason=reason, created_by=session.get('email', 'manager'))
        db.session.add(ret)
        db.session.commit()
        from routes.auth_routes import audit
        audit('CREATE', 'order_returns', ret.id, f'Manager PO return {return_ref}: {return_qty}x {po.product_id}')
        return jsonify({'ok': True, 'return_ref': return_ref, 'return_amount': return_amount,
                        'message': f'Return processed. {return_qty} units removed from inventory. ₹{return_amount:,.2f} deducted.'})

