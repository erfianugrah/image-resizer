# Image Resizer Project Guidelines

## Build & Test Commands
- **Start development server**: `npm run dev` or `wrangler dev`
- **Deploy**: `npm run deploy` or `wrangler deploy`
- **Run tests**: `npm test` or `vitest`
- **Run single test**: `vitest -t "test name"` or `vitest path/to/test.spec.ts`
- **Type check**: `tsc --noEmit`

## Code Style Guidelines
- **Dependency Injection**: Use factory functions for service creation
- **Imports**: Use ES modules (`import/export`) syntax
- **Formatting**: Use consistent indentation (2 spaces)
- **TypeScript**: Use strict mode, properly typed interfaces/parameters
- **Error Handling**: Use AppError hierarchy in types/utils/errors.ts
- **Logging**: Use centralized logging utilities (`loggerUtils.ts`)
- **Documentation**: JSDoc comments for functions with @param and @returns
- **File Structure**: Separate types into src/types directory

## Code Architecture
- **Service Pattern**: Create services with factory functions
- **Command Pattern**: Use commands for complex operations
- **Dependency Injection**: Explicitly provide dependencies to factories
- **Error Handling**: Centralized error types and factory functions
- **Caching Strategy**: URL-pattern-based cache configuration

## Dependency Injection Implementation
- **Factory Functions**: Create services through factory functions that accept explicit dependencies
- **Interface-Based Design**: Define interfaces first, then implement them
- **Service Registry**: Register all services with the ServiceRegistry
- **Circular Dependency Resolution**: Use dynamic imports with require() to break circular dependencies
- **Backward Compatibility**: Maintain legacy API alongside factory functions with @deprecated annotations
- **Testing**: Provide mock implementations for dependencies in tests

## Implementation Progress
The following components have been migrated to factory pattern:
- ✅ ConfigManager: `createConfigManager({ logger })` with backward compatibility
- ✅ ConfigValidator: `createConfigValidator({ logger })` with backward compatibility
- ✅ LoggerFactory: `createLoggerFactory()` with backward compatibility
- ✅ Logger: `createLogger(name)` factory function
- ✅ ServiceRegistry: `createServiceRegistry()` with backward compatibility
- ✅ TransformImageCommand: `createTransformImageCommand(context, dependencies)` pure factory function with closures
- ✅ ErrorFactory: `createErrorFactory({ logger })` with backward compatibility
- ✅ ErrorResponseFactory: `createErrorResponseFactory({ errorFactory, logger })` with backward compatibility
- ✅ PathUtils: `createPathUtils({ logger })` with backward compatibility
- ✅ UrlParamUtils: `createUrlParamUtils({ logger })` with backward compatibility
- ✅ UrlTransformUtils: `createUrlTransformUtils({ pathUtils, urlParamUtils, logger })` with backward compatibility
- ✅ ClientDetectionUtils: `createClientDetectionUtils({ logger })` with backward compatibility
- ✅ FormatUtils: `createFormatUtils({ logger, clientDetectionUtils })` with backward compatibility
- ✅ ValidationUtils: `createValidationUtils({ logger, configProvider })` with backward compatibility

All key utilities have been migrated to the factory pattern with dependency injection.

## ServiceRegistry Integration Progress
The following components have been registered with the ServiceRegistry:
- ✅ Core Services (Logger, ConfigManager, ErrorFactory, etc.)
- ✅ Path Utilities: Registered as `IPathUtils`
- ✅ URL Param Utilities: Registered as `IUrlParamUtils`
- ✅ URL Transform Utilities: Registered as `IUrlTransformUtils` with dependencies on PathUtils and UrlParamUtils
- ✅ Client Detection Utilities: Registered as `IClientDetectionUtils`
- ✅ Format Utilities: Registered as `IFormatUtils` with dependency on ClientDetectionUtils
- ✅ Validation Utilities: Registered as `IValidationUtils` with dependency on IConfigManager
- ✅ Service Dependencies: Updated service implementations to use utility dependencies

The ServiceRegistry now has complete registration of all utility services with proper dependency chains. The implementation now features:
1. Singleton lifecycle for utility services
2. Proper dependency injection between services
3. Usage of interfaces to standardize service access
4. Type safety throughout dependency resolution
5. Optional dependencies for backward compatibility

## Documentation
- Architecture documentation is located in `/docs/architecture/`
- Key documents:
  - `DEPENDENCY_INJECTION.md`: Service factory pattern (Updated with ErrorFactory migration)
  - `ERROR_HANDLING.md`: Error hierarchy and handling (Updated with factory pattern details)
  - `CACHING.md`: Caching strategy
  - `TYPE_SYSTEM.md`: Type organization