# Caching Strategy in Image Resizer

This document outlines the caching strategy implemented in the Image Resizer codebase.

## Table of Contents
- [Introduction](#introduction)
- [Cache Configuration System](#cache-configuration-system)
- [URL-Specific Cache Configuration](#url-specific-cache-configuration)
- [Derivative-Specific Cache Configuration](#derivative-specific-cache-configuration)
- [Content Type-Specific Cache Configuration](#content-type-specific-cache-configuration)
- [Cache Headers and TTL](#cache-headers-and-ttl)
- [Cache Tags for Purging](#cache-tags-for-purging)
- [Cache API Implementation](#cache-api-implementation)
- [Best Practices](#best-practices)

## Introduction

The Image Resizer implements a comprehensive caching strategy to optimize performance and reduce origin load. The system supports:

1. **Flexible TTL Configuration**: Different cache TTLs based on response status, content type, and URL patterns
2. **URL-Specific Caching**: Apply different cache settings based on URL patterns
3. **Derivative-Specific Caching**: Configure caching differently for each image transformation preset
4. **Content Type-Specific Caching**: Different caching rules for different image formats
5. **Cache Tags**: Support for cache tags to enable targeted cache purging
6. **Multiple Caching Methods**: Support for both Cache API and CF object caching

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

The Image Resizer supports multiple caching methods:

1. **Cache API**: Using the Cloudflare Workers Cache API
2. **CF Object Caching**: Using Cloudflare's fetch options

The method is configurable:

```typescript
// Get a response from cache
export async function getCachedResponse(request: Request): Promise<Response | null> {
  // Import configuration to check caching method
  const { imageConfig } = await import('../config/imageConfig');

  // If using Cache API method
  if (imageConfig.caching?.method === 'cache-api') {
    const cache = caches.default;
    const cachedResponse = await cache.match(request);
    // Return cached response if found
  }

  // Not found in cache
  return null;
}
```

## Best Practices

1. **Layer Cache Settings**: Apply different cache settings at different levels:
   - Global defaults
   - URL-pattern specific settings
   - Content-type specific settings
   - Derivative-specific settings

2. **Use Appropriate TTLs**:
   - Longer TTLs (days to weeks) for static images that rarely change
   - Shorter TTLs (minutes to hours) for dynamic content
   - No caching for personalized content

3. **Cache Tags for Purging**:
   - Use structured tags (`source:x`, `derivative:y`)
   - Include application-level tags for targeted purging

4. **Avoid Caching Errors**:
   - Use short TTLs for client errors (404, etc.)
   - Avoid caching server errors entirely

5. **Content Type Considerations**:
   - Different formats may have different update frequencies
   - Optimize by format: longer TTLs for optimized formats like WebP and AVIF