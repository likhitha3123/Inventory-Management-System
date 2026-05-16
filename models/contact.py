from models.db import db
from datetime import datetime
import pytz

def _ist_now_c():
    return datetime.now(pytz.timezone('Asia/Kolkata')).replace(tzinfo=None)

class ContactMessage(db.Model):
    __tablename__ = 'contact_messages'
    id         = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name  = db.Column(db.String(100))
    email      = db.Column(db.String(120), nullable=False)
    join_type  = db.Column(db.String(20))    # 'customer' | 'supplier'
    message    = db.Column(db.Text, nullable=False)
    status     = db.Column(db.String(20), default='pending')  # pending | accepted | rejected
    created_at = db.Column(db.DateTime, default=_ist_now_c)

    def to_dict(self):
        return {
            'id':         self.id,
            'first_name': self.first_name,
            'last_name':  self.last_name or '',
            'email':      self.email,
            'join_type':  self.join_type or '',
            'message':    self.message,
            'status':     self.status,
            'created_at': str(self.created_at)[:19],
        }
