# Dependency Injection in Image Resizer

This document describes the dependency injection (DI) pattern implemented in the Image Resizer project to address circular dependencies and improve testability, maintainability, and modularity.

## Overview

Dependency injection is a design pattern that allows us to:

1. Eliminate circular dependencies
2. Improve testability by allowing mock dependencies
3. Make dependencies explicit
4. Separate interface from implementation
5. Enable runtime switching of implementations

## Implementation Architecture

The Image Resizer now implements a comprehensive dependency injection architecture with two key components:

1. **Factory Pattern**: Each service is created by a factory function that explicitly accepts its dependencies
2. **Service Registry**: A centralized registry manages service creation, resolution, and lifecycle

### Factory Pattern

Each service has:

1. An interface defining its contract
2. A dependency interface specifying what it needs
3. A factory function that accepts dependencies and returns an implementation

### Service Registry

The `ServiceRegistry` class is the central dependency container that manages service creation and lifecycle:

```typescript
// Get the service registry
const registry = ServiceRegistry.getInstance();

// Register a service
registry.register('IMyService', {
  factory: (deps) => createMyService(deps),
  lifecycle: 'singleton',
  dependencies: ['ILogger', 'ICacheService']
});

// Resolve a service
const myService = registry.resolve<IMyService>('IMyService');
```

## Service Lifecycle Types

Services can have three lifecycle types:

- **Singleton**: Service is created once and reused throughout the application lifecycle.
- **Transient**: A new instance is created each time the service is resolved.
- **Scoped**: Service is created once per scope (typically a request).

## Implemented Services

The following services have been implemented using the dependency injection pattern:

1. **ConfigManager**
   - Factory: `createConfigManager`
   - Interface: `IConfigManager`
   - Dependencies: `ConfigManagerDependencies`
   
2. **ConfigValidator**
   - Factory: `createConfigValidator`
   - Interface: `IConfigValidator`
   - Dependencies: `ConfigValidatorDependencies`

3. **LoggerFactory**
   - Factory: `createLoggerFactory`
   - Interface: `ILoggerFactory`
   - Dependencies: `LoggerFactoryDependencies`

4. **Logger**
   - Factory: `createLogger`
   - Interface: `ILogger`
   - No dependencies (uses utility functions internally)

5. **ServiceRegistry** (New)
   - Factory: `createServiceRegistry`
   - Interface: `IServiceRegistry`
   - Dependencies: `ServiceRegistryDependencies`

6. **ImageTransformationService** 
   - Factory: `createImageTransformationService`
   - Interface: `IImageTransformationService`
   - Dependencies: `ImageTransformationDependencies`

7. **CacheManagementService**
   - Factory: `createCacheManagementService`
   - Interface: `ICacheManagementService`
   - Dependencies: `CacheManagementDependencies`

8. **DebugService**
   - Factory: `createDebugService`
   - Interface: `IDebugService`
   - Dependencies: `DebugServiceDependencies`

9. **ImageOptionsService**
   - Factory: `createImageOptionsService`
   - Interface: `IImageOptionsService`
   - Dependencies: `ImageOptionsServiceDependencies`

10. **TransformImageCommand** (New)
    - Factory: `createTransformImageCommand`
    - Interface: `ITransformImageCommand`
    - Dependencies: `TransformImageCommandDependencies`

11. **ErrorFactory** (New)
    - Factory: `createErrorFactory`
    - Interface: `IErrorFactory`
    - Dependencies: `ErrorFactoryDependencies`

12. **ErrorResponseFactory** (New)
    - Factory: `createErrorResponseFactory`
    - Interface: `IErrorResponseFactory`
    - Dependencies: `ErrorResponseFactoryDependencies`

13. **PathUtils** (New)
    - Factory: `createPathUtils`
    - Interface: `IPathUtils`
    - Dependencies: `PathUtilsDependencies`

14. **UrlParamUtils** (New)
    - Factory: `createUrlParamUtils`
    - Interface: `IUrlParamUtils`
    - Dependencies: `UrlParamUtilsDependencies`

15. **UrlTransformUtils** (New)
    - Factory: `createUrlTransformUtils`
    - Interface: `IUrlTransformUtils`
    - Dependencies: `UrlTransformUtilsDependencies`

