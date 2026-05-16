"""
Invoice PDF generator using ReportLab.
Saves PDFs to:
  <app_root>/invoices_sales_orders/     (Sales Orders)
  <app_root>/invoices_purchase_orders/  (Purchase Orders)
"""

import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

# ── Color palette (matching the app theme) ──────────────
DARK_BLUE   = colors.HexColor('#0f172a')
MID_BLUE    = colors.HexColor('#0284c7')
LIGHT_BLUE  = colors.HexColor('#e0f2fe')
GREEN       = colors.HexColor('#16a34a')
LIGHT_GREEN = colors.HexColor('#dcfce7')
ORANGE      = colors.HexColor('#ea580c')
LIGHT_ORANGE= colors.HexColor('#fff7ed')
GREY_TEXT   = colors.HexColor('#64748b')
LIGHT_GREY  = colors.HexColor('#f8fafc')
BORDER_GREY = colors.HexColor('#e2e8f0')
WHITE       = colors.white
RED         = colors.HexColor('#dc2626')


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def _app_root() -> str:
    """Return the project root (where app.py lives)."""
    here = os.path.dirname(os.path.abspath(__file__))   # utils/
    return os.path.dirname(here)                         # INV_fi/


def _styles():
    base = getSampleStyleSheet()
    return {
        'company': ParagraphStyle('company', fontName='Helvetica-Bold',   fontSize=22, textColor=DARK_BLUE,    leading=26),
        'tagline': ParagraphStyle('tagline', fontName='Helvetica',         fontSize=9,  textColor=GREY_TEXT,    leading=13),
        'inv_title':ParagraphStyle('inv_title',fontName='Helvetica-Bold',  fontSize=16, textColor=WHITE,        leading=20),
        'label':   ParagraphStyle('label',   fontName='Helvetica-Bold',   fontSize=8,  textColor=GREY_TEXT,    leading=11, spaceAfter=1),
        'value':   ParagraphStyle('value',   fontName='Helvetica',         fontSize=9,  textColor=DARK_BLUE,    leading=13),
        'value_b': ParagraphStyle('value_b', fontName='Helvetica-Bold',   fontSize=9,  textColor=DARK_BLUE,    leading=13),
        'small':   ParagraphStyle('small',   fontName='Helvetica',         fontSize=8,  textColor=GREY_TEXT,    leading=11),
        'th':      ParagraphStyle('th',      fontName='Helvetica-Bold',   fontSize=8,  textColor=WHITE,        leading=11),
        'td':      ParagraphStyle('td',      fontName='Helvetica',         fontSize=8,  textColor=DARK_BLUE,    leading=11),
        'td_r':    ParagraphStyle('td_r',    fontName='Helvetica',         fontSize=8,  textColor=DARK_BLUE,    leading=11, alignment=TA_RIGHT),
        'td_rb':   ParagraphStyle('td_rb',   fontName='Helvetica-Bold',   fontSize=8,  textColor=DARK_BLUE,    leading=11, alignment=TA_RIGHT),
        'total_l': ParagraphStyle('total_l', fontName='Helvetica-Bold',   fontSize=11, textColor=WHITE,        leading=14),
        'total_r': ParagraphStyle('total_r', fontName='Helvetica-Bold',   fontSize=13, textColor=WHITE,        leading=16, alignment=TA_RIGHT),
        'footer':  ParagraphStyle('footer',  fontName='Helvetica',         fontSize=7,  textColor=GREY_TEXT,    leading=10, alignment=TA_CENTER),
        'note_l':  ParagraphStyle('note_l',  fontName='Helvetica-Bold',   fontSize=8,  textColor=GREY_TEXT,    leading=11),
        'note_v':  ParagraphStyle('note_v',  fontName='Helvetica',         fontSize=8,  textColor=DARK_BLUE,    leading=11),
    }


# ════════════════════════════════════════════════════════════
#  SALES ORDER INVOICE
# ════════════════════════════════════════════════════════════

