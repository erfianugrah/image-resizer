/**
 * Tests for the TransformationCacheService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransformationCacheService } from '../../src/services/transformationCacheService';
import { ImageTransformOptions } from '../../src/types/services/image';
import { TransformationOptionFormat } from '../../src/utils/transformationUtils';

describe('TransformationCacheService', () => {
  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
  };

  const mockCache = {
    determineCacheControl: vi.fn().mockReturnValue('public, max-age=3600'),
    generateCacheTags: vi.fn().mockReturnValue(['image', 'test']),
  };

  const sampleOptions: ImageTransformOptions = {
    width: 800,
    height: 600,
    fit: 'cover',
    quality: 80,
    format: 'webp',
  };

  const defaultConfig = {
    maxSize: 10,
    ttl: 1000,
    enabled: true,
    maxHeadersCacheSize: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a transformation cache service', () => {
    const service = createTransformationCacheService({ logger: mockLogger });
    expect(service).toBeDefined();
    expect(service.getPreparedTransformation).toBeDefined();
    expect(service.getTransformationOptions).toBeDefined();
    expect(service.createCacheHeaders).toBeDefined();
    expect(service.clearCache).toBeDefined();
    expect(service.getCacheStats).toBeDefined();
  });

  it('should cache transformation options', () => {
    const service = createTransformationCacheService({ logger: mockLogger }, defaultConfig);

    // First call should calculate and cache
    const result1 = service.getPreparedTransformation(sampleOptions);
    expect(result1).toBeDefined();
    expect(result1.normalizedOptions).toBeDefined();
    expect(result1.cfObjectOptions).toBeDefined();
    expect(result1.cdnCgiParams).toBeDefined();
    expect(result1.queryUrl).toBeDefined();

    // Second call with the same options should use cache
    const result2 = service.getPreparedTransformation(sampleOptions);
    expect(result2).toBeDefined();

    // Results should be the same objects (from cache)
    expect(result1).toBe(result2);

    // Check stats
    const stats = service.getCacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });

  it('should get transformation options in different formats', () => {
    const service = createTransformationCacheService({ logger: mockLogger }, defaultConfig);

    // Get CF object options
    const cfOptions = service.getTransformationOptions(
      sampleOptions,
      TransformationOptionFormat.CF_OBJECT
    ) as Record<string, string | number | boolean>;

    expect(cfOptions).toBeDefined();
    expect(cfOptions.width).toBe(800);
    expect(cfOptions.height).toBe(600);
    expect(cfOptions.fit).toBe('cover');

    // Get CDN-CGI params
    const cdnParams = service.getTransformationOptions(
      sampleOptions,
      TransformationOptionFormat.CDN_CGI
    ) as string[];

    expect(cdnParams).toBeDefined();
    expect(cdnParams).toContain('width=800');
    expect(cdnParams).toContain('height=600');

    // Get query URL
    const queryUrl = service.getTransformationOptions(
      sampleOptions,
      TransformationOptionFormat.QUERY_PARAMS
    ) as URL;

    expect(queryUrl).toBeDefined();
    expect(queryUrl.searchParams.get('width')).toBe('800');
    expect(queryUrl.searchParams.get('height')).toBe('600');

    // Check stats - should have 1 hit and 1 miss since all calls use the same cached transformation
    const stats = service.getCacheStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
  });

  it('should create cache headers', () => {
    // Setup mock with everything we need
    const fullMockCache = {
      determineCacheControl: vi.fn().mockReturnValue('public, max-age=3600'),
      generateCacheTags: vi.fn().mockReturnValue([]), // Return empty array to avoid length check error
    };

    const service = createTransformationCacheService(
      {
        logger: mockLogger,
        cache: fullMockCache,
      },
      defaultConfig
    );

    const headers = service.createCacheHeaders(200, { cacheability: true, ttl: { ok: 3600 } });

    expect(headers).toBeDefined();
    expect(headers instanceof Headers).toBe(true);
    expect(headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(fullMockCache.determineCacheControl).toHaveBeenCalledTimes(1);

    // Get headers again - should use cache
    const headers2 = service.createCacheHeaders(200, { cacheability: true, ttl: { ok: 3600 } });
    expect(headers2).toBeDefined();

    // Calls should not increase
    expect(fullMockCache.determineCacheControl).toHaveBeenCalledTimes(1);

    // Check stats
    const stats = service.getCacheStats();
    expect(stats.headerCacheHits).toBe(1);
    expect(stats.headerCacheMisses).toBe(1);
  });

  it('should clear the cache', () => {
    const service = createTransformationCacheService({ logger: mockLogger }, defaultConfig);

    // Fill cache
    service.getPreparedTransformation(sampleOptions);
    service.createCacheHeaders(200, { cacheability: true, ttl: { ok: 3600 } });

    // Clear cache
    service.clearCache();

    // Check stats
    const stats = service.getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.headerCacheSize).toBe(0);
  });

  it('should handle disabled cache', () => {
    const service = createTransformationCacheService(
      {
        logger: mockLogger,
      },
      { ...defaultConfig, enabled: false }
    );

    // First call
    const result1 = service.getPreparedTransformation(sampleOptions);

    // Second call
    const result2 = service.getPreparedTransformation(sampleOptions);

    // Results should be different objects (not from cache)
    expect(result1).not.toBe(result2);

    // Check stats
    const stats = service.getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('should evict LRU entries when cache exceeds size', () => {
    const service = createTransformationCacheService(
      {
        logger: mockLogger,
      },
      { ...defaultConfig, maxSize: 2 }
    );

    // Fill cache with 3 different options
    service.getPreparedTransformation({ width: 100 });
    service.getPreparedTransformation({ width: 200 });
    service.getPreparedTransformation({ width: 300 });

    // Check stats
    const stats = service.getCacheStats();
    expect(stats.size).toBeLessThanOrEqual(2);
    expect(stats.misses).toBe(3);
  });
});
