import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleImageRequest } from '../../src/handlers/imageHandler';
import { AppConfig } from '../../src/config/configManager';

// Create a simple test version we can use
class MockR2Object {
  body: ReadableStream<Uint8Array>;
  httpMetadata: { contentType: string };
  size: number;

  constructor(contentType = 'image/jpeg', size = 100000) {
    // Create a simple stream with some bytes for testing
    this.body = new ReadableStream({
      start(controller) {
        const bytes = new Uint8Array(10);
        controller.enqueue(bytes);
        controller.close();
      },
    });
    this.httpMetadata = { contentType };
    this.size = size;
  }
}

// Mock the transformRequestUrl function since we're having issues with it
vi.mock('../../src/utils/urlTransformUtils', () => {
  const originalModule = vi.importActual('../../src/utils/urlTransformUtils');
  return {
    ...originalModule,
    transformRequestUrl: vi.fn((request, config, env) => {
      const url = new URL(request.url);
      const path = url.pathname;
      const filename = path.split('/').pop() || '';
      
      // Simple method to determine if we're using R2
      const isR2 = config.mode === 'hybrid' || config.mode === 'r2-only';
      const hasR2 = env && (env.IMAGES_BUCKET || env.TEST_BUCKET);
      
      return {
        originRequest: request,
        bucketName: isR2 && hasR2 ? 'test-bucket' : undefined,
        originUrl: isR2 && hasR2 ? request.url : 'https://example.com' + path,
        derivative: path.includes('thumbnails') ? 'thumbnail' : undefined,
        isRemoteFetch: !(isR2 && hasR2),
        isR2Fetch: isR2 && hasR2,
        r2Key: isR2 && hasR2 ? filename : undefined,
      };
    }),
  };
});

// Mock path utilities
vi.mock('../../src/utils/pathUtils', () => ({
  getDerivativeFromPath: vi.fn().mockReturnValue('thumbnail'),
}));

// Mock cache utilities
vi.mock('../../src/utils/cacheUtils', () => ({
  buildCacheKey: vi.fn().mockReturnValue('test-cache-key'),
  determineCacheControl: vi.fn().mockReturnValue('public, max-age=86400'),
  generateCacheTags: vi.fn().mockReturnValue(['image', 'thumbnail']),
}));

// Mock logging
vi.mock('../../src/utils/loggerUtils', () => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  logRequest: vi.fn(),
}));

// Mock URL params utilities
vi.mock('../../src/utils/urlParamUtils', () => ({
  extractImageParams: vi.fn().mockReturnValue({
    width: 800,
    height: 600,
    quality: 80,
    format: 'auto',
  }),
}));

// Mock services
vi.mock('../../src/services/cacheManagementService', () => ({
  createCacheManagementService: vi.fn(() => ({
    getCachedResponse: vi.fn().mockResolvedValue(null),
    cacheResponse: vi.fn().mockResolvedValue(undefined),
    applyCacheHeaders: vi.fn((response) => response),
  })),
}));

vi.mock('../../src/services/debugService', () => ({
  createDebugService: vi.fn(() => ({
    addDebugHeaders: vi.fn((response) => {
      const headers = new Headers(response.headers);
      headers.set('debug-info', JSON.stringify({ test: true }));
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }),
  })),
}));

vi.mock('../../src/services/imageTransformationService', () => ({
  createImageTransformationService: vi.fn(() => ({
    transformImage: vi.fn().mockImplementation((request, options, pathPatterns, debugInfo, config) => {
      // Return a different response based on whether it's an R2 request
      if (debugInfo.isR2Fetch && config.isR2Fetch) {
        const headers = new Headers({
          'content-type': 'image/webp',
          'cf-resized': 'internal=ok/- q=80 n=800+600 c=300+200',
          'x-source': 'r2-cdn-cgi-transform',
          'content-length': '5000',
          'cache-control': 'public, max-age=86400',
        });
        
        if (debugInfo.isEnabled) {
          headers.set('debug-info', JSON.stringify({ source: 'r2', options }));
        }
        
        return Promise.resolve(new Response('R2 Transformed image', { status: 200, headers }));
      }
      
      return Promise.resolve(new Response('Transformed image', {
        status: 200,
        headers: {
          'content-type': 'image/webp',
          'cf-resized': 'internal=ok/- q=80 n=800+600 c=300+200',
          'x-source': 'direct-transform',
          'cache-control': 'public, max-age=86400',
        },
      }));
    }),
  })),
}));

