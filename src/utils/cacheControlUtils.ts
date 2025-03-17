/**
 * Utilities for cache control headers and tags
 *
 * This file is deprecated. Use cacheUtils instead.
 * This file is maintained for backward compatibility only.
 */

import {
  CacheConfig as CacheConfigType,
  CacheConfigRecord as CacheConfigRecordType,
  determineCacheControl as determineCacheControlImpl,
  generateCacheTags as generateCacheTagsImpl,
} from './cacheUtils';

// Re-export types for backward compatibility
export type CacheConfig = CacheConfigType;
export type CacheConfigRecord = CacheConfigRecordType;

/**
 * @deprecated Use determineCacheControl from cacheUtils instead
 */
export function determineCacheControl(status: number, cache?: CacheConfig): string {
  return determineCacheControlImpl(status, cache);
}

/**
 * @deprecated Use generateCacheTags from cacheUtils instead
 */
export function generateCacheTags(bucketName?: string, derivative?: string | null): string[] {
  return generateCacheTagsImpl(bucketName, derivative);
}
