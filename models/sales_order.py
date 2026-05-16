from models.db import db
from sqlalchemy.sql import func
import pytz
from datetime import datetime

def _ist_now():
    return datetime.now(pytz.timezone('Asia/Kolkata')).replace(tzinfo=None)


class SalesOrder(db.Model):
    """Header record for a multi-product customer sales order."""
    __tablename__ = "sales_orders"

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_ref    = db.Column(db.String, unique=True, nullable=False)   # SO-0001
    customer_id  = db.Column(db.String, db.ForeignKey('customers.customer_id'), nullable=False)
    site_id      = db.Column(db.String, db.ForeignKey('sites.site_id'), nullable=False)
    status       = db.Column(db.String, default='pending')  # pending | accepted | rejected
    total_amount = db.Column(db.Float, default=0.0)
    placed_by    = db.Column(db.String)      # admin / manager email
    placed_by_role = db.Column(db.String)    # admin / manager
    note         = db.Column(db.String)
    created_at   = db.Column(db.DateTime, default=_ist_now)
    updated_at   = db.Column(db.DateTime, default=_ist_now, onupdate=_ist_now)

    customer = db.relationship('Customer', backref='sales_orders')
    site     = db.relationship('Site',     backref='sales_orders')
    items    = db.relationship('SalesOrderItem', backref='order', cascade='all, delete-orphan')

    def to_dict(self):
        # Get transport type from first linked logistics shipment
        from models.records import Logistics
        first_log = Logistics.query.filter_by(sales_order_id=self.id).first()
        transport_type = (first_log.transportation_type if first_log and first_log.transportation_type else 'Road')
        return {
            'id':           self.id,
            'order_ref':    self.order_ref,
            'customer_id':  self.customer_id,
            'site_id':      self.site_id,
            'status':       self.status,
            'total_amount': self.total_amount,
            'placed_by':    self.placed_by or '',
            'placed_by_role': self.placed_by_role or '',
            'note':         self.note or '',
            'created_at':   str(self.created_at)[:19] if self.created_at else '',
            'transport_type': transport_type,
            'items': [i.to_dict() for i in self.items],
        }


class SalesOrderItem(db.Model):
    """One product line within a SalesOrder."""
    __tablename__ = "sales_order_items"

    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_id    = db.Column(db.Integer, db.ForeignKey('sales_orders.id'), nullable=False)
    product_id  = db.Column(db.String, db.ForeignKey('products.product_id'), nullable=False)
    quantity    = db.Column(db.Integer, nullable=False)
    unit_price  = db.Column(db.Float, default=0.0)
    line_total  = db.Column(db.Float, default=0.0)

    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id':         self.id,
            'product_id': self.product_id,
            'product_name': self.product.product_name if self.product else '',
            'quantity':   self.quantity,
            'unit_price': self.unit_price,
            'line_total': self.line_total,
        }
