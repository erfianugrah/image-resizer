# Interceptor Strategy Implementation

This document details the implementation of the Interceptor Strategy for image transformations using Cloudflare's `cf.image` property with subrequest interception.

## 1. Strategy Overview

The Interceptor Strategy is a high-performance approach for transforming images stored in R2 buckets. It works by:

1. Making a fetch request to the same URL with `cf.image` properties
2. Detecting subrequests from Cloudflare's image resizing service
3. Serving the original image directly from R2 for these subrequests
4. Delivering the transformed result for the original request

This approach reduces network hops compared to the CDN-CGI approach, potentially improving performance significantly, especially for large images.

## 2. Implementation Challenges

### 2.1 Domain-Specific Behavior

The Interceptor Strategy exhibits different behavior based on the domain:

- **Production Domains** (images.erfi.dev): Strategy works correctly
- **Development Domains** (dev-resizer.anugrah.workers.dev): Strategy returns 404 errors

### 2.2 Cloudflare Workers.dev Limitations

Cloudflare's Workers.dev domains have limitations that affect the Interceptor Strategy:

1. Different routing behavior compared to custom domains
2. Special handling of recursive worker calls
3. Possible restrictions on internal Cloudflare service access

### 2.3 Path Key Extraction Issues

The original implementation had issues with key extraction for subrequests:

```javascript
// Original implementation - used the original key
const r2Object = await bucket.get(key);
```

This approach worked for direct paths on custom domains but failed on Workers.dev domains where the path structure might differ in subrequests.

## 3. Solution Implementation

### 3.1 Path Key Extraction Fix

The primary fix involves extracting the key from the URL path for subrequests:

```javascript
// New implementation - extract key from URL path
const url = new URL(request.url);
const pathname = url.pathname;
const pathKey = pathname.startsWith('/') ? pathname.substring(1) : pathname;

// Use the key extracted from the URL path
const r2Object = await bucket.get(pathKey);
```

This ensures that we're using the key as it appears in the subrequest URL, not the original key passed to the function.

### 3.2 Environment-Aware Strategy Selection

The Environment Service now provides domain-specific strategy priorities:

```javascript
// For development domains on workers.dev
if (domainEnvironment === 'development' && getDomain(url).includes('workers.dev')) {
  return ['cdn-cgi', 'interceptor', 'direct-url', 'remote-fallback', 'direct-serving'];
}
```

This ensures that on development domains:
- CDN-CGI strategy is tried first (it works reliably)
- Interceptor is still available as a fallback
- Service remains functional across all environments

### 3.3 Enhanced Error Logging

Improved error logging helps diagnose issues with subrequests:

```javascript
// Get response body for debugging if available
let responseText = '';
try {
  const clonedResponse = response.clone();
  responseText = await clonedResponse.text();
} catch (e) {
  responseText = 'Could not read response body';
}

logger.error(`Image transform request failed: ${response.status}`, {
  status: response.status,
  url: request.url,
  responseBody: responseText.substring(0, 500),
  headers: Object.fromEntries([...response.headers.entries()])
});
```

This provides more context about why requests are failing in different environments.

## 4. Architectural Improvements

### 4.1 Implementation Details

The interceptor strategy has been enhanced with:

1. **Domain Awareness**: Different behavior based on the requesting domain
2. **Robust Path Handling**: Correct extraction of keys from URL paths
3. **Better Error Handling**: Detailed error capturing for failed requests
4. **Enhanced Logging**: Comprehensive logging of all steps in the process

### 4.2 Key Code Changes

Key changes to make the strategy work reliably:

1. **R2 Key Extraction**: Now properly extracts the key from the subrequest URL
2. **Error Response Capture**: Captures and logs response body for failed requests
3. **Domain-Based Strategy Selection**: Prioritizes strategies based on domain type
4. **Worker Process Flow**: Updated to properly handle image-resizing subrequests

## 5. Performance Implications

The improved strategy selection system provides:

1. **Optimal Performance in Production**: Uses the interceptor strategy first on custom domains
2. **Reliability in Development**: Falls back to CDN-CGI on workers.dev domains
3. **Dynamic Adaptation**: Adjusts to the environment without manual configuration
4. **Full Diagnostics**: Provides detailed information about transformation attempts

## 6. Future Considerations

1. **Custom Workers.dev Route Patterns**: May resolve interceptor issues on workers.dev domains
2. **Separate Domain for Development**: Consider using a custom domain for development
3. **Direct Workers Binding**: Explore direct binding between workers for improved performance
4. **Caching Interceptor Results**: Add specific caching strategies for interceptor results

## 7. Integration with New Architecture

The Interceptor Strategy is now fully integrated with our new architecture components:

### 7.1 Service Registry Integration

The strategy is now registered with the centralized ServiceRegistry:

```typescript
registry.register('IStrategyRegistry', {
  factory: (deps) => {
    const logger = deps.ILogger;
    const configService = deps.IConfigurationService || deps.IEnvironmentService || {/*...*/};
    return createStrategyRegistry({ 
      logger,
      configService,
    });
  },
  // ...
});
```

### 7.2 Environment Service Integration

The strategy priorities are determined by the EnvironmentService based on domain:

```typescript
// Development environment needs special handling for interceptor strategy
if (domainEnvironment === 'development') {
  // For development domains like dev-resizer.anugrah.workers.dev, prioritize cdn-cgi over interceptor
  if (getDomain(url).includes('workers.dev')) {
    logger.debug('Using development-specific strategy order for workers.dev domain', {
      domain: getDomain(url),
    });
    return ['cdn-cgi', 'interceptor', 'direct-url', 'remote-fallback', 'direct-serving'];
  }
}
```

### 7.3 Test Coverage

We've added comprehensive test coverage for the strategy, including:

```typescript
// Test subrequests from workers.dev domains
it('should handle subrequests from workers.dev domains', async () => {
  const request = new Request('https://dev-resizer.anugrah.workers.dev/test.jpg', {
    headers: {
      via: 'image-resizing',
    }
  });
  
  // Verify the right R2 key is used
  expect(mockBucket.get).toHaveBeenCalledWith('test.jpg');
});
```

## 8. Conclusion

The implementation now handles the key differences between production and development environments, ensuring reliable operation across all domains while still optimizing for performance where possible. The domain-specific strategy selection provides flexibility without requiring manual configuration changes when moving between environments.

By integrating with our new architectural components, we've created a robust, maintainable system that handles environment-specific behaviors without compromising performance or reliability.