16. **ClientDetectionUtils** (New)
    - Factory: `createClientDetectionUtils`
    - Interface: `IClientDetectionUtils`
    - Dependencies: `ClientDetectionUtilsDependencies`
    - Consolidates client hints, device detection, user agent and responsive width utilities

17. **ImageOptionsFactory**
    - Factory: `createImageOptionsFactory`
    - Class: `ImageOptionsFactory`
    - Uses Strategy Pattern internally

18. **ImageProcessingService**
    - Factory: `createImageProcessingService`
    - Interface: `IImageProcessingService`
    - Dependencies: `ImageProcessingDependencies`

## Service Registration

All services are registered in a central initialization function in `index.ts`:

```typescript
function initializeServiceRegistry(env: Record<string, unknown>): void {
  // Get the service registry using the factory function
  const registry = createServiceRegistry();
  
  // Also register it for backward compatibility
  registry.register('ServiceRegistry', {
    factory: () => ServiceRegistry.getInstance(),
    lifecycle: 'singleton',
  });

  // Create a logger factory using the factory function
  const loggerFactory = createLoggerFactory();

  // Register the logger factory using the factory pattern
  registry.register('ILoggerFactory', {
    factory: () => loggerFactory,
    lifecycle: 'singleton',
  });

  // Register the legacy logger factory for backward compatibility
  registry.register('LoggerFactory', {
    factory: () => LoggerFactory.getInstance(),
    lifecycle: 'singleton',
  });

  // Register the logger service
  registry.register('ILogger', {
    factory: (deps) => {
      const factory = deps.ILoggerFactory;
      return factory.createLogger('ImageResizer');
    },
    lifecycle: 'singleton',
    dependencies: ['ILoggerFactory'],
  });

  // Create a main logger instance directly (needed for bootstrapping)
  const mainLogger = createLogger('ImageResizer');
  
  // Register the configuration validator
  registry.register('IConfigValidator', {
    factory: () => createConfigValidator({ logger: mainLogger }),
    lifecycle: 'singleton',
  });
  
  // Register the configuration manager using the factory pattern
  registry.register('IConfigManager', {
    factory: (deps) => {
      const configManager = createConfigManager({ 
        logger: mainLogger 
      });
      configManager.initialize(env);
      return configManager;
    },
    lifecycle: 'singleton',
    dependencies: []
  });
  
  // Register the old configuration manager for backward compatibility
  registry.register('ConfigurationManager', {
    factory: () => {
      const configManager = ConfigurationManager.getInstance();
      configManager.initialize(env);
      return configManager;
    },
    lifecycle: 'singleton',
  });

  // -------------------- Begin Path and URL Utils Registration --------------------

  // Register PathUtils
  registry.register('IPathUtils', {
    factory: (deps) => {
      const logger = deps.ILogger;
      return createPathUtils({ logger });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger']
  });
  
  // Register UrlParamUtils
  registry.register('IUrlParamUtils', {
    factory: (deps) => {
      const logger = deps.ILogger;
      return createUrlParamUtils({ logger });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger']
  });
  
  // Register UrlTransformUtils with dependencies on other utils
  registry.register('IUrlTransformUtils', {
    factory: (deps) => {
      const logger = deps.ILogger;
      const pathUtils = deps.IPathUtils;
      const urlParamUtils = deps.IUrlParamUtils;
      
      return createUrlTransformUtils({
        logger,
        pathUtils,
        urlParamUtils
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IPathUtils', 'IUrlParamUtils']
  });
  
  // Register ClientDetectionUtils
  registry.register('IClientDetectionUtils', {
    factory: (deps) => {
      const logger = deps.ILogger;
      return createClientDetectionUtils({ logger });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger']
  });
  
  // Register FormatUtils with dependency on ClientDetectionUtils
  registry.register('IFormatUtils', {
    factory: (deps) => {
      const logger = deps.ILogger;
      const clientDetectionUtils = deps.IClientDetectionUtils;
      
      return createFormatUtils({
        logger,
        clientDetectionUtils
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IClientDetectionUtils']
  });
  
  // Register ValidationUtils with dependency on configManager
  registry.register('IValidationUtils', {
    factory: (deps) => {
      const logger = deps.ILogger;
      const configManager = deps.IConfigManager;
      
      return createValidationUtils({
        logger,
        configProvider: {
          getConfig: () => configManager.getConfig()
        }
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IConfigManager']
  });

  // -------------------- End Path and URL Utils Registration --------------------

  // Register services
  registry.register('ICacheManagementService', {
    factory: (deps) => { /* service creation with deps */ },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IConfigManager']
  });
  
  // ...other service registrations
}
```

