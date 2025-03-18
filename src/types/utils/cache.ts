/**
 * Centralized cache configuration interfaces
 */

/**
 * Cache configuration interface
 */
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

// Type that includes Record<string, unknown> to fix index signature issues
export type CacheConfigRecord = CacheConfig & Record<string, unknown>;

/**
 * URL-specific cache configuration
 */
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

/**
 * Cache management service interface
 */
export interface ICacheManagementService {
  /**
   * Get a response from cache
   * @param request - The original request
   * @returns Cached response or null if not cached
   */
  getCachedResponse(request: Request): Promise<Response | null>;

  /**
   * Store a response in cache
   * @param request - The original request
   * @param response - The response to cache
   * @returns Whether the caching operation succeeded
   */
  cacheResponse(request: Request, response: Response): Promise<boolean>;

  /**
   * Apply cache headers to the response
   * @param response - The original response
   * @param status - HTTP status code
   * @param cacheConfig - Cache configuration
   * @param source - Source identifier for cache tags
   * @param derivative - Derivative identifier for cache tags
   * @returns Response with cache headers
   */
  applyCacheHeaders(
    response: Response,
    status: number,
    cacheConfig?: CacheConfig | null,
    source?: string,
    derivative?: string
  ): Response;

  /**
   * Generate cache tags for the given source and derivative
   * @param source - Source identifier
   * @param derivative - Derivative identifier
   * @returns Array of cache tags
   */
  generateCacheTags(source?: string, derivative?: string | null): string[];
}

/**
 * Dependencies for the cache management service
 */
export interface CacheManagementDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
  config: {
    getConfig: () => {
      cache?: {
        method?: string;
      };
      caching?: {
        method?: string;
      };
      environment?: string;
    };
  };
  utils: {
    buildCacheKey: (request: Request) => string;
    determineCacheControl: (status: number, cacheConfig: CacheConfig) => string | null;
    generateCacheTags: (source?: string, derivative?: string | null) => string[];
  };
}