vi.mock('../../src/handlers/imageOptionsService', () => ({
  createImageOptionsService: vi.fn(() => ({
    determineImageOptions: vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      quality: 80,
      format: 'webp',
      fit: 'contain',
    }),
  })),
}));

vi.mock('../../src/types/utils/errors', () => ({
  createErrorFactory: vi.fn(() => ({
    createError: vi.fn((code, message) => ({
      code,
      message,
      type: 'AppError',
    })),
    createNotFoundError: vi.fn((message) => ({
      code: 'NOT_FOUND',
      message,
      type: 'AppError',
    })),
    createValidationError: vi.fn(),
  })),
  createErrorResponseFactory: vi.fn(() => ({
    createErrorResponse: vi.fn((err) => {
      return new Response(JSON.stringify({ error: err }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }),
  })),
  createErrorFromUnknown: vi.fn((err) => ({
    code: 'UNKNOWN_ERROR',
    message: err instanceof Error ? err.message : String(err),
    type: 'AppError',
  })),
  createErrorResponse: vi.fn((appError) => {
    return new Response(JSON.stringify({ error: appError }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }),
}));

// Mock service registry
vi.mock('../../src/core/serviceRegistry', () => ({
  ServiceRegistry: {
    getInstance: vi.fn(() => ({
      resolve: vi.fn(() => ({})),
    })),
  },
}));

describe('ImageHandler', () => {
  let mockConfig: AppConfig;
  let mockR2Bucket: any;
  let mockEnv: Record<string, unknown>;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Setup mock fetch
    vi.mocked(fetch).mockImplementation(() => {
      return Promise.resolve(new Response('Image data', {
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'cf-resized': 'internal=ok/- q=80 n=800+600 c=300+200',
          'content-length': '5000',
        },
      }));
    });
    
    // Create mock R2 bucket with get method that returns our MockR2Object
    mockR2Bucket = {
      get: vi.fn().mockImplementation(async (key) => {
        if (key === 'test-image.jpg' || key === 'profile.jpg') {
          return new MockR2Object();
        }
        return null; // Not found for other keys
      }),
    };
    
    // Basic config for tests
    mockConfig = {
      mode: 'hybrid', // Default to hybrid mode which supports both R2 and remote
      version: '1.0.0-test',
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
      debug: {
        enabled: false,
        verbose: false,
        includeHeaders: false,
      },
      derivatives: {
        thumbnail: {
          width: 200,
          height: 200,
          fit: 'cover',
        },
      },
      pathTemplates: [
        {
          name: 'thumbnails',
          pattern: '/thumbnails/:filename',
          derivative: 'thumbnail',
        },
      ],
      pathPatterns: [
        {
          name: 'images',
          pattern: '/images/.*',
          ttl: 86400,
        },
      ],
      defaults: {
        quality: 80,
        format: 'auto',
        fit: 'contain',
      },
      responsive: {
        breakpoints: [320, 768, 1440],
        deviceWidths: {
          mobile: 320,
          tablet: 768,
          desktop: 1440,
        },
      },
    };
    
    // Environment with R2 bucket
    mockEnv = {
      IMAGES_BUCKET: mockR2Bucket,
      VERSION: '1.0.0-test',
      DEPLOYMENT_MODE: 'test',
    };
  });
  
  it('should handle R2 image requests successfully', async () => {
    // Arrange
    const request = new Request('https://example.com/images/test-image.jpg');
    
    // Act
    const response = await handleImageRequest(request, mockConfig, mockEnv);
    
    // Debug check for errors
    if (response.status !== 200) {
      console.error('Response status:', response.status);
      console.error('Response text:', await response.clone().text());
    }
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cf-resized')).toBeTruthy();
    expect(response.headers.get('x-source')).toContain('r2');
  });
  
  it('should handle non-R2 image requests in hybrid mode', async () => {
    // Arrange - create a special mock for this test
    const { createImageTransformationService } = await import('../../src/services/imageTransformationService');
    vi.mocked(createImageTransformationService).mockReturnValueOnce({
      transformImage: vi.fn().mockResolvedValue(
        new Response('Remote image', {
          status: 200,
          headers: {
            'content-type': 'image/webp',
            'cf-resized': 'internal=ok',
            'x-source': 'direct-transform',
          }
        })
      ),
    } as any);
    
    // Override the transform request function
    const { transformRequestUrl } = await import('../../src/utils/urlTransformUtils');
    vi.mocked(transformRequestUrl).mockImplementationOnce((request) => {
      return {
        originRequest: request,
        bucketName: undefined,
        originUrl: 'https://example.com/images/test-image.jpg',
        derivative: 'thumbnail',
        isRemoteFetch: true,
        isR2Fetch: false,
        r2Key: undefined,
      };
    });
    
    const request = new Request('https://example.com/images/test-image.jpg');
    
    // Act
    const response = await handleImageRequest(request, mockConfig, mockEnv);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('x-source')).toBe('direct-transform');
  });
  
  it('should handle cached responses', async () => {
    // Arrange - mock cache to return a response
    const { createCacheManagementService } = await import('../../src/services/cacheManagementService');
    vi.mocked(createCacheManagementService).mockReturnValueOnce({
      getCachedResponse: vi.fn().mockResolvedValue(
        new Response('Cached image', {
          headers: {
            'content-type': 'image/webp',
            'cf-cache-status': 'HIT',
            'cache-control': 'public, max-age=86400',
          },
        })
      ),
      cacheResponse: vi.fn().mockResolvedValue(undefined),
      applyCacheHeaders: vi.fn((response) => response),
    } as any);
    
    const request = new Request('https://example.com/images/test-image.jpg');
    
    // Act
    const response = await handleImageRequest(request, mockConfig, mockEnv);
    
    // Assert
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Cached image');
    expect(response.headers.get('cf-cache-status')).toBe('HIT');
  });
  
  it('should handle errors gracefully', async () => {
    // Arrange - make transformation service throw an error
    const { createImageTransformationService } = await import('../../src/services/imageTransformationService');
    vi.mocked(createImageTransformationService).mockReturnValueOnce({
      transformImage: vi.fn().mockRejectedValue(new Error('Transformation failed')),
    } as any);
    
    // Also fix our error mocks
    const { createErrorResponseFactory } = await import('../../src/types/utils/errors');
    vi.mocked(createErrorResponseFactory).mockReturnValueOnce({
      createErrorResponse: vi.fn().mockReturnValue(
        new Response('{"error":"Transformation failed"}', {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      ),
    } as any);
    
    const request = new Request('https://example.com/images/test-image.jpg');
    
    // Act
    const response = await handleImageRequest(request, mockConfig, mockEnv);
    
    // Assert
    expect(response.status).toBe(500);
    const responseText = await response.text();
    expect(responseText).toContain('Transformation failed');
  });
  
  it('should add debug information when debug is enabled', async () => {
    // Arrange - enable debug
    const debugConfig = { ...mockConfig, debug: { enabled: true, verbose: true, includeHeaders: true } };
    
    // Create debug service with specific headers
    const { createDebugService } = await import('../../src/services/debugService');
    vi.mocked(createDebugService).mockReturnValueOnce({
      addDebugHeaders: vi.fn((response) => {
        const headers = new Headers(response.headers);
        headers.set('debug-info', JSON.stringify({ debug: true, source: 'test' }));
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }),
    } as any);
    
    const request = new Request('https://example.com/images/test-image.jpg');
    
    // Act
    const response = await handleImageRequest(request, debugConfig, mockEnv);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('debug-info')).toBeTruthy();
  });
  
  it('should handle custom R2 binding name from config', async () => {
    // Arrange - Config with custom R2 binding
    const customConfig = { 
      ...mockConfig,
      originConfig: {
        r2: {
          binding_name: 'TEST_BUCKET'
        }
      }
    };
    
    // Environment with custom bucket name
    const customEnv = {
      TEST_BUCKET: mockR2Bucket,
      VERSION: '1.0.0-test',
    };
    
    // Make sure the R2 key is detected correctly
    const { transformRequestUrl } = await import('../../src/utils/urlTransformUtils');
    vi.mocked(transformRequestUrl).mockImplementationOnce((request) => {
      return {
        originRequest: request,
        bucketName: 'test-bucket',
        originUrl: request.url,
        derivative: 'thumbnail',
        isRemoteFetch: false,
        isR2Fetch: true,
        r2Key: 'test-image.jpg',
      };
    });
    
    const request = new Request('https://example.com/images/test-image.jpg');
    
    // Act
    const response = await handleImageRequest(request, customConfig, customEnv);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('x-source')).toContain('r2');
  });
});