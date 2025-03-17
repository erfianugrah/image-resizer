# Applying DRY Principle in Image Resizer

This document outlines how the Don't Repeat Yourself (DRY) principle has been applied to the Image Resizer codebase, identifying specific redundancies that were eliminated and strategies for maintaining code without duplication.

## Understanding DRY

The DRY principle states: "Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."

Benefits of following DRY:
- Reduced code size and complexity
- Easier maintenance
- Fewer bugs
- More consistent behavior

## Identified Redundancies and Solutions

### 1. Image Parameter Definitions

**Problem**: Image parameter definitions were duplicated across multiple files:
- In `urlParamUtils.ts` for parameter extraction
- In `urlTransformUtils.ts` for parameter filtering
- In service implementations

**Solution**: Extracted parameter definitions to a central function:

```typescript
// In urlParamUtils.ts
export function extractDefaultImageParams(): ImageParamOptions {
  return {
    // Core parameters
    derivative: null,
    width: null,
    height: null,
    quality: null,
    fit: null,
    format: null,
    metadata: 'copyright',
    
    // Additional Cloudflare parameters
    dpr: null,
    gravity: null,
    trim: null,
    
    // Visual adjustments
    brightness: null,
    contrast: null,
    gamma: null,
    rotate: null,
    sharpen: null,
    saturation: null,
    
    // Optional settings
    background: null,
    blur: null,
    border: null,
    compression: null,
    onerror: null,
    anim: null,
  };
}
```

Now all code uses this central definition:

```typescript
// In urlParamUtils.ts
export function extractImageParams(urlParams: URLSearchParams, _path = ''): ImageParamOptions {
  // Get default parameter definitions
  const paramDefinitions = extractDefaultImageParams();
  
  // Extract parameters using the definitions
  return Object.entries(paramDefinitions).reduce<ImageParamOptions>(
    (params, [key, defaultValue]) => {
      params[key] = urlParams.get(key) || defaultValue;
      return params;
    },
    {} as ImageParamOptions
  );
}

// In urlTransformUtils.ts
function buildOriginUrl(originalUrl: URL, transformedPath: string, remoteOrigin: string): URL {
  const originUrl = new URL(transformedPath, remoteOrigin);

  // Import the image parameters definition from urlParamUtils
  // to ensure we maintain DRY principle
  const dummyParams = extractDefaultImageParams();
  const imageParams = Object.keys(dummyParams);
  
  // Filter params using the same list
  // ...
}
```

### 2. Debug Headers Application

**Problem**: Debug header application was implemented in multiple places:
- `debugHeadersUtils.ts`
- `debugService.ts`
- Partial implementations in various services

**Solution**: Consolidated to a single implementation in `loggerUtils.ts` with re-exports:

```typescript
// In loggerUtils.ts
export function addDebugHeaders(
  response: Response,
  debugInfo: DebugInfo,
  diagnosticsInfo: DiagnosticsInfo
): Response {
  // Single implementation
}

// In debugHeadersUtils.ts
import { addDebugHeaders as loggerAddDebugHeaders } from './loggerUtils';

/**
 * @deprecated Use addDebugHeaders from loggerUtils instead
 */
export function addDebugHeaders(...) {
  // Forward to the central implementation
  return loggerAddDebugHeaders(response, debugInfo, diagnosticsInfo);
}

// In debugService.ts
export { addDebugHeaders } from '../utils/loggerUtils';
```

### 3. Cache Configuration Logic

**Problem**: Cache configuration was duplicated in:
- `cacheControlUtils.ts`
- `cacheUtils.ts`
- `imageProcessingService.ts`

**Solution**: Consolidated in `cacheUtils.ts` with improved URL-specific configuration:

```typescript
// In cacheUtils.ts
export async function determineCacheConfig(url: string): Promise<CacheConfig> {
  // Base configuration
  const config = { ...defaultCacheConfig };
  
  // Apply URL-specific rules
  if (imageConfig.cacheConfig && Array.isArray(imageConfig.cacheConfig)) {
    for (const urlConfig of imageConfig.cacheConfig) {
      if (urlConfig.pattern && new RegExp(urlConfig.pattern).test(url)) {
        // Override with URL-specific settings
        if (urlConfig.ttl) {
          config.ttl = { ...config.ttl, ...urlConfig.ttl };
        }
        
        if (urlConfig.cacheability !== undefined) {
          config.cacheability = urlConfig.cacheability;
        }
        
        break; // Stop at first match
      }
    }
  }
  
  return config;
}
```

### 4. Interface Definitions

**Problem**: Interface definitions were duplicated and slightly different:
- `PathPattern` in multiple files
- `CacheConfig` variations
- `DebugInfo` and `DiagnosticsInfo` variants

**Solution**: Created a types directory with canonical definitions:

```
/src/types/
├── utils/
│   ├── cache.ts - CacheConfig and related interfaces
│   ├── debug.ts - DebugInfo and DiagnosticsInfo
│   └── path.ts  - PathPattern and related interfaces
└── services/
    └── image.ts - Image transformation interfaces
```

## Best Practices for Maintaining DRY

### 1. Central Type Definitions

Always define interfaces in the types directory and import them where needed. Never redefine an interface:

```typescript
// Bad
interface MyConfig { /* ... */ }

// Good
import { MyConfig } from '../types/utils/config';
```

### 2. Utility Function Organization

- Group related utility functions in a single file
- Create functions for repeated logic
- Use descriptive function names that clearly state purpose

### 3. Reusable Code Patterns

Extract repeated code patterns into generic utility functions:

```typescript
// Instead of repeating this pattern:
if (obj !== null && typeof obj === 'object' && prop in obj) {
  // use obj[prop]
}

// Create a utility:
function safeAccess<T, K extends string>(obj: T | null | undefined, prop: K): T[K] | undefined {
  if (obj !== null && typeof obj === 'object' && prop in obj) {
    return obj[prop];
  }
  return undefined;
}

// Then use:
const value = safeAccess(obj, 'prop');
```

### 4. Configuration as Data

Express configuration as data, not code:

```typescript
// Instead of:
if (path.includes('/images/')) {
  ttl = 86400;
} else if (path.includes('/thumbs/')) {
  ttl = 3600;
}

// Use a data structure:
const pathConfigMap = [
  { pattern: '/images/', ttl: 86400 },
  { pattern: '/thumbs/', ttl: 3600 }
];

const config = pathConfigMap.find(c => path.includes(c.pattern));
const ttl = config?.ttl || defaultTtl;
```

### 5. Re-export Pattern for Migration

Use re-exports to maintain backward compatibility while consolidating code:

```typescript
// In a deprecated file that used to contain implementation:
export { function1, function2 } from './newCentralLocation';
```

### 6. Code Review Checklist

During code reviews, specifically look for:
- Duplicate blocks of similar code
- Similar functions with slight variations
- Copy-pasted code with minor modifications
- Redundant interface definitions

## Next Steps for DRY Improvement

1. **Consolidate Client Detection Logic**:
   - Complete the migration from deprecated files to `clientDetectionUtils.ts`
   - Remove duplicate implementations in `imageProcessingService.ts`

2. **Standardize Error Handling**:
   - Create a centralized error handling utility
   - Define standard error types
   - Implement consistent error reporting across services

3. **Extract Common Service Patterns**:
   - Identify repeated service initialization patterns
   - Create factory functions for services with similar initialization

4. **Unified Configuration System**:
   - Consolidate configuration loading and validation
   - Implement a single access point for configuration
   - Define typed configuration schemas