# Error Handling in Image Resizer

This document outlines the standardized error handling system implemented in the Image Resizer codebase.

## Table of Contents
- [Introduction](#introduction)
- [Error Class Hierarchy](#error-class-hierarchy)
- [Error Factory Functions](#error-factory-functions)
- [Error Response Creation](#error-response-creation)
- [Using Error Types](#using-error-types)
- [Best Practices](#best-practices)

## Introduction

A robust error handling system is essential for a production-grade application. The Image Resizer implements a standardized approach that:

1. **Provides Typed Errors**: Custom error classes with proper typing for different error scenarios
2. **Centralizes Error Creation**: Factory functions for consistent error creation
3. **Standardizes Error Responses**: Unified format for error responses
4. **Improves Debugging**: Additional context in error objects for easier debugging
5. **Adds Operational Flags**: Ability to differentiate between operational and programming errors

## Error Class Hierarchy

The error system uses a class hierarchy defined in `/src/types/utils/errors.ts`:

```
AppError (Base class)
├── ValidationError
├── NotFoundError
├── ConfigurationError
├── ServiceError
├── TimeoutError
└── AuthorizationError
```

### Base Error Class (AppError)

The `AppError` class serves as the base class for all application errors:

```typescript
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
```

The key features include:
- `statusCode`: Maps to an HTTP status code for responses
- `errorCode`: A machine-readable error code (e.g., "NOT_FOUND")
- `isOperational`: Indicates whether this is an expected error (operational) or a bug (programming error)

### Specialized Error Classes

The system includes several specialized error classes:

1. **ValidationError**: For input validation failures (status 400)
2. **NotFoundError**: For resources that cannot be found (status 404)
3. **ConfigurationError**: For configuration-related errors (status 500)
4. **ServiceError**: For errors in external services (status 502)
5. **TimeoutError**: For operations that exceed time limits (status 504)
6. **AuthorizationError**: For permission/access issues (status 403)

Each specialized class adds context-specific properties. For example, `ValidationError` adds:
- `field`: The field that failed validation
- `value`: The invalid value provided

## Error Factory Functions

The system implements a comprehensive error factory pattern with dependency injection support:

### Error Factory Interfaces

```typescript
export interface IErrorFactory {
  createAppError(message: string, errorCode: string, statusCode?: number, isOperational?: boolean): AppError;
  createValidationError(message: string, field?: string, value?: unknown): ValidationError;
  createNotFoundError(resource: string, identifier?: string | number): NotFoundError;
  createConfigurationError(message: string, configKey?: string): ConfigurationError;
  createServiceError(service: string, message: string, operation?: string): ServiceError;
  createTimeoutError(operation: string, timeoutMs: number): TimeoutError;
  createAuthorizationError(message: string, permission?: string): AuthorizationError;
  createFromUnknown(err: unknown, defaultMessage?: string): AppError;
}

export interface ErrorFactoryDependencies {
  logger?: {
    error?: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
```

### Error Factory Implementation

The factory function implementation with dependency injection:

```typescript
export function createErrorFactory(dependencies: ErrorFactoryDependencies = {}): IErrorFactory {
  const { logger } = dependencies;

  const logError = (message: string, details?: Record<string, unknown>) => {
    if (logger?.error) {
      logger.error('ErrorFactory', message, details);
    }
  };

  return {
    createAppError(message: string, errorCode: string, statusCode = 500, isOperational = true): AppError {
      return new AppError(message, errorCode, statusCode, isOperational);
    },

    createValidationError(message: string, field?: string, value?: unknown): ValidationError {
      return new ValidationError(message, field, value);
    },

    // Other factory methods...

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
        // Pattern matching on error message to determine the type
        if (err.message.includes('not found') || err.message.includes('404')) {
          return new NotFoundError('Resource', err.message);
        }
        
        // Additional patterns...
        
        return new AppError(err.message, 'UNKNOWN_ERROR');
      }
      
      // For non-Error objects or primitives
      return new AppError(
        typeof err === 'string' ? err : defaultMessage, 
        'UNKNOWN_ERROR'
      );
    }
  };
}
```

This factory provides methods for creating all types of application errors and includes an enhanced `createFromUnknown` method that analyzes unknown errors and converts them into the appropriate `AppError` subclass, providing consistent error handling throughout the application.

### Backward Compatibility

The system maintains backward compatibility with previous error factory functions:

```typescript
/**
 * @deprecated Use createErrorFactory().createFromUnknown() instead
 */
export function createErrorFromUnknown(
  err: unknown,
  defaultMessage = 'An error occurred'
): AppError {
  // Default implementation that doesn't require dependencies
  const errorFactory = createErrorFactory();
  return errorFactory.createFromUnknown(err, defaultMessage);
}
```

## Error Response Creation

The system implements a factory for creating standardized HTTP responses from errors:

### Error Response Factory Interfaces

```typescript
export interface IErrorResponseFactory {
  createErrorResponse(err: unknown): Response;
}

export interface ErrorResponseFactoryDependencies {
  errorFactory: IErrorFactory;
  logger?: {
    error?: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
```

### Error Response Factory Implementation

```typescript
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

        // Add type-specific fields
        if (appError instanceof ValidationError && appError.field) {
          (errorPayload.error as Record<string, unknown>).field = appError.field;
        }

        if (appError instanceof NotFoundError) {
          (errorPayload.error as Record<string, unknown>).resource = appError.resource;
        }

        if (appError instanceof ServiceError) {
          (errorPayload.error as Record<string, unknown>).service = appError.service;
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
            responseCreationError: responseError instanceof Error ? responseError.message : String(responseError),
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
```

### Backward Compatibility

```typescript
/**
 * @deprecated Use createErrorResponseFactory().createErrorResponse() instead
 */
export function createErrorResponse(err: unknown): Response {
  // Default implementation that doesn't require explicit dependencies
  const errorFactory = createErrorFactory();
  const errorResponseFactory = createErrorResponseFactory({ errorFactory });
  return errorResponseFactory.createErrorResponse(err);
}
```

This architecture ensures that all error responses have a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid width value: must be between 10 and 8192",
    "type": "ValidationError",
    "field": "width"
  }
}
```

## Using Error Types

### Using Factory Functions

```typescript
import { 
  createErrorFactory, 
  createErrorResponseFactory 
} from '../types/utils/errors';

// Create the error factory with optional logger
const errorFactory = createErrorFactory({
  logger: {
    error: (module, message, data) => console.error(`[${module}] ${message}`, data),
  },
});

// Create the response factory with error factory dependency
const errorResponseFactory = createErrorResponseFactory({
  errorFactory,
  logger: {
    error: (module, message, data) => console.error(`[${module}] ${message}`, data),
  },
});

function validateWidth(width: number): void {
  if (width < 10 || width > 8192) {
    throw errorFactory.createValidationError(
      `Invalid width value: must be between 10 and 8192`,
      'width',
      width
    );
  }
}
```

### Handling Errors with Try/Catch

```typescript
export async function handleRequest(request: Request): Promise<Response> {
  try {
    // Process the request...
    return new Response('Success');
  } catch (err) {
    // Use the error response factory
    return errorResponseFactory.createErrorResponse(err);
  }
}
```

### Using Backward Compatible Functions

```typescript
import { 
  ValidationError, 
  createErrorFromUnknown, 
  createErrorResponse 
} from '../types/utils/errors';

function validateWidth(width: number): void {
  if (width < 10 || width > 8192) {
    throw new ValidationError(
      `Invalid width value: must be between 10 and 8192`,
      'width',
      width
    );
  }
}

export async function handleRequest(request: Request): Promise<Response> {
  try {
    // Process the request...
    return new Response('Success');
  } catch (err) {
    // Use the backward compatible functions
    const appError = createErrorFromUnknown(err);
    return createErrorResponse(appError);
  }
}
```

## Recent Updates

We've continued to expand our dependency injection architecture by implementing factory patterns for path and URL utilities:

1. **Path Utilities**: Added factory pattern with `createPathUtils()` function
   - Interface: `IPathUtils`
   - Dependencies: `PathUtilsDependencies` (optional logger)
   - Methods for path analysis, matching, and pattern extraction

2. **URL Parameter Utilities**: Added factory pattern with `createUrlParamUtils()` function
   - Interface: `IUrlParamUtils`
   - Dependencies: `UrlParamUtilsDependencies` (optional logger)
   - Methods for extracting and parsing URL parameters

3. **URL Transform Utilities**: Added factory pattern with `createUrlTransformUtils()` function
   - Interface: `IUrlTransformUtils`
   - Dependencies: `UrlTransformUtilsDependencies` (pathUtils, urlParamUtils, optional logger)
   - Methods for transforming request URLs based on configuration

These additions follow the same patterns established with error handling:
- Interface-based design
- Explicit dependency injection
- Backward compatibility functions
- Enhanced logging capabilities
- Improved testability

## Best Practices

1. **Use Factory Pattern**: Use factory functions for creating service implementations
2. **Inject Dependencies**: Pass in required dependencies explicitly to factory functions
3. **Use Specific Error Types**: Use the most specific error factory method that applies (e.g., `createValidationError`)
4. **Be Descriptive**: Include useful information in error messages and logs
5. **Include Context**: Add relevant fields for debugging
6. **Set Operational Flag**: Use `isOperational` parameter to differentiate between expected errors and bugs
7. **Use Try/Catch in Factories**: Add robust error handling within the factory functions themselves
8. **Maintain Backward Compatibility**: Use backward compatibility functions when migrating existing code
9. **Register with ServiceRegistry**: Register factories with the service registry for centralized access
10. **Map to HTTP Status Codes**: Set appropriate status codes for different error types
11. **Add Error Codes**: Use explicit error codes for machine readability
12. **Apply Centralized Handling**: Use factory functions for all service instantiations
13. **Test with Mocked Dependencies**: Use mock implementations when testing factory-based services