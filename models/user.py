from models.db import db

class User(db.Model):
    __tablename__ = 'users'

    id             = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(100), nullable=False)
    email          = db.Column(db.String(120), unique=True, nullable=False)
    password       = db.Column(db.String(255), nullable=False)
    role           = db.Column(db.String(20), nullable=False)   # admin / manager
    is_first_login = db.Column(db.Boolean, default=True)

    manager = db.relationship('Manager', backref='user', uselist=False)

    def to_dict(self):
        return {
            "id":             self.id,
            "name":           self.name,
            "email":          self.email,
            "role":           self.role,
            "is_first_login": self.is_first_login,
        }
