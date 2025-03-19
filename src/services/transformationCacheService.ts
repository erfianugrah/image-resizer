/**
 * Transformation Cache Service
 *
 * Caches pre-processed transformation options to minimize redundant calculations
 * across multiple strategies in the transformation chain.
 */
import {
  ITransformationCacheService,
  PreparedTransformation,
  TransformationCacheDependencies,
  TransformationCacheConfig,
} from '../types/services/imageProcessing';
import { ImageTransformOptions } from '../types/services/image';
import { CacheConfig } from '../types/utils/cache';
import {
  normalizeImageOptions,
  prepareCdnCgiOptions,
  prepareCfImageOptions,
  addOptionsToUrlParams,
  prepareTransformationOptions,
  TransformationOptionFormat,
} from '../utils/transformationUtils';

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: TransformationCacheConfig = {
  maxSize: 200,
  ttl: 60000, // 1 minute
  enabled: true,
  maxHeadersCacheSize: 100,
};

/**
 * LRU Cache entry with expiration
 */
interface CacheEntry<T> {
  value: T;
  expires: number;
  lastAccessed: number;
}

/**
 * Factory function to create a transformation cache service
 * @param dependencies Service dependencies
 * @returns TransformationCacheService implementation
 */
export function createTransformationCacheService(
  dependencies: TransformationCacheDependencies,
  config: Partial<TransformationCacheConfig> = {}
): ITransformationCacheService {
  // Merge config with defaults
  const fullConfig: TransformationCacheConfig = {
    ...DEFAULT_CACHE_CONFIG,
    ...config,
  };

  // Extract logger from dependencies for convenience
  const { debug, error } = dependencies.logger;

  // Cache statistics
  let cacheHits = 0;
  let cacheMisses = 0;
  let headerCacheHits = 0;
  let headerCacheMisses = 0;

  // Cache storage
  const transformationCache = new Map<string, CacheEntry<PreparedTransformation>>();
  const headersCache = new Map<string, CacheEntry<Headers>>();

  /**
   * Generate a cache key for transformation options
   * @param options Transformation options
   * @returns Cache key string
   */
  function generateCacheKey(options: ImageTransformOptions): string {
    // Sort keys to ensure consistent key generation regardless of property order
    const sortedEntries = Object.entries(options).sort(([keyA], [keyB]) =>
      keyA.localeCompare(keyB)
    );
    return JSON.stringify(sortedEntries);
  }

  /**
   * Generate a cache key for headers
   * @param status Response status
   * @param cacheConfig Cache configuration
   * @param source Source identifier
   * @param derivative Derivative identifier
   * @returns Cache key string
   */
  function generateHeadersCacheKey(
    status: number,
    cacheConfig: CacheConfig,
    source?: string,
    derivative?: string | null
  ): string {
    return `${status}:${JSON.stringify(cacheConfig)}:${source || ''}:${derivative || ''}`;
  }

  /**
   * Remove expired entries from the cache
   */
  function cleanupExpiredEntries(): void {
    const now = Date.now();

    // Clean transformation cache
    for (const [key, entry] of transformationCache.entries()) {
      if (entry.expires < now) {
        transformationCache.delete(key);
      }
    }

    // Clean headers cache
    for (const [key, entry] of headersCache.entries()) {
      if (entry.expires < now) {
        headersCache.delete(key);
      }
    }
  }

  /**
   * Evict least recently used entries if cache exceeds max size
   */
  function evictLRUEntries(): void {
    // Check if transformation cache needs eviction
    if (transformationCache.size > fullConfig.maxSize) {
      // Convert to array for sorting
      const entries = Array.from(transformationCache.entries());

      // Sort by last accessed time (oldest first)
      entries.sort(([, entryA], [, entryB]) => entryA.lastAccessed - entryB.lastAccessed);

      // Remove oldest entries until we're below max size
      const entriesToRemove = entries.slice(0, entries.length - fullConfig.maxSize);
      for (const [key] of entriesToRemove) {
        transformationCache.delete(key);
      }
    }

    // Check if headers cache needs eviction
    if (headersCache.size > fullConfig.maxHeadersCacheSize) {
      // Convert to array for sorting
      const entries = Array.from(headersCache.entries());

      // Sort by last accessed time (oldest first)
      entries.sort(([, entryA], [, entryB]) => entryA.lastAccessed - entryB.lastAccessed);

      // Remove oldest entries until we're below max size
      const entriesToRemove = entries.slice(0, entries.length - fullConfig.maxHeadersCacheSize);
      for (const [key] of entriesToRemove) {
        headersCache.delete(key);
      }
    }
  }

  /**
   * Create a prepared transformation with all formats
   * @param options Original transformation options
   * @returns Prepared transformation with all formats
   */
  function createPreparedTransformation(options: ImageTransformOptions): PreparedTransformation {
    // Generate a cache key
    const cacheKey = generateCacheKey(options);

    // Create normalized options first
    const normalizedOptions = normalizeImageOptions(options);

    // Create all transformation formats
    const cfObjectOptions = prepareCfImageOptions(normalizedOptions);
    const cdnCgiParams = prepareCdnCgiOptions(normalizedOptions);
    const queryUrl = addOptionsToUrlParams(new URL('https://example.com'), normalizedOptions);

    // Return the prepared transformation
    return {
      normalizedOptions,
      cfObjectOptions,
      cdnCgiParams,
      queryUrl,
      cacheKey,
    };
  }

  // Run cleanup periodically
  const cleanupInterval = setInterval(() => {
    cleanupExpiredEntries();
  }, 30000); // Run every 30 seconds

  return {
    /**
     * Get cached transformation options in all required formats
     */
    getPreparedTransformation(options: ImageTransformOptions): PreparedTransformation {
      // If cache is disabled, create and return without caching
      if (!fullConfig.enabled) {
        return createPreparedTransformation(options);
      }

      // Generate a cache key
      const cacheKey = generateCacheKey(options);

      // Try to get from cache
      const cachedEntry = transformationCache.get(cacheKey);
      const now = Date.now();

      // If found and not expired
      if (cachedEntry && cachedEntry.expires > now) {
        // Update last accessed time
        cachedEntry.lastAccessed = now;
        cacheHits++;
        return cachedEntry.value;
      }

      // Not found or expired
      cacheMisses++;

      // Create the prepared transformation
      const prepared = createPreparedTransformation(options);

      // Cache it
      transformationCache.set(cacheKey, {
        value: prepared,
        expires: now + fullConfig.ttl,
        lastAccessed: now,
      });

      // Evict LRU entries if needed
      evictLRUEntries();

      return prepared;
    },

    /**
     * Get transformation options in a specific format
     */
    getTransformationOptions(
      options: ImageTransformOptions,
      format: TransformationOptionFormat
    ): string[] | Record<string, string | number | boolean> | URL {
      // Get the prepared transformation
      const prepared = this.getPreparedTransformation(options);

      // Return the requested format
      switch (format) {
        case TransformationOptionFormat.CF_OBJECT:
          return prepared.cfObjectOptions;

        case TransformationOptionFormat.CDN_CGI:
          return prepared.cdnCgiParams;

        case TransformationOptionFormat.QUERY_PARAMS:
          return prepared.queryUrl;

        default:
          // Fallback to the utility function if format is not recognized
          debug(
            'TransformationCacheService',
            'Unknown format requested, falling back to direct calculation',
            {
              format,
            }
          );
          return prepareTransformationOptions(options, format);
      }
    },

    /**
     * Create response headers with proper cache control
     */
    createCacheHeaders(
      status: number,
      cacheConfig: CacheConfig,
      source?: string,
      derivative?: string | null
    ): Headers {
      // If cache is disabled or no cache dependency, create and return without caching
      if (!fullConfig.enabled || !dependencies.cache) {
        const headers = new Headers();

        // If we have cache dependency, use it to determine cache control
        if (dependencies.cache) {
          headers.set(
            'Cache-Control',
            dependencies.cache.determineCacheControl(status, cacheConfig, source, derivative)
          );

          // Add cache tags if available
          const cacheTags = dependencies.cache.generateCacheTags(source, derivative);
          if (cacheTags.length > 0) {
            headers.set('Cache-Tag', cacheTags.join(','));
          }
        } else {
          // Use a default cache control
          headers.set('Cache-Control', 'public, max-age=86400');
        }

        return headers;
      }

      // Generate a cache key for the headers
      const cacheKey = generateHeadersCacheKey(status, cacheConfig, source, derivative);

      // Try to get from cache
      const cachedEntry = headersCache.get(cacheKey);
      const now = Date.now();

      // If found and not expired
      if (cachedEntry && cachedEntry.expires > now) {
        // Update last accessed time
        cachedEntry.lastAccessed = now;
        headerCacheHits++;

        // Clone the headers to avoid mutation
        const clonedHeaders = new Headers();
        for (const [key, value] of cachedEntry.value.entries()) {
          clonedHeaders.set(key, value);
        }

        return clonedHeaders;
      }

      // Not found or expired
      headerCacheMisses++;

      // Create the headers
      const headers = new Headers();

      // Set cache control
      headers.set(
        'Cache-Control',
        dependencies.cache.determineCacheControl(status, cacheConfig, source, derivative)
      );

      // Add cache tags if available
      const cacheTags = dependencies.cache.generateCacheTags?.(source, derivative) || [];
      if (cacheTags.length > 0) {
        headers.set('Cache-Tag', cacheTags.join(','));
      }

      // Cache the headers
      headersCache.set(cacheKey, {
        value: headers,
        expires: now + fullConfig.ttl,
        lastAccessed: now,
      });

      // Evict LRU entries if needed
      evictLRUEntries();

      // Clone the headers to avoid mutation issues
      const clonedHeaders = new Headers();
      for (const [key, value] of headers.entries()) {
        clonedHeaders.set(key, value);
      }

      return clonedHeaders;
    },

    /**
     * Clear the transformation cache
     */
    clearCache(): void {
      transformationCache.clear();
      headersCache.clear();

      debug('TransformationCacheService', 'Cache cleared', {
        transformationCacheSize: transformationCache.size,
        headersCacheSize: headersCache.size,
      });
    },

    /**
     * Get cache statistics
     */
    getCacheStats(): {
      size: number;
      hits: number;
      misses: number;
      headerCacheSize: number;
      headerCacheHits: number;
      headerCacheMisses: number;
    } {
      return {
        size: transformationCache.size,
        hits: cacheHits,
        misses: cacheMisses,
        headerCacheSize: headersCache.size,
        headerCacheHits: headerCacheHits,
        headerCacheMisses: headerCacheMisses,
      };
    },
  };
}
