# Image Resizer Type System Architecture

This document describes the type system architecture for the Image Resizer codebase, providing a guide for developers to understand the type structure and dependencies.

## Type Directory Structure

The type system is organized in a hierarchical directory structure under `/src/types/`:

```
/src/types/
├── config/       - Configuration-related interfaces
├── services/     - Service interfaces 
│   └── image.ts  - Image transformation service interfaces
└── utils/        - Utility interfaces
    ├── cache.ts  - Cache configuration interfaces
    ├── debug.ts  - Debug and diagnostics interfaces
    └── path.ts   - Path pattern interfaces
```

## Core Interface Categories

### Debug & Diagnostics (`/src/types/utils/debug.ts`)

These interfaces handle debug information and diagnostic data:

- `DebugInfo`: Controls debug behavior and settings
  ```typescript
  export interface DebugInfo {
    isEnabled: boolean;
    isVerbose?: boolean;
    includeHeaders?: string[];
    includePerformance?: boolean;
    deploymentMode?: string;
    isRemoteFetch?: boolean;
  }
  ```

- `DiagnosticsInfo`: Comprehensive object containing all diagnostic information
  ```typescript
  export interface DiagnosticsInfo {
    originalUrl?: string;
    transformParams?: Record<string, string | number | boolean | null | undefined>;
    pathMatch?: string;
    errors?: string[];
    warnings?: string[];
    clientHints?: boolean;
    deviceType?: string;
    processingTimeMs?: number;
    // ... and more
  }
  ```

### Cache Configuration (`/src/types/utils/cache.ts`)

Interfaces for cache management:

- `CacheConfig`: Primary cache configuration interface
  ```typescript
  export interface CacheConfig {
    cacheability: boolean;
    ttl: {
      ok: number;
      redirects: number;
      clientError: number;
      serverError: number;
    };
    method?: string;
    // ...
  }
  ```

- `UrlCacheConfig`: URL-specific cache configuration
  ```typescript
  export interface UrlCacheConfig {
    pattern: string;
    ttl?: {...};
    cacheability?: boolean;
  }
  ```

### Path Handling (`/src/types/utils/path.ts`)

Interfaces for path pattern matching:

- `PathPattern`: Structure for route pattern matching
  ```typescript
  export interface PathPattern {
    name: string;
    matcher: string;
    cacheTtl?: number;
    captureGroups?: boolean;
    // ...
    [key: string]: unknown; // Index signature for flexibility
  }
  ```

### Image Services (`/src/types/services/image.ts`)

Image transformation and processing interfaces:

- `ImageTransformOptions`: Options for image transformation
  ```typescript
  export interface ImageTransformOptions {
    width?: number | string | null;
    height?: number | null;
    format?: string | null;
    quality?: number | null;
    // ...
  }
  ```

- `IImageTransformationService`: Interface for the image transformation service
  ```typescript
  export interface IImageTransformationService {
    transformImage(
      request: Request,
      options: ImageTransformOptions,
      pathPatterns?: { name: string; matcher: string; [key: string]: unknown }[],
      debugInfo?: DebugInfo,
      config?: unknown
    ): Promise<Response>;
    
    getBestImageFormat(request: Request): string;
  }
  ```

## Dependency Structure

The type system follows a strict dependency hierarchy to avoid circular dependencies:

1. **Base Types Layer**
   - Basic types with no dependencies on other modules
   - Example: Most interfaces in `/types/utils/`

2. **Service Interface Layer**
   - Service interfaces that may depend on base types
   - Example: `/types/services/image.ts`

3. **Implementation Layer** (not in types directory)
   - Concrete implementations importing from the type system
   - Example: `imageTransformationService.ts` imports `IImageTransformationService`

## Migration Strategy

To transition from the old type system to the new one:

1. **Re-export Stage**:
   - Original files re-export from new type system (`export type { PathPattern } from '../types/utils/path'`)
   - Mark original interfaces as deprecated

2. **Direct Import Stage**:
   - Update imports to reference new types directly (`import { PathPattern } from '../types/utils/path'`)
   - Remove original interface definitions

3. **Cleanup Stage**:
   - Remove deprecated files after confirming all imports are updated
   - Update documentation to reference only the new type system

## Best Practices

When working with the type system:

1. **Importing Types**:
   - Always import types from the `/types/` directory, not from implementation files
   - Example: `import { DiagnosticsInfo } from '../types/utils/debug'`

2. **Extending Interfaces**:
   - When extending an interface, import the base interface from the type system
   - Add the new properties to your extension

3. **Creating New Types**:
   - Add new types to the appropriate directory under `/types/`
   - Maintain the dependency hierarchy to avoid circular dependencies

4. **Index Signatures**:
   - Use index signatures (`[key: string]: unknown`) for flexible object types
   - Ensure all properties have explicit types for better type checking