## Request Scope Management

For request-scoped services, we create and dispose of scopes with each request:

```typescript
// Create a request scope
const registry = ServiceRegistry.getInstance();
const scope = registry.createScope();

try {
  // Get dependencies from the registry
  const configManager = registry.resolve<ConfigurationManager>('ConfigurationManager');
  const config = configManager.getConfig();
  const logger = registry.resolve<ILogger>('ILogger');
  
  // Process the request
  // ...
} finally {
  // Dispose of the request scope
  registry.disposeScope(scope);
}
```

## Testing Support

Mock service implementations are provided for testing in the `test/utils/mockFactories.ts` file:

```typescript
import { vi } from 'vitest';
import { IPathUtils } from '../../src/types/utils/path';
import { ILogger } from '../../src/types/core/logger';

/**
 * Create a mock path utilities implementation
 * @returns Mock implementation of IPathUtils
 */
export function createMockPathUtils(): IPathUtils {
  return {
    getDerivativeFromPath: vi.fn().mockReturnValue('thumbnail'),
    isImagePath: vi.fn().mockReturnValue(true),
    getFilenameFromPath: vi.fn().mockReturnValue('image.jpg'),
    findMatchingPathPattern: vi.fn().mockReturnValue({ name: 'test', matcher: '.*' }),
    matchPathWithCaptures: vi.fn().mockReturnValue({
      pattern: { name: 'test', matcher: '.*' },
      captures: { '1': 'capture1' }
    }),
    extractVideoId: vi.fn().mockReturnValue('video123')
  };
}

/**
 * Create a mock logger implementation
 * @returns Mock implementation of ILogger
 */
export function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    logRequest: vi.fn(),
    logResponse: vi.fn()
  };
}
```

Using the mock factories in tests:

```typescript
import { createMockLogger, createMockPathUtils } from '../../test/utils/mockFactories';

describe('UrlTransformUtils', () => {
  it('should transform URLs correctly', () => {
    // Arrange
    const mockLogger = createMockLogger();
    const mockPathUtils = createMockPathUtils();
    const mockUrlParamUtils = createMockUrlParamUtils();
    
    const urlTransformUtils = createUrlTransformUtils({
      logger: mockLogger,
      pathUtils: mockPathUtils,
      urlParamUtils: mockUrlParamUtils
    });
    
    // Act
    const result = urlTransformUtils.transformUrlToImageDelivery('https://example.com/image.jpg');
    
    // Assert
    expect(result).toContain('imagedelivery.net');
    expect(mockPathUtils.isImagePath).toHaveBeenCalled();
  });
});
```

## Backward Compatibility

To ensure backward compatibility, we have implemented several approaches to maintain the existing API while migrating to the factory pattern:

### 1. Class with Singleton Pattern that Internally Uses Factory

For the ConfigurationManager, we maintain the singleton class and getInstance method, but internally it uses the new factory function:

```typescript
/**
 * Configuration manager singleton class
 * @deprecated Use the createConfigManager factory function instead
 */
export class ConfigurationManager implements IConfigManager {
  private static instance: ConfigurationManager;
  private configManager: IConfigManager;

  private constructor() {
    try {
      // Use dynamic import to avoid circular dependencies
      const { createLogger } = require('../core/logger');
      const logger = createLogger('ConfigManager');
      
      // Use the factory function internally
      this.configManager = createConfigManager({ logger });
    } catch (err) {
      // Fallback implementation for tests
      const mockLogger = { /* mock logger implementation */ };
      this.configManager = createConfigManager({ logger: mockLogger });
    }
  }

  /**
   * Get the singleton instance
   * @returns ConfigurationManager instance
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Initialize configuration from environment variables
   * @param env Environment variables
   */
  public initialize(env: Record<string, unknown>): void {
    this.configManager.initialize(env);
  }

  /**
   * Get the application configuration
   * @returns Application configuration
   */
  public getConfig(): AppConfig {
    return this.configManager.getConfig();
  }
}
```

### 2. Function Wrapper with Dynamic Import

For standalone functions like validateAppConfig, we create a wrapper that dynamically imports dependencies and uses the factory function:

