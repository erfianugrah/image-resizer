/**
 * Centralized error types for the application
 * Provides a unified way to handle errors with proper typing and classification
 */

// -------------------------------------------------------------
// Error Classes
// -------------------------------------------------------------

/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  readonly name: string = 'AppError';
  readonly statusCode: number = 500;
  readonly isOperational: boolean = true;
  readonly errorCode: string;

  constructor(message: string, errorCode: string, statusCode = 500, isOperational = true) {
    super(message);
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * ValidationError for input validation errors
 */
export class ValidationError extends AppError {
  readonly name: string = 'ValidationError';
  readonly field?: string;
  readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, true);
    this.field = field;
    this.value = value;

    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * NotFoundError for resources that cannot be found
 */
export class NotFoundError extends AppError {
  readonly name: string = 'NotFoundError';
  readonly resource: string;
  readonly identifier?: string | number;

  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier ${identifier} not found`
      : `${resource} not found`;

    super(message, 'NOT_FOUND', 404, true);
    this.resource = resource;
    this.identifier = identifier;

    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * ConfigurationError for errors related to configuration
 */
export class ConfigurationError extends AppError {
  readonly name: string = 'ConfigurationError';
  readonly configKey?: string;

  constructor(message: string, configKey?: string) {
    super(message, 'CONFIG_ERROR', 500, true);
    this.configKey = configKey;

    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * ServiceError for errors in external services
 */
export class ServiceError extends AppError {
  readonly name: string = 'ServiceError';
  readonly service: string;
  readonly operation?: string;

  constructor(service: string, message: string, operation?: string) {
    super(message, 'SERVICE_ERROR', 502, true);
    this.service = service;
    this.operation = operation;

    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

/**
 * R2Error for errors related to R2 storage
 */
export class R2Error extends AppError {
  readonly name: string = 'R2Error';
  readonly r2Key?: string;
  readonly service: string = 'R2';

  constructor(message: string, errorCode: string, statusCode = 500, r2Key?: string) {
    super(message, errorCode, statusCode, true);
    this.r2Key = r2Key;

    Object.setPrototypeOf(this, R2Error.prototype);
  }
}

/**
 * R2NotFoundError for R2 objects that cannot be found
 */
export class R2NotFoundError extends R2Error {
  readonly name: string = 'R2NotFoundError';

  constructor(message: string, r2Key: string) {
    super(message, 'R2_NOT_FOUND', 404, r2Key);

    Object.setPrototypeOf(this, R2NotFoundError.prototype);
  }
}

/**
 * R2TransformationError for errors during R2 image transformations
 */
export class R2TransformationError extends R2Error {
  readonly name: string = 'R2TransformationError';
  readonly method: string;

  constructor(message: string, method: string, r2Key?: string) {
    super(message, `R2_TRANSFORM_FAILED_${method.toUpperCase()}`, 500, r2Key);
    this.method = method;

    Object.setPrototypeOf(this, R2TransformationError.prototype);
  }
}

/**
 * R2NetworkError for network-related errors during R2 operations
 */
export class R2NetworkError extends R2Error {
  readonly name: string = 'R2NetworkError';

  constructor(message: string, r2Key?: string) {
    super(message, 'R2_NETWORK_ERROR', 502, r2Key);

    Object.setPrototypeOf(this, R2NetworkError.prototype);
  }
}

/**
 * TimeoutError for operations that exceed time limits
 */
export class TimeoutError extends AppError {
  readonly name: string = 'TimeoutError';
  readonly operation: string;
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`Operation ${operation} timed out after ${timeoutMs}ms`, 'TIMEOUT', 504, true);
    this.operation = operation;
    this.timeoutMs = timeoutMs;

    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * AuthorizationError for permission/access issues
 */
export class AuthorizationError extends AppError {
  readonly name: string = 'AuthorizationError';
  readonly permission?: string;

  constructor(message: string, permission?: string) {
    super(message, 'AUTH_ERROR', 403, true);
    this.permission = permission;

    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

// -------------------------------------------------------------
// Interface Definitions
// -------------------------------------------------------------

/**
 * Interface for the error factory
 */
export interface IErrorFactory {
  /**
   * Creates an AppError instance
   */
  createAppError(
    message: string,
    errorCode: string,
    statusCode?: number,
    isOperational?: boolean
  ): AppError;

  /**
   * Creates a ValidationError instance
   */
  createValidationError(message: string, field?: string, value?: unknown): ValidationError;

  /**
   * Creates a NotFoundError instance
   */
  createNotFoundError(resource: string, identifier?: string | number): NotFoundError;

  /**
   * Creates a ConfigurationError instance
   */
  createConfigurationError(message: string, configKey?: string): ConfigurationError;

  /**
   * Creates a ServiceError instance
   */
  createServiceError(service: string, message: string, operation?: string): ServiceError;

  /**
   * Creates a TimeoutError instance
   */
  createTimeoutError(operation: string, timeoutMs: number): TimeoutError;

  /**
   * Creates an AuthorizationError instance
   */
  createAuthorizationError(message: string, permission?: string): AuthorizationError;

  /**
   * Creates an R2Error instance
   */
  createR2Error(message: string, errorCode: string, statusCode?: number, r2Key?: string): R2Error;

  /**
   * Creates an R2NotFoundError instance
   */
  createR2NotFoundError(message: string, r2Key: string): R2NotFoundError;

  /**
   * Creates an R2TransformationError instance
   */
  createR2TransformationError(
    message: string,
    method: string,
    r2Key?: string
  ): R2TransformationError;

  /**
   * Creates an R2NetworkError instance
   */
  createR2NetworkError(message: string, r2Key?: string): R2NetworkError;

  /**
   * Normalizes an unknown error into an AppError instance
   */
  createFromUnknown(err: unknown, defaultMessage?: string): AppError;
}

/**
 * Interface for the error response factory
 */
export interface IErrorResponseFactory {
  /**
   * Creates a standardized error response from an error
   */
  createErrorResponse(err: unknown): Response;
}

/**
 * Dependencies for the ErrorFactory
 */
export interface ErrorFactoryDependencies {
  /**
   * Logger dependency (optional)
   */
  logger?: {
    error?: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}

/**
 * Dependencies for the ErrorResponseFactory
 */
export interface ErrorResponseFactoryDependencies {
  /**
   * Error factory dependency
   */
  errorFactory: IErrorFactory;

  /**
   * Logger dependency (optional)
   */
  logger?: {
    error?: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}

// -------------------------------------------------------------
// Factory Function Implementations
// -------------------------------------------------------------

/**
 * Creates an error factory instance
 * @param dependencies - Dependencies required by the factory
 * @returns An implementation of IErrorFactory
 */
export function createErrorFactory(dependencies: ErrorFactoryDependencies = {}): IErrorFactory {
  const { logger } = dependencies;

  const logError = (message: string, details?: Record<string, unknown>) => {
    if (logger?.error) {
      logger.error('ErrorFactory', message, details);
    }
  };

  return {
    createAppError(
      message: string,
      errorCode: string,
      statusCode = 500,
      isOperational = true
    ): AppError {
      return new AppError(message, errorCode, statusCode, isOperational);
    },

    createValidationError(message: string, field?: string, value?: unknown): ValidationError {
      return new ValidationError(message, field, value);
    },

    createNotFoundError(resource: string, identifier?: string | number): NotFoundError {
      return new NotFoundError(resource, identifier);
    },

    createConfigurationError(message: string, configKey?: string): ConfigurationError {
      return new ConfigurationError(message, configKey);
    },

    createServiceError(service: string, message: string, operation?: string): ServiceError {
      return new ServiceError(service, message, operation);
    },

    createTimeoutError(operation: string, timeoutMs: number): TimeoutError {
      return new TimeoutError(operation, timeoutMs);
    },

    createAuthorizationError(message: string, permission?: string): AuthorizationError {
      return new AuthorizationError(message, permission);
    },

    createR2Error(message: string, errorCode: string, statusCode = 500, r2Key?: string): R2Error {
      return new R2Error(message, errorCode, statusCode, r2Key);
    },

    createR2NotFoundError(message: string, r2Key: string): R2NotFoundError {
      return new R2NotFoundError(message, r2Key);
    },

    createR2TransformationError(
      message: string,
      method: string,
      r2Key?: string
    ): R2TransformationError {
      return new R2TransformationError(message, method, r2Key);
    },

    createR2NetworkError(message: string, r2Key?: string): R2NetworkError {
      return new R2NetworkError(message, r2Key);
    },

    createFromUnknown(err: unknown, defaultMessage = 'An error occurred'): AppError {
      // Log the raw error if logger is available
      if (logger?.error) {
        logError('Normalizing unknown error', {
          rawError: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }

      if (err instanceof AppError) {
        return err;
      }

      if (err instanceof Error) {
        // Check for common error patterns
        // R2-specific not found errors
        if (
          err.message.includes('R2') &&
          (err.message.includes('not found') || err.message.includes('404'))
        ) {
          // Extract the key if possible using regex
          const keyMatch = err.message.match(/(?:key|object|file|image)[:\s]+([^\s,.]+)/i);
          const r2Key = keyMatch ? keyMatch[1] : 'unknown';
          return new R2NotFoundError(err.message, r2Key);
        }
        // General not found errors
        else if (err.message.includes('not found') || err.message.includes('404')) {
          return new NotFoundError('Resource', err.message);
        }

        if (err.message.includes('validation') || err.message.includes('invalid')) {
          return new ValidationError(err.message);
        }

        if (err.message.includes('timeout') || err.message.includes('timed out')) {
          return new TimeoutError('Unknown', 30000);
        }

        if (err.message.includes('configuration') || err.message.includes('config')) {
          return new ConfigurationError(err.message);
        }

        // R2 transformation errors
        if (err.message.includes('transform') && err.message.includes('R2')) {
          // Try to determine the transformation method
          let method = 'unknown';
          if (err.message.includes('cdn-cgi')) method = 'cdn-cgi';
          else if (err.message.includes('direct')) method = 'direct-url';
          else if (err.message.includes('remote')) method = 'remote';

          return new R2TransformationError(err.message, method);
        }

        if (
          err.message.includes('permission') ||
          err.message.includes('access') ||
          err.message.includes('unauthorized') ||
          err.message.includes('forbidden')
        ) {
          return new AuthorizationError(err.message);
        }

        // Default error with original message
        return new AppError(err.message, 'UNKNOWN_ERROR');
      }

      // For non-Error objects
      if (typeof err === 'object' && err !== null) {
        const errorObj = err as Record<string, unknown>;

        if (typeof errorObj.message === 'string') {
          return new AppError(errorObj.message, 'UNKNOWN_ERROR');
        }

        if (typeof errorObj.error === 'string') {
          return new AppError(errorObj.error, 'UNKNOWN_ERROR');
        }
      }

      // For primitives or completely unknown errors
      return new AppError(typeof err === 'string' ? err : defaultMessage, 'UNKNOWN_ERROR');
    },
  };
}

/**
 * Creates an error response factory instance
 * @param dependencies - Dependencies required by the factory
 * @returns An implementation of IErrorResponseFactory
 */
export function createErrorResponseFactory(
  dependencies: ErrorResponseFactoryDependencies
): IErrorResponseFactory {
  const { errorFactory, logger } = dependencies;

  const logError = (message: string, details?: Record<string, unknown>) => {
    if (logger?.error) {
      logger.error('ErrorResponseFactory', message, details);
    }
  };

  return {
    createErrorResponse(err: unknown): Response {
      try {
        const appError = errorFactory.createFromUnknown(err);

        const errorPayload = {
          error: {
            code: appError.errorCode,
            message: appError.message,
            type: appError.name,
          },
        };

        // Add specific fields based on error type
        if (appError instanceof ValidationError && appError.field) {
          (errorPayload.error as Record<string, unknown>).field = appError.field;
        }

        if (appError instanceof NotFoundError) {
          (errorPayload.error as Record<string, unknown>).resource = appError.resource;
        }

        if (appError instanceof ServiceError) {
          (errorPayload.error as Record<string, unknown>).service = appError.service;
        }

        // Add R2-specific fields
        if (appError instanceof R2Error) {
          (errorPayload.error as Record<string, unknown>).r2Key = appError.r2Key;

          // Add transformation method for R2TransformationError
          if (appError instanceof R2TransformationError) {
            (errorPayload.error as Record<string, unknown>).method = appError.method;
          }
        }

        return new Response(JSON.stringify(errorPayload), {
          status: appError.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        });
      } catch (responseError) {
        // Something went wrong while creating the error response
        if (logger?.error) {
          logError('Failed to create error response', {
            originalError: err instanceof Error ? err.message : String(err),
            responseCreationError:
              responseError instanceof Error ? responseError.message : String(responseError),
          });
        }

        // Fallback error response
        return new Response(
          JSON.stringify({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'An unexpected error occurred while processing the request',
              type: 'InternalError',
            },
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
          }
        );
      }
    },
  };
}

// -------------------------------------------------------------
// Backward Compatibility
// -------------------------------------------------------------

/**
 * @deprecated Use createErrorFactory().createFromUnknown() instead
 * Factory function to create appropriate error from unknown error type
 * @param err - The error to normalize
 * @param defaultMessage - Default message if error doesn't have one
 * @returns Appropriate AppError subclass
 */
export function createErrorFromUnknown(
  err: unknown,
  defaultMessage = 'An error occurred'
): AppError {
  // Default implementation that doesn't require dependencies
  const errorFactory = createErrorFactory();
  return errorFactory.createFromUnknown(err, defaultMessage);
}

/**
 * @deprecated Use createErrorResponseFactory().createErrorResponse() instead
 * Create an appropriate error response based on the error
 * @param err - The error to convert to a response
 * @returns Response object with appropriate status and error details
 */
export function createErrorResponse(err: unknown): Response {
  // Default implementation that doesn't require explicit dependencies
  const errorFactory = createErrorFactory();
  const errorResponseFactory = createErrorResponseFactory({ errorFactory });
  return errorResponseFactory.createErrorResponse(err);
}
