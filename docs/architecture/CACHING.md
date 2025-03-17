# Caching Strategy in Image Resizer

This document outlines the caching strategy implemented in the Image Resizer codebase.

## Table of Contents
- [Introduction](#introduction)
- [Caching Methods](#caching-methods)
- [Environment-Specific Method Selection](#environment-specific-method-selection)
- [Cache Configuration System](#cache-configuration-system)
- [URL-Specific Cache Configuration](#url-specific-cache-configuration)
- [Derivative-Specific Cache Configuration](#derivative-specific-cache-configuration)
- [Content Type-Specific Cache Configuration](#content-type-specific-cache-configuration)
- [Cache Headers and TTL](#cache-headers-and-ttl)
- [Cache Tags for Purging](#cache-tags-for-purging)
- [Cache API Implementation](#cache-api-implementation)
- [CF Object Parameters](#cf-object-parameters)
- [Debug and Diagnostics](#debug-and-diagnostics)
- [Best Practices](#best-practices)

## Introduction

The Image Resizer implements a comprehensive caching strategy to optimize performance and reduce origin load. The system supports:

1. **Flexible TTL Configuration**: Different cache TTLs based on response status, content type, and URL patterns
2. **URL-Specific Caching**: Apply different cache settings based on URL patterns
3. **Derivative-Specific Caching**: Configure caching differently for each image transformation preset
4. **Content Type-Specific Caching**: Different caching rules for different image formats
5. **Cache Tags**: Support for cache tags to enable targeted cache purging
6. **Multiple Caching Methods**: Support for both Cache API and CF object caching

## Caching Methods

The image resizer supports two primary caching methods:

1. **Cache API Method (`cache-api`)** - Uses Cloudflare Workers' Cache API directly
   - Manual cache management using `caches.default`
   - Fine-grained control over cache entry management
   - Suitable for development and debugging

2. **CF Method (`cf`)** - Uses Cloudflare's fetch options with CF object
   - Sets cache parameters directly in the fetch request options
   - Leverages Cloudflare's optimized caching infrastructure
   - **Required for production environments**

## Environment-Specific Method Selection

A key architectural decision is to **force the `cf` method in production environments** regardless of configuration:

### CacheUtils Implementation

In `cacheUtils.ts`, the `determineCacheConfig()` function ensures production always uses `cf`:

```javascript
// Apply caching method from environment
if (appConfig.cache.method) {
  // Force the method to "cf" in production environment
  if (appConfig.environment === 'production') {
    config.method = 'cf';
  } else {
    config.method = appConfig.cache.method;
  }
  
  logger.debug('CacheUtils', '🔧 OVERRIDE - Applied cache method from environment', {
    method: config.method,
    originalMethod: appConfig.cache.method,
    envOverride: appConfig.environment === 'production' ? 'forced-cf' : 'from-config',
    url
  });
}
```

### CacheManagementService Implementation

In `cacheManagementService.ts`, the `determineCacheMethod()` helper ensures consistency:

```javascript
// Helper function to determine cache method - used in multiple methods
const determineCacheMethod = (): string => {
  const config = dependencies.config.getConfig();
  // Use the configured method, but force 'cf' in production
  return config.environment === 'production' ? 'cf' : (config.caching?.method || 'cache-api');
};
```

### TransformImageCommand Implementation

In `TransformImageCommand.ts`, the diagnostics and CF object are created based on environment:

```javascript
// Force cache method to 'cf' in production - ensure consistency with actual behavior
const actualCacheMethod = diagnosticsInfo.environment === 'production' 
  ? 'cf' 
  : (cacheConfig.method || 'default');
  
// Also update the diagnostics info to show the correct cache method
diagnosticsInfo.cachingMethod = actualCacheMethod;
```

### LoggerUtils Implementation

In `loggerUtils.ts`, debug headers are set according to environment:

```javascript
// Always set the cache method header for debugging
// Use environment override for production
if (diagnosticsInfo.cachingMethod) {
  const environment = (diagnosticsInfo.environment as string) || '';
  const cacheMethod = environment === 'production' ? 'cf' : diagnosticsInfo.cachingMethod;
  headers.set('debug-cache-method', cacheMethod);
}
```

## Cache Configuration System

The core cache configuration is defined in `src/types/utils/cache.ts`:

```typescript
export interface CacheConfig {
  cacheability: boolean;
  imageCompression?: string;
  mirage?: boolean;
  ttl: {
    ok: number;
    redirects: number;
    clientError: number;
    serverError: number;
    [key: string]: number | undefined;
  };
  method?: string;
  [key: string]: unknown;
}
```

Default settings are provided in `cacheUtils.ts`:

```typescript
const defaultCacheConfig: CacheConfig = {
  cacheability: true,
  ttl: {
    ok: 86400, // 1 day for successful responses
    redirects: 86400, // 1 day for redirects
    clientError: 60, // 1 minute for client errors
    serverError: 0, // No caching for server errors
  },
};
```

## URL-Specific Cache Configuration

The system supports URL-specific cache configuration through pattern matching:

```typescript
export interface UrlCacheConfig {
  pattern: string;
  ttl?: {
    ok?: number;
    redirects?: number;
    clientError?: number;
    serverError?: number;
    [key: string]: number | undefined;
  };
  cacheability?: boolean;
}
```

Multiple patterns can be defined and sorted by specificity:

```javascript
// Configuration example
{
  "cacheConfig": [
    {
      "pattern": "^/images/thumbnails/.*",
      "ttl": {
        "ok": 604800  // 1 week for thumbnails
      }
    },
    {
      "pattern": "^/images/hires/.*",
      "ttl": {
        "ok": 2592000  // 30 days for high-res images
      }
    }
  ]
}
```

The implementation in `determineCacheConfig()` matches URLs against patterns, with more specific patterns taking precedence:

```typescript
// Filter configs that match the URL
const matchingConfigs = imageConfig.cacheConfig
  .filter(urlConfig => urlConfig.pattern && new RegExp(urlConfig.pattern).test(url))
  .sort((a, b) => {
    // Sort by specificity - longer patterns are more specific
    const aSpecificity = a.pattern?.length || 0;
    const bSpecificity = b.pattern?.length || 0;
    return bSpecificity - aSpecificity;
  });

// Apply the most specific matching configuration
if (matchingConfigs.length > 0) {
  const urlConfig = matchingConfigs[0];
  // Apply configuration...
}
```

## Derivative-Specific Cache Configuration

Each derivative (image transformation preset) can have its own cache configuration:

```javascript
// Configuration example
{
  "derivatives": {
    "thumbnail": {
      "width": 320,
      "height": 180,
      "cache": {
        "ttl": {
          "ok": 604800  // 1 week
        },
        "cacheability": true
      }
    }
  }
}
```

The implementation applies these settings when a derivative is specified:

```typescript
const derivative = urlObj.searchParams.get('derivative');

if (derivative && imageConfig.derivatives && imageConfig.derivatives[derivative]) {
  const derivativeConfig = imageConfig.derivatives[derivative];
  
  // Check if the derivative has cache-specific settings
  if (derivativeConfig.cache && typeof derivativeConfig.cache === 'object') {
    // Apply derivative-specific cache settings...
  }
}
```

## Content Type-Specific Cache Configuration

Different image formats can have different cache configurations:

```javascript
{
  "pattern": "^/images/.*",
  "contentTypes": {
    "image/jpeg": {
      "ttl": {
        "ok": 2592000  // 30 days for JPEGs
      }
    },
    "image/webp": {
      "ttl": {
        "ok": 604800  // 1 week for WebP
      }
    }
  }
}
```

The implementation determines the content type based on file extension:

```typescript
if (urlConfig.contentTypes && typeof urlConfig.contentTypes === 'object') {
  const urlObj = new URL(url);
  const extension = urlObj.pathname.split('.').pop()?.toLowerCase();
  
  if (extension) {
    // Map extension to content type
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      // Additional formats...
    };
    
    const contentType = contentTypeMap[extension];
    if (contentType && urlConfig.contentTypes[contentType]) {
      // Apply content-type specific cache settings...
    }
  }
}
```

## Cache Headers and TTL

Cache headers are set based on HTTP status codes:

```typescript
export function determineCacheControl(status: number, cache?: CacheConfig): string {
  if (!cache || !cache.ttl) return '';

  const statusGroup = Math.floor(status / 100);

  // Map status groups to TTL properties
  const ttlMap: Record<number, string> = {
    2: 'ok', // 200-299 status codes
    3: 'redirects', // 300-399 status codes
    4: 'clientError', // 400-499 status codes
    5: 'serverError', // 500-599 status codes
  };

  const ttlProperty = ttlMap[statusGroup];
  const ttl = ttlProperty && cache.ttl ? cache.ttl[ttlProperty] : 0;

  if (!cache.cacheability || ttl === 0) {
    return 'no-store';
  }

  return ttl ? `public, max-age=${ttl}` : '';
}
```

## Cache Tags for Purging

The system supports cache tags for targeted purging:

```typescript
export function generateCacheTags(bucketName?: string, derivative?: string | null): string[] {
  const tags: string[] = ['image'];

  if (bucketName) {
    tags.push(`source:${bucketName}`);
  }

  if (derivative) {
    tags.push(`derivative:${derivative}`);
  }

  return tags;
}
```

These tags are applied to responses and can be used for targeted cache purging.

## Cache API Implementation

The Image Resizer supports multiple caching methods through the `CacheManagementService`:

```typescript
// Get a response from cache
async getCachedResponse(request: Request): Promise<Response | null> {
  try {
    const cacheKey = dependencies.utils.buildCacheKey(request);

    // Get cache method from helper function
    const cacheMethod = determineCacheMethod();
    
    // Log what's happening
    debug('CacheManagementService', 'Cache method determined', {
      method: cacheMethod
    });

    // If using Cache API method
    if (cacheMethod === 'cache-api') {
      const cache = caches.default;
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        debug('CacheManagementService', 'Cache hit', {
          url: request.url,
          key: cacheKey,
        });
        return cachedResponse;
      }
    }

    // Not found in cache
    debug('CacheManagementService', 'Cache miss', {
      url: request.url,
      key: cacheKey,
    });
    return null;
  } catch (err) {
    // Error handling
  }
}
```

## CF Object Parameters

The `createCfObjectParams()` function in `cacheUtils.ts` creates Cloudflare-specific parameters for fetch options:

```typescript
export function createCfObjectParams(
  status: number,
  cacheConfig?: CacheConfig | null,
  source?: string,
  derivative?: string
): Record<string, unknown> {
  const cfObject: Record<string, unknown> = {
    cacheEverything: true,
  };

  // If no cache config, use default TTL
  if (!cacheConfig) {
    cfObject.cacheTtl = 3600; // 1 hour default
    return cfObject;
  }

  // Determine TTL based on status code
  let ttl = 0;
  if (status >= 200 && status < 300) {
    ttl = cacheConfig.ttl.ok;
  } else if (status >= 300 && status < 400) {
    ttl = cacheConfig.ttl.redirects;
  } else if (status >= 400 && status < 500) {
    ttl = cacheConfig.ttl.clientError;
  } else if (status >= 500) {
    ttl = cacheConfig.ttl.serverError;
  }

  // Apply TTL if cacheability is enabled
  if (cacheConfig.cacheability && ttl > 0) {
    cfObject.cacheTtl = ttl;
  } else {
    cfObject.cacheTtl = 0;
  }

  // Apply image settings
  if (cacheConfig.imageCompression) {
    cfObject.polish = cacheConfig.imageCompression;
  }

  if (cacheConfig.mirage) {
    cfObject.mirage = true;
  }

  // Apply cache tags for purging
  if (source || derivative) {
    cfObject.cacheTags = generateCacheTags(source, derivative);
  }

  return cfObject;
}
```

These parameters are attached to the `fetch()` request options via the `cf` property:

```javascript
const fetchOptions: RequestInit = {
  cf: cfProperties,
};

// Perform the fetch with enhanced options
response = await fetch(request, fetchOptions);
```

## Debug and Diagnostics

The system provides several debugging tools:

### Debug Headers

Debug headers are added to responses when debugging is enabled:

```typescript
// Always set the cache method header for debugging
if (diagnosticsInfo.cachingMethod) {
  const environment = (diagnosticsInfo.environment as string) || '';
  const cacheMethod = environment === 'production' ? 'cf' : diagnosticsInfo.cachingMethod;
  headers.set('debug-cache-method', cacheMethod);
}

if (diagnosticsInfo.cacheability !== undefined) {
  headers.set('debug-cacheable', String(diagnosticsInfo.cacheability));
}

if (diagnosticsInfo.cacheTtl !== undefined) {
  headers.set('debug-cache-ttl', String(diagnosticsInfo.cacheTtl));
}
```

### Diagnostic Logging

Detailed logging of cache operations is available:

```typescript
logger.debug('CacheUtils', '🔍 DIAGNOSTICS - Environment config loaded', {
  environment: appConfig.environment,
  cacheMethod: appConfig.cache?.method || 'not-set',
  envVarCacheMethod: currentEnv.CACHE_METHOD || 'env-not-available',
  configSource: 'configManager.getConfig()',
  url,
  config_cache_json: JSON.stringify(appConfig.cache)
});
```

## Best Practices

1. **Always use `cf` method in production** (enforced by the code)
2. Use `cache-api` method in development for debugging
3. **Layer Cache Settings**: Apply different cache settings at different levels:
   - Global defaults
   - URL-pattern specific settings
   - Content-type specific settings
   - Derivative-specific settings
4. **Use Appropriate TTLs**:
   - Longer TTLs (days to weeks) for static images that rarely change
   - Shorter TTLs (minutes to hours) for dynamic content
   - No caching for personalized content
5. **Cache Tags for Purging**:
   - Use structured tags (`source:x`, `derivative:y`)
   - Include application-level tags for targeted purging
6. **Avoid Caching Errors**:
   - Use short TTLs for client errors (404, etc.)
   - Avoid caching server errors entirely
7. **Content Type Considerations**:
   - Different formats may have different update frequencies
   - Optimize by format: longer TTLs for optimized formats like WebP and AVIF
8. Check debug headers to verify cache method and configuration
9. Use the `CF-Cache-Status` header to check cache status