def generate_sales_invoice(so) -> str:
    """
    Generate a PDF invoice for a SalesOrder.
    Returns the absolute path to the saved file.
    """
    root    = _app_root()
    folder  = _ensure_dir(os.path.join(root, 'invoices_sales_orders'))
    filename= f"INV-{so.order_ref}.pdf"
    filepath= os.path.join(folder, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=12*mm,  bottomMargin=15*mm
    )

    W = A4[0] - 30*mm   # usable width
    s = _styles()
    now = datetime.now().strftime('%d %b %Y, %I:%M %p')

    elements = []

    # ── Header band ───────────────────────────────────────
    header_data = [[
        Paragraph('INVENTORY', s['company']),
        Paragraph('SALES INVOICE', s['inv_title'])
    ]]
    header_tbl = Table(header_data, colWidths=[W * 0.55, W * 0.45])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND',  (1,0), (1,0), MID_BLUE),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',       (1,0), (1,0), 'CENTER'),
        ('LEFTPADDING', (1,0), (1,0), 6),
        ('RIGHTPADDING',(1,0), (1,0), 6),
        ('TOPPADDING',  (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
        ('ROUNDEDCORNERS', [4]),
    ]))
    elements.append(header_tbl)
    elements.append(Paragraph('Management System — Your trusted inventory partner', s['tagline']))
    elements.append(Spacer(1, 6*mm))

    # ── Order meta grid ───────────────────────────────────
    so_ref   = so.order_ref
    so_date  = str(so.created_at)[:10] if so.created_at else now[:10]
    so_stat  = (so.status or '').replace('_',' ').title()
    placed   = f"{so.placed_by or ''} ({so.placed_by_role or ''})"

    meta_data = [
        [
            Paragraph('INVOICE NO', s['label']),
            Paragraph(so_ref, s['value_b']),
            Paragraph('ORDER DATE', s['label']),
            Paragraph(so_date, s['value']),
        ],
        [
            Paragraph('STATUS', s['label']),
            Paragraph(so_stat, s['value_b']),
            Paragraph('GENERATED', s['label']),
            Paragraph(now, s['value']),
        ],
        [
            Paragraph('CUSTOMER', s['label']),
            Paragraph(so.customer_id or '—', s['value']),
            Paragraph('PLACED BY', s['label']),
            Paragraph(placed, s['value']),
        ],
        [
            Paragraph('SITE', s['label']),
            Paragraph(so.site_id or '—', s['value']),
            Paragraph('NOTE', s['label']),
            Paragraph(so.note or '—', s['value']),
        ],
    ]
    cw = [W*0.18, W*0.32, W*0.18, W*0.32]
    meta_tbl = Table(meta_data, colWidths=cw)
    meta_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), LIGHT_GREY),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER_GREY),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [4]),
    ]))
    elements.append(meta_tbl)
    elements.append(Spacer(1, 5*mm))

    # ── Items table ───────────────────────────────────────
    items = getattr(so, 'items', [])
    tbl_head = [
        Paragraph('PRODUCT ID', s['th']),
        Paragraph('PRODUCT NAME', s['th']),
        Paragraph('QTY', s['th']),
        Paragraph('UNIT PRICE (₹)', s['th']),
        Paragraph('LINE TOTAL (₹)', s['th']),
    ]
    tbl_rows = [tbl_head]
    for it in items:
        pname = ''
        if hasattr(it, 'product') and it.product:
            pname = it.product.product_name
        tbl_rows.append([
            Paragraph(str(it.product_id or ''), s['td']),
            Paragraph(pname or '—', s['td']),
            Paragraph(str(it.quantity or 0), s['td']),
            Paragraph(f"{it.unit_price:,.2f}", s['td_r']),
            Paragraph(f"{it.line_total:,.2f}", s['td_rb']),
        ])

    col_w = [W*0.18, W*0.34, W*0.10, W*0.19, W*0.19]
    item_tbl = Table(tbl_rows, colWidths=col_w, repeatRows=1)
    row_count = len(tbl_rows)
    item_tbl.setStyle(TableStyle([
        # Header
        ('BACKGROUND',    (0,0), (-1,0), DARK_BLUE),
        ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
        # Data rows alternating
        ('BACKGROUND',    (0,1), (-1,-1), WHITE),
        ('ROWBACKGROUNDS',(0,1), (-1,-1), [WHITE, LIGHT_GREY]),
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER_GREY),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 7),
        ('RIGHTPADDING',  (0,0), (-1,-1), 7),
        ('ALIGN',         (2,0), (-1,-1), 'RIGHT'),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(item_tbl)
    elements.append(Spacer(1, 4*mm))

    # ── Total bar ─────────────────────────────────────────
    total = so.total_amount or 0
    total_data = [[
        Paragraph('TOTAL AMOUNT', s['total_l']),
        Paragraph(f"₹ {total:,.2f}", s['total_r']),
    ]]
    total_tbl = Table(total_data, colWidths=[W*0.6, W*0.4])
    total_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), MID_BLUE),
        ('TOPPADDING',   (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0), (-1,-1), 10),
        ('LEFTPADDING',  (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [6]),
    ]))
    elements.append(total_tbl)
    elements.append(Spacer(1, 6*mm))

    # ── Footer ────────────────────────────────────────────
    elements.append(HRFlowable(width=W, thickness=0.5, color=BORDER_GREY))
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(
        f'This is a computer-generated invoice for {so_ref}. '
        f'Generated on {now} by INVENTORY Management System.',
        s['footer']
    ))

    doc.build(elements)
    return filepath


