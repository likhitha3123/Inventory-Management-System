from flask import Blueprint, render_template, request, jsonify
from models.records import Product, Sale, Site, Inventory
from models.contact import ContactMessage
from models.db import db
from sqlalchemy import func
import re

common_bp = Blueprint('common', __name__)

@common_bp.route('/')
def home():
    total_products = Product.query.count()
    total_sites    = Site.query.count()
    total_revenue  = db.session.query(func.sum(Sale.revenue)).scalar() or 0
    total_sales    = Sale.query.count()
    stats = {
        'total_products': total_products,
        'total_sites':    total_sites,
        'total_revenue':  round(total_revenue / 1e7, 1),
        'total_sales':    total_sales,
    }
    return render_template('common/home.html', stats=stats)

@common_bp.route('/about')
def about():
    return render_template('common/about.html')

@common_bp.route('/features')
def features():
    return render_template('common/features.html')

@common_bp.route('/contact', methods=['GET', 'POST'])
def contact():
    return render_template('common/contact.html')

# ── Submit contact / enquiry ───────────────────────────────────────────────
@common_bp.route('/api/contact', methods=['POST'])
def api_contact():
    d = request.get_json() or {}
    first = (d.get('first_name') or '').strip()
    email = (d.get('email') or '').strip()
    message = (d.get('message') or '').strip()
    join_type = (d.get('join_type') or '').strip()

    if not first:
        return jsonify({'error': 'First name is required'}), 400
    if not email or not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        return jsonify({'error': 'A valid email address is required'}), 400
    if not message:
        return jsonify({'error': 'Message is required'}), 400
    if join_type not in ('customer', 'supplier'):
        return jsonify({'error': 'Please select whether you are joining as a customer or supplier'}), 400

    msg = ContactMessage(
        first_name = first,
        last_name  = (d.get('last_name') or '').strip(),
        email      = email,
        join_type  = join_type,
        message    = message,
        status     = 'pending'
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Your enquiry has been sent! We will reply to your email within 24 hours.'})
