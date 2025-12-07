import { Request, Response, NextFunction } from 'express';

// Input sanitization utilities
export function sanitizeString(str: unknown, maxLength: number = 500): string {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS
    .slice(0, maxLength);
}

export function sanitizeNumber(value: unknown, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num) || !isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 254);
}

export function sanitizeUUID(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : null;
}

export function sanitizeDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  const date = new Date(String(dateStr));
  if (isNaN(date.getTime())) return null;
  // Don't allow dates too far in past or future
  const minDate = new Date('2000-01-01');
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  if (date < minDate || date > maxDate) return null;
  return date;
}

// Validation middleware for sales input
export function validateSalesInput(req: Request, res: Response, next: NextFunction) {
  const { quantity, sale_date, product_id, product_name } = req.body;

  // Validate quantity
  const qty = sanitizeNumber(quantity, 0, 999999);
  if (qty < 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Quantity tidak valid (min: 0, max: 999999)' 
    });
  }
  req.body.quantity = qty;

  // Validate date
  if (sale_date) {
    const date = sanitizeDate(sale_date);
    if (!date) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tanggal tidak valid' 
      });
    }
    req.body.sale_date = date;
  }

  // Sanitize strings
  if (product_name) {
    req.body.product_name = sanitizeString(product_name, 100);
  }

  next();
}

// Validation middleware for product input
export function validateProductInput(req: Request, res: Response, next: NextFunction) {
  const { name, unit, price } = req.body;

  // Validate name
  if (name !== undefined) {
    const sanitizedName = sanitizeString(name, 100);
    if (sanitizedName.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nama produk minimal 2 karakter' 
      });
    }
    req.body.name = sanitizedName;
  }

  // Validate unit
  const validUnits = ['pcs', 'porsi', 'cup', 'botol', 'bungkus', 'kg', 'box', 'unit', 'lembar', 'pack'];
  if (unit !== undefined) {
    const sanitizedUnit = sanitizeString(unit, 20).toLowerCase();
    if (!validUnits.includes(sanitizedUnit)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unit tidak valid' 
      });
    }
    req.body.unit = sanitizedUnit;
  }

  // Validate price
  if (price !== undefined && price !== null && price !== '') {
    const sanitizedPrice = sanitizeNumber(price, 0, 999999999);
    req.body.price = sanitizedPrice;
  }

  next();
}

// Generic request size limiter
export function limitRequestSize(maxItems: number = 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { entries, sales_data } = req.body;
    
    if (Array.isArray(entries) && entries.length > maxItems) {
      return res.status(400).json({
        success: false,
        error: `Maksimal ${maxItems} item per request`
      });
    }
    
    if (Array.isArray(sales_data) && sales_data.length > maxItems) {
      return res.status(400).json({
        success: false,
        error: `Maksimal ${maxItems} data points per request`
      });
    }
    
    next();
  };
}