# ════════════════════════════════════════════════════════════
#  PURCHASE ORDER INVOICE
# ════════════════════════════════════════════════════════════

def generate_po_invoice(po) -> str:
    """
    Generate a PDF invoice for a PurchaseOrder.
    Returns the absolute path to the saved file.
    """
    root    = _app_root()
    folder  = _ensure_dir(os.path.join(root, 'invoices_purchase_orders'))
    filename= f"INV-{po.po_number}.pdf"
    filepath= os.path.join(folder, filename)

    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=12*mm,  bottomMargin=15*mm
    )

    W = A4[0] - 30*mm
    s = _styles()
    now = datetime.now().strftime('%d %b %Y, %I:%M %p')

    elements = []

    # ── Header band ───────────────────────────────────────
    header_data = [[
        Paragraph('INVENTORY', s['company']),
        Paragraph('PURCHASE ORDER', s['inv_title'])
    ]]
    header_tbl = Table(header_data, colWidths=[W * 0.55, W * 0.45])
    header_tbl.setStyle(TableStyle([
        ('BACKGROUND',  (1,0), (1,0), ORANGE),
        ('VALIGN',      (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN',       (1,0), (1,0), 'CENTER'),
        ('LEFTPADDING', (1,0), (1,0), 6),
        ('RIGHTPADDING',(1,0), (1,0), 6),
        ('TOPPADDING',  (0,0), (-1,-1), 6),
        ('BOTTOMPADDING',(0,0),(-1,-1), 6),
        ('ROUNDEDCORNERS', [4]),
    ]))
    elements.append(header_tbl)
    elements.append(Paragraph('Management System — Your trusted inventory partner', s['tagline']))
    elements.append(Spacer(1, 6*mm))

    # ── Supplier & order info grid ────────────────────────
    sup = po.supplier_rel if hasattr(po, 'supplier_rel') and po.supplier_rel else None
    sup_name  = sup.supplier_name if sup else '—'
    sup_email = sup.email if sup else '—'
    sup_phone = sup.phone if sup and sup.phone else '—'

    order_date = str(po.order_date)[:10] if po.order_date else '—'
    exp_del    = str(po.expected_delivery) if po.expected_delivery else '—'
    po_status  = (po.status or '').replace('_',' ').title()

    # Supplier address block
    elements.append(Paragraph('SUPPLIER DETAILS', s['label']))
    elements.append(Spacer(1, 1*mm))
    sup_data = [[
        Paragraph('SUPPLIER', s['label']),
        Paragraph(sup_name, s['value_b']),
        Paragraph('PO NUMBER', s['label']),
        Paragraph(po.po_number, s['value_b']),
    ],[
        Paragraph('EMAIL', s['label']),
        Paragraph(sup_email, s['value']),
        Paragraph('ORDER DATE', s['label']),
        Paragraph(order_date, s['value']),
    ],[
        Paragraph('PHONE', s['label']),
        Paragraph(sup_phone, s['value']),
        Paragraph('EXP. DELIVERY', s['label']),
        Paragraph(exp_del, s['value']),
    ],[
        Paragraph('STATUS', s['label']),
        Paragraph(po_status, s['value_b']),
        Paragraph('PLACED BY', s['label']),
        Paragraph(f"{po.placed_by or ''} ({po.placed_by_role or ''})", s['value']),
    ]]
    cw = [W*0.15, W*0.35, W*0.18, W*0.32]
    sup_tbl = Table(sup_data, colWidths=cw)
    sup_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), LIGHT_ORANGE),
        ('GRID',         (0,0), (-1,-1), 0.5, BORDER_GREY),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 8),
        ('ROUNDEDCORNERS', [4]),
    ]))
    elements.append(sup_tbl)
    elements.append(Spacer(1, 5*mm))

    # ── Order line item table ─────────────────────────────
    prod = po.product
    prod_name = prod.product_name if prod else '—'
    unit_cost = prod.unit_cost if prod else 0.0
    total_cost = round((unit_cost or 0) * (po.quantity or 0), 2)

    tbl_head = [
        Paragraph('SITE', s['th']),
        Paragraph('PRODUCT ID', s['th']),
        Paragraph('PRODUCT NAME', s['th']),
        Paragraph('QTY', s['th']),
        Paragraph('UNIT COST (₹)', s['th']),
        Paragraph('TOTAL (₹)', s['th']),
    ]
    tbl_rows = [tbl_head, [
        Paragraph(po.site_id or '—', s['td']),
        Paragraph(po.product_id or '—', s['td']),
        Paragraph(prod_name, s['td']),
        Paragraph(str(po.quantity), s['td']),
        Paragraph(f"{unit_cost:,.2f}", s['td_r']),
        Paragraph(f"{total_cost:,.2f}", s['td_rb']),
    ]]
    col_w = [W*0.14, W*0.15, W*0.30, W*0.10, W*0.15, W*0.16]
    item_tbl = Table(tbl_rows, colWidths=col_w)
    item_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), DARK_BLUE),
        ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
        ('BACKGROUND',    (0,1), (-1,-1), LIGHT_GREY),
        ('GRID',          (0,0), (-1,-1), 0.4, BORDER_GREY),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 7),
        ('RIGHTPADDING',  (0,0), (-1,-1), 7),
        ('ALIGN',         (3,0), (-1,-1), 'RIGHT'),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(item_tbl)
    elements.append(Spacer(1, 4*mm))

    # ── Total bar ─────────────────────────────────────────
    total_data = [[
        Paragraph('TOTAL AMOUNT', s['total_l']),
        Paragraph(f"₹ {total_cost:,.2f}", s['total_r']),
    ]]
    total_tbl = Table(total_data, colWidths=[W*0.6, W*0.4])
    total_tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,-1), ORANGE),
        ('TOPPADDING',   (0,0), (-1,-1), 10),
        ('BOTTOMPADDING',(0,0), (-1,-1), 10),
        ('LEFTPADDING',  (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [6]),
    ]))
    elements.append(total_tbl)
    elements.append(Spacer(1, 5*mm))

    # ── Terms / note ──────────────────────────────────────
    if po.admin_note:
        elements.append(Paragraph('NOTE', s['note_l']))
        elements.append(Paragraph(po.admin_note, s['note_v']))
        elements.append(Spacer(1, 3*mm))

    elements.append(Paragraph(
        'TERMS: Payment due within 30 days of delivery. Goods must match specifications. '
        'Please reference the PO number in all correspondence.',
        s['small']
    ))
    elements.append(Spacer(1, 4*mm))

    # ── Footer ────────────────────────────────────────────
    elements.append(HRFlowable(width=W, thickness=0.5, color=BORDER_GREY))
    elements.append(Spacer(1, 2*mm))
    elements.append(Paragraph(
        f'This is a computer-generated purchase order document for {po.po_number}. '
        f'Generated on {now} by INVENTORY Management System.',
        s['footer']
    ))

    doc.build(elements)
    return filepath