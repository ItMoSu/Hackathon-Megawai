import { Response } from 'express';

// Standardized API response helpers

export function successResponse<T>(res: Response, data: T, statusCode: number = 200) {
  return res.status(statusCode).json({
    success: true,
    data
  });
}

export function errorResponse(res: Response, error: string, statusCode: number = 400) {
  return res.status(statusCode).json({
    success: false,
    error
  });
}

export function createdResponse<T>(res: Response, data: T) {
  return successResponse(res, data, 201);
}

export function notFoundResponse(res: Response, message: string = 'Resource tidak ditemukan') {
  return errorResponse(res, message, 404);
}

export function unauthorizedResponse(res: Response, message: string = 'User tidak terotentikasi') {
  return errorResponse(res, message, 401);
}

export function forbiddenResponse(res: Response, message: string = 'Akses ditolak') {
  return errorResponse(res, message, 403);
}

export function serverErrorResponse(res: Response, error: Error | string) {
  const message = error instanceof Error ? error.message : error;
  console.error('[Server Error]', message);
  return errorResponse(res, 'Terjadi kesalahan server', 500);
}

// Paginated response helper
export function paginatedResponse<T>(
  res: Response, 
  data: T[], 
  total: number, 
  page: number, 
  limit: number
) {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}
