import { Request, Response, NextFunction } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

// Simple request logger
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log request
  const log = {
    method: req.method,
    path: req.path,
    userId: req.user?.sub || 'anonymous',
    timestamp: new Date().toISOString()
  };
  
  if (isDev) {
    console.log(`[REQ] ${log.method} ${log.path} - User: ${log.userId}`);
  }

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    if (isDev) {
      const statusColor = status >= 400 ? '\x1b[31m' : '\x1b[32m'; // Red for errors, green for success
      console.log(`[RES] ${log.method} ${log.path} - ${statusColor}${status}\x1b[0m - ${duration}ms`);
    }
    
    // Log slow requests in production too
    if (duration > 5000) {
      console.warn(`[SLOW] ${log.method} ${log.path} took ${duration}ms`);
    }
    
    // Log errors
    if (status >= 500) {
      console.error(`[ERROR] ${log.method} ${log.path} - Status ${status}`);
    }
  });

  next();
}

// Error logger middleware
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  
  if (isDev) {
    console.error(err.stack);
  }
  
  // Don't expose error details in production
  const message = isDev ? err.message : 'Internal Server Error';
  
  res.status(500).json({
    success: false,
    error: message
  });
}
