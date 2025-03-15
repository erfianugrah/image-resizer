import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getCachedResponse, 
  cacheResponse, 
  applyCacheHeaders, 
  createCfObjectParams 
} from '../../src/services/cacheManagementService';

// Mock imageConfig
vi.mock('../../src/config/imageConfig', () => ({
  imageConfig: {
    caching: {
      method: 'cache-api',
      debug: false,
      ttl: {
        ok: 86400,
        redirects: 86400,
        clientError: 60,
        serverError: 0
      }
    }
  }
}));

vi.mock('../../src/utils/loggerUtils', async () => ({
  debug: vi.fn(),
  error: vi.fn()
}));

describe('CacheManagementService', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  
  beforeEach(() => {
    mockRequest = new Request('https://example.com/test.jpg');
    mockResponse = new Response('Test image data', {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      }
    });
    
    // Reset cache mocks
    (caches.default.match as any).mockReset();
    (caches.default.put as any).mockReset();
  });
  
  describe('getCachedResponse', () => {
    it('should return cached response when available', async () => {
      // Arrange
      (caches.default.match as any).mockResolvedValue(mockResponse);
      
      // Act
      const result = await getCachedResponse(mockRequest);
      
      // Assert
      expect(result).toBe(mockResponse);
      expect(caches.default.match).toHaveBeenCalledWith(mockRequest);
    });
    
    it('should return null when no cached response is found', async () => {
      // Arrange
      (caches.default.match as any).mockResolvedValue(null);
      
      // Act
      const result = await getCachedResponse(mockRequest);
      
      // Assert
      expect(result).toBeNull();
      expect(caches.default.match).toHaveBeenCalledWith(mockRequest);
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      (caches.default.match as any).mockRejectedValue(new Error('Cache error'));
      
      // Act
      const result = await getCachedResponse(mockRequest);
      
      // Assert
      expect(result).toBeNull();
    });
  });
  
  describe('cacheResponse', () => {
    it('should store response in cache if cacheable', async () => {
      // Arrange
      (caches.default.put as any).mockResolvedValue(undefined);
      
      // Act
      const result = await cacheResponse(mockRequest, mockResponse);
      
      // Assert
      expect(result).toBe(true);
      expect(caches.default.put).toHaveBeenCalledWith(mockRequest, expect.any(Response));
    });
    
    it('should not cache responses with no-store Cache-Control', async () => {
      // Arrange
      const nonCacheableResponse = new Response('Test data', {
        headers: { 'Cache-Control': 'no-store' }
      });
      
      // Act
      const result = await cacheResponse(mockRequest, nonCacheableResponse);
      
      // Assert
      expect(result).toBe(false);
      expect(caches.default.put).not.toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Arrange
      (caches.default.put as any).mockRejectedValue(new Error('Cache error'));
      
      // Act
      const result = await cacheResponse(mockRequest, mockResponse);
      
      // Assert
      expect(result).toBe(false);
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
          serverError: 0
        }
      };
      
      // Act
      const result = applyCacheHeaders(mockResponse, 200, cacheConfig, 'test-source', 'thumbnail');
      
      // Assert
      expect(result.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(result.headers.get('Cache-Tag')).toBe('source:test-source,derivative:thumbnail');
    });
    
    it('should apply no-store for non-cacheable configs', () => {
      // Arrange
      const cacheConfig = {
        cacheability: false,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0
        }
      };
      
      // Act
      const result = applyCacheHeaders(mockResponse, 200, cacheConfig);
      
      // Assert
      expect(result.headers.get('Cache-Control')).toBe('no-store');
    });
    
    it('should apply different TTLs based on status code', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0
        }
      };
      
      // Act - Test redirect status
      const redirectResult = applyCacheHeaders(mockResponse, 302, cacheConfig);
      
      // Assert
      expect(redirectResult.headers.get('Cache-Control')).toBe('public, max-age=1800');
      
      // Act - Test client error status
      const clientErrorResult = applyCacheHeaders(mockResponse, 404, cacheConfig);
      
      // Assert
      expect(clientErrorResult.headers.get('Cache-Control')).toBe('public, max-age=60');
      
      // Act - Test server error status
      const serverErrorResult = applyCacheHeaders(mockResponse, 500, cacheConfig);
      
      // Assert
      expect(serverErrorResult.headers.get('Cache-Control')).toBe('no-store');
    });
    
    it('should return original response if no cache config provided', () => {
      // Act
      const result = applyCacheHeaders(mockResponse, 200);
      
      // Assert
      expect(result).toBe(mockResponse);
    });
  });
  
  describe('createCfObjectParams', () => {
    it('should create correct CF object parameters for successful responses', () => {
      // Arrange
      const cacheConfig = {
        cacheability: true,
        ttl: {
          ok: 3600,
          redirects: 1800,
          clientError: 60,
          serverError: 0
        },
        imageCompression: 'lossy',
        mirage: true
      };
      
      // Act
      const result = createCfObjectParams(200, cacheConfig, 'test-source', 'thumbnail');
      
      // Assert
      expect(result).toEqual({
        cacheEverything: true,
        cacheTtl: 3600,
        polish: 'lossy',
        mirage: true,
        cacheTags: ['source:test-source', 'derivative:thumbnail']
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
          serverError: 0
        }
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
          serverError: 0
        }
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
  });
});