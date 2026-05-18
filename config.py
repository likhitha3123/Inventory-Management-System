import os

class Config:

    # Database
    db_url = os.getenv("DATABASE_URL")

    # Fix old postgres:// issue
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")

    # Uploads
    UPLOAD_FOLDER = 'static/uploads'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'jfif'}
    LIMIT_PER_PAGE = 20

    # Mail (SendGrid SMTP)
    MAIL_SERVER = 'smtp.sendgrid.net'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_TIMEOUT = 10
    
    MAIL_USERNAME = 'apikey'
    MAIL_PASSWORD = os.getenv("SENDGRID_API_KEY")

    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER")