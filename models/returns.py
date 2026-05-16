from models.db import db
from datetime import datetime
import pytz

def _ist_ret():
    return datetime.now(pytz.timezone('Asia/Kolkata')).replace(tzinfo=None)

class OrderReturn(db.Model):
    """Tracks returns for both Sales Orders and Purchase Orders."""
    __tablename__ = 'order_returns'

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    return_ref   = db.Column(db.String, unique=True, nullable=False)  # RET-SO-0001 / RET-PO-0001
    order_type   = db.Column(db.String, nullable=False)   # 'sales' | 'purchase'
    order_id     = db.Column(db.Integer, nullable=False)  # sales_orders.id OR purchase_orders.id
    order_ref    = db.Column(db.String, nullable=False)   # SO-0001 | PO-0001
    product_id   = db.Column(db.String, db.ForeignKey('products.product_id'))
    site_id      = db.Column(db.String, db.ForeignKey('sites.site_id'))
    return_qty   = db.Column(db.Integer, nullable=False)
    unit_price   = db.Column(db.Float, default=0.0)       # price per unit at time of return
    return_amount= db.Column(db.Float, default=0.0)       # return_qty * unit_price
    reason       = db.Column(db.String)
    status       = db.Column(db.String, default='processed')
    created_by   = db.Column(db.String)
    created_at   = db.Column(db.DateTime, default=_ist_ret)

    product = db.relationship('Product')
    site    = db.relationship('Site')

    def to_dict(self):
        return {
            'id':            self.id,
            'return_ref':    self.return_ref,
            'order_type':    self.order_type,
            'order_id':      self.order_id,
            'order_ref':     self.order_ref,
            'product_id':    self.product_id,
            'product_name':  self.product.product_name if self.product else '',
            'site_id':       self.site_id,
            'return_qty':    self.return_qty,
            'unit_price':    self.unit_price,
            'return_amount': self.return_amount,
            'reason':        self.reason or '',
            'status':        self.status,
            'created_by':    self.created_by or '',
            'created_at':    str(self.created_at)[:19] if self.created_at else '',
        }
