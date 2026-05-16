from models.db import db
from sqlalchemy.sql import func

class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    order_ref = db.Column(db.String, unique=True, nullable=False)
    customer_id = db.Column(db.String, db.ForeignKey('customers.customer_id'), nullable=False)
    site_id = db.Column(db.String, db.ForeignKey('sites.site_id'), nullable=False)
    product_id = db.Column(db.String, db.ForeignKey('products.product_id'), nullable=False)
    units = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float)
    total_amount = db.Column(db.Float)
    status = db.Column(db.String, default='pending')
    manager_note = db.Column(db.String)
    created_at = db.Column(db.DateTime, server_default=func.now())
    updated_at = db.Column(db.DateTime, server_default=func.now(), onupdate=func.now())

    customer = db.relationship('Customer', backref='orders')
    site = db.relationship('Site', backref='orders')
    product = db.relationship('Product', backref='orders')


    def to_dict(self):
        return {"id": self.id, "order_ref": self.order_ref, "customer_id": self.customer_id,
                 "site_id": self.site_id, "product_id": self.product_id, "units": self.units, 
                 "unit_price": self.unit_price, "total_amount": self.total_amount, "status": self.status,
                 "manager_note": self.manager_note, "created_at": self.created_at, "updated_at": self.updated_at}