```typescript
/**
 * Validate application configuration
 * @deprecated Use the createConfigValidator factory function instead
 * @param config Configuration to validate
 * @returns Boolean indicating whether the configuration is valid
 */
export function validateAppConfig(config: unknown): boolean {
  try {
    // Use dynamic import to avoid circular dependencies
    const { createLogger } = require('../core/logger');
    const logger = createLogger('ConfigValidator');
    
    // Use the factory function
    const validator = createConfigValidator({ logger });
    return validator.validateAppConfig(config);
  } catch (err) {
    // Fallback for tests
    const mockLogger = { 
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };
    const validator = createConfigValidator({ logger: mockLogger });
    return validator.validateAppConfig(config);
  }
}
```

### 3. Direct Function with Dependency Imports

For functions that need to maintain their original signature, we can use dynamic imports for dependencies:

```typescript
/**
 * Legacy export for backward compatibility
 * @deprecated Use the createImageProcessingService factory function instead
 */
export const processImage = async (
  request: Request,
  options: ImageProcessingOptions,
  cache: CacheConfig,
  debugInfo: DebugInformation = {}
): Promise<Response> => {
  // Import dependencies to avoid circular dependencies
  const { addDebugHeaders, debug, error, info, logResponse } = await import('../utils/loggerUtils');
  const { generateCacheTags } = await import('../utils/cacheControlUtils');
  
  // Create a service instance with required dependencies
  const service = createImageProcessingService({
    logger: { /* logger dependencies */ },
    debug: { /* debug dependencies */ },
    // ...other dependencies
  });
  
  // Delegate to the service implementation
  return service.processImage(request, options, cache, debugInfo);
};
```

## Benefits Realized

1. **Elimination of Circular Dependencies**: Dependencies are explicitly injected rather than statically imported.

2. **Improved Testability**: Services can be tested with mock dependencies, making unit testing simpler.

3. **Explicit Interfaces**: Each service has a clear contract and explicitly states what it depends on.

4. **Lifecycle Management**: Services can be singletons, transient, or scoped to a request.

5. **Centralized Dependency Resolution**: All dependencies are resolved through the ServiceRegistry.

6. **Runtime Flexibility**: Different implementations can be provided at runtime.

## Next Steps

1. Complete migration by implementing factory pattern for remaining services:
   - ✅ ConfigurationManager (implemented with both factory and backward-compatible singleton)
   - ✅ ConfigValidator (implemented with factory function)
   - ✅ LoggerFactory (implemented with factory function)
   - ✅ Logger (using factory function)
   - ✅ ServiceRegistry (implemented with factory function)
   - ✅ TransformImageCommand (pure factory function with closures)
   - ✅ ErrorFactory (implemented with factory function)
   - ✅ ErrorResponseFactory (implemented with factory function)
   - ✅ PathUtils (implemented with factory function)
   - ✅ UrlParamUtils (implemented with factory function)
   - ✅ UrlTransformUtils (implemented with factory function)
   - ✅ ClientDetectionUtils (consolidated client hints, device detection, responsive width utils)
   - ✅ FormatUtils (implemented with factory function and clientDetectionUtils integration)
   - ✅ ValidationUtils (implemented with factory function and configProvider integration)
   
   All key utilities have been migrated to the factory pattern!

2. Improve testability further:
   - ✅ Fixed tests for ConfigValidator 
   - ✅ Create a comprehensive test utility package with common mocks
   - ⬜ Enhance the mock registry for service testing
   - ⬜ Create integration test harness with ServiceRegistry
   - ✅ Add more comprehensive mocks for complex services
   - ✅ Create tests for Path and URL utility factories

3. Enhance service registration:
   - ⬜ Implement dependency auto-discovery to reduce boilerplate
   - ✅ Add support for factory registration by interface name
   - ⬜ Provide better error reporting for missing dependencies
   - ✅ Register new path and URL utility factories in the ServiceRegistry

4. Documentation and cleanup:
   - ✅ Updated documentation for ConfigManager, ConfigValidator, and LoggerFactory
   - ✅ Updated documentation for PathUtils, UrlParamUtils, and UrlTransformUtils
   - ✅ Added documentation for ServiceRegistry integration with utility factories
   - ✅ Added documentation for mock utilities in testing
   - ⬜ Update test cases to use factory functions directly
   - ⬜ Gradually remove @deprecated exports as consumers migrate
   - ⬜ Add examples of integration testing with dependency injection
   - ✅ Update the rest of the documentation to reflect the new pattern

