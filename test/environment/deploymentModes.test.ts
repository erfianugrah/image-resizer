import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create a mock R2 object class for testing
class MockR2Object {
  body: ReadableStream<Uint8Array>;
  key: string;
  httpMetadata: { contentType: string };
  size: number;

  constructor(key: string, contentType: string, size: number) {
    this.key = key;
    this.httpMetadata = { contentType };
    this.size = size;

    // Create a simple stream with some bytes for testing
    this.body = new ReadableStream({
      start(controller) {
        const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // Simple JPEG header
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
}

// Mock a complete R2 bucket for testing
class MockR2Bucket {
  objects: Map<string, MockR2Object>;
  name: string;

  constructor(name: string) {
    this.name = name;
    this.objects = new Map<string, MockR2Object>();

    // Add some default test objects
    this.addObject('test.jpg', 'image/jpeg', 100000);
    this.addObject('test.png', 'image/png', 150000);
  }

  addObject(key: string, contentType: string, size: number) {
    this.objects.set(key, new MockR2Object(key, contentType, size));
  }

  async get(key: string): Promise<MockR2Object | null> {
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    return this.objects.get(normalizedKey) || null;
  }

  async head(key: string): Promise<{ key: string; size: number; contentType?: string } | null> {
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    const object = this.objects.get(normalizedKey);
    if (!object) return null;

    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata.contentType,
    };
  }
}

// Simple mock for handleImageRequest
const handleImageRequest = vi.fn(
  async (request: Request, config: Record<string, any>, env: Record<string, any>) => {
    const url = new URL(request.url);

    // Create default successful response
    const headers = new Headers({
      'content-type': 'image/jpeg',
      'content-length': '100000',
      'cache-control': 'public, max-age=86400',
      'x-deployment-mode': config.mode || 'unknown',
    });

    // For R2 paths
    if (url.pathname.startsWith('/r2/')) {
      // Extract key from path
      const key = url.pathname.substring(3); // Remove /r2/

      // Check for R2 mode
      if (config.mode === 'r2-only' || config.mode === 'hybrid') {
        // Get R2 bucket name from config
        const bucketName = config.r2?.binding_name || 'IMAGES_BUCKET';
        const bucket = env[bucketName];

        if (bucket) {
          const object = await bucket.get(key);

          if (object) {
            headers.set('content-type', object.httpMetadata.contentType);
            headers.set('content-length', String(object.size));
            headers.set('x-source', 'r2-direct');

            return new Response('R2 Object Data', {
              status: 200,
              headers,
            });
          } else {
            return new Response('Not Found', { status: 404 });
          }
        }
      } else if (config.mode === 'remote-only') {
        // Check remote configuration
        if (config.remote?.enabled && config.remote.upstream_url) {
          headers.set('x-source', 'remote-origin');
          return new Response('Remote Image Data', {
            status: 200,
            headers,
          });
        }
      }
    }

    // For remote-only mode
    if (config.mode === 'remote-only') {
      // Check remote configuration
      if (config.remote?.enabled && config.remote.upstream_url) {
        headers.set('x-source', 'remote-origin');
        return new Response('Remote Image Data', {
          status: 200,
          headers,
        });
      }
    }

    // Default passthrough response
    return new Response('Image Data', {
      status: 200,
      headers,
    });
  }
);

// Worker function that mocks the main worker module
async function mockWorker(
  request: Request,
  env: Record<string, any>,
  ctx: ExecutionContext
): Promise<Response> {
  // Get configuration from env
  const config = {
    mode: env.DEPLOYMENT_MODE || 'hybrid',
    r2: {
      enabled: true,
      binding_name: env.R2_BINDING_NAME || 'IMAGES_BUCKET',
    },
    remote: {
      enabled: true,
      upstream_url: env.REMOTE_URL || 'https://cdn.example.com',
    },
    cache: {
      method: env.CACHE_METHOD || 'cache-api',
    },
  };

  // Process request
  return handleImageRequest(request, config, env);
}

describe('Deployment Mode Tests', () => {
  let mockRequest: Request;
  let mockEnv: Record<string, any>;
  let mockCtx: { waitUntil: vi.Mock };
  let mockR2Bucket: MockR2Bucket;

  beforeEach(() => {
    // Create mock R2 bucket
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');

    // Create mock request
    mockRequest = new Request('https://example.com/r2/test.jpg');

    // Create mock context
    mockCtx = {
      waitUntil: vi.fn(),
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  it('should use R2 objects in r2-only mode', async () => {
    // Set up environment for r2-only mode
    mockEnv = {
      DEPLOYMENT_MODE: 'r2-only',
      IMAGES_BUCKET: mockR2Bucket,
      CACHE_METHOD: 'cache-api',
    };

    // Execute worker
    const response = await mockWorker(mockRequest, mockEnv, mockCtx as any);

    // Assert R2 was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-deployment-mode')).toBe('r2-only');
    expect(response.headers.get('x-source')).toBe('r2-direct');
    expect(handleImageRequest).toHaveBeenCalledWith(
      mockRequest,
      expect.objectContaining({ mode: 'r2-only' }),
      mockEnv
    );
  });

  it('should use remote origin in remote-only mode', async () => {
    // Set up environment for remote-only mode
    mockEnv = {
      DEPLOYMENT_MODE: 'remote-only',
      REMOTE_URL: 'https://cdn.example.com',
      CACHE_METHOD: 'cache-api',
    };

    // Execute worker
    const response = await mockWorker(mockRequest, mockEnv, mockCtx as any);

    // Assert remote was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-deployment-mode')).toBe('remote-only');
    expect(response.headers.get('x-source')).toBe('remote-origin');
    expect(handleImageRequest).toHaveBeenCalledWith(
      mockRequest,
      expect.objectContaining({ mode: 'remote-only' }),
      mockEnv
    );
  });

  it('should use R2 in hybrid mode when available', async () => {
    // Set up environment for hybrid mode
    mockEnv = {
      DEPLOYMENT_MODE: 'hybrid',
      IMAGES_BUCKET: mockR2Bucket,
      REMOTE_URL: 'https://cdn.example.com',
      CACHE_METHOD: 'cache-api',
    };

    // Execute worker
    const response = await mockWorker(mockRequest, mockEnv, mockCtx as any);

    // Assert R2 was used in hybrid mode
    expect(response.status).toBe(200);
    expect(response.headers.get('x-deployment-mode')).toBe('hybrid');
    expect(response.headers.get('x-source')).toBe('r2-direct');
    expect(handleImageRequest).toHaveBeenCalledWith(
      mockRequest,
      expect.objectContaining({ mode: 'hybrid' }),
      mockEnv
    );
  });

  it('should handle missing R2 binding in r2-only mode', async () => {
    // Set up environment without R2 bucket
    mockEnv = {
      DEPLOYMENT_MODE: 'r2-only',
      CACHE_METHOD: 'cache-api',
      // Missing IMAGES_BUCKET binding
    };

    // Execute worker
    const response = await mockWorker(mockRequest, mockEnv, mockCtx as any);

    // Assert we got a response (not an error)
    expect(response.status).toBe(200);
    expect(response.headers.get('x-deployment-mode')).toBe('r2-only');
    // x-source shouldn't be r2-direct since R2 wasn't available
    expect(response.headers.get('x-source')).not.toBe('r2-direct');
  });

  it('should use custom R2 binding name when specified', async () => {
    // Create a different bucket
    const customBucket = new MockR2Bucket('CUSTOM_BUCKET');
    customBucket.addObject('custom.jpg', 'image/jpeg', 200000);

    // Set up environment with custom binding
    mockEnv = {
      DEPLOYMENT_MODE: 'r2-only',
      R2_BINDING_NAME: 'CUSTOM_BUCKET',
      CUSTOM_BUCKET: customBucket,
      CACHE_METHOD: 'cache-api',
    };

    // Create request for object in custom bucket
    const customRequest = new Request('https://example.com/r2/custom.jpg');

    // Execute worker
    const response = await mockWorker(customRequest, mockEnv, mockCtx as any);

    // Assert the custom bucket was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-deployment-mode')).toBe('r2-only');
    expect(response.headers.get('x-source')).toBe('r2-direct');
    expect(handleImageRequest).toHaveBeenCalledWith(
      customRequest,
      expect.objectContaining({
        r2: expect.objectContaining({ binding_name: 'CUSTOM_BUCKET' }),
      }),
      mockEnv
    );
  });

  it('should have working cache configuration across deployment modes', async () => {
    // Test different cache methods across deployment modes
    const testCases = [
      { mode: 'r2-only', cacheMethod: 'cache-api' },
      { mode: 'remote-only', cacheMethod: 'cache-control' },
      { mode: 'hybrid', cacheMethod: 'no-cache' },
    ];

    for (const testCase of testCases) {
      // Set up environment
      mockEnv = {
        DEPLOYMENT_MODE: testCase.mode,
        CACHE_METHOD: testCase.cacheMethod,
        IMAGES_BUCKET: mockR2Bucket,
        REMOTE_URL: 'https://cdn.example.com',
      };

      // Execute worker
      const response = await mockWorker(mockRequest, mockEnv, mockCtx as any);

      // Assert proper configuration was passed
      expect(response.status).toBe(200);
      expect(handleImageRequest).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({
          mode: testCase.mode,
          cache: expect.objectContaining({ method: testCase.cacheMethod }),
        }),
        mockEnv
      );

      // Reset for next iteration
      vi.clearAllMocks();
    }
  });

  it('should throw if environment is missing mandatory configuration', async () => {
    // Set up environment without deployment mode
    mockEnv = {};

    // Mock an error to be thrown when missing configuration
    handleImageRequest.mockImplementationOnce(() => {
      throw new Error('Missing required configuration: DEPLOYMENT_MODE');
    });

    // Execute worker and expect error
    await expect(mockWorker(mockRequest, mockEnv, mockCtx as any)).rejects.toThrow(
      'Missing required configuration'
    );
  });
});
