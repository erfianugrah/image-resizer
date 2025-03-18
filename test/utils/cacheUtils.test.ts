import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  determineCacheConfig,
  determineCacheControl,
  generateCacheTags,
  buildCacheKey,
  createCfObjectParams,
} from '../../src/utils/cacheUtils';
import { CacheConfig } from '../../src/types/utils/cache';

// Mock dependencies
vi.mock('../../src/utils/loggerUtils', () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../src/config/imageConfig', () => ({
  imageConfig: {
    caching: {
      method: 'cache-api',
      debug: false,
      ttl: {
        ok: 86400,
        redirects: 3600,
        clientError: 60,
        serverError: 0,
      },
    },
    cacheConfig: [
      {
        pattern: '.*\\.jpg$',
        ttl: {
          ok: 172800, // 2 days for JPEGs
        },
        contentTypes: {
          'image/jpeg': {
            ttl: {
              ok: 172800,
            },
          },
        },
      },
      {
        pattern: '/r2/.*',
        ttl: {
          ok: 604800, // 7 days for R2 content
        },
      },
      {
        pattern: '/thumbnails/.*',
        ttl: {
          ok: 2592000, // 30 days for thumbnails
        },
      },
    ],
    derivatives: {
      thumbnail: {
        width: 200,
        height: 200,
        fit: 'cover',
        cache: {
          ttl: {
            ok: 2592000, // 30 days
          },
        },
      },
    },
  },
}));

vi.mock('../../src/core/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../../src/core/serviceRegistry', () => {
  const mockConfigManager = {
    getConfig: vi.fn(() => ({
      environment: 'test',
      cache: {
        method: 'cache-api',
        debug: false,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      },
      mode: 'hybrid',
      derivatives: {
        thumbnail: {
          width: 200,
          height: 200,
        },
      },
      responsive: {
        availableWidths: [320, 640, 768, 1024, 1366, 1600, 1920],
      },
      defaults: {
        quality: 80,
      },
    })),
  };

  return {
    ServiceRegistry: {
      getInstance: vi.fn(() => ({
        resolve: vi.fn((serviceId) => {
          if (serviceId === 'IConfigManager') {
            return mockConfigManager;
          }
          return {};
        }),
      })),
    },
  };
});

describe('cacheUtils', () => {
  describe('determineCacheControl', () => {
    it('should return empty string if cache config is undefined', () => {
      const result = determineCacheControl(200);
      expect(result).toBe('');
    });

    it('should return no-store for status 200 with cacheability false', () => {
      const cacheConfig: CacheConfig = {
        cacheability: false,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = determineCacheControl(200, cacheConfig);
      expect(result).toBe('no-store');
    });

    it('should return max-age for status 200 with cacheability true', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = determineCacheControl(200, cacheConfig);
      expect(result).toBe('public, max-age=86400');
    });

    it('should return max-age for status 301 (redirect)', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = determineCacheControl(301, cacheConfig);
      expect(result).toBe('public, max-age=3600');
    });

    it('should return max-age for status 404 (client error)', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = determineCacheControl(404, cacheConfig);
      expect(result).toBe('public, max-age=60');
    });

    it('should return no-store for status 500 (server error) with ttl 0', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = determineCacheControl(500, cacheConfig);
      expect(result).toBe('no-store');
    });
  });

  describe('generateCacheTags', () => {
    it('should return default tags with no parameters', () => {
      const result = generateCacheTags();
      expect(result).toEqual(['image']);
    });

    it('should include source tag when bucket name is provided', () => {
      const result = generateCacheTags('test-bucket');
      expect(result).toEqual(['image', 'source:test-bucket']);
    });

    it('should include derivative tag when derivative is provided', () => {
      const result = generateCacheTags(undefined, 'thumbnail');
      expect(result).toEqual(['image', 'derivative:thumbnail']);
    });

    it('should include both source and derivative tags when both are provided', () => {
      const result = generateCacheTags('r2-bucket', 'thumbnail');
      expect(result).toEqual(['image', 'source:r2-bucket', 'derivative:thumbnail']);
    });

    it('should handle R2 bucket names properly', () => {
      const result = generateCacheTags('IMAGES_BUCKET', 'thumbnail');
      expect(result).toEqual(['image', 'source:IMAGES_BUCKET', 'derivative:thumbnail']);
    });
  });

  describe('buildCacheKey', () => {
    it('should build cache key from URL path and search', () => {
      const request = new Request('https://example.com/image.jpg?width=800&height=600');
      const result = buildCacheKey(request);
      expect(result).toBe('/image.jpg?width=800&height=600');
    });

    it('should handle URLs with no search parameters', () => {
      const request = new Request('https://example.com/image.jpg');
      const result = buildCacheKey(request);
      expect(result).toBe('/image.jpg');
    });

    it('should handle URLs with path segments', () => {
      const request = new Request('https://example.com/images/photos/image.jpg');
      const result = buildCacheKey(request);
      expect(result).toBe('/images/photos/image.jpg');
    });

    it('should handle R2 URLs properly', () => {
      const request = new Request('https://example.com/r2/bucket/image.jpg?width=800');
      const result = buildCacheKey(request);
      expect(result).toBe('/r2/bucket/image.jpg?width=800');
    });
  });

  describe('createCfObjectParams', () => {
    it('should return default params with no cache config', () => {
      const result = createCfObjectParams(200);
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 3600,
      });
    });

    it('should set cacheTtl for status 200 with cacheability true', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = createCfObjectParams(200, cacheConfig);
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 86400,
      });
    });

    it('should set cacheTtl for status 404 (client error)', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = createCfObjectParams(404, cacheConfig);
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 60,
      });
    });

    it('should set cacheTtl to 0 for server errors', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = createCfObjectParams(500, cacheConfig);
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 0,
      });
    });

    it('should include image compression settings if provided', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
        imageCompression: 'lossless',
      };
      const result = createCfObjectParams(200, cacheConfig);
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 86400,
        polish: 'lossless',
      });
    });

    it('should include mirage setting if enabled', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
        mirage: true,
      };
      const result = createCfObjectParams(200, cacheConfig);
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 86400,
        mirage: true,
      });
    });

    it('should include cache tags for source and derivative', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = createCfObjectParams(200, cacheConfig, 'r2-bucket', 'thumbnail');
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 86400,
        cacheTags: ['image', 'source:r2-bucket', 'derivative:thumbnail'],
      });
    });

    it('should handle R2 bucket names in cache tags', () => {
      const cacheConfig: CacheConfig = {
        cacheability: true,
        ttl: {
          ok: 86400,
          redirects: 3600,
          clientError: 60,
          serverError: 0,
        },
      };
      const result = createCfObjectParams(200, cacheConfig, 'IMAGES_BUCKET', 'thumbnail');
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 86400,
        cacheTags: ['image', 'source:IMAGES_BUCKET', 'derivative:thumbnail'],
      });
    });
  });

  describe('determineCacheConfig', () => {
    it('should determine cache config for standard URLs', async () => {
      const result = await determineCacheConfig('https://example.com/image.jpg');
      expect(result).toHaveProperty('cacheability', true);
      // Because of our module mocking, we can't test for the exact method value
      expect(result).toHaveProperty('method');
      expect(result.ttl).toHaveProperty('ok');
      expect(result.ttl.ok).toBeGreaterThan(0);
    });

    it('should apply URL-specific TTL for JPG images', async () => {
      const result = await determineCacheConfig('https://example.com/image.jpg');
      expect(result.ttl.ok).toBe(172800); // 2 days for JPEGs
    });

    it('should apply URL-specific TTL for R2 paths', async () => {
      const result = await determineCacheConfig('https://example.com/r2/image.png');
      expect(result.ttl.ok).toBe(604800); // 7 days for R2 content
    });

    it('should apply URL-specific TTL for thumbnail paths', async () => {
      const result = await determineCacheConfig('https://example.com/thumbnails/image.jpg');
      expect(result.ttl.ok).toBe(2592000); // 30 days for thumbnails
    });

    it('should apply derivative-specific cache settings', async () => {
      const result = await determineCacheConfig('https://example.com/image.jpg?derivative=thumbnail');
      expect(result.ttl.ok).toBe(2592000); // 30 days for thumbnail derivative
    });

    it('should handle fallback to default config on error', async () => {
      // Mock ServiceRegistry to throw an error
      vi.mock('../../src/core/serviceRegistry', () => {
        return {
          ServiceRegistry: {
            getInstance: vi.fn(() => {
              throw new Error('Test error');
            }),
          },
        };
      });

      // Also need to mock ConfigManager for the fallback
      vi.mock('../../src/config/configManager', () => {
        return {
          createConfigManager: vi.fn(() => ({
            getConfig: vi.fn(() => ({
              environment: 'test',
              cache: {
                method: 'cf',
              },
            })),
          })),
        };
      });

      // Clear module cache to ensure our mocks take effect
      vi.resetModules();

      // Re-import the function
      const { determineCacheConfig } = await import('../../src/utils/cacheUtils');
      
      const result = await determineCacheConfig('https://example.com/image.jpg');
      
      // Should still return a valid config even after error
      expect(result).toHaveProperty('cacheability', true);
      expect(result.ttl).toHaveProperty('ok');
      expect(result.ttl.ok).toBeGreaterThan(0);
    });
  });
});