5. Consider implementing:
   - ⬜ Automated dependency resolution for nested dependencies
   - ⬜ Configuration-based service registration
   - ⬜ Disposal callbacks for resource cleanup
   - ⬜ Service initialization hooks
   - ⬜ Better error handling for circular dependencies

## ServiceRegistry Integration Summary

The final phase of the dependency injection migration has been completed, focusing on integrating all utility services with the ServiceRegistry. The key accomplishments include:

1. **Full Utility Integration**: All Path, URL, Format, Validation, and Client Detection utilities have been migrated to factory pattern and registered with the ServiceRegistry.

2. **Dependency Graph**: Established a complete dependency graph for all utilities:
   - UrlTransformUtils depends on PathUtils and UrlParamUtils
   - FormatUtils depends on ClientDetectionUtils
   - ValidationUtils depends on ConfigManager

3. **Mock Implementation**: Created a comprehensive mock implementation for all utility services in `test/utils/mockFactories.ts`, enabling simplified testing with dependency injection.

4. **Service Usage**: Updated service consumers to optionally use the factory-created implementations:
   - ImageTransformationService now uses FormatUtils and UrlTransformUtils
   - ImageProcessingService uses ClientDetectionUtils
   - ValidationUtils uses ConfigManager

5. **Type Safety**: Enhanced type safety throughout the system with proper interface implementations and dependency parameters.

6. **Documentation**: Updated documentation to reflect the new architecture, including:
   - Factory function implementation patterns
   - Service registration examples
   - Testing with mock dependencies
   - Dependency management best practices

The system now has a fully functional dependency injection architecture with centralized service management, proper dependency resolution, and complete type safety.

## Standardized Minimal Dependencies

To further reduce the verbosity of service dependencies, we've implemented standardized minimal interfaces for common dependencies:

### Minimal Logger Interface

The `IMinimalLogger` interface provides a simplified logging API with fixed module name:

```typescript
/**
 * Minimal logger interface for service dependencies
 * Provides core logging functionality in a simpler format
 * with fixed module name for easy integration
 */
export interface IMinimalLogger {
  /**
   * Log debug information
   * @param message - Log message
   * @param data - Optional data object
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Log information (if available, falls back to debug if not)
   * @param message - Log message
   * @param data - Optional data object
   */
  info?(message: string, data?: Record<string, unknown>): void;

  /**
   * Log warning
   * @param message - Log message
   * @param data - Optional data object
   */
  warn?(message: string, data?: Record<string, unknown>): void;

  /**
   * Log error
   * @param message - Log message
   * @param data - Optional data object
   */
  error(message: string, data?: Record<string, unknown>): void;

  /**
   * Log response (optional)
   * @param response - Response object
   */
  logResponse?(response: Response): void;
}
```

#### Creating and Using Minimal Loggers

Services can request a minimal logger through the ServiceRegistry:

```typescript
// Register the minimal logger service
registry.register('IMinimalLogger', {
  factory: (deps, params) => {
    const factory = deps.ILoggerFactory;
    // Use the module name provided as a parameter, or default to 'Service'
    const moduleName = params?.moduleName || 'Service';
    return factory.createMinimalLogger(moduleName);
  },
  lifecycle: 'transient', // Create a new instance each time with different module name
  dependencies: ['ILoggerFactory'],
});

// Register a service that uses the minimal logger
registry.register('IMyService', {
  factory: (deps) => {
    // Get a minimal logger with specific module name
    const logger = deps.IMinimalLogger;
    
    return createMyService({ logger });
  },
  lifecycle: 'singleton',
  dependencies: ['IMinimalLogger'],
  parameters: { moduleName: 'MyService' } // Pass the module name as a parameter
});
```

#### Benefits of Minimal Logger

1. **Simplified Service Dependencies**:
   - Services no longer need to repeat the module name for every log
   - Reduced boilerplate in service implementation
   - Cleaner service dependency signatures

2. **Runtime Adaptability**:
   - Supports both standard and minimal logger interfaces
   - Automatically detects logger type and adapts at runtime
   - Backward compatible with existing services

3. **Improved Code Readability**:
   - More concise logging calls without repeated module references
   - Cleaner service implementations
   - Reduced verbosity while maintaining context

This pattern can be extended to other common dependencies like configuration, error handling, and caching services to further streamline service dependencies.