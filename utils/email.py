from flask_mail import Message


def send_credentials_email(mail, to_email, name, password):

    try:

        msg = Message(
            subject="Your INVENTORY Account Credentials",
            recipients=[to_email]
        )

        msg.body = f"""Hello {name},

Your INVENTORY account has been created.

Email:    {to_email}
Password: {password}

Please log in and change your password immediately.

-- INVENTORY Management System
"""

        mail.send(msg)

        print(f"CREDENTIAL EMAIL SENT TO: {to_email}")

        return True

    except Exception as e:

        print(f"CREDENTIAL EMAIL ERROR: {str(e)}")

        return False


def send_po_to_supplier(mail, supplier_email, supplier_name, po):
    """
    Send Purchase Order email to supplier
    """

    try:

        accept_url = (
            f"https://inventory-management-system-eiqz.onrender.com"
            f"/admin/po/respond/{po.po_number}/accept"
        )

        reject_url = (
            f"https://inventory-management-system-eiqz.onrender.com"
            f"/admin/po/respond/{po.po_number}/reject"
        )

        msg = Message(
            subject=f"Purchase Order {po.po_number} — INVENTORY",
            recipients=[supplier_email]
        )

        msg.body = f"""Dear {supplier_name},

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

        mail.send(msg)

        print(f"PURCHASE ORDER EMAIL SENT TO: {supplier_email}")

        return True

    except Exception as e:

        print(f"PURCHASE ORDER EMAIL ERROR: {str(e)}")

        return False


def send_po_rejection_to_admin(mail, admin_email, supplier_name, po):
    """
    Notify admin when supplier rejects PO
    """

    try:

        msg = Message(
            subject=f"PO {po.po_number} Rejected by Supplier — INVENTORY",
            recipients=[admin_email]
        )

        msg.body = f"""Purchase Order REJECTED

PO Number : {po.po_number}
Supplier  : {supplier_name}
Product   : {po.product_id}
Site      : {po.site_id}
Quantity  : {po.quantity}

The supplier has REJECTED this purchase order.

Please log in and take action.

-- INVENTORY Management System
"""

        mail.send(msg)

        print(f"REJECTION EMAIL SENT TO ADMIN: {admin_email}")

        return True

    except Exception as e:

        print(f"REJECTION EMAIL ERROR: {str(e)}")

        return False