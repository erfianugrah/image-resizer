import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCacheManagementService } from '../../src/services/cacheManagementService';
import { createCfObjectParams } from '../../src/utils/cacheUtils';

// Define mock types to avoid 'any'
interface CacheMock {
  match: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

// Logger mock
const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
};

// Utils mock
const mockUtils = {
  buildCacheKey: vi.fn().mockImplementation((req) => req.url),
  determineCacheControl: vi.fn().mockImplementation(() => 'public, max-age=86400'),
  generateCacheTags: vi.fn().mockImplementation(() => ['image', 'source:test']),
};

// Config mock for development environment
const mockDevConfig = {
  getConfig: vi.fn().mockImplementation(() => ({
    caching: {
      method: 'cache-api',
    },
    environment: 'development',
  })),
};

// Config mock for production environment
const mockProdConfig = {
  getConfig: vi.fn().mockImplementation(() => ({
    caching: {
      method: 'cf',
    },
    environment: 'production',
  })),
};

// Mock global caches object
vi.stubGlobal('caches', {
  default: {
    match: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
});

describe('CacheManagementService', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let cacheService: ReturnType<typeof createCacheManagementService>;

  beforeEach(() => {
    mockRequest = new Request('https://example.com/test.jpg');
    mockResponse = new Response('Test image data', {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });

    // Reset mocks
    vi.resetAllMocks();
    mockLogger.debug.mockReset();
    mockLogger.error.mockReset();
    mockUtils.buildCacheKey.mockReset();
    mockUtils.determineCacheControl.mockReset();
    mockUtils.generateCacheTags.mockReset();
    (caches.default.match as unknown as ReturnType<typeof vi.fn>).mockReset();
    (caches.default.put as unknown as ReturnType<typeof vi.fn>).mockReset();

    // Setup default mock implementations
    mockUtils.buildCacheKey.mockImplementation((req) => req.url);
    mockUtils.determineCacheControl.mockImplementation(() => 'public, max-age=86400');
    mockUtils.generateCacheTags.mockImplementation(() => ['image', 'source:test']);

    // Fix for Response objects in tests - use mockResolvedValue for match
    (caches.default.match as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
    // Fix for put operation - default to success
    (caches.default.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // Create service instance for development environment
    cacheService = createCacheManagementService({
      logger: mockLogger,
      config: mockDevConfig,
      utils: mockUtils,
    });
  });

  describe('getCachedResponse', () => {
    it('should return cached response when available', async () => {
      // Create a fresh service with fresh mocks to avoid any shared state
      const freshMockLogger = { debug: vi.fn(), error: vi.fn() };
      const freshMatchMock = vi.fn().mockResolvedValue(mockResponse);

      // Create mock cache with controlled match function
      const freshCachesMock = {
        default: {
          match: freshMatchMock,
          put: vi.fn(),
        },
      };

      // Store global caches
      const originalCaches = global.caches;

      // Replace global caches for this test
      global.caches = freshCachesMock as any;

      const testService = createCacheManagementService({
        logger: freshMockLogger,
        config: {
          getConfig: vi.fn().mockReturnValue({
            environment: 'development',
            caching: { method: 'cache-api' },
          }),
        },
        utils: mockUtils,
      });

      try {
        // Act
        const result = await testService.getCachedResponse(mockRequest);

        // Assert
        expect(result).toBe(mockResponse);
        expect(freshMatchMock).toHaveBeenCalledWith(mockRequest);
      } finally {
        // Restore global caches
        global.caches = originalCaches;
      }
    });

    it('should return null when no cached response is found', async () => {
      // Create a fresh service with fresh mocks to avoid any shared state
      const freshMockLogger = { debug: vi.fn(), error: vi.fn() };
      const freshMatchMock = vi.fn().mockResolvedValue(null);

      // Create mock cache with controlled match function
      const freshCachesMock = {
        default: {
          match: freshMatchMock,
          put: vi.fn(),
        },
      };

      // Store global caches
      const originalCaches = global.caches;

      // Replace global caches for this test
      global.caches = freshCachesMock as any;

      const testService = createCacheManagementService({
        logger: freshMockLogger,
        config: {
          getConfig: vi.fn().mockReturnValue({
            environment: 'development',
            caching: { method: 'cache-api' },
          }),
        },
        utils: mockUtils,
      });

      try {
        // Act
        const result = await testService.getCachedResponse(mockRequest);

        // Assert
        expect(result).toBeNull();
        expect(freshMatchMock).toHaveBeenCalledWith(mockRequest);
        expect(freshMockLogger.debug).toHaveBeenCalledWith(
          'CacheManagementService',
          'Cache miss',
          expect.any(Object)
        );
      } finally {
        // Restore global caches
        global.caches = originalCaches;
      }
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (caches.default.match as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cache error')
      );

      // Act
      const result = await cacheService.getCachedResponse(mockRequest);

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CacheManagementService',
        'Error retrieving from cache',
        expect.any(Object)
      );
    });

    it('should use environment-specific caching method in production', async () => {
      // Arrange - Create a production service with fresh mocks
      const mockProdLogger = { debug: vi.fn(), error: vi.fn() };

      const prodCacheService = createCacheManagementService({
        logger: mockProdLogger,
        config: {
          getConfig: vi.fn().mockReturnValue({
            environment: 'production',
            caching: { method: 'cf' },
          }),
        },
        utils: mockUtils,
      });

      // Act - Production should not use Cache API
      await prodCacheService.getCachedResponse(mockRequest);

      // Assert debug was called with production method
      expect(mockProdLogger.debug).toHaveBeenCalledWith(
        'CacheManagementService',
        'Cache method determined',
        expect.objectContaining({ method: 'cf' })
      );
    });

    it('should use configured caching method in development', async () => {
      // Arrange - Create a development service with fresh mocks
      const mockDevLogger = { debug: vi.fn(), error: vi.fn() };

      // Create mock cache with controlled match function
      const freshMatchMock = vi.fn().mockResolvedValue(null);
      const freshCachesMock = {
        default: {
          match: freshMatchMock,
          put: vi.fn(),
        },
      };

      // Store global caches
      const originalCaches = global.caches;

      // Replace global caches for this test
      global.caches = freshCachesMock as any;

      const devCacheService = createCacheManagementService({
        logger: mockDevLogger,
        config: {
          getConfig: vi.fn().mockReturnValue({
            environment: 'development',
            caching: { method: 'cache-api' },
          }),
        },
        utils: mockUtils,
      });

      try {
        // Act - Development should use Cache API
        await devCacheService.getCachedResponse(mockRequest);

        // Assert debug was called with development method
        expect(mockDevLogger.debug).toHaveBeenCalledWith(
          'CacheManagementService',
          'Cache method determined',
          expect.objectContaining({ method: 'cache-api' })
        );

        // Also verify Cache API is called for 'cache-api' method
        expect(freshMatchMock).toHaveBeenCalledWith(mockRequest);
      } finally {
        // Restore global caches
        global.caches = originalCaches;
      }
    });
  });

  describe('cacheResponse', () => {
    it('should store response in cache if cacheable using cache-api in development', async () => {
      // Arrange with fresh mocks and dev configuration
      const mockDevLogger = { debug: vi.fn(), error: vi.fn() };
      const mockDevCacheService = createCacheManagementService({
        logger: mockDevLogger,
        config: {
          getConfig: vi.fn().mockReturnValue({
            environment: 'development',
            caching: { method: 'cache-api' },
          }),
        },
        utils: mockUtils,
      });

      // Setup cache.put mock to succeed
      (caches.default.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Act
      const result = await mockDevCacheService.cacheResponse(mockRequest, mockResponse);

      // Assert
      expect(result).toBe(true);
      expect(caches.default.put).toHaveBeenCalledWith(mockRequest, expect.any(Response));
      expect(mockDevLogger.debug).toHaveBeenCalledWith(
        'CacheManagementService',
        'Cache method for caching response',
        expect.objectContaining({ method: 'cache-api' })
      );
    });

    it('should return true for cacheable responses in production but not use Cache API', async () => {
      // Arrange - Create a production service with fresh mocks
      const mockProdLogger = { debug: vi.fn(), error: vi.fn() };
      const prodCacheService = createCacheManagementService({
        logger: mockProdLogger,
        config: {
          getConfig: vi.fn().mockReturnValue({
            environment: 'production',
            caching: { method: 'cf' },
          }),
        },
        utils: mockUtils,
      });

      // Reset cache API mock
      (caches.default.put as unknown as ReturnType<typeof vi.fn>).mockClear();

      // Act
      const result = await prodCacheService.cacheResponse(mockRequest, mockResponse);

      // Assert
      expect(result).toBe(true);
      // In production mode with 'cf' method, we should NOT call cache.put
      expect(caches.default.put).not.toHaveBeenCalled();
      expect(mockProdLogger.debug).toHaveBeenCalledWith(
        'CacheManagementService',
        'Cache method for caching response',
        expect.objectContaining({ method: 'cf' })
      );
    });

    it('should not cache responses with no-store Cache-Control', async () => {
      // Arrange
      const nonCacheableResponse = new Response('Test data', {
        headers: { 'Cache-Control': 'no-store' },
      });
      mockLogger.debug.mockReset();

      // Act
      const result = await cacheService.cacheResponse(mockRequest, nonCacheableResponse);

      // Assert
      expect(result).toBe(false);
      expect(caches.default.put).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CacheManagementService',
        'Skipping cache for non-cacheable response',
        expect.any(Object)
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (caches.default.put as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Cache error')
      );

      // Act
      const result = await cacheService.cacheResponse(mockRequest, mockResponse);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CacheManagementService',
        'Error storing in cache',
        expect.any(Object)
      );
    });
  });

  describe('applyCacheHeaders', () => {
    it('should apply correct cache headers for successful responses', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
      };
      mockUtils.determineCacheControl.mockReturnValue('public, max-age=3600');
      mockUtils.generateCacheTags.mockReturnValue([
        'image',
        'source:test-source',
        'derivative:thumbnail',
      ]);

      // Act
      const result = cacheService.applyCacheHeaders(
        mockResponse,
        200,
        cacheConfig,
        'test-source',
        'thumbnail'
      );

      // Assert
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(result.headers.get('Cache-Tag')).toBe('image,source:test-source,derivative:thumbnail');
      expect(mockUtils.determineCacheControl).toHaveBeenCalledWith(200, cacheConfig);
      expect(mockUtils.generateCacheTags).toHaveBeenCalledWith('test-source', 'thumbnail');
    });

    it('should apply different cache headers for error responses', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
      };
      mockUtils.determineCacheControl.mockReturnValue('public, max-age=60');
      mockUtils.generateCacheTags.mockReturnValue([
        'image',
        'source:test-source',
        'derivative:thumbnail',
      ]);

      // Act
      const result = cacheService.applyCacheHeaders(
        mockResponse,
        404,
        cacheConfig,
        'test-source',
        'thumbnail'
      );

      // Assert
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=60');
      expect(result.headers.get('Cache-Tag')).toBe('image,source:test-source,derivative:thumbnail');
      expect(mockUtils.determineCacheControl).toHaveBeenCalledWith(404, cacheConfig);
    });

    it('should return enhanced response with no additional headers if no cache config provided', () => {
      // Reset mocks
      mockUtils.determineCacheControl.mockReset();
      mockUtils.generateCacheTags.mockReset();

      // Create a fresh response to avoid reference issues
      const testResponse = new Response('Test data', {
        headers: { 'X-Test': 'value' },
      });

      // Create a fresh service that returns a new Response object
      const serviceMock = createCacheManagementService({
        logger: { debug: vi.fn(), error: vi.fn() },
        config: { getConfig: vi.fn() },
        utils: {
          determineCacheControl: vi.fn(),
          generateCacheTags: vi.fn(),
          buildCacheKey: vi.fn(),
        },
      });

      // Act
      const result = serviceMock.applyCacheHeaders(testResponse, 200);

      // Assert that headers were copied instead of checking object identity
      expect(result.headers.get('X-Test')).toBe('value'); // Headers should be copied
      expect(result.status).toBe(testResponse.status); // Status should be the same
      expect(result.headers.get('Cache-Control')).toBeNull();
      expect(result.headers.get('Cache-Tag')).toBeNull();
    });

    it('should handle errors gracefully and return original response', () => {
      // Arrange - Make the utility throw an error
      mockUtils.determineCacheControl.mockImplementation(() => {
        throw new Error('Test error');
      });

      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
      };

      // Act
      const result = cacheService.applyCacheHeaders(mockResponse, 200, cacheConfig);

      // Assert
      expect(result).toBe(mockResponse); // Should return original on error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CacheManagementService',
        'Error applying cache headers',
        expect.any(Object)
      );
    });
  });

  describe('generateCacheTags', () => {
    it('should generate correct cache tags', () => {
      // Arrange
      mockUtils.generateCacheTags.mockReturnValue([
        'image',
        'source:test-source',
        'derivative:thumbnail',
      ]);

      // Act
      const result = cacheService.generateCacheTags('test-source', 'thumbnail');

      // Assert
      expect(result).toEqual(['image', 'source:test-source', 'derivative:thumbnail']);
      expect(mockUtils.generateCacheTags).toHaveBeenCalledWith('test-source', 'thumbnail');
    });

    it('should handle missing parameters', () => {
      // Arrange
      mockUtils.generateCacheTags.mockReturnValue(['image']);

      // Act
      const result = cacheService.generateCacheTags();

      // Assert
      expect(result).toEqual(['image']);
      expect(mockUtils.generateCacheTags).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('createCfObjectParams utility', () => {
    it('should create correct CF object parameters for successful responses', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
        imageCompression: 'lossy',
        mirage: true,
      };

      // Act
      const result = createCfObjectParams(200, cacheConfig, 'test-source', 'thumbnail');

      // Assert
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 3600,
        polish: 'lossy',
        mirage: true,
        cacheTags: expect.any(Array),
      });
    });

    it('should set cacheTtl to 0 for non-cacheable configs', () => {
      // Arrange
      const cacheConfig = {
        cacheability: false,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
      };

      // Act
      const result = createCfObjectParams(200, cacheConfig);

      // Assert
      expect(result.cacheTtl).toBe(0);
    });

    it('should use different TTLs based on status code', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
      };

      // Act - Test redirect status
      const redirectResult = createCfObjectParams(302, cacheConfig);

      // Assert
      expect(redirectResult.cacheTtl).toBe(1800);

      // Act - Test client error status
      const clientErrorResult = createCfObjectParams(404, cacheConfig);

      // Assert
      expect(clientErrorResult.cacheTtl).toBe(60);

      // Act - Test server error status
      const serverErrorResult = createCfObjectParams(500, cacheConfig);

      // Assert
      expect(serverErrorResult.cacheTtl).toBe(0);
    });

    it('should use default TTL if no cache config provided', () => {
      // Act
      const result = createCfObjectParams(200);

      // Assert
      expect(result.cacheTtl).toBe(3600); // Default 1 hour
    });

    it('should apply cache tags when source and derivative are provided', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0,
        },
      };

      // Act
      const result = createCfObjectParams(200, cacheConfig, 'test-bucket', 'thumbnail');

      // Assert
      expect(result.cacheTags).toEqual(expect.any(Array));
      expect(Array.isArray(result.cacheTags)).toBe(true);
      expect((result.cacheTags as string[]).includes('source:test-bucket')).toBe(true);
      expect((result.cacheTags as string[]).includes('derivative:thumbnail')).toBe(true);
    });
  });
});
