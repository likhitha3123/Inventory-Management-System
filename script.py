import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from config import Config
from models.db import db

from models.records import (
    Product, Customer, Site, Inventory,
    Logistics, Sale, Promotion, SeasonalPlan, States, Supplier
)
from models.purchase_order import PurchaseOrder
from models.catogery import Category
from models.sub_catogery import SubCategory

engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)

# -------------------------------
# HELPERS
# -------------------------------

def clean_columns(df):
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    return df

def to_date(series):
    return pd.to_datetime(series, errors="coerce").dt.date

def truncate(table):
    try:
        with engine.begin() as conn:
            conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        print(f"{table} truncated")
    except Exception as e:
        print(f"Error truncating {table}: {e}")

def safe_to_sql(df, table_name):
    try:
        df.to_sql(table_name, engine, if_exists="append", index=False)
        print(f"{table_name} loaded ({len(df)} rows)")
    except Exception as e:
        print(f"Bulk insert failed for {table_name}, trying row-by-row...")

        success, failed = 0, 0
        for _, row in df.iterrows():
            try:
                row.to_frame().T.to_sql(table_name, engine, if_exists="append", index=False)
                success += 1
            except Exception:
                failed += 1

        print(f"{table_name}: {success} inserted, {failed} skipped")


# -------------------------------
# LOAD FUNCTIONS
# -------------------------------

def load_states():
    truncate(States.__tablename__)

    df = clean_columns(pd.read_csv("archive/States.csv"))
    df["state_id"] = pd.to_numeric(df["state_id"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["state_id"], inplace=True)

    safe_to_sql(df, States.__tablename__)


def load_suppliers():
    truncate("suppliers")

    df = clean_columns(pd.read_csv("archive/suppliers.csv"))

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["supplier_pk"], inplace=True)

    safe_to_sql(df, "suppliers")


def load_categories():
    truncate("categories")

    df = clean_columns(pd.read_csv("archive/categories.csv"))

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["name"], inplace=True)

    safe_to_sql(df, "categories")


def load_subcategories():
    truncate("subcategories")

    df = clean_columns(pd.read_csv("archive/subcategories.csv"))
    df["category_id"] = pd.to_numeric(df["category_id"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["name", "category_id"], inplace=True)

    safe_to_sql(df, "subcategories")


def load_products():
    truncate(Product.__tablename__)

    df = clean_columns(pd.read_csv("archive/Product_Information.csv"))

    df["unit_cost"] = pd.to_numeric(df["unit_cost"], errors="coerce")
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")
    df["shelf_life"] = pd.to_numeric(df["shelf_life"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["product_id"], inplace=True)

    safe_to_sql(df, Product.__tablename__)


def load_customers():
    truncate(Customer.__tablename__)

    df = clean_columns(pd.read_csv("archive/Customer_Demographics.csv"))

    df["age"] = pd.to_numeric(df["age"], errors="coerce")
    df["purchase_frequency"] = pd.to_numeric(df["purchase_frequency"], errors="coerce")
    df["average_spend"] = pd.to_numeric(df["average_spend"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["customer_id"], inplace=True)

    safe_to_sql(df, Customer.__tablename__)


def load_sites():
    truncate(Site.__tablename__)

    df = clean_columns(pd.read_csv("archive/Site_Details.csv"))

    df["store_size"] = pd.to_numeric(df["store_size"], errors="coerce")
    df["open_date"] = to_date(df["open_date"])

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["site_id"], inplace=True)

    safe_to_sql(df, Site.__tablename__)


def load_inventory():
    truncate(Inventory.__tablename__)

    df = clean_columns(pd.read_csv("archive/Inventory_Data.csv"))

    df["beginning_inventory"] = pd.to_numeric(df["beginning_inventory"], errors="coerce")
    df["ending_inventory"] = pd.to_numeric(df["ending_inventory"], errors="coerce")
    df["replenishment"] = pd.to_numeric(df["replenishment"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["site_id", "product_id"], inplace=True)

    safe_to_sql(df, Inventory.__tablename__)


def load_logistics():
    truncate(Logistics.__tablename__)

    df = clean_columns(pd.read_csv("archive/Logistics_Data.csv"))

    df["shipment_date"] = to_date(df["shipment_date"])
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["shipment_id"], inplace=True)

    safe_to_sql(df, Logistics.__tablename__)


def load_sales():
    truncate(Sale.__tablename__)

    df = clean_columns(pd.read_csv("archive/Sales_Data.csv"))

    # FIXED DATE
    df["date"] = pd.to_datetime(df["date"], format="%d-%m-%Y", errors="coerce")

    df["units_sold"] = pd.to_numeric(df["units_sold"], errors="coerce")
    df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce")

    print("Invalid dates:", df["date"].isna().sum())  # debug

    df.drop_duplicates(inplace=True)

    #  Now this will NOT remove valid rows
    df.dropna(subset=["date", "site_id", "product_id"], inplace=True)

    safe_to_sql(df, Sale.__tablename__)


def load_promotions():
    truncate(Promotion.__tablename__)

    df = clean_columns(pd.read_csv("archive/Promotions_and_Discounts.csv"))

    df["start_date"] = to_date(df["start_date"])
    df["end_date"] = to_date(df["end_date"])

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["promotion_id"], inplace=True)

    safe_to_sql(df, Promotion.__tablename__)


def load_seasonal_planning():
    truncate(SeasonalPlan.__tablename__)

    df = clean_columns(pd.read_csv("archive/Monthly_Seasonal_Planning.csv"))

    df["forecasted_sales"] = pd.to_numeric(df["forecasted_sales"], errors="coerce")
    df["actual_sales"] = pd.to_numeric(df["actual_sales"], errors="coerce")

    df.drop_duplicates(inplace=True)
    df.dropna(subset=["month", "site_id"], inplace=True)

    safe_to_sql(df, SeasonalPlan.__tablename__)


# -------------------------------
# MAIN (ORDER MATTERS)
# -------------------------------

if __name__ == "__main__":
    print(" Loading Data...\n")

    load_states()
    load_suppliers()
    load_categories()
    load_subcategories()

    load_products()
    load_customers()
    load_sites()

    load_inventory()
    load_logistics()
    load_sales()
    load_promotions()
    load_seasonal_planning()

    print("\n ALL DATA LOADED SUCCESSFULLY! ✅")