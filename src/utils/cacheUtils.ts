/**
 * Centralized cache utilities
 * Provides a unified caching interface for the application
 */

import { debug } from './loggerUtils';

import { CacheConfig, CacheConfigRecord, UrlCacheConfig } from '../types/utils/cache';
import { IConfigManager } from '../types/core/config';

// Re-export types for backward compatibility
export type { CacheConfig, CacheConfigRecord, UrlCacheConfig };

// Interface definitions moved to types/utils/cache.ts

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
    // Import configuration from the environment via ServiceRegistry or ConfigManager
    const { createLogger } = await import('../core/logger');
    const { ServiceRegistry } = await import('../core/serviceRegistry');
    const logger = createLogger('CacheUtils');

    // Use the global ServiceRegistry to get the ConfigManager singleton instance
    let configManager;
    let appConfig;

    try {
      const registry = ServiceRegistry.getInstance();
      configManager = registry.resolve<IConfigManager>('IConfigManager');
      appConfig = configManager.getConfig();
    } catch (error) {
      // Fallback to creating a new instance if service registry fails
      logger.debug(
        'CacheUtils',
        'Failed to get IConfigManager from ServiceRegistry, falling back',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );

      const { createConfigManager } = await import('../config/configManager');
      configManager = createConfigManager({ logger });
      appConfig = configManager.getConfig();
    }

    // Get current environment for comparison
    const currentEnv = (globalThis as any).process?.env || {};

    // Debug log to see what's coming from the environment
    logger.debug('CacheUtils', '🔍 DIAGNOSTICS - Environment config loaded', {
      environment: appConfig.environment,
      cacheMethod: appConfig.cache?.method || 'not-set',
      envVarCacheMethod: currentEnv.CACHE_METHOD || 'env-not-available',
      configSource: 'ServiceRegistry -> IConfigManager -> getConfig()',
      url,
      config_cache_json: JSON.stringify(appConfig.cache),
    });

    // Check for missing critical configuration and log warnings
    const missingConfig = [];
    if (!appConfig.cache?.method) missingConfig.push('CACHE_METHOD');
    if (!appConfig.derivatives || Object.keys(appConfig.derivatives).length === 0)
      missingConfig.push('DERIVATIVE_TEMPLATES');
    if (!appConfig.responsive?.availableWidths?.length) missingConfig.push('RESPONSIVE_CONFIG');
    if (!appConfig.defaults?.quality) missingConfig.push('defaults (quality, fit, etc.)');

    if (missingConfig.length > 0) {
      logger.debug('CacheUtils', '⚠️ Missing environment configuration detected', {
        missingValues: missingConfig,
        environment: appConfig.environment,
        source: 'wrangler.jsonc environment variables',
        url,
      });
    }

    // Import image config (for structure only)
    const { imageConfig } = await import('../config/imageConfig');
    const { createErrorFactory } = await import('../types/utils/errors');
    const _errorFactory = createErrorFactory();

    // Start with default configuration
    const config = { ...defaultCacheConfig };

    // Always prioritize environment config (from wrangler.jsonc) as the source of truth
    // Only use imageConfig as a fallback for default values

    // Apply global cache settings from the ConfigManager
    if (appConfig.cache) {
      // Apply TTL settings
      if (appConfig.cache.ttl) {
        config.ttl = {
          ...config.ttl,
          ...appConfig.cache.ttl,
        };
      }

      // Apply image compression settings
      if (appConfig.cache.imageCompression) {
        config.imageCompression = appConfig.cache.imageCompression;
      }

      // Apply Mirage settings
      if (appConfig.cache.mirage !== undefined) {
        config.mirage = appConfig.cache.mirage;
      }

      // Apply caching method from environment
      if (appConfig.cache.method) {
        // Always respect the configured cache method, don't force override
        config.method = appConfig.cache.method;

        logger.debug('CacheUtils', '🔧 Applied cache method from environment', {
          method: config.method,
          environment: appConfig.environment,
          configSource: appConfig.configSource || 'unknown',
          url,
          cache_method_source: 'appConfig.cache.method',
        });
      } else if ((appConfig as any).caching?.method) {
        // Fallback to legacy property path
        config.method = (appConfig as any).caching.method;

        logger.debug('CacheUtils', '🔧 Applied cache method from legacy property path', {
          method: config.method,
          environment: appConfig.environment,
          configSource: appConfig.configSource || 'unknown',
          url,
          cache_method_source: 'appConfig.caching.method',
        });
      }
    }

    // Log a warning if imageConfig.caching.method is being used instead of environment config
    // This helps identify configuration inconsistencies without forcing any values
    if (imageConfig.caching?.method && !config.method) {
      logger.debug('CacheUtils', '⚠️ Environment config missing for cache method', {
        imageConfigMethod: imageConfig.caching?.method || 'not-set',
        envConfigMethod: config.method || 'not-set',
        url,
        configSource: 'Should come from CACHE_METHOD in wrangler.jsonc',
      });
    }

    // Apply URL-specific cache configuration if available
    if (imageConfig.cacheConfig && Array.isArray(imageConfig.cacheConfig)) {
      // Filter configs that match the URL
      const matchingConfigs = imageConfig.cacheConfig
        .filter((urlConfig) => urlConfig.pattern && new RegExp(urlConfig.pattern).test(url))
        .sort((a, b) => {
          // Sort by specificity - longer patterns are more specific
          const aSpecificity = a.pattern?.length || 0;
          const bSpecificity = b.pattern?.length || 0;
          return bSpecificity - aSpecificity;
        });

      // Apply the most specific matching configuration
      if (matchingConfigs.length > 0) {
        const urlConfig = matchingConfigs[0];

        debug('CacheUtils', 'URL-specific cache config applied', {
          url,
          pattern: urlConfig.pattern,
          specificity: urlConfig.pattern?.length || 0,
        });

        // Override with URL-specific TTL settings
        if (urlConfig.ttl) {
          config.ttl = { ...config.ttl, ...urlConfig.ttl };
        }

        // Override cacheability setting
        if (urlConfig.cacheability !== undefined) {
          config.cacheability = urlConfig.cacheability;
        }

        // Apply content-type specific settings if available
        if (urlConfig.contentTypes && typeof urlConfig.contentTypes === 'object') {
          const urlObj = new URL(url);
          const extension = urlObj.pathname.split('.').pop()?.toLowerCase();

          if (extension) {
            // Map extension to content type
            const contentTypeMap: Record<string, string> = {
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              gif: 'image/gif',
              webp: 'image/webp',
              svg: 'image/svg+xml',
              avif: 'image/avif',
            };

            const contentType = contentTypeMap[extension];
            if (contentType && urlConfig.contentTypes[contentType]) {
              const contentTypeConfig = urlConfig.contentTypes[contentType];

              debug('CacheUtils', 'Content-type specific cache config applied', {
                url,
                contentType,
                extension,
              });

              // Apply content-type specific TTL
              if (contentTypeConfig.ttl) {
                config.ttl = { ...config.ttl, ...contentTypeConfig.ttl };
              }

              // Apply content-type specific cacheability
              if (contentTypeConfig.cacheability !== undefined) {
                config.cacheability = contentTypeConfig.cacheability;
              }
            }
          }
        }
      }
    }

    // Apply derivative-specific cache configuration if available
    const urlObj = new URL(url);
    const derivative = urlObj.searchParams.get('derivative');

    if (derivative && imageConfig.derivatives && imageConfig.derivatives[derivative]) {
      const derivativeConfig = imageConfig.derivatives[derivative];

      // Check if the derivative has cache-specific settings
      if (derivativeConfig.cache && typeof derivativeConfig.cache === 'object') {
        debug('CacheUtils', 'Derivative-specific cache config applied', {
          url,
          derivative,
        });

        const cacheConfig = derivativeConfig.cache as Record<string, unknown>;

        // Apply derivative-specific TTL
        if (cacheConfig.ttl && typeof cacheConfig.ttl === 'object') {
          config.ttl = {
            ...config.ttl,
            ...(cacheConfig.ttl as Record<string, number>),
          };
        }

        // Apply derivative-specific cacheability
        if (typeof cacheConfig.cacheability === 'boolean') {
          config.cacheability = cacheConfig.cacheability;
        }
      }
    }

    logger.debug('CacheUtils', 'Final cache config determined', {
      url,
      final_method: config.method,
      original_method: appConfig.cache?.method || (appConfig as any).caching?.method || 'unknown',
      environment: appConfig.environment,
      config: JSON.stringify(config),
    });

    return config;
  } catch (err) {
    debug('CacheUtils', 'Error determining cache config', {
      error: err instanceof Error ? err.message : 'Unknown error',
      url,
    });
    return defaultCacheConfig;
  }
}

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

  if (!cache.cacheability || ttl === 0) {
    return 'no-store';
  }

  return ttl ? `public, max-age=${ttl}` : '';
}

/**
 * Generate cache tag list for the image
 * @param bucketName - Origin bucket name or source
 * @param derivative - Derivative type
 * @returns Array of cache tags
 */
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

/**
 * Cache key builder function
 * @param request - The request to build a cache key for
 * @returns Cache key string
 */
export function buildCacheKey(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
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
    cacheEverything: true,
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
    cfObject.cacheTags = generateCacheTags(source, derivative);
  }

  return cfObject;
}
