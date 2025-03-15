/**
 * Cache configuration utility functions
 */

import { debug } from './loggerUtils';

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
  };
}

// Default cache configuration
const defaultCacheConfig: CacheConfig = {
  cacheability: true,
  ttl: {
    ok: 86400, // 1 day for successful responses
    redirects: 86400, // 1 day for redirects
    clientError: 60, // 1 minute for client errors
    serverError: 0, // No caching for server errors
  },
};

/**
 * Determine cache configuration for a URL
 * @param url URL to determine cache configuration for
 * @returns Cache configuration
 */
export async function determineCacheConfig(url: string): Promise<CacheConfig> {
  try {
    // We'll eventually import config from the environment
    // For now, just return the default config
    const { imageConfig } = await import('../config/imageConfig');

    if (imageConfig && imageConfig.caching) {
      const config = { ...defaultCacheConfig };

      if (imageConfig.caching.ttl) {
        config.ttl = {
          ...config.ttl,
          ...imageConfig.caching.ttl,
        };
      }

      if (imageConfig.caching.imageCompression) {
        config.imageCompression = imageConfig.caching.imageCompression;
      }

      if (imageConfig.caching.mirage !== undefined) {
        config.mirage = imageConfig.caching.mirage;
      }

      // Check if the URL matches any regex in the cache config
      if (imageConfig.cacheConfig) {
        // Eventually implement URL-specific cache configuration
      }

      debug('CacheUtils', 'Determined cache config', { url, config });
      return config;
    }

    return defaultCacheConfig;
  } catch (err) {
    debug('CacheUtils', 'Error determining cache config', {
      error: err instanceof Error ? err.message : 'Unknown error',
      url,
    });
    return defaultCacheConfig;
  }
}
