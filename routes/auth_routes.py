import pytz
from flask import Blueprint, render_template, request, redirect, session, jsonify
from models.user import User
from models.db import db
from werkzeug.security import check_password_hash, generate_password_hash
from functools import wraps
import traceback, random, string
from models.records import Inventory

auth_bp = Blueprint('auth', __name__)

def random_password(length=10):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if 'user_id' not in session:
            return redirect('/login')
        return f(*args, **kwargs)
    return wrapper

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if session.get('role') not in roles:
                return redirect('/login')
                # return jsonify({'error': 'Unauthorized'}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

def handle_errors(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
    return wrapper

def audit(action, table, record_id, detail=''):
    try:
        from models.audit import AuditLog
        log = AuditLog(
            user_id=session.get('user_id'),
            action=action,
            table_name=table,
            record_id=str(record_id),
            detail=detail
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print('Audit error:', e)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        d        = request.get_json()
        email    = d.get('email', '').strip()
        password = d.get('password', '')
        user     = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, password):
            # session.clear()
            session['user_id'] = user.id
            session['role']    = user.role
            session['name']    = user.name
            session['email']   = user.email
            
            audit(action='LOGIN',table='users',record_id=user.id, detail=f'{user.name} logged in')

            if user.role == 'manager' and user.is_first_login:
                return jsonify({'redirect': '/change-password'})
            if user.role == 'admin':
                return jsonify({'redirect': '/admin/dashboard'})
            if user.role == 'analyst' and user.is_first_login:
                return jsonify({'redirect': '/change-password'})
            if user.role == 'analyst':
                return jsonify({'redirect': '/analyst/dashboard'})
            return jsonify({'redirect': '/manager/dashboard'})
        return jsonify({'error': 'Invalid email or password'}), 401
    return render_template('auth/login.html')

@auth_bp.route('/logout')
def logout():
    user_id = session.get('user_id')

    audit(
        action='LOGOUT',
        table='users',
        record_id=user_id,
        detail='User logged out'
    )
    session.clear()
    return redirect('/')

@auth_bp.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        d    = request.get_json()
        user = User.query.get(session['user_id'])
        user.password       = generate_password_hash(d.get('password', ''))
        user.is_first_login = False
        db.session.commit()
        role = user.role
        dest = '/admin/dashboard' if role == 'admin' else ('/analyst/dashboard' if role == 'analyst' else '/manager/dashboard')
        return jsonify({'redirect': dest})
    return render_template('auth/change_password.html')

@auth_bp.route('/forgot-password', methods=['GET', 'POST'])
@handle_errors
def forgot_password():
    if request.method == 'POST':
        d    = request.get_json()
        email = d.get('email', '').strip()
        user  = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'Email not found'}), 404
        pwd = random_password()
        user.password       = generate_password_hash(pwd)
        user.is_first_login = True
        db.session.commit()
        sent = False
        try:
            from app import mail
            from utils.email import send_credentials_email
            send_credentials_email(mail, user.email, user.name, pwd)
            sent = True
        except Exception as e:
            print('Email error:', e)
        return jsonify({'message': 'Password reset.' + ('' if sent else ' Email not sent — check SMTP.'), 'redirect': '/login'})
    return render_template('auth/forgot.html')

# -----------------for purchase orders------------
def update_inventory_from_po(po):
    inv = Inventory.query.filter_by(
        site_id=po.site_id,
        product_id=po.product_id
    ).first()

    if inv:
        inv.beginning_inventory = inv.ending_inventory
        inv.ending_inventory = (inv.ending_inventory or 0) + po.quantity
        inv.replenishment = po.quantity
        inv.stockout_flag = 'No'
    else:
        inv = Inventory(
            site_id=po.site_id,
            product_id=po.product_id,
            beginning_inventory=0,
            ending_inventory=po.quantity,
            replenishment=po.quantity,
            stockout_flag='No'
        )
        db.session.add(inv)
