from flask import Flask
from flask_migrate import Migrate
from flask_mail import Mail
from config import Config
from models.db import db
from sqlalchemy import text
import os

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
migrate = Migrate(app, db)
mail = Mail(app)

from models import *

from routes.common_routes import common_bp
from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from routes.manager_routes import manager_bp
from routes.analyst_routes import analyst_bp

app.register_blueprint(common_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(manager_bp)
app.register_blueprint(analyst_bp)

with app.app_context():
    try:
        db.session.execute(text("""
            SELECT setval(
                pg_get_serial_sequence('states','state_id'),
                COALESCE(MAX(state_id),1)
            ) FROM states;
        """))
        db.session.commit()
        print("States sequence fixed")
    except Exception as e:
        print("Sequence fix skipped:", e)

with app.app_context():
    from seed import create_admin
    create_admin()

if __name__ == "__main__":
    app.run()