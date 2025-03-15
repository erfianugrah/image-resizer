/**
 * Utilities for cache control headers and tags
 */

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  ttl?: {
    ok?: number;
    redirects?: number;
    clientError?: number;
    serverError?: number;
    [key: string]: number | undefined;
  };
  [key: string]: unknown;
}

// Create a type that includes Record<string, unknown> to fix index signature issues
export type CacheConfigRecord = CacheConfig & Record<string, unknown>;

/**
 * Determine cache control header based on response status
 * @param status - HTTP status code
 * @param cache - Cache configuration
 * @returns Cache-Control header value
 */
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

  return ttl ? `public, max-age=${ttl}` : '';
}

/**
 * Generate cache tag list for the image
 * @param bucketName - Origin bucket name
 * @param derivative - Derivative type
 * @returns Array of cache tags
 */
export function generateCacheTags(bucketName?: string, derivative?: string | null): string[] {
  const tags: string[] = ['image'];

  if (bucketName) {
    tags.push(`bucket:${bucketName}`);
  }

  if (derivative) {
    tags.push(`derivative:${derivative}`);
  }

  return tags;
}
