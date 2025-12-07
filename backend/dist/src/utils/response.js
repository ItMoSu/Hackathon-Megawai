"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
exports.createdResponse = createdResponse;
exports.notFoundResponse = notFoundResponse;
exports.unauthorizedResponse = unauthorizedResponse;
exports.forbiddenResponse = forbiddenResponse;
exports.serverErrorResponse = serverErrorResponse;
exports.paginatedResponse = paginatedResponse;
// Standardized API response helpers
function successResponse(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data
    });
}
function errorResponse(res, error, statusCode = 400) {
    return res.status(statusCode).json({
        success: false,
        error
    });
}
function createdResponse(res, data) {
    return successResponse(res, data, 201);
}
function notFoundResponse(res, message = 'Resource tidak ditemukan') {
    return errorResponse(res, message, 404);
}
function unauthorizedResponse(res, message = 'User tidak terotentikasi') {
    return errorResponse(res, message, 401);
}
function forbiddenResponse(res, message = 'Akses ditolak') {
    return errorResponse(res, message, 403);
}
function serverErrorResponse(res, error) {
    const message = error instanceof Error ? error.message : error;
    console.error('[Server Error]', message);
    return errorResponse(res, 'Terjadi kesalahan server', 500);
}
// Paginated response helper
function paginatedResponse(res, data, total, page, limit) {
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
