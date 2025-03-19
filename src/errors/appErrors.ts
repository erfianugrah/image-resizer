/**
 * Centralized Error Handling System
 * Defines a comprehensive error hierarchy for the application
 */
import { ILogger } from '../types/core/logger';

/**
 * Base Error Type
 * All application-specific errors should extend this
 */
export class AppError extends Error {
  /**
   * Creates a new AppError
   * @param message Error message
   * @param code Error code for classification
   * @param statusCode HTTP status code to return
   * @param context Additional context information
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Convert to a response object
   * @returns Response object
   */
  toResponse(): Response {
    const body = JSON.stringify({
      error: {
        code: this.code,
        message: this.message,
        ...this.context,
      }
    });

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, must-revalidate',
      'X-Error-Code': this.code,
      'X-Error-Type': this.name,
    };

    return new Response(body, {
      status: this.statusCode,
      headers,
    });
  }

  /**
   * Convert to a JSON object
   * @returns JSON representation of the error
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...this.context,
    };
  }
}

/**
 * Resource Not Found Error
 * Use when a requested resource cannot be found
 */
export class ResourceNotFoundError extends AppError {
  constructor(resource: string, context: Record<string, unknown> = {}) {
    super(`Resource not found: ${resource}`, 'RESOURCE_NOT_FOUND', 404, context);
  }
}

/**
 * Validation Error
 * Use when input validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', 400, context);
  }
}

/**
 * Configuration Error
 * Use when there's an issue with application configuration
 */
export class ConfigurationError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'CONFIGURATION_ERROR', 500, context);
  }
}

/**
 * Service Unavailable Error
 * Use when a service is temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, reason: string, context: Record<string, unknown> = {}) {
    super(`Service ${service} unavailable: ${reason}`, 'SERVICE_UNAVAILABLE', 503, context);
  }
}

/**
 * R2 Storage Errors
 */
export class R2Error extends AppError {
  constructor(message: string, code: string, statusCode: number, context: Record<string, unknown> = {}) {
    super(message, code, statusCode, context);
  }
}

export class R2NotFoundError extends R2Error {
  constructor(key: string, context: Record<string, unknown> = {}) {
    super(`Object not found in R2: ${key}`, 'R2_NOT_FOUND', 404, { key, ...context });
  }
}

export class R2TransformationError extends R2Error {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'R2_TRANSFORMATION_ERROR', 500, context);
  }
}

/**
 * Transformation Strategy Errors
 */
export class StrategyError extends AppError {
  constructor(
    strategy: string,
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `STRATEGY_ERROR_${strategy.toUpperCase()}`, 502, {
      strategy,
      ...context,
    });
  }
}

/**
 * Error Factory
 * Centralized factory for creating application errors
 */
export interface ErrorFactoryDependencies {
  logger: ILogger;
}

export interface IErrorFactory {
  /**
   * Create a general application error
   * @param code Error code
   * @param message Error message
   * @param statusCode HTTP status code
   * @param context Additional context
   * @returns AppError instance
   */
  createError(
    code: string,
    message: string,
    statusCode?: number,
    context?: Record<string, unknown>
  ): AppError;

  /**
   * Create a validation error
   * @param message Error message
   * @param context Additional context
   * @returns ValidationError instance
   */
  createValidationError(message: string, context?: Record<string, unknown>): ValidationError;

  /**
   * Create a not found error
   * @param resource Resource that wasn't found
   * @param context Additional context
   * @returns ResourceNotFoundError instance
   */
  createNotFoundError(resource: string, context?: Record<string, unknown>): ResourceNotFoundError;

  /**
   * Create an R2-specific error
   * @param key R2 key
   * @param context Additional context
   * @returns R2NotFoundError instance
   */
  createR2NotFoundError(key: string, context?: Record<string, unknown>): R2NotFoundError;

  /**
   * Create a strategy-specific error
   * @param strategy Strategy name
   * @param message Error message
   * @param context Additional context
   * @returns StrategyError instance
   */
  createStrategyError(
    strategy: string,
    message: string,
    context?: Record<string, unknown>
  ): StrategyError;

  /**
   * Create an appropriate response for an error
   * @param error The error
   * @returns A Response object
   */
  createErrorResponse(error: Error): Response;
}

/**
 * Create an Error Factory
 * @param dependencies Factory dependencies
 * @returns An error factory instance
 */
export function createErrorFactory(
  dependencies: ErrorFactoryDependencies
): IErrorFactory {
  const { logger } = dependencies;

  return {
    createError: (
      code: string,
      message: string,
      statusCode: number = 500,
      context: Record<string, unknown> = {}
    ): AppError => {
      logger.debug('ErrorFactory', `Creating error: ${code}`, { message, statusCode, ...context });
      return new AppError(message, code, statusCode, context);
    },

    createValidationError: (
      message: string,
      context: Record<string, unknown> = {}
    ): ValidationError => {
      logger.debug('ErrorFactory', `Creating validation error`, { message, ...context });
      return new ValidationError(message, context);
    },

    createNotFoundError: (
      resource: string,
      context: Record<string, unknown> = {}
    ): ResourceNotFoundError => {
      logger.debug('ErrorFactory', `Creating not found error: ${resource}`, context);
      return new ResourceNotFoundError(resource, context);
    },

    createR2NotFoundError: (
      key: string,
      context: Record<string, unknown> = {}
    ): R2NotFoundError => {
      logger.debug('ErrorFactory', `Creating R2 not found error: ${key}`, context);
      return new R2NotFoundError(key, context);
    },

    createStrategyError: (
      strategy: string,
      message: string,
      context: Record<string, unknown> = {}
    ): StrategyError => {
      logger.debug('ErrorFactory', `Creating strategy error: ${strategy}`, { message, ...context });
      return new StrategyError(strategy, message, context);
    },

    createErrorResponse: (error: Error): Response => {
      // For AppErrors, use the built-in response generator
      if (error instanceof AppError) {
        logger.error('ErrorFactory', `Error response: ${error.code}`, {
          message: error.message,
          code: error.code,
          status: error.statusCode,
          ...error.context,
        });
        return error.toResponse();
      }

      // For other errors, create a generic response
      logger.error('ErrorFactory', 'Unknown error type', {
        error: error.message,
        name: error.name,
        stack: error.stack,
      });

      const body = JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        }
      });

      return new Response(body, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate',
          'X-Error-Code': 'INTERNAL_ERROR',
          'X-Error-Type': error.name || 'Error',
        },
      });
    },
  };
}