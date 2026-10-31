export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, code: string = 'ERROR', isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: string = 'BAD_REQUEST'): ApiError {
    return new ApiError(400, message, code);
  }

  static unauthorized(message: string = 'Unauthorized', code: string = 'UNAUTHORIZED'): ApiError {
    return new ApiError(401, message, code);
  }

  static forbidden(message: string = 'Forbidden', code: string = 'FORBIDDEN'): ApiError {
    return new ApiError(403, message, code);
  }

  static notFound(message: string = 'Resource not found', code: string = 'NOT_FOUND'): ApiError {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code: string = 'CONFLICT'): ApiError {
    return new ApiError(409, message, code);
  }

  static tooManyRequests(message: string = 'Too many requests', code: string = 'TOO_MANY_REQUESTS'): ApiError {
    return new ApiError(429, message, code);
  }

  static internal(message: string = 'Internal server error', code: string = 'INTERNAL_SERVER_ERROR'): ApiError {
    return new ApiError(500, message, code, false);
  }
}

