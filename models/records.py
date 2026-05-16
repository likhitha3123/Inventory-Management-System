from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from datetime import datetime as _dt_rec
import pytz as _pytz_rec
def _ist_rec():
    return _dt_rec.now(_pytz_rec.timezone('Asia/Kolkata')).replace(tzinfo=None)
from sqlalchemy import ForeignKey
from models.db import db
from sqlalchemy.sql import func

# Product_Information.csv
class Product(db.Model):
    __tablename__ = "products"
    id           = Column(Integer, primary_key=True, autoincrement=True)
    product_id   = Column(String, unique=True, nullable=False)
    product_name = Column(String)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    subcategory_id = db.Column(db.Integer, db.ForeignKey('subcategories.id'))

    category = db.relationship('Category')
    subcategory = db.relationship('SubCategory')
    unit_cost    = Column(Float)
    unit_price   = Column(Float)
    shelf_life   = Column(Integer)

# Customer_Demographics.csv
class Customer(db.Model):
    __tablename__ = "customers"
    id                 = Column(Integer, primary_key=True, autoincrement=True)
    customer_id        = Column(String, unique=True, nullable=False)
    age                = Column(Integer)
    gender             = Column(String)
    income_bracket     = Column(String)
    purchase_frequency = Column(Integer)
    average_spend      = Column(Float)
    email=Column(String, unique=True)
    phone=Column(String)


# Site_Details.csv
class Site(db.Model):
    __tablename__ = "sites"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    site_id     = Column(String, unique=True, nullable=False)
    site_name   = Column(String)
    site_format = Column(String)
    region      = Column(String)
    city        = Column(String)
    state_id = Column(Integer, ForeignKey('states.state_id'))
    state = db.relationship('States', backref='sites')
    store_size  = Column(Integer)
    open_date     = Column(Date, default=func.current_date())
    status      = Column(String)

# Inventory_Data.csv
class Inventory(db.Model):
    __tablename__ = "inventory"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    site_id             = Column(String, nullable=False)
    product_id          = Column(String,ForeignKey('products.product_id'))
    beginning_inventory = Column(Integer)
    ending_inventory    = Column(Integer)
    replenishment       = Column(Integer)
    stockout_flag       = Column(String)

# Logistics_Data.csv
class Logistics(db.Model):
    __tablename__ = "logistics"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    shipment_id         = Column(String, unique=True, nullable=False)
    site_id             = Column(String,ForeignKey('sites.site_id'))
    product_id          = Column(String,ForeignKey('products.product_id'))
    sales_order_id = Column(Integer, ForeignKey('sales_orders.id'))
    shipment_date = Column(Date, default=func.current_date())
    quantity            = Column(Integer)
    delivery_status     = Column(String)
    transportation_type = Column(String)

# Sales_Data.csv
class Sale(db.Model):
    __tablename__ = "sales"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    date          = Column(Date, default=func.current_date())
    site_id = Column(String, db.ForeignKey('sites.site_id'))
    product_id = Column(String, db.ForeignKey('products.product_id'))
    units_sold  = Column(Integer)
    revenue     = Column(Float)
    discounts   = Column(Float)
    returns     = Column(Integer)
    customer_id = Column(String, db.ForeignKey('customers.customer_id'))

    product = db.relationship('Product', backref='sales')
    site = db.relationship('Site', backref='sales')
    customer = db.relationship('Customer', backref='sales')


# Promotions_and_Discounts.csv
class Promotion(db.Model):
    __tablename__ = "promotions"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    promotion_id    = Column(String, unique=True, nullable=False)
    product_id      = Column(String,ForeignKey('products.product_id'))
    site_id         = Column(String,ForeignKey('sites.site_id'))
    start_date      = Column(Date)
    end_date        = Column(Date)
    discount_type   = Column(String)
    discount_amount = Column(Float)

    product = db.relationship('Product', backref='promotions')
    site    = db.relationship('Site', backref='promotions')

# Monthly_Seasonal_Planning.csv
class SeasonalPlan(db.Model):
    __tablename__ = "seasonal_planning"
    id                   = Column(Integer, primary_key=True, autoincrement=True)
    month                = Column(String)
    site_id              = Column(String,ForeignKey('sites.site_id'))
    product_category     = Column(String)
    forecasted_sales     = Column(Float)
    actual_sales         = Column(Float)
    seasonal_adjustments = Column(Float)

# States.csv
class States(db.Model):
    __tablename__ = "states"
    state_id   = Column(Integer, primary_key=True, autoincrement=True)
    state_name = Column(String)
    date          = Column(Date, default=func.current_date())

# ── Supplier ────────────────────────────────────────────
class Supplier(db.Model):
    __tablename__ = "suppliers"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    supplier_pk   = Column(String, unique=True, nullable=False)   # e.g. supplier1
    supplier_name = Column(String, nullable=False)
    email         = Column(String, nullable=False)
    phone         = Column(String)
    created_at    = db.Column(db.DateTime, default=_ist_rec)

    purchase_orders = db.relationship('PurchaseOrder', backref='supplier_rel', lazy=True)
