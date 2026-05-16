from models.db import db
from models.records import States

class Manager(db.Model):
    __tablename__ = 'managers'

    id       = db.Column(db.Integer, primary_key=True)
    user_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    state_id = db.Column(db.Integer, db.ForeignKey('states.state_id'))

    state = db.relationship('States', backref='managers')

    def to_dict(self):
        return {
            "id":         self.id,
            "user_id":    self.user_id,
            "name":       self.user.name  if self.user  else "",
            "email":      self.user.email if self.user  else "",
            "state_id":   self.state_id,
            "state_name": self.state.state_name if self.state else "",
        }
