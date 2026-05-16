from sqlalchemy import Column, Integer, String 
from models.db import db
from datetime import datetime
import pytz
def _ist_po():
    return datetime.now(pytz.timezone('Asia/Kolkata')).replace(tzinfo=None)


# ── PurchaseOrder ───────────────────────────────────────
class PurchaseOrder(db.Model):
    __tablename__ = "purchase_orders"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    po_number        = Column(String, unique=True, nullable=False)   # e.g. PO-0001
    supplier_id      = Column(Integer, db.ForeignKey('suppliers.id'), nullable=False)
    site_id          = Column(String, db.ForeignKey('sites.site_id'), nullable=False)
    product_id       = Column(String, db.ForeignKey('products.product_id'), nullable=False)
    order_date       = db.Column(db.DateTime, default=_ist_po)
    expected_delivery= Column(db.Date)
    quantity         = Column(Integer, nullable=False)
    status           = Column(String, default='draft')  # draft | sent | received | cancelled
    placed_by        = Column(String)                   # 'admin' or manager email
    placed_by_role   = Column(String)                   # 'admin' | 'manager'
    admin_note       = Column(String)
    created_at       = db.Column(db.DateTime, default=_ist_po)
    updated_at       = db.Column(db.DateTime, default=_ist_po, onupdate=_ist_po)

    site    = db.relationship('Site', backref='purchase_orders')
    product = db.relationship('Product', backref='purchase_orders')

    def to_dict(self):
        return {
            'id': self.id,
            'po_number': self.po_number,
            'supplier_id': self.supplier_id,
            'supplier_name': self.supplier_rel.supplier_name if self.supplier_rel else '',
            'supplier_email': self.supplier_rel.email if self.supplier_rel else '',
            'site_id': self.site_id,
            'product_id': self.product_id,
            'product_name': self.product.product_name if self.product else '',
            'order_date': str(self.order_date)[:19] if self.order_date else '',
            'expected_delivery': str(self.expected_delivery) if self.expected_delivery else '',
            'quantity': self.quantity,
            'status': self.status,
            'placed_by': self.placed_by or '',
            'placed_by_role': self.placed_by_role or '',
            'admin_note': self.admin_note or '',
        }
