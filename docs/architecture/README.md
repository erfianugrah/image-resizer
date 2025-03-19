# Architecture Documentation

This directory contains documentation about the architecture of the image-resizer system.

## Contents

- [DEPENDENCY_INJECTION.md](./DEPENDENCY_INJECTION.md): Details on the factory pattern and dependency injection approach
- [R2_INTEGRATION.md](./R2_INTEGRATION.md): Documentation on the R2 storage integration and transformation strategies
- [DOMAIN_SPECIFIC_STRATEGY.md](./DOMAIN_SPECIFIC_STRATEGY.md): Information about domain-specific transformation strategies
- [REFACTORING_PROGRESS.md](./REFACTORING_PROGRESS.md): Status and details of ongoing refactoring work

## Overview of the Architecture

The image-resizer is built with a modular, service-oriented architecture that emphasizes:

1. **Domain-Driven Design**: Core business logic is organized around domain concepts in the `domain` directory
2. **Command Pattern**: Complex operations are encapsulated in command objects
3. **Factory Pattern**: Services and components are created through factory functions
4. **Strategy Pattern**: Image transformation uses a pluggable strategy pattern for flexibility
5. **Dependency Injection**: Dependencies are explicitly passed to factories
6. **Interface-Based Design**: Components depend on interfaces, not implementations

## Key Components

### Core Services

- **ServiceRegistry**: Central registry for all services with dependency resolution
- **ConfigManager**: Manages configuration loading and access
- **LoggerFactory**: Creates loggers with consistent formatting and levels

### Domain Layer

- **TransformImageCommand**: Implements the command pattern for image transformation
- **ValidationService**: Handles validation of image transformation options

### Service Layer

- **StreamingTransformationService**: Manages transformation strategies with fallback chain
- **R2ImageProcessorService**: Handles R2 bucket operations for image storage
- **EnvironmentService**: Provides domain-specific configuration and strategy selection
- **TransformationCacheService**: Caches transformation options for performance

### Transformation Strategies

The system uses a strategy pattern for image transformations:

1. **WorkersDevStrategy**: Specialized strategy for workers.dev domains
2. **InterceptorStrategy**: Uses Cloudflare's image resizing with subrequest interception
3. **DirectUrlStrategy**: Uses direct URLs with cf.image properties
4. **CdnCgiStrategy**: Uses the /cdn-cgi/image/ URL pattern
5. **RemoteFallbackStrategy**: Falls back to a remote server for transformations
6. **DirectServingStrategy**: Serves original images without transformation

### Utility Layer

- **TransformationUtils**: Standardized transformation option processing
- **ResponseHeadersBuilder**: Builder pattern for HTTP headers
- **EnhancedDebugHeaders**: Debug header generation for diagnostics
- **CacheUtils**: Cache configuration and control
- **ValidationUtils**: Validation utilities for image options

## Domain-Specific Strategy Selection

A key architectural feature is the dynamic selection of transformation strategies based on domain type:

1. **Domain Detection**: The system identifies workers.dev versus custom domains
2. **Configuration-Driven Selection**: Strategy prioritization is defined in wrangler.jsonc
3. **Automatic Fallback**: If a higher-priority strategy fails, the system tries lower-priority options
4. **Strategy Disabling**: Certain strategies can be explicitly disabled for specific domains

## Error Handling

The system uses a consistent error handling approach:

1. **AppError Hierarchy**: Centralized error types defined in the core layer
2. **ErrorFactory Pattern**: Errors are created through factory functions
3. **Specialized Error Types**: Domain-specific errors (like R2Error) with additional diagnostics
4. **HTTP Status Code Mapping**: Errors are mapped to appropriate HTTP status codes

## Performance Optimizations

Several performance optimizations have been implemented:

1. **Validation Results Caching**: TTL-based caching for validation results
2. **Transformation Options Caching**: Multi-format caching for transformation options
3. **Response Header Optimization**: Centralized header management
4. **Streaming Transformations**: Support for streaming image processing
5. **Domain-Specific Strategy Selection**: Optimal strategy selection based on domain