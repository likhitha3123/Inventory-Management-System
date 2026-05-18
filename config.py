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

    # Mail (Gmail SMTP)
    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = 'likhitha03123@gmail.com'      
    MAIL_PASSWORD = 'vgmq wvme mrsp qpzi'     
    MAIL_DEFAULT_SENDER = 'likhitha03123@gmail.com' 