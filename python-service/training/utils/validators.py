'''
Data Validators (Single Responsibility Principle)
Implements IDataValidator interface
'''

from typing import List, Dict
import pandas as pd
from core.interfaces import IDataValidator, IColumnDetector, IDataCleaner
from core.exceptions import DataValidationError


class SalesDataValidator(IDataValidator):
    '''Validates sales data format and quality'''

    def __init__(self):
        self.errors: List[str] = []

    def validate_dataframe(self, df: pd.DataFrame) -> bool:
        '''Validate if dataframe has required structure'''
        self.errors = []

        if df is None or df.empty:
            self.errors.append("DataFrame is empty")
            return False

        if len(df) < 30:
            self.errors.append(f"Insufficient data: {len(df)} rows (need 30+)")
            return False

        required_cols = ['date', 'quantity']
        missing_cols = [col for col in required_cols if col not in df.columns]

        if missing_cols:
            self.errors.append(f"Missing columns: {missing_cols}")
            return False

        # Check for null values
        null_counts = df[required_cols].isnull().sum()
        if null_counts.any():
            self.errors.append(f"Null values found: {null_counts.to_dict()}")
            return False

        # Check quantity is numeric and positive
        try:
            quantities = pd.to_numeric(df['quantity'], errors='coerce')
            if quantities.isnull().any():
                self.errors.append("Non-numeric values in quantity column")
                return False

            if (quantities <= 0).any():
                self.errors.append("Negative or zero quantities found")
                return False
        except Exception as e:
            self.errors.append(f"Quantity validation failed: {str(e)}")
            return False

        return True

    def validate_sales_data(self, sales_data: List[Dict]) -> bool:
        '''Validate sales data list format'''
        self.errors = []

        if not sales_data:
            self.errors.append("Sales data is empty")
            return False

        if len(sales_data) < 30:
            self.errors.append(f"Insufficient records: {len(sales_data)} (need 30+)")
            return False

        for i, record in enumerate(sales_data):
            if 'date' not in record:
                self.errors.append(f"Record {i}: missing 'date' field")
                return False

            if 'quantity' not in record:
                self.errors.append(f"Record {i}: missing 'quantity' field")
                return False

            try:
                float(record['quantity'])
            except (ValueError, TypeError):
                self.errors.append(f"Record {i}: invalid quantity value")
                return False

        return True

    def get_validation_errors(self) -> List[str]:
        '''Return list of validation errors'''
        return self.errors


class ColumnDetector(IColumnDetector):
    '''Detects date, quantity, and product columns'''

    DATE_KEYWORDS = ['date', 'tanggal', 'tgl', 'waktu', 'time', 'datetime']
    QUANTITY_KEYWORDS = ['quantity', 'qty', 'jumlah', 'sales', 'penjualan', 'amount', 'total', 'sold']
    PRODUCT_KEYWORDS = ['product', 'produk', 'item', 'nama', 'name', 'barang', 'article', 'desc', 'description']

    def detect_date_column(self, df: pd.DataFrame) -> str | None:
        '''Auto-detect date column'''
        for col in df.columns:
            col_lower = str(col).lower().strip()
            if any(keyword in col_lower for keyword in self.DATE_KEYWORDS):
                return col
        return None

    def detect_quantity_column(self, df: pd.DataFrame) -> str | None:
        '''Auto-detect quantity column'''
        for col in df.columns:
            col_lower = str(col).lower().strip()
            if any(keyword in col_lower for keyword in self.QUANTITY_KEYWORDS):
                # Verify it's numeric
                try:
                    pd.to_numeric(df[col], errors='coerce')
                    return col
                except Exception:
                    continue
        return None

    def detect_product_column(self, df: pd.DataFrame) -> str | None:
        '''Auto-detect product name column'''
        for col in df.columns:
            col_lower = str(col).lower().strip()
            if col_lower.startswith('unnamed') or col_lower.startswith('index'):
                continue
            if any(keyword in col_lower for keyword in self.PRODUCT_KEYWORDS):
                return col
        return None


class DataCleaner(IDataCleaner):
    '''Cleans and standardizes data'''

    def __init__(self, date_formats: List[str] = None):
        from datetime import datetime  # noqa: F401
        self.date_formats = date_formats or [
            '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y',
            '%Y/%m/%d', '%d-%m-%Y', '%Y%m%d'
        ]

    def clean_date(self, date_str: str) -> str | None:
        '''Clean and standardize date to YYYY-MM-DD'''
        from datetime import datetime

        if pd.isna(date_str):
            return None

        date_str = str(date_str).strip()

        for fmt in self.date_formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except Exception:
                continue

        return None

    def clean_quantity(self, quantity_val) -> float | None:
        '''Clean and validate quantity'''
        try:
            qty = float(pd.to_numeric(quantity_val, errors='coerce'))
            if pd.isna(qty) or qty <= 0:
                return None
            return qty
        except Exception:
            return None

    def remove_outliers(self, df: pd.DataFrame, std_threshold: float = 3.0) -> pd.DataFrame:
        '''Remove outliers using Z-score method'''
        if 'quantity' not in df.columns or len(df) < 10:
            return df

        mean = df['quantity'].mean()
        std = df['quantity'].std()

        if std == 0:
            return df

        z_scores = abs((df['quantity'] - mean) / std)
        return df[z_scores < std_threshold].copy()
