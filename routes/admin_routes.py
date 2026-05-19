from flask import Blueprint, render_template, request, jsonify, session, send_file, current_app
from werkzeug.security import generate_password_hash
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from datetime import date, timedelta, datetime
from collections import defaultdict
import uuid
import pytz

from models.db import db
from models.user import User
from models.managers import Manager
from models.records import Product, Site, Inventory, Logistics, Sale, Promotion, States, Customer, Supplier
from models.purchase_order import PurchaseOrder
from models.sales_order import SalesOrder, SalesOrderItem
from models.contact import ContactMessage
from models.audit import AuditLog
from models.catogery import Category
from models.sub_catogery import SubCategory
from models.returns import OrderReturn
from routes.auth_routes import login_required, role_required, handle_errors, random_password, audit, update_inventory_from_po
from utils.email import send_po_to_supplier, send_credentials_email, _send 

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# ── Page routes ─────────────────────────────────────────

@admin_bp.route('/dashboard')
@login_required
@role_required('admin')
def dashboard():
    return render_template('admin/dashboard.html')

@admin_bp.route('/products')
@login_required
@role_required('admin')
def products():
    return render_template('admin/products.html')

@admin_bp.route('/inventory')
@login_required
@role_required('admin')
def inventory():
    return render_template('admin/inventory.html')

@admin_bp.route('/sales')
@login_required
@role_required('admin')
def sales():
    return render_template('admin/sales.html')

@admin_bp.route('/logistics')
@login_required
@role_required('admin')
def logistics():
    return render_template('admin/logistics.html')

@admin_bp.route('/sites')
@login_required
@role_required('admin')
def sites():
    return render_template('admin/sites.html')

@admin_bp.route('/promotions')
@login_required
@role_required('admin')
def promotions():
    return render_template('admin/promotions.html')

@admin_bp.route('/audit-log')
@login_required
@role_required('admin')
def audit_log():
    return render_template('admin/audit_log.html')

@admin_bp.route('/suppliers')
@login_required
@role_required('admin')
def suppliers():
    return render_template('admin/suppliers.html')

@admin_bp.route('/purchase-orders')
@login_required
@role_required('admin')
def purchase_orders():
    return render_template('admin/purchase_orders.html')

@admin_bp.route('/sales-orders')
@login_required
@role_required('admin')
def sales_orders():
    return render_template('admin/sales_orders.html')

@admin_bp.route('/customers')
@login_required
@role_required('admin')
def customers():
    return render_template('admin/customers.html')

@admin_bp.route('/users')
@login_required
@role_required('admin')
def users():
    return render_template('admin/users.html')

@admin_bp.route('/messages')
@login_required
@role_required('admin')
def messages():
    return render_template('admin/messages.html')

# ── API: dashboard ──────────────────────────────────────

@admin_bp.route('/api/dashboard')
@login_required
def api_dashboard():
    today = date.today()
    days7 = [(today - timedelta(days=i)) for i in range(6, -1, -1)]
    rev_by_day = defaultdict(float)
    for s in Sale.query.filter(Sale.date >= days7[0]).all():
        rev_by_day[str(s.date)] += s.revenue or 0
    chart_revenue    = [{'date': str(d), 'revenue': round(rev_by_day[str(d)], 2)} for d in days7]
    top_prods        = db.session.query(Sale.product_id, func.sum(Sale.revenue).label('rev')) \
        .group_by(Sale.product_id).order_by(func.sum(Sale.revenue).desc()).limit(6).all()
    chart_top_products = [{'product_id': r[0], 'revenue': round(r[1] or 0, 2)} for r in top_prods]
    so_pending  = SalesOrder.query.filter_by(status='pending').count()
    so_accepted = SalesOrder.query.filter_by(status='accepted').count()
    so_rejected = SalesOrder.query.filter_by(status='rejected').count()
    log_pending = Logistics.query.filter_by(delivery_status='Pending').count()
    log_transit = Logistics.query.filter_by(delivery_status='In Transit').count()
    log_done    = Logistics.query.filter_by(delivery_status='Delivered').count()
    stock_val   = db.session.query(func.sum(Inventory.ending_inventory * Product.unit_cost)) \
        .join(Product, Product.product_id == Inventory.product_id).scalar()
    return jsonify({
        'stats': {
            'products':          Product.query.count(),
            'sites':             Site.query.count(),
            'revenue':           round(db.session.query(func.sum(Sale.revenue)).scalar() or 0),
            'sales':             Sale.query.count(),
            'low_stock':         Inventory.query.filter_by(stockout_flag='Yes').count(),
            'promos':            Promotion.query.count(),
            'shipments':         Logistics.query.count(),
            'total_stock_value': round(stock_val or 0, 2),
        },
        'chart_revenue':         chart_revenue,
        'chart_top_products':    chart_top_products,
        'chart_so_status':       [so_pending, so_accepted, so_rejected],
        'chart_shipment_status': [log_pending, log_transit, log_done],
    })

# ── API: states ─────────────────────────────────────────

@admin_bp.route('/api/states', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_states():
    if request.method == 'POST':
        d    = request.get_json()
        name = d.get('state_name', '').strip()
        if not name:
            return jsonify({'error': 'State name required'}), 400
        if States.query.filter_by(state_name=name).first():
            return jsonify({'error': 'State already exists'}), 400
        s = States(state_name=name)
        db.session.add(s); db.session.commit()
        audit('CREATE', 'states', s.state_id, f'Created state: {name}')
        return jsonify({'state_id': s.state_id, 'state_name': s.state_name})
    allocated = {m.state_id for m in Manager.query.all()}
    return jsonify([{'id': s.state_id, 'name': s.state_name, 'taken': s.state_id in allocated}
                    for s in States.query.order_by(States.state_name).all()])

# ── API: products ───────────────────────────────────────

@admin_bp.route('/api/products', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_products():
    if request.method == 'POST':
        d   = request.get_json()
        pid = 'PRD' + str(uuid.uuid4())[:8].upper()
        p   = Product(product_id=pid, product_name=d.get('product_name'),
                      category_id=d.get('category_id'), subcategory_id=d.get('subcategory_id'),
                      unit_cost=float(d.get('unit_cost', 0)), unit_price=float(d.get('unit_price', 0)),
                      shelf_life=int(d.get('shelf_life', 0)))
        db.session.add(p); db.session.commit()
        return jsonify({'ok': True})
    if request.args.get('dropdown') == '1':
        if request.args.get('type') == 'inventory':
            return jsonify({'items': [{'product_id': p.product_id, 'product_name': p.product_name}
                                      for p in Product.query.all()]})
        return jsonify({
            'categories':    [{'id': c.id, 'name': c.name} for c in Category.query.all()],
            'subcategories': [{'id': s.id, 'name': s.name, 'category_id': s.category_id}
                              for s in SubCategory.query.all()]
        })
    page        = request.args.get('page', 1, type=int)
    category_id = request.args.get('category_id', '', type=str)
    search      = request.args.get('search', '').strip()
    q = Product.query
    if category_id: q = q.filter_by(category_id=int(category_id))
    if search:      q = q.filter(Product.product_name.ilike(f'%{search}%'))
    pag = q.paginate(page=page, per_page=20)
    return jsonify({
        'items': [{'id': p.id, 'product_id': p.product_id, 'product_name': p.product_name,
                   'category_id': p.category_id, 'subcategory_id': p.subcategory_id,
                   'category': p.category.name if p.category else '',
                   'subcategory': p.subcategory.name if p.subcategory else '',
                   'unit_cost': p.unit_cost, 'unit_price': p.unit_price,
                   'shelf_life': p.shelf_life} for p in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages
    })

@admin_bp.route('/api/products/<int:pid>', methods=['PUT', 'DELETE'])
@login_required
@handle_errors
def api_product(pid):
    p = Product.query.get_or_404(pid)
    if request.method == 'DELETE':
        db.session.delete(p); db.session.commit()
        audit('DELETE', 'products', pid, f'Deleted product: {p.product_name}')
        return jsonify({'ok': True})
    d = request.get_json()
    p.product_name   = d.get('product_name', p.product_name)
    p.category_id    = d.get('category_id', p.category_id)
    p.subcategory_id = d.get('subcategory_id', p.subcategory_id)
    p.unit_cost      = d.get('unit_cost', p.unit_cost)
    p.unit_price     = d.get('unit_price', p.unit_price)
    p.shelf_life     = d.get('shelf_life', p.shelf_life)
    db.session.commit()
    audit('UPDATE', 'products', pid, f'Updated product: {p.product_name}')
    return jsonify({'ok': True})

@admin_bp.route('/api/products/dropdown_sales', methods=['GET'])
@login_required
def api_products_sales_dropdown():
    return jsonify({'items': [{'product_id': p.product_id, 'product_name': p.product_name,
        'unit_price': p.unit_price} for p in Product.query.all()]})

# ── API: categories / subcategories ─────────────────────

@admin_bp.route('/api/categories', methods=['POST'])
@login_required
def add_category():
    d = request.get_json()
    c = Category(name=d.get('name'))
    db.session.add(c); db.session.commit()
    return jsonify({'id': c.id, 'name': c.name})

@admin_bp.route('/api/subcategories', methods=['POST'])
@login_required
def add_subcategory():
    d = request.get_json()
    s = SubCategory(name=d.get('name'), category_id=d.get('category_id'))
    db.session.add(s); db.session.commit()
    return jsonify({'id': s.id, 'name': s.name})

# ── API: inventory ──────────────────────────────────────

@admin_bp.route('/api/inventory', methods=['GET'])
@login_required
@handle_errors
def api_inventory():
    page     = request.args.get('page', 1, type=int)
    state_id = request.args.get('state_id', '', type=str)
    search   = request.args.get('search', '').strip()
    stockout = request.args.get('stockout', '').strip()
    q = Inventory.query
    if state_id:
        site_ids = [s.site_id for s in Site.query.filter_by(state_id=int(state_id)).all()]
        q = q.filter(Inventory.site_id.in_(site_ids))
    if search:
        q = q.filter(db.or_(Inventory.site_id.ilike(f'%{search}%'),
                             Inventory.product_id.ilike(f'%{search}%')))
    if stockout in ('Yes', 'No'):
        q = q.filter(Inventory.stockout_flag == stockout)
    pag      = q.paginate(page=page, per_page=20)
    sold_q   = db.session.query(Sale.site_id, Sale.product_id,
                                func.sum(Sale.units_sold).label('total_sold')) \
        .group_by(Sale.site_id, Sale.product_id).all()
    sold_map = {(r.site_id, r.product_id): int(r.total_sold or 0) for r in sold_q}
    def inv_row(i):
        begin  = i.beginning_inventory or 0
        replen = i.replenishment or 0
        ending = i.ending_inventory or 0
        return {'id': i.id, 'site_id': i.site_id, 'product_id': i.product_id,
                'beginning_inventory': begin, 'ending_inventory': ending,
                'replenishment': replen, 'stockout_flag': i.stockout_flag,
                'units_sold': max(max(0, begin + replen - ending),
                                  sold_map.get((i.site_id, i.product_id), 0))}
    return jsonify({'items': [inv_row(i) for i in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

# ── API: sites ──────────────────────────────────────────

@admin_bp.route('/api/sites', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_sites():
    if request.method == 'POST':
        d   = request.get_json()
        sid = 'SITE' + str(uuid.uuid4())[:4].upper()
        s   = Site(site_id=sid, site_name=d.get('site_name', '').strip(),
                   site_format=d.get('site_format', '').strip(),
                   region=d.get('region', '').strip(), city=d.get('city', '').strip(),
                   state_id=int(d.get('state_id')) if d.get('state_id') else None,
                   store_size=int(d.get('store_size', 0)), status=d.get('status', 'Active'))
        db.session.add(s); db.session.commit()
        return jsonify({'ok': True, 'site_id': s.site_id})
    if request.args.get('dropdown') == '1':
        return jsonify({'items': [{'site_id': s.site_id, 'site_name': s.site_name,
            'state_id': s.state_id} for s in Site.query.all()]})
    page     = request.args.get('page', 1, type=int)
    state_id = request.args.get('state_id', '', type=str)
    search   = request.args.get('search', '').strip()
    q = Site.query
    if state_id: q = q.filter_by(state_id=int(state_id))
    if search:
        q = q.filter(db.or_(Site.site_id.ilike(f'%{search}%'), Site.site_name.ilike(f'%{search}%'),
                             Site.city.ilike(f'%{search}%'), Site.region.ilike(f'%{search}%'),
                             Site.site_format.ilike(f'%{search}%')))
    pag        = q.paginate(page=page, per_page=20)
    all_items  = Site.query.all()
    states_map = {st.state_id: st.state_name for st in States.query.all()}
    return jsonify({
        'summary': {'total': len(all_items),
                    'active': sum(1 for s in all_items if s.status == 'Active'),
                    'inactive': sum(1 for s in all_items if s.status == 'Inactive'),
                    'regions': len({s.region for s in all_items if s.region})},
        'items': [{'id': s.id, 'site_id': s.site_id, 'site_name': s.site_name,
                   'site_format': s.site_format, 'region': s.region, 'city': s.city,
                   'state_id': s.state_id, 'state_name': states_map.get(s.state_id, ''),
                   'store_size': s.store_size, 'open_date': str(s.open_date), 'status': s.status}
                  for s in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/sites/<int:sid>', methods=['PUT', 'DELETE'])
@login_required
@handle_errors
def api_site(sid):
    s = Site.query.get_or_404(sid)
    if request.method == 'DELETE':
        db.session.delete(s); db.session.commit()
        audit('DELETE', 'sites', sid, f'Deleted site: {s.site_name}')
        return jsonify({'ok': True})
    d = request.get_json()
    s.site_name   = d.get('site_name', s.site_name)
    s.site_format = d.get('site_format', s.site_format)
    s.region      = d.get('region', s.region)
    s.city        = d.get('city', s.city)
    s.status      = d.get('status', s.status)
    if d.get('state_id'): s.state_id = int(d['state_id'])
    db.session.commit()
    audit('UPDATE', 'sites', sid, f'Updated site: {s.site_name}')
    return jsonify({'ok': True})

@admin_bp.route('/api/states-with-sites')
@login_required
def api_states_with_sites():
    result = []
    for s in States.query.order_by(States.state_name).all():
        sites = Site.query.filter_by(state_id=s.state_id).all()
        if sites:
            result.append({'state_id': s.state_id, 'state_name': s.state_name,
                           'sites': [{'site_id': x.site_id, 'site_name': x.site_name} for x in sites]})
    return jsonify({'items': result})

# ── API: sales ──────────────────────────────────────────

@admin_bp.route('/api/sales', methods=['GET'])
@login_required
@handle_errors
def api_sales():
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = Sale.query
    if search:
        q = q.filter(db.or_(Sale.site_id.ilike(f'%{search}%'),
                             Sale.product_id.ilike(f'%{search}%'),
                             Sale.customer_id.ilike(f'%{search}%')))
    pag = q.order_by(Sale.date.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [{'id': s.id, 'date': str(s.date), 'site_id': s.site_id,
        'product_id': s.product_id, 'customer_id': s.customer_id, 'units_sold': s.units_sold,
        'revenue': s.revenue, 'discounts': s.discounts, 'returns': s.returns} for s in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/sales/<int:sid>', methods=['DELETE'])
@login_required
@handle_errors
def api_sale(sid):
    s = Sale.query.get_or_404(sid)
    db.session.delete(s); db.session.commit()
    audit('DELETE', 'sales', sid, '')
    return jsonify({'ok': True})

# ── API: customers ──────────────────────────────────────

@admin_bp.route('/api/customers', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_customers():
    if request.method == 'POST':
        d     = request.get_json() or {}
        email = (d.get('email') or '').strip()
        phone = (d.get('phone') or '').strip()
        if email and Customer.query.filter_by(email=email).first():
            return jsonify({'error': 'A customer with this email already exists'}), 400
        count   = Customer.query.count() + 1
        cust_id = f'CUST{count:06d}'
        while Customer.query.filter_by(customer_id=cust_id).first():
            count += 1; cust_id = f'CUST{count:06d}'
        c = Customer(
            customer_id=cust_id,
            email=email or None,
            phone=phone or None,
            age=int(d['age']) if d.get('age') else None,
            gender=d.get('gender') or None,
            income_bracket=d.get('income_bracket') or None,
            purchase_frequency=int(d['purchase_frequency']) if d.get('purchase_frequency') else None,
            average_spend=float(d['average_spend']) if d.get('average_spend') else None,
        )
        db.session.add(c); db.session.commit()
        audit('CREATE', 'customers', c.id, f'Admin created customer: {cust_id}')
        return jsonify({'ok': True, 'customer_id': cust_id})
    if request.args.get('dropdown') == '1':
        return jsonify({'items': [{'customer_id': c.customer_id}
                                  for c in Customer.query.order_by(Customer.customer_id).all()]})
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = Customer.query
    if search:
        q = q.filter(db.or_(Customer.customer_id.ilike(f'%{search}%'),
                             Customer.email.ilike(f'%{search}%') if hasattr(Customer, 'email') else False))
    pag = q.order_by(Customer.customer_id).paginate(page=page, per_page=20)
    def cdict(c):
        row = {'id': c.id, 'customer_id': c.customer_id, 'age': c.age, 'gender': c.gender,
               'income_bracket': c.income_bracket, 'purchase_frequency': c.purchase_frequency,
               'average_spend': c.average_spend}
        if hasattr(c, 'email'): row['email'] = c.email or ''
        if hasattr(c, 'phone'): row['phone'] = c.phone or ''
        return row
    return jsonify({'items': [cdict(c) for c in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/customers-list', methods=['GET'])
@login_required
def api_customers_list():
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = Customer.query
    if search: q = q.filter(Customer.customer_id.ilike(f'%{search}%'))
    pag = q.order_by(Customer.customer_id).paginate(page=page, per_page=20)
    return jsonify({'items': [{'id': c.id, 'customer_id': c.customer_id, 'age': c.age,
        'gender': c.gender, 'income_bracket': c.income_bracket,
        'purchase_frequency': c.purchase_frequency, 'average_spend': c.average_spend}
        for c in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

# ── API: logistics ──────────────────────────────────────

@admin_bp.route('/api/logistics', methods=['GET'])
@login_required
def api_logistics():
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = Logistics.query
    if search:
        q = q.filter(db.or_(Logistics.shipment_id.ilike(f'%{search}%'),
                             Logistics.site_id.ilike(f'%{search}%'),
                             Logistics.product_id.ilike(f'%{search}%'),
                             Logistics.delivery_status.ilike(f'%{search}%')))
    pag = q.order_by(Logistics.shipment_date.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [{'id': l.id, 'shipment_id': l.shipment_id, 'site_id': l.site_id,
        'product_id': l.product_id, 'shipment_date': str(l.shipment_date),
        'quantity': l.quantity, 'delivery_status': l.delivery_status,
        'transportation_type': l.transportation_type,
        'sales_order_id': getattr(l, 'sales_order_id', None)} for l in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/logistics/<int:lid>', methods=['PUT', 'DELETE'])
@login_required
@handle_errors
def api_logistic(lid):
    l = Logistics.query.get_or_404(lid)
    if request.method == 'DELETE':
        db.session.delete(l); db.session.commit()
        audit('DELETE', 'logistics', lid, '')
        return jsonify({'ok': True})
    if l.delivery_status in ('Delivered', 'Cancelled'):
        return jsonify({'error': f'{l.delivery_status} shipments cannot be modified.'}), 400
    d          = request.get_json()
    old_status = l.delivery_status
    l.delivery_status     = d.get('delivery_status', l.delivery_status)
    l.transportation_type = d.get('transportation_type', l.transportation_type)
    l.quantity            = d.get('quantity', l.quantity)
    if old_status != 'Delivered' and l.delivery_status == 'Delivered':
        inv = Inventory.query.filter_by(site_id=l.site_id, product_id=l.product_id).first()
        if inv:
            inv.ending_inventory = max(0, (inv.ending_inventory or 0) - l.quantity)
            inv.stockout_flag    = 'Yes' if inv.ending_inventory == 0 else 'No'
        so_id = getattr(l, 'sales_order_id', None)
        if so_id:
            so = SalesOrder.query.get(so_id)
            if so:
                prod      = Product.query.filter_by(product_id=l.product_id).first()
                today_d   = date.today()
                ap        = Promotion.query.filter_by(site_id=so.site_id, product_id=l.product_id) \
                    .filter(Promotion.start_date <= today_d, Promotion.end_date >= today_d).first()
                base_p    = prod.unit_price if prod else 0.0
                disc_amt  = 0.0
                if ap and ap.discount_type == 'Percentage':
                    price = round(base_p * (1 - ap.discount_amount / 100), 2)
                    disc_amt = round((base_p - price) * l.quantity, 2)
                elif ap and ap.discount_type == 'Flat':
                    price = max(0, round(base_p - ap.discount_amount, 2))
                    disc_amt = round((base_p - price) * l.quantity, 2)
                else:
                    price = base_p
                db.session.add(Sale(site_id=l.site_id, product_id=l.product_id,
                    customer_id=so.customer_id, units_sold=l.quantity,
                    revenue=round(price * l.quantity, 2), discounts=round(disc_amt, 2), returns=0,
                    date=datetime.now(pytz.timezone('Asia/Kolkata')).date()))
                all_logs = Logistics.query.filter_by(sales_order_id=so_id).all()
                if all_logs and all(x.delivery_status == 'Delivered' for x in all_logs):
                    so.status = 'delivered'
        audit('UPDATE', 'logistics', lid, f'Delivered {l.shipment_id}')
    else:
        audit('UPDATE', 'logistics', lid, f'Updated shipment: {l.shipment_id}')
    db.session.commit()
    return jsonify({'ok': True})

@admin_bp.route('/api/logistics/<int:lid>/deliver', methods=['PUT'])
@login_required
@handle_errors
def api_logistic_deliver(lid):
    l = Logistics.query.get_or_404(lid)
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

# ── API: promotions ─────────────────────────────────────

@admin_bp.route('/api/promotions', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_promotions():
    if request.method == 'POST':
        d = request.get_json()
        site_id    = d.get('site_id', '').strip()
        product_id = d.get('product_id', '').strip()
        start_date = d.get('start_date', '').strip()
        end_date   = d.get('end_date', '').strip()
        dtype      = d.get('discount_type', '').strip()
        damount    = float(d.get('discount_amount', 0))
        if not all([site_id, product_id, start_date, end_date, dtype]):
            return jsonify({'error': 'All fields are required.'}), 400
        if Promotion.query.filter_by(site_id=site_id, product_id=product_id).first():
            return jsonify({'error': f'A promotion already exists for {product_id} at {site_id}.'}), 400
        promo_id = 'PROMO-' + uuid.uuid4().hex[:8].upper()
        promo    = Promotion(promotion_id=promo_id, site_id=site_id, product_id=product_id,
                             start_date=date.fromisoformat(start_date),
                             end_date=date.fromisoformat(end_date),
                             discount_type=dtype, discount_amount=damount)
        db.session.add(promo); db.session.commit()
        audit('CREATE', 'promotions', promo.id, f'Created promotion: {promo_id}')
        return jsonify({'ok': True, 'promotion_id': promo_id})
    page      = request.args.get('page', 1, type=int)
    search    = request.args.get('search', '').strip()
    all_items = Promotion.query.all()
    q = Promotion.query
    if search:
        q = q.filter(db.or_(Promotion.promotion_id.ilike(f'%{search}%'),
                             Promotion.product_id.ilike(f'%{search}%'),
                             Promotion.site_id.ilike(f'%{search}%')))
    pag = q.order_by(Promotion.id.desc()).paginate(page=page, per_page=20)
    return jsonify({'summary': {'total': len(all_items),
        'percentage': sum(1 for p in all_items if p.discount_type == 'Percentage'),
        'flat': sum(1 for p in all_items if p.discount_type == 'Flat'),
        'sites': len({p.site_id for p in all_items if p.site_id})},
        'items': [{'id': p.id, 'promotion_id': p.promotion_id, 'product_id': p.product_id,
            'site_id': p.site_id, 'start_date': str(p.start_date), 'end_date': str(p.end_date),
            'discount_type': p.discount_type, 'discount_amount': p.discount_amount} for p in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/promotions/<int:pid>', methods=['PUT', 'DELETE'])
@login_required
@handle_errors
def api_promotion(pid):
    p = Promotion.query.get_or_404(pid)
    if request.method == 'DELETE':
        db.session.delete(p); db.session.commit()
        audit('DELETE', 'promotions', pid, '')
        return jsonify({'ok': True})
    d = request.get_json()
    p.discount_type   = d.get('discount_type', p.discount_type)
    p.discount_amount = d.get('discount_amount', p.discount_amount)
    if d.get('start_date'): p.start_date = date.fromisoformat(d['start_date'])
    if d.get('end_date'):   p.end_date   = date.fromisoformat(d['end_date'])
    db.session.commit()
    audit('UPDATE', 'promotions', pid, f'Updated promotion: {p.promotion_id}')
    return jsonify({'ok': True})

@admin_bp.route('/api/products-at-site')
@login_required
def api_products_at_site():
    site_id = request.args.get('site_id', '').strip()
    if not site_id:
        return jsonify({'items': []})
    result = []
    for i in Inventory.query.filter_by(site_id=site_id).filter(Inventory.ending_inventory > 0).all():
        prod     = Product.query.filter_by(product_id=i.product_id).first()
        existing = Promotion.query.filter_by(site_id=site_id, product_id=i.product_id).first()
        result.append({'product_id': i.product_id,
                       'product_name': prod.product_name if prod else i.product_id,
                       'has_promo': existing is not None})
    return jsonify({'items': result})

# ── API: audit log ──────────────────────────────────────

@admin_bp.route('/api/audit-log')
@login_required
def api_audit_log():
    page   = request.args.get('page', 1, type=int)
    search = request.args.get('search', '').strip()
    q = AuditLog.query.options(joinedload(AuditLog.user))
    if search:
        q = q.filter(db.or_(AuditLog.action.ilike(f'%{search}%'),
                             AuditLog.table_name.ilike(f'%{search}%'),
                             AuditLog.detail.ilike(f'%{search}%')))
    pag = q.order_by(AuditLog.created_at.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [l.to_dict() for l in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

# ── API: messages ───────────────────────────────────────

@admin_bp.route('/api/messages', methods=['GET'])
@login_required
@role_required('admin')
def api_messages():
    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    q      = ContactMessage.query
    if status: q = q.filter_by(status=status)
    pag           = q.order_by(ContactMessage.created_at.desc()).paginate(page=page, per_page=20)
    pending_count = ContactMessage.query.filter_by(status='pending').count()
    return jsonify({'items': [m.to_dict() for m in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next,
        'pending_count': pending_count})

@admin_bp.route('/api/messages/<int:mid>', methods=['PUT'])
@login_required
@role_required('admin')
@handle_errors
def api_message_action(mid):
    msg    = ContactMessage.query.get_or_404(mid)
    d      = request.get_json()
    action = d.get('status')
    if action not in ('accepted', 'rejected'):
        return jsonify({'error': 'Invalid action'}), 400
    msg.status = action
    db.session.commit()
    audit('UPDATE', 'contact_messages', mid,
          f'Message from {msg.email} ({msg.join_type}) {action}')
    return jsonify({'ok': True, 'status': msg.status})

@admin_bp.route('/api/messages/<int:mid>/reply', methods=['POST'])
@login_required
@role_required('admin')
@handle_errors
def api_message_reply(mid):
    msg        = ContactMessage.query.get_or_404(mid)
    d          = request.get_json()
    reply_text = d.get('reply', '').strip()
    if not reply_text:
        return jsonify({'error': 'Reply message cannot be empty'}), 400
    try:
        subject = "Re: Your Message — INVENTORY"
        plain = (
            f"Hello {msg.first_name} {msg.last_name or ''},\n\n"
            f"Thank you for reaching out.\n\n"
            f"---\nYour message:\n{msg.message}\n---\n\n"
            f"Our reply:\n{reply_text}\n\n"
            f"Best regards,\n"
            f"INVENTORY Management Team"
        )
        sent = _send(to_email=msg.email, subject=subject, plain=plain)
        if not sent:
            return jsonify({'error': 'Failed to send email'}), 500
        audit('UPDATE', 'contact_messages', mid, f'Replied to {msg.email}')
        return jsonify({'ok': True, 'message': 'Reply sent successfully'})

    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500

@admin_bp.route('/api/notifications')
@login_required
def api_notifications():
    try:
        count  = ContactMessage.query.filter_by(status='pending').count()
        recent = ContactMessage.query.filter_by(status='pending') \
            .order_by(ContactMessage.created_at.desc()).limit(5).all()
        return jsonify({'pending_count': count, 'recent': [m.to_dict() for m in recent]})
    except Exception as e:
        print("NOTIFICATION ERROR:", str(e))
        return jsonify({
            'pending_count': 0,
            'recent': [],
            'error': str(e) }), 500
# ── API: suppliers ──────────────────────────────────────

@admin_bp.route('/api/suppliers', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_suppliers():
    if request.method == 'POST':
        d     = request.get_json()
        name  = d.get('supplier_name', '').strip()
        email = d.get('email', '').strip()
        if not name or not email:
            return jsonify({'error': 'Name and email required'}), 400
        count = Supplier.query.count() + 1
        pk    = f'supplier{count}'
        while Supplier.query.filter_by(supplier_pk=pk).first():
            count += 1; pk = f'supplier{count}'
        s = Supplier(supplier_pk=pk, supplier_name=name, email=email, phone=d.get('phone', ''))
        db.session.add(s); db.session.commit()
        audit('CREATE', 'suppliers', s.id, f'Created supplier: {name}')
        return jsonify({'id': s.id, 'supplier_pk': s.supplier_pk,
                        'supplier_name': s.supplier_name, 'email': s.email})
    items = Supplier.query.order_by(Supplier.id).all()
    return jsonify({'items': [{'id': s.id, 'supplier_pk': s.supplier_pk,
        'supplier_name': s.supplier_name, 'email': s.email,
        'phone': s.phone or ''} for s in items]})

@admin_bp.route('/api/suppliers/<int:sid>', methods=['PUT', 'DELETE'])
@login_required
@handle_errors
def api_supplier(sid):
    s = Supplier.query.get_or_404(sid)
    if request.method == 'DELETE':
        db.session.delete(s); db.session.commit()
        audit('DELETE', 'suppliers', sid, '')
        return jsonify({'ok': True})
    d = request.get_json()
    s.supplier_name = d.get('supplier_name', s.supplier_name)
    s.email         = d.get('email', s.email)
    s.phone         = d.get('phone', s.phone)
    db.session.commit()
    audit('UPDATE', 'suppliers', sid, f'Updated supplier: {s.supplier_name}')
    return jsonify({'ok': True})

# ── API: purchase orders ────────────────────────────────

@admin_bp.route('/api/purchase-orders', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_purchase_orders():
    if request.method == 'POST':
        d           = request.get_json()
        supplier_id = d.get('supplier_id')
        site_id     = d.get('site_id', '').strip()
        product_id  = d.get('product_id', '').strip()
        qty         = int(d.get('quantity', 0))
        exp_del     = d.get('expected_delivery')
        if not all([supplier_id, site_id, product_id, qty]):
            return jsonify({'error': 'All fields required'}), 400
        count  = PurchaseOrder.query.count() + 1
        po_num = f'PO-{count:04d}'
        while PurchaseOrder.query.filter_by(po_number=po_num).first():
            count += 1; po_num = f'PO-{count:04d}'
        po = PurchaseOrder(po_number=po_num, supplier_id=int(supplier_id),
                           site_id=site_id, product_id=product_id, quantity=qty,
                           expected_delivery=exp_del, status='sent',
                           placed_by=session.get('email', 'admin'), placed_by_role='admin')
        db.session.add(po); db.session.commit()
        audit('CREATE', 'purchase_orders', po.id, f'Created PO: {po_num}')
        sup = Supplier.query.get(int(supplier_id))
        try:
            send_po_to_supplier(None, sup.email, sup.supplier_name, po)
        except Exception:
            pass
        return jsonify({'ok': True, 'po_number': po_num, 'id': po.id})
    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    q = PurchaseOrder.query
    if status: q = q.filter_by(status=status)
    pag = q.order_by(PurchaseOrder.created_at.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [po.to_dict() for po in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/purchase-orders/<int:pid>', methods=['PUT', 'DELETE'])
@login_required
@handle_errors
def api_purchase_order(pid):
    po = PurchaseOrder.query.get_or_404(pid)
    if request.method == 'DELETE':
        db.session.delete(po); db.session.commit()
        audit('DELETE', 'purchase_orders', pid, '')
        return jsonify({'ok': True})
    d          = request.get_json()
    new_status = d.get('status', po.status)
    old_status = po.status
    po.status  = new_status
    if d.get('admin_note'): po.admin_note = d['admin_note']
    if old_status != 'received' and new_status == 'received':
        update_inventory_from_po(po)
    db.session.commit()
    audit('UPDATE', 'purchase_orders', pid, f'PO {po.po_number} status → {new_status}')
    return jsonify({'ok': True})

@admin_bp.route('/po/respond/<po_number>/<action>')
def po_respond(po_number, action):
    if action not in ('accept', 'reject'):
        return render_template('common/po_response.html', status='error',
                               po_number=po_number, message='Invalid action.')
    po = PurchaseOrder.query.filter_by(po_number=po_number).first()
    if not po:
        return render_template('common/po_response.html', status='error',
                               po_number=po_number, message='Purchase order not found.')
    if po.status not in ('sent', 'draft'):
        return render_template('common/po_response.html', status='already_done',
                               po_number=po_number, message=f'Already processed ({po.status})')
    if action == 'accept':
        if po.status != 'received':
            po.status = 'received'
            update_inventory_from_po(po)
        db.session.commit()
        audit('UPDATE', 'purchase_orders', po.id, f'PO {po_number} accepted by supplier')
        return render_template('common/po_response.html', status='accepted',
                               po_number=po_number, message='Order accepted. Inventory updated.')
    else:
        po.status = 'cancelled'
        db.session.commit()
        audit('UPDATE', 'purchase_orders', po.id, f'PO {po_number} rejected by supplier')
        return render_template('common/po_response.html', status='rejected',
                               po_number=po_number, message='Order rejected.')

# ── API: inventory by site ──────────────────────────────

@admin_bp.route('/api/inventory-by-site', methods=['GET'])
@login_required
def api_inventory_by_site():
    site_id = request.args.get('site_id', '').strip()
    if not site_id:
        return jsonify({'items': []})
    result = []
    today  = date.today()
    for i in Inventory.query.filter_by(site_id=site_id).all():
        if (i.ending_inventory or 0) <= 0: continue
        prod   = Product.query.filter_by(product_id=i.product_id).first()
        name   = prod.product_name if prod else i.product_id
        sub    = prod.subcategory.name if prod and prod.subcategory else ''
        label  = (name + ' (' + sub + ')') if sub else name
        ap     = Promotion.query.filter_by(site_id=site_id, product_id=i.product_id) \
            .filter(Promotion.start_date <= today, Promotion.end_date >= today).first()
        base_p = (prod.unit_price or 0) if prod else 0
        if ap and ap.discount_type == 'Percentage':
            dp = round(base_p * (1 - ap.discount_amount / 100), 2)
        elif ap and ap.discount_type == 'Flat':
            dp = max(0, round(base_p - ap.discount_amount, 2))
        else:
            dp = base_p
        result.append({'product_id': i.product_id, 'label': label, 'product_name': name,
            'subcategory': sub, 'ending_inventory': i.ending_inventory or 0,
            'stockout_flag': i.stockout_flag, 'unit_price': base_p, 'discounted_price': dp,
            'has_promo': ap is not None, 'discount_type': ap.discount_type if ap else None,
            'discount_amount': ap.discount_amount if ap else 0})
    return jsonify({'items': result})

# ── API: sales orders ───────────────────────────────────

@admin_bp.route('/api/sales-orders', methods=['GET', 'POST'])
@login_required
@handle_errors
def api_sales_orders():
    if request.method == 'POST':
        d           = request.get_json()
        customer_id = d.get('customer_id', '').strip()
        site_id     = d.get('site_id', '').strip()
        items_data  = d.get('items', [])
        if not customer_id or not site_id or not items_data:
            return jsonify({'error': 'Customer, site and at least one product required'}), 400
        count = SalesOrder.query.count() + 1
        ref   = f'SO-{count:04d}'
        while SalesOrder.query.filter_by(order_ref=ref).first():
            count += 1; ref = f'SO-{count:04d}'
        total = 0.0
        so = SalesOrder(order_ref=ref, customer_id=customer_id, site_id=site_id,
                        status='pending', placed_by=session.get('email', 'admin'),
                        placed_by_role='admin')
        db.session.add(so); db.session.flush()
        for it in items_data:
            prod       = Product.query.filter_by(product_id=it.get('product_id')).first()
            base_price = prod.unit_price if prod else 0.0
            price      = float(it.get('unit_price', base_price)) or base_price
            qty        = int(it.get('quantity', 0))
            line       = round(price * qty, 2)
            total     += line
            db.session.add(SalesOrderItem(order_id=so.id, product_id=it['product_id'],
                                          quantity=qty, unit_price=price, line_total=line))
        so.total_amount = round(total, 2)
        db.session.commit()
        audit('CREATE', 'sales_orders', so.id, f'Created SO {ref} for {customer_id}')
        return jsonify({'ok': True, 'order_ref': ref, 'id': so.id})
    page   = request.args.get('page', 1, type=int)
    status = request.args.get('status', '')
    search = request.args.get('search', '').strip()
    q = SalesOrder.query
    if status: q = q.filter_by(status=status)
    if search: q = q.filter(db.or_(SalesOrder.order_ref.ilike(f'%{search}%'),
                                   SalesOrder.customer_id.ilike(f'%{search}%'),
                                   SalesOrder.site_id.ilike(f'%{search}%')))
    pag = q.order_by(SalesOrder.created_at.desc()).paginate(page=page, per_page=20)
    return jsonify({'items': [o.to_dict() for o in pag.items],
        'total': pag.total, 'page': pag.page, 'pages': pag.pages,
        'has_prev': pag.has_prev, 'has_next': pag.has_next})

@admin_bp.route('/api/sales-orders/<int:oid>', methods=['PUT'])
@login_required
@handle_errors
def api_sales_order_action(oid):
    so     = SalesOrder.query.get_or_404(oid)
    d      = request.get_json()
    action = d.get('action')
    if action not in ('accept', 'reject', 'in_transit', 'delivered'):
        return jsonify({'error': 'Invalid action'}), 400
    if action == 'accept':
        if so.status != 'pending':
            return jsonify({'error': 'Only pending orders can be accepted'}), 400
        so.status = 'accepted'
        db.session.flush()
        for it in so.items:
            ship_id = 'SHP-' + str(uuid.uuid4())[:8].upper()
            db.session.add(Logistics(shipment_id=ship_id, site_id=so.site_id,
                product_id=it.product_id, quantity=it.quantity,
                delivery_status='Pending', transportation_type='Road', sales_order_id=so.id))
        db.session.commit()
        audit('UPDATE', 'sales_orders', oid, f'Accepted SO {so.order_ref}')
        return jsonify({'ok': True, 'status': so.status, 'order_ref': so.order_ref})
    elif action == 'reject':
        if so.status != 'pending':
            return jsonify({'error': 'Only pending orders can be rejected'}), 400
        so.status = 'rejected'
        so.note   = d.get('note', '')
        db.session.commit()
        audit('UPDATE', 'sales_orders', oid, f'Rejected SO {so.order_ref}')
        return jsonify({'ok': True, 'status': so.status})
    elif action == 'in_transit':
        if so.status != 'accepted':
            return jsonify({'error': 'Only accepted orders can be marked In Transit'}), 400
        transport_type = d.get('transport_type', 'Road')
        so.status = 'in_transit'
        for lg in Logistics.query.filter_by(sales_order_id=oid).all():
            lg.transportation_type = transport_type
            lg.delivery_status     = 'In Transit'
        db.session.commit()
        audit('UPDATE', 'sales_orders', oid, f'In Transit SO {so.order_ref} via {transport_type}')
        return jsonify({'ok': True, 'status': so.status, 'transport_type': transport_type})
    elif action == 'delivered':
        if so.status not in ('accepted', 'in_transit'):
            return jsonify({'error': 'Order must be In Transit before marking Delivered'}), 400
        so.status = 'delivered'
        today_d   = date.today()
        for lg in Logistics.query.filter_by(sales_order_id=oid).all():
            if lg.delivery_status != 'Delivered':
                lg.delivery_status = 'Delivered'
                inv = Inventory.query.filter_by(site_id=lg.site_id, product_id=lg.product_id).first()
                if inv:
                    inv.ending_inventory = max(0, (inv.ending_inventory or 0) - lg.quantity)
                    inv.stockout_flag    = 'Yes' if inv.ending_inventory == 0 else 'No'
                prod = Product.query.filter_by(product_id=lg.product_id).first()
                ap   = Promotion.query.filter_by(site_id=so.site_id, product_id=lg.product_id) \
                    .filter(Promotion.start_date <= today_d, Promotion.end_date >= today_d).first()
                base_p   = prod.unit_price if prod else 0.0
                disc_amt = 0.0
                if ap and ap.discount_type == 'Percentage':
                    price = round(base_p * (1 - ap.discount_amount / 100), 2)
                    disc_amt = round((base_p - price) * lg.quantity, 2)
                elif ap and ap.discount_type == 'Flat':
                    price = max(0, round(base_p - ap.discount_amount, 2))
                    disc_amt = round((base_p - price) * lg.quantity, 2)
                else:
                    price = base_p
                if not Sale.query.filter_by(site_id=lg.site_id, product_id=lg.product_id,
                        customer_id=so.customer_id, units_sold=lg.quantity) \
                        .filter(Sale.date == today_d).first():
                    db.session.add(Sale(site_id=lg.site_id, product_id=lg.product_id,
                        customer_id=so.customer_id, units_sold=lg.quantity,
                        revenue=round((price or 0) * lg.quantity, 2),
                        discounts=round(disc_amt, 2), returns=0, date=today_d))
        db.session.commit()
        audit('UPDATE', 'sales_orders', oid, f'Delivered SO {so.order_ref}')
        return jsonify({'ok': True, 'status': so.status})

# ── API: returns ────────────────────────────────────────

@admin_bp.route('/api/returns/delivered-orders', methods=['GET'])
@login_required
@handle_errors
def api_delivered_orders_for_return():
    order_type = request.args.get('type', 'sales')
    if order_type == 'sales':
        result = []
        for o in SalesOrder.query.filter_by(status='delivered').order_by(SalesOrder.id.desc()).all():
            for item in o.items:
                result.append({'order_id': o.id, 'order_ref': o.order_ref,
                    'product_id': item.product_id,
                    'product_name': item.product.product_name if item.product else '',
                    'site_id': o.site_id, 'quantity': item.quantity, 'unit_price': item.unit_price,
                    'label': f"{o.order_ref} — {item.product_id} (qty: {item.quantity})"})
        return jsonify({'items': result})
    else:
        result = []
        for o in PurchaseOrder.query.filter_by(status='received').order_by(PurchaseOrder.id.desc()).all():
            prod = Product.query.filter_by(product_id=o.product_id).first()
            result.append({'order_id': o.id, 'order_ref': o.po_number,
                'product_id': o.product_id, 'product_name': prod.product_name if prod else '',
                'site_id': o.site_id, 'quantity': o.quantity,
                'unit_price': prod.unit_cost if prod else 0.0,
                'label': f"{o.po_number} — {o.product_id} (qty: {o.quantity})"})
        return jsonify({'items': result})

@admin_bp.route('/api/returns', methods=['POST'])
@login_required
@handle_errors
def api_create_return():
    d          = request.get_json() or {}
    order_type = d.get('order_type')
    order_id   = d.get('order_id')
    product_id = d.get('product_id')
    return_qty = int(d.get('return_qty', 0))
    reason     = d.get('reason', '').strip()
    if order_type not in ('sales', 'purchase'):
        return jsonify({'error': 'Invalid order type'}), 400
    if not order_id or not product_id or return_qty <= 0:
        return jsonify({'error': 'Order, product, and a positive quantity are required'}), 400
    if order_type == 'sales':
        so   = SalesOrder.query.get_or_404(order_id)
        if so.status != 'delivered':
            return jsonify({'error': 'Only delivered sales orders can be returned'}), 400
        item = SalesOrderItem.query.filter_by(order_id=order_id, product_id=product_id).first()
        if not item:
            return jsonify({'error': 'Product not found in this order'}), 404
        if return_qty > item.quantity:
            return jsonify({'error': f'Return qty exceeds ordered qty ({item.quantity})'}), 400
        unit_price    = item.unit_price
        return_amount = round(unit_price * return_qty, 2)
        inv = Inventory.query.filter_by(site_id=so.site_id, product_id=product_id).first()
        if inv:
            inv.ending_inventory = (inv.ending_inventory or 0) + return_qty
            inv.stockout_flag    = 'No'
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
            reason=reason, created_by=session.get('email', 'admin'))
        db.session.add(ret); db.session.commit()
        audit('CREATE', 'order_returns', ret.id, f'SO return {return_ref}: {return_qty}x {product_id}')
        return jsonify({'ok': True, 'return_ref': return_ref, 'return_amount': return_amount,
            'message': f'Return processed. {return_qty} units added back. ₹{return_amount:,.2f} credited.'})
    else:
        po = PurchaseOrder.query.get_or_404(order_id)
        if po.status != 'received':
            return jsonify({'error': 'Only received purchase orders can be returned'}), 400
        if return_qty > po.quantity:
            return jsonify({'error': f'Return qty exceeds PO qty ({po.quantity})'}), 400
        prod          = po.product
        unit_cost     = prod.unit_cost if prod else 0.0
        return_amount = round(unit_cost * return_qty, 2)
        inv = Inventory.query.filter_by(site_id=po.site_id, product_id=po.product_id).first()
        if inv:
            inv.ending_inventory = max(0, (inv.ending_inventory or 0) - return_qty)
            inv.replenishment    = max(0, (inv.replenishment or 0) - return_qty)
            inv.stockout_flag    = 'Yes' if inv.ending_inventory == 0 else 'No'
        ret_count  = OrderReturn.query.count() + 1
        return_ref = f'RET-PO-{ret_count:04d}'
        ret = OrderReturn(return_ref=return_ref, order_type='purchase', order_id=order_id,
            order_ref=po.po_number, product_id=po.product_id, site_id=po.site_id,
            return_qty=return_qty, unit_price=unit_cost, return_amount=return_amount,
            reason=reason, created_by=session.get('email', 'admin'))
        db.session.add(ret); db.session.commit()
        audit('CREATE', 'order_returns', ret.id, f'PO return {return_ref}: {return_qty}x {po.product_id}')
        return jsonify({'ok': True, 'return_ref': return_ref, 'return_amount': return_amount,
            'message': f'Return processed. {return_qty} units removed. ₹{return_amount:,.2f} deducted.'})

# ── API: users ──────────────────────────────────────────

@admin_bp.route('/api/users', methods=['GET', 'POST'])
@login_required
@role_required('admin')
def api_users():
    if request.method == 'POST':
        d        = request.get_json()
        name     = d.get('name')
        email    = d.get('email')
        role     = d.get('role')
        state_id = d.get('state_id')
        if not name or not email:
            return jsonify({'error': 'Name & Email required'}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already exists'}), 400
        pwd  = random_password()
        user = User(name=name, email=email, password=generate_password_hash(pwd),
                    role=role, is_first_login=True)
        db.session.add(user); db.session.flush()
        if role == 'manager':
            if not state_id:
                return jsonify({'error': 'State required'}), 400
            if Manager.query.filter_by(state_id=state_id).first():
                return jsonify({'error': 'State already taken'}), 400
            db.session.add(Manager(user_id=user.id, state_id=state_id))
        db.session.commit()
        email_sent = False
        try:
            send_credentials_email(None, email, name, pwd)
            email_sent = True
        except Exception as e:
            print("Email error:", e)
        return jsonify({'message': 'User created successfully', 'email_sent': email_sent,
                        'user': {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role}})
    users_list = User.query.filter(User.role.in_(['analyst', 'manager'])).all()
    data = []
    for u in users_list:
        rec = {'id': u.id, 'name': u.name, 'email': u.email, 'role': u.role,
               'is_first_login': u.is_first_login}
        if u.role == 'manager':
            mgr = Manager.query.filter_by(user_id=u.id).first()
            if mgr: rec['state_id'] = mgr.state_id
        data.append(rec)
    return jsonify(data)

@admin_bp.route('/api/users/<int:id>', methods=['PUT', 'DELETE'])
@login_required
@role_required('admin')
def api_user(id):
    user = User.query.get_or_404(id)
    if request.method == 'DELETE':
        mgr = Manager.query.filter_by(user_id=id).first()
        if mgr: db.session.delete(mgr)
        db.session.delete(user); db.session.commit()
        return jsonify({'ok': True})
    d        = request.get_json()
    role     = d.get('role')
    state_id = d.get('state_id')
    user.name  = d.get('name')
    user.email = d.get('email')
    user.role  = role
    if role == 'manager':
        mgr = Manager.query.filter_by(user_id=id).first()
        if not mgr:
            mgr = Manager(user_id=id); db.session.add(mgr)
        if state_id:
            if Manager.query.filter(Manager.state_id == state_id, Manager.user_id != id).first():
                return jsonify({'error': 'State already taken'}), 400
            mgr.state_id = state_id
    else:
        mgr = Manager.query.filter_by(user_id=id).first()
        if mgr: db.session.delete(mgr)
    db.session.commit()
    return jsonify({'ok': True})