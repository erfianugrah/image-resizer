/**
 * Service for managing cache operations
 * Provides a unified interface for cache operations using both
 * Cache API and CF object approaches
 */
// Import dependencies but mark unused ones with underscore prefix
import {
  CacheConfig,
  ICacheManagementService,
  CacheManagementDependencies,
} from '../types/utils/cache';

// Legacy function removed - use createCacheManagementService factory function instead

// Legacy function removed - use factory function instead

// Legacy function removed - use createCacheManagementService factory function instead

/**
 * Factory function to create cache management service with dependency injection
 * @param dependencies - Dependencies for the cache service
 * @returns Instantiated cache management service
 */
export function createCacheManagementService(
  dependencies: CacheManagementDependencies
): ICacheManagementService {
  // Helper function to determine cache method - used in multiple methods
  const determineCacheMethod = (): string => {
    const config = dependencies.config.getConfig();
    // Use the configured method, but force 'cf' in production
    return config.environment === 'production' ? 'cf' : config.caching?.method || 'cache-api';
  };
  return {
    /**
     * Get a response from cache
     */
    async getCachedResponse(request: Request): Promise<Response | null> {
      try {
        const { debug } = dependencies.logger;
        const cacheKey = dependencies.utils.buildCacheKey(request);

        // Get cache method from helper function
        const cacheMethod = determineCacheMethod();

        // Log what's happening
        debug('CacheManagementService', 'Cache method determined', {
          method: cacheMethod,
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
        const { error } = dependencies.logger;
        error('CacheManagementService', 'Error retrieving from cache', {
          error: err instanceof Error ? err.message : 'Unknown error',
          url: request.url,
        });
        return null;
      }
    },

    /**
     * Store a response in cache
     */
    async cacheResponse(request: Request, response: Response): Promise<boolean> {
      try {
        const { debug } = dependencies.logger;

        // Check if response is cacheable based on Cache-Control header
        const cacheControl = response.headers.get('Cache-Control') || '';
        if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
          debug('CacheManagementService', 'Skipping cache for non-cacheable response', {
            url: request.url,
            cacheControl,
          });
          return false;
        }

        // Get cache method from helper function
        const cacheMethod = determineCacheMethod();

        // Log what's happening
        debug('CacheManagementService', 'Cache method for caching response', {
          method: cacheMethod,
        });

        // If using Cache API method
        if (cacheMethod === 'cache-api') {
          const cache = caches.default;
          await cache.put(request, response.clone());

          debug('CacheManagementService', 'Stored in cache', {
            url: request.url,
            status: response.status,
          });
          return true;
        }

        // CF object caching happens automatically with fetch options
        return true;
      } catch (err) {
        const { error } = dependencies.logger;
        error('CacheManagementService', 'Error storing in cache', {
          error: err instanceof Error ? err.message : 'Unknown error',
          url: request.url,
        });
        return false;
      }
    },

    /**
     * Apply cache headers to the response
     */
    applyCacheHeaders(
      response: Response,
      status: number,
      cacheConfig?: CacheConfig | null,
      source?: string,
      derivative?: string
    ): Response {
      try {
        // Logger available if needed in the future

        // If no cache config, return original response
        if (!cacheConfig) {
          return response;
        }

        // Clone the response to make it mutable
        const enhancedResponse = new Response(response.body, response);

        // Determine Cache-Control header value
        const cacheControl = dependencies.utils.determineCacheControl(status, cacheConfig);
        if (cacheControl) {
          enhancedResponse.headers.set('Cache-Control', cacheControl);
        }

        // Apply cache tags for purging
        if (source || derivative) {
          const tags = dependencies.utils.generateCacheTags(source, derivative);
          if (tags.length > 0) {
            enhancedResponse.headers.set('Cache-Tag', tags.join(','));
          }
        }

        return enhancedResponse;
      } catch (err) {
        const { error } = dependencies.logger;
        error('CacheManagementService', 'Error applying cache headers', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return response; // Return original response on error
      }
    },

    /**
     * Generate cache tags for the given source and derivative
     */
    generateCacheTags(source?: string, derivative?: string | null): string[] {
      return dependencies.utils.generateCacheTags(source, derivative);
    },
  };
}
