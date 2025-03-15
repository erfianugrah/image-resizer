/**
 * Service for managing cache operations
 * Provides a unified interface for cache operations using both 
 * Cache API and CF object approaches
 */
import { debug, error } from '../utils/loggerUtils';

// Cache configuration interface
export interface CacheConfig {
  cacheability: boolean;
  imageCompression?: string;
  mirage?: boolean;
  ttl: {
    ok: number;
    redirects: number;
    clientError: number;
    serverError: number;
  };
}

// Cache key builder function
function buildCacheKey(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

/**
 * Get a response from cache
 * 
 * @param request - The original request
 * @returns Cached response or null if not cached
 */
export async function getCachedResponse(request: Request): Promise<Response | null> {
  try {
    const cacheKey = buildCacheKey(request);
    
    // Import configuration to check caching method
    const { imageConfig } = await import('../config/imageConfig');
    
    // If using Cache API method
    if (imageConfig.caching?.method === 'cache-api') {
      const cache = caches.default;
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        debug('CacheManagementService', 'Cache hit', {
          url: request.url,
          key: cacheKey
        });
        return cachedResponse;
      }
    }
    
    // Not found in cache
    debug('CacheManagementService', 'Cache miss', {
      url: request.url,
      key: cacheKey
    });
    return null;
  } catch (err) {
    error('CacheManagementService', 'Error retrieving from cache', {
      error: err instanceof Error ? err.message : 'Unknown error',
      url: request.url
    });
    return null;
  }
}

/**
 * Store a response in cache
 * 
 * @param request - The original request
 * @param response - The response to cache
 * @returns Whether the caching operation succeeded
 */
export async function cacheResponse(request: Request, response: Response): Promise<boolean> {
  try {
    // Check if response is cacheable based on Cache-Control header
    const cacheControl = response.headers.get('Cache-Control') || '';
    if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
      debug('CacheManagementService', 'Skipping cache for non-cacheable response', {
        url: request.url,
        cacheControl
      });
      return false;
    }
    
    // Import configuration to check caching method
    const { imageConfig } = await import('../config/imageConfig');
    
    // If using Cache API method
    if (imageConfig.caching?.method === 'cache-api') {
      const cache = caches.default;
      await cache.put(request, response.clone());
      
      debug('CacheManagementService', 'Stored in cache', {
        url: request.url,
        status: response.status
      });
      return true;
    }
    
    // CF object caching happens automatically with fetch options
    return true;
  } catch (err) {
    error('CacheManagementService', 'Error storing in cache', {
      error: err instanceof Error ? err.message : 'Unknown error',
      url: request.url
    });
    return false;
  }
}

/**
 * Apply cache headers to the response
 * 
 * @param response - The original response
 * @param status - HTTP status code
 * @param cacheConfig - Cache configuration
 * @param source - Source identifier for cache tags
 * @param derivative - Derivative identifier for cache tags
 * @returns Response with cache headers
 */
export function applyCacheHeaders(
  response: Response,
  status: number,
  cacheConfig?: CacheConfig | null,
  source?: string,
  derivative?: string
): Response {
  try {
    // If no cache config, return original response
    if (!cacheConfig) {
      return response;
    }
    
    // Clone the response to make it mutable
    const enhancedResponse = new Response(response.body, response);
    
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
    
    // If cacheability is false or TTL is 0, apply no-store
    if (!cacheConfig.cacheability || ttl === 0) {
      enhancedResponse.headers.set('Cache-Control', 'no-store');
      return enhancedResponse;
    }
    
    // Create Cache-Control header
    enhancedResponse.headers.set('Cache-Control', `public, max-age=${ttl}`);
    
    // Apply cache tags for purging
    if (source || derivative) {
      const tags = [];
      if (source) tags.push(`source:${source}`);
      if (derivative) tags.push(`derivative:${derivative}`);
      
      if (tags.length > 0) {
        enhancedResponse.headers.set('Cache-Tag', tags.join(','));
      }
    }
    
    return enhancedResponse;
  } catch (err) {
    error('CacheManagementService', 'Error applying cache headers', {
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    return response; // Return original response on error
  }
}

/**
 * Create CF object parameters for fetch options
 * 
 * @param status - HTTP status code
 * @param cacheConfig - Cache configuration
 * @param source - Source identifier for cache tags
 * @param derivative - Derivative identifier for cache tags
 * @returns CF object parameters
 */
export function createCfObjectParams(
  status: number,
  cacheConfig?: CacheConfig | null,
  source?: string,
  derivative?: string
): Record<string, unknown> {
  const cfObject: Record<string, unknown> = {
    cacheEverything: true
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
    const tags = [];
    if (source) tags.push(`source:${source}`);
    if (derivative) tags.push(`derivative:${derivative}`);
    
    if (tags.length > 0) {
      cfObject.cacheTags = tags;
    }
  }
  
  return cfObject;
}