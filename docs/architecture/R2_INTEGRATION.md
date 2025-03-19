# R2 Integration in Image Resizer

This document outlines the approach for integrating Cloudflare R2 storage with the Image Resizer service.

## Overview

The Image Resizer now supports R2 storage as an image source through a modular transformation strategy pattern. This allows for multiple approaches to transform and deliver images stored in R2 buckets, with automatic fallback between strategies if one fails.

## Transformation Strategies

The system uses a prioritized list of transformation strategies:

### 1. WorkersDevStrategy (Priority: 0 for workers.dev domains)

The WorkersDevStrategy is specialized for workers.dev domains where Cloudflare Image Resizing has limitations. When a request comes from a workers.dev domain, this strategy:

1. Retrieves the original image from R2
2. Adds transformation information as headers (e.g., `X-Image-Width`, `X-Image-Format`)
3. Returns the untransformed image with these headers

This strategy was created specifically for workers.dev domains because both the Interceptor and DirectUrl strategies have known limitations on these domains, resulting in 404 errors. It preserves transformation metadata while ensuring the image is still served correctly.

### 2. Interceptor Strategy (Priority: 0 for custom domains)

The interceptor strategy uses the Cloudflare Worker's ability to intercept image resizing subrequests. When Cloudflare processes an image with `cf.image` properties, it makes a subrequest that can be identified by its `via` header containing `image-resizing`. The worker intercepts this subrequest and serves the R2 image directly.

This approach is the most efficient because:
- It eliminates unnecessary network hops and redirects
- The original image is served directly from R2 to Cloudflare's transformation service
- No external requests are made to CDNs or origin servers
- It works with any type of R2 stored image (JPEG, PNG, WebP, AVIF, etc.)
- **Note**: This strategy works best on custom domains (not workers.dev domains)

**Key Implementation Detail**: When the worker receives a subrequest (identified by the `via` header), it extracts the image key from the URL path. The URL path structure `/path/to/image.jpg` is preserved when making the initial request with `cf.image` properties, which allows the worker to determine which image to serve from R2 when the subrequest comes back.

#### Flow Diagram

```
┌─────────┐         (1)         ┌─────────────┐       (4)      ┌──────────┐
│  Client │ ───────────────────►│   Worker    │◄───────────────│   R2     │
└────┬────┘                     └──────┬──────┘                └──────────┘
     │                                 │                            ▲
     │                                 │                            │
     │                                 │ (2)                        │ (3)
     │                                 ▼                            │
     │                           ┌─────────────┐                    │
     └─────────────────(5)───────┤ CF Image    │────────────────────┘
                                 │ Processing  │
                                 └─────────────┘

1. Client requests image with transformations
2. Worker initiates transformation with cf.image properties
3. CF Image Processing makes a subrequest back to the worker with 'via: image-resizing' header
4. Worker detects the subrequest and serves original image directly from R2
5. CF transforms the image and returns it to the client
```

```typescript
// Example implementation
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const via = request.headers.get('via') ?? '';

    // Check if this is an image resizing subrequest
    if (via.includes('image-resizing')) {
      // Extract the image key from the URL path
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const imageKey = pathParts[pathParts.length - 1]; // Get the last part of the path as the key
      
      console.log('Handling subrequest for image:', imageKey);
      
      // Serve the original image from R2 using the extracted key
      const object = await env.r2.get(imageKey);
      if (object === null) {
        return new Response(`Object Not Found: ${imageKey}`, {status: 404});
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=86400");
      headers.set("X-Source", "r2-direct-subrequest");

      return new Response(object.body, {
        headers,
      });
    } 
    
    // This is the original request - use cf.image to transform it
    // The original URL (with the key in the path) is preserved and used for the transformation
    // This is important because when Cloudflare makes the subrequest back to our worker,
    // we can extract the key from the URL path
    return await fetch(request.url, {
      cf: {
        image: {
          width: 500,
          height: 300,
          fit: "cover",
          quality: 80
        },
        cacheEverything: true,
        cacheTtl: 86400
      }
    });
  }
};
```

### 2. CDN-CGI Strategy (Priority: 1)

This strategy uses the standard Cloudflare Image Resizing path format (`/cdn-cgi/image/`) to transform images. It constructs a URL with transformation parameters and the image key from R2.

```
/cdn-cgi/image/width=500,height=300,fit=cover/image.jpg
```

### 3. Direct URL Strategy (Priority: 2)

This strategy uses a direct URL to the image and applies the transformation using the `cf.image` parameter in the fetch options.

### 4. Remote Fallback Strategy (Priority: 3)

This strategy uses a remote server as a fallback option, passing transformation parameters as query parameters.

### 5. Direct Serving Strategy (Priority: 10)

This strategy is used when no transformations are needed, serving the image directly from R2 without any modifications.

