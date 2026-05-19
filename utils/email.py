import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail


SENDGRID_FROM = os.environ.get(
    'SENDGRID_FROM_EMAIL',
    'yourverifiedemail@gmail.com'
)


# ---------------------------------------------------
# INTERNAL SEND FUNCTION
# ---------------------------------------------------

def _send(to_email, subject, plain):

    api_key = os.environ.get('SENDGRID_API_KEY')

    if not api_key:
        print("SENDGRID_API_KEY not found")
        return False

    try:

        message = Mail(
            from_email=SENDGRID_FROM,
            to_emails=to_email,
            subject=subject,
            plain_text_content=plain
        )

        sg = SendGridAPIClient(api_key)

        response = sg.send(message)

        print(f"SENDGRID STATUS: {response.status_code}")

        return response.status_code in [200, 201, 202]

    except Exception as e:

        print(f"SENDGRID ERROR: {str(e)}")

        return False


# ---------------------------------------------------
# USER CREDENTIALS EMAIL
# ---------------------------------------------------

def send_credentials_email(mail, to_email, name, password):

    subject = "Your INVENTORY Account Credentials"

    plain = f"""
Hello {name},

Your INVENTORY account has been created.

Email: {to_email}
Password: {password}

Please log in and change your password immediately.

-- INVENTORY Management System
"""

    return _send(
        to_email=to_email,
        subject=subject,
        plain=plain
    )


# ---------------------------------------------------
# PURCHASE ORDER EMAIL
# ---------------------------------------------------

def send_po_to_supplier(mail, supplier_email, supplier_name, po):
    accept_url = (
        f"https://inventory-management-system-eiqz.onrender.com"
        f"/admin/po/respond/{po.po_number}/accept"
    )

    reject_url = (
        f"https://inventory-management-system-eiqz.onrender.com"
        f"/admin/po/respond/{po.po_number}/reject"
    )

    subject = f"Purchase Order {po.po_number} — INVENTORY"

    plain = f"""
Dear {supplier_name},

A new Purchase Order has been placed with you.

PO Number         : {po.po_number}
Product ID        : {po.product_id}
Site ID           : {po.site_id}
Quantity          : {po.quantity}
Expected Delivery : {po.expected_delivery}
Order Date        : {str(po.order_date)[:10]}

Please respond using the links below:

ACCEPT ORDER:
{accept_url}

REJECT ORDER:
{reject_url}

-- INVENTORY Management System
"""

    return _send(
        to_email=supplier_email,
        subject=subject,
        plain=plain
    )


# ---------------------------------------------------
# REJECTION EMAIL
# ---------------------------------------------------

def send_po_rejection_to_admin(mail, admin_email, supplier_name, po):
    subject = f"PO {po.po_number} Rejected by Supplier — INVENTORY"

    plain = f"""
Purchase Order REJECTED

PO Number : {po.po_number}
Supplier  : {supplier_name}
Product   : {po.product_id}
Site      : {po.site_id}
Quantity  : {po.quantity}

The supplier has REJECTED this purchase order.

Please log in and take action.

-- INVENTORY Management System
"""

    return _send(
        to_email=admin_email,
        subject=subject,
        plain=plain
    )