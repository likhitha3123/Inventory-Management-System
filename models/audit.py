from models.db import db
from datetime import datetime
import pytz

def _ist_now():
    return datetime.now(pytz.timezone('Asia/Kolkata')).replace(tzinfo=None)

class AuditLog(db.Model):
    __tablename__ = 'audit_log'
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action     = db.Column(db.String(50))   # CREATE / UPDATE / DELETE
    table_name = db.Column(db.String(50))
    record_id  = db.Column(db.String(100))
    detail     = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=_ist_now)

    user = db.relationship('User', backref='audit_logs')

    def to_dict(self):
        return {
            'id':         self.id,
            'user':       self.user.name if self.user else 'System',
            'action':     self.action,
            'table_name': self.table_name,
            'record_id':  self.record_id,
            'detail':     self.detail,
            'created_at': str(self.created_at)[:19] + ' IST',
        }