## Implementation Details

### Strategy Interface

All transformation strategies implement the same interface:

```typescript
interface IImageTransformationStrategy {
  name: string;
  priority: number;
  canHandle(params: TransformationStrategyParams): boolean;
  execute(params: TransformationStrategyParams): Promise<Response>;
}
```

### Service Registration

The transformation strategies are registered with the service registry and can be dynamically loaded:

```typescript
// Register the streaming transformation service
import { createStreamingTransformationService } from '../services/streamingTransformationService';

// In your service registration code:
registry.registerSingleton('IStreamingTransformationService', () => {
  return createStreamingTransformationService({
    logger,
    cache,
    transformationCache,
    // Optional custom strategies
    strategies: [
      // Add your own strategies here
    ]
  });
});
```

### Usage in Worker Code

To use the transformation strategies in your worker code:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Check if this is an R2 image request
    const url = new URL(request.url);
    const path = url.pathname;
    
    // If path matches a pattern for R2 images
    if (path.startsWith('/images/')) {
      const key = path.replace('/images/', '');
      
      // Get options from query parameters or other source
      const options = {
        width: 500,
        height: 300,
        fit: 'cover'
      };
      
      // Get the streaming transformation service
      const { ServiceRegistry } = await import('./core/serviceRegistry');
      const registry = ServiceRegistry.getInstance();
      
      if (registry.isRegistered('IStreamingTransformationService')) {
        const transformService = registry.resolve('IStreamingTransformationService');
        
        // Process the image with automatic strategy selection
        return await transformService.processR2Image(
          key,
          env.r2,
          options,
          request,
          { cacheability: true, ttl: { ok: 86400 } },
          'https://example.com' // Optional fallback URL
        );
      }
      
      // Fallback if service isn't registered
      // ...
    }
    
    // Handle other requests
    // ...
  }
};
```

## Strategy Selection Process

1. When `processR2Image` is called, it first retrieves the image from R2
2. It creates a parameters object with all necessary information
3. It then iterates through the strategies in priority order
4. For each strategy, it checks if the strategy can handle the request using `canHandle()`
5. If a strategy can handle the request, it executes it
6. If the strategy fails, it tries the next one
7. If all strategies fail, it serves the image directly from R2 as a fallback

## Benefits of the Strategy Pattern

1. **Modularity**: Each transformation approach is isolated in its own strategy class
2. **Extensibility**: New strategies can be added without modifying existing code
3. **Prioritization**: Strategies are tried in order of efficiency/preference
4. **Fallback**: Automatic fallback to other strategies if one fails
5. **Configurability**: Strategies can be registered dynamically or configured at runtime
6. **Testing**: Each strategy can be tested independently

## Usage with StreamingTransformationService

The recommended way to use these strategies is through the `StreamingTransformationService`, which provides a unified API for all transformation approaches:

```typescript
import { createStreamingTransformationService } from '../services/streamingTransformationService';

// Create the service with dependencies
const transformService = createStreamingTransformationService({
  logger,
  cache,
  transformationCache
});

// Use the service to transform images
const response = await transformService.processR2Image(
  'image.jpg',           // R2 key
  env.IMAGES_BUCKET,     // R2 bucket
  {                      // Transformation options
    width: 800,
    height: 600,
    fit: 'cover',
    quality: 80,
    format: 'auto'
  },
  request,               // Original request
  {                      // Cache config
    cacheability: true,
    ttl: { ok: 86400 }
  },
  'https://fallback.com' // Optional fallback URL
);
```

In this approach, the service automatically:
1. Retrieves the image from R2
2. Selects the most appropriate transformation strategy
3. Executes the strategy with fallbacks if needed
4. Adds proper cache and source headers
5. Returns a standardized response

## Recent Improvements

### Optimized InterceptorStrategy Implementation

The InterceptorStrategy has been improved to:
1. Use the original request URL instead of a dummy URL, preventing 530 errors
2. Extract the image key from the URL path in subrequests, fixing 404 errors
3. Properly handle both initial requests and subrequests in a single strategy
4. Implement better logging for debugging
5. Properly handle caching and headers
6. Integrate with the transformation cache service
7. Use a unified error handling approach
8. Provide detailed diagnostic information

### Enhanced Documentation and Examples

The `docs/examples/r2-interceptor-worker.ts` file now provides a clean, simple implementation of the interceptor pattern that can be used as a starting point for new projects.

## Conclusion

The strategy pattern provides a clean, extensible way to handle image transformations from R2 storage. By separating the transformation logic into distinct strategies, we can easily add new approaches and ensure reliability through the fallback mechanism.

The addition of the optimized InterceptorStrategy provides significant performance benefits by eliminating unnecessary network hops and leveraging Cloudflare's image transformation service directly with R2 objects.