class config:
    SQLALCHEMY_DATABASE_URI = 'postgresql://postgres:liki3123@localhost:5432/INV'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = "mysecret123"

    UPLOAD_FOLDER = 'static/uploads'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'jfif'}
    LIMIT_PER_PAGE = 20

    MAIL_SERVER   = 'smtp.gmail.com'
    MAIL_PORT     = 587
    MAIL_USE_TLS  = True
    MAIL_USERNAME = 'likhitha03123@gmail.com'
    MAIL_PASSWORD = 'idll rqsq lbfx hsoj'
    MAIL_DEFAULT_SENDER = 'likhitha03123@gmail.com'
