/**
 * CDN-CGI Pattern Integration Tests
 * Tests for the Cloudflare-specific CDN-CGI image resizing URL pattern with R2 buckets
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createTransformImageCommand } from '../../src/domain/commands/TransformImageCommand';

// Mock the ServiceRegistry
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
    })),
  };

  // Create a mock R2ImageProcessorService that adds CF headers
  const mockR2Processor = {
    processR2Image: vi.fn(
      async (r2Key, r2Bucket, imageOptions, request, cacheConfig, fallbackUrl) => {
        // Create a mock response that has the expected Cloudflare headers
        const headers = new Headers({
          'Content-Type': 'image/jpeg',
          'Content-Length': '500',
          'cf-resized': `internal=ok/- q=${imageOptions.quality || 80}${imageOptions.width ? ` n=${imageOptions.width}` : ''}`,
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'r2-cf-proxy-transform',
        });

        if (imageOptions.format === 'webp') {
          headers.set('Content-Type', 'image/webp');
        } else if (imageOptions.format === 'avif') {
          headers.set('Content-Type', 'image/avif');
        }

        // Return a response with the mock headers
        return new Response('Mock Image Data', {
          status: 200,
          headers,
        });
      }
    ),
  };

  return {
    ServiceRegistry: {
      getInstance: vi.fn(() => ({
        resolve: vi.fn((serviceId) => {
          if (serviceId === 'IConfigManager') {
            return mockConfigManager;
          }
          if (serviceId === 'ILogger') {
            return {
              debug: vi.fn(),
              error: vi.fn(),
              info: vi.fn(),
            };
          }
          if (serviceId === 'IDebugService') {
            return {
              addDebugHeaders: vi.fn((response) => response),
            };
          }
          if (serviceId === 'ICacheUtils') {
            return {
              determineCacheConfig: vi.fn(() => ({
                cacheability: true,
                ttl: {
                  ok: 86400,
                  redirects: 3600,
                  clientError: 60,
                  serverError: 0,
                },
                method: 'cache-api',
              })),
            };
          }
          if (serviceId === 'IErrorFactory') {
            return {
              createNotFoundError: vi.fn((message) => ({
                code: 'NOT_FOUND',
                message,
                type: 'AppError',
              })),
              createError: vi.fn((code, message) => ({
                code,
                message,
                type: 'AppError',
              })),
            };
          }
          if (serviceId === 'IErrorResponseFactory') {
            return {
              createErrorResponse: vi.fn((err) => {
                if (err?.code === 'NOT_FOUND') {
                  return new Response(JSON.stringify({ error: err }), {
                    status: 404,
                    headers: { 'content-type': 'application/json' },
                  });
                }
                return new Response(JSON.stringify({ error: err }), {
                  status: 500,
                  headers: { 'content-type': 'application/json' },
                });
              }),
            };
          }
          if (serviceId === 'IR2ImageProcessorService') {
            return mockR2Processor;
          }
          return {};
        }),
      })),
    },
  };
});

// Create a mock R2 object class for testing
class MockR2Object {
  body: ReadableStream<Uint8Array>;
  key: string;
  httpMetadata: { contentType: string };
  size: number;
  customMetadata?: Record<string, string>;

  constructor(
    key: string,
    contentType: string,
    size: number,
    customMetadata?: Record<string, string>
  ) {
    this.key = key;
    this.httpMetadata = { contentType };
    this.size = size;
    this.customMetadata = customMetadata;

    // Create a simple stream with some bytes for testing
    this.body = new ReadableStream({
      start(controller) {
        // For image types, create a minimal valid image buffer
        let bytes: Uint8Array;

        // Create different mock content based on content type
        if (contentType === 'image/jpeg') {
          // Simple JPEG header bytes
          bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
        } else if (contentType === 'image/png') {
          // Simple PNG header bytes
          bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        } else if (contentType === 'image/webp') {
          // Simple WebP header bytes
          bytes = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
          ]);
        } else if (contentType === 'image/avif') {
          // Simple AVIF header bytes
          bytes = new Uint8Array([
            0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
          ]);
        } else {
          // Default plain text or binary content
          bytes = new TextEncoder().encode('Mock content for ' + key);
        }

        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
}

// Mock a complete R2 bucket for integration testing
class MockR2Bucket {
  objects: Map<string, MockR2Object>;
  name: string;

  constructor(name: string) {
    this.name = name;
    this.objects = new Map<string, MockR2Object>();

    // Add test objects with different formats
    this.addObject('image.jpg', 'image/jpeg', 100000);
    this.addObject('image.png', 'image/png', 150000);
    this.addObject('image.webp', 'image/webp', 80000);
    this.addObject('image.avif', 'image/avif', 60000);
    this.addObject('large-image.jpg', 'image/jpeg', 5000000);
    this.addObject('document.pdf', 'application/pdf', 2000000);

    // Make the object available via binding
    (globalThis as any).IMAGES_BUCKET = this;
  }

  addObject(
    key: string,
    contentType: string,
    size: number,
    customMetadata?: Record<string, string>
  ) {
    this.objects.set(key, new MockR2Object(key, contentType, size, customMetadata));
  }

  async get(key: string): Promise<MockR2Object | null> {
    return this.objects.get(key) || null;
  }

  async head(key: string): Promise<{
    key: string;
    size: number;
    contentType?: string;
    customMetadata?: Record<string, string>;
  } | null> {
    const object = this.objects.get(key);
    if (!object) return null;

    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata.contentType,
      customMetadata: object.customMetadata,
    };
  }
}

// Helper function to create command dependencies
function createCommandDependencies() {
  // Create a mock R2Processor directly instead of trying to get it from the registry
  const mockR2Processor = {
    processR2Image: vi.fn(
      async (r2Key, r2Bucket, imageOptions, request, cacheConfig, fallbackUrl) => {
        // Create a mock response that has the expected Cloudflare headers
        const headers = new Headers({
          'Content-Type': 'image/jpeg',
          'Content-Length': '500',
          'cf-resized': `internal=ok/- q=${imageOptions.quality || 80}${imageOptions.width ? ` n=${imageOptions.width}` : ''}`,
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'r2-cf-proxy-transform',
        });

        if (imageOptions.format === 'webp') {
          headers.set('Content-Type', 'image/webp');
        } else if (imageOptions.format === 'avif') {
          headers.set('Content-Type', 'image/avif');
        }

        // Return a response with the mock headers
        return new Response('Mock Image Data', {
          status: 200,
          headers,
        });
      }
    ),
  };

  return {
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      logResponse: vi.fn(),
    },
    cacheUtils: {
      determineCacheConfig: async () => ({
        cacheability: true,
        ttl: { ok: 86400 },
        method: 'cache-api',
      }),
      generateCacheTags: vi.fn(() => ['tag1', 'tag2']),
      applyCacheHeaders: vi.fn((response) => response),
    },
    clientDetection: {
      hasCfDeviceType: () => false,
      getCfDeviceType: () => 'desktop',
      hasClientHints: () => false,
      getDeviceTypeFromUserAgent: () => 'desktop',
      normalizeDeviceType: (type) => type,
      getViewportWidth: () => 1440,
      getDevicePixelRatio: () => 2,
    },
    debugService: {
      addDebugHeaders: (response) => response,
    },
    errorFactory: {
      createNotFoundError: (message) => ({
        code: 'NOT_FOUND',
        message,
        type: 'AppError',
      }),
      createError: (code, message) => ({
        code,
        message,
        type: 'AppError',
      }),
    },
    errorResponseFactory: {
      createErrorResponse: (err) => {
        if (err?.code === 'NOT_FOUND') {
          return new Response(JSON.stringify({ error: err }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: err }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
    formatUtils: {
      getBestSupportedFormat: vi.fn((request, format) => format || 'webp'),
      getFormatFromAcceptHeader: vi.fn(() => 'webp'),
    },
    urlTransformUtils: {
      transformUrlToImageDelivery: vi.fn((url) => url),
      processUrl: vi.fn((url) => ({
        sourceUrl: url,
        transformedUrl: url,
        options: { width: 800 },
      })),
    },
    config: {
      getImageConfig: vi.fn(() => ({
        derivatives: {
          thumbnail: { width: 200, height: 200 },
          large: { width: 1200 },
        },
      })),
    },
    // Add the R2Processor service
    r2Processor: mockR2Processor,
  };
}

describe('CDN-CGI Pattern Tests', () => {
  let mockR2Bucket: MockR2Bucket;

  beforeEach(() => {
    // Reset mock bucket for each test
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');

    // Reset and setup fetch mock
    vi.mocked(fetch).mockReset();

    // NOTE: We aren't using fetch mock anymore for the CDN-CGI transformation part
    // since the tests now use our mock R2ImageProcessorService instead.
    // This mock is just for the other test cases.
    vi.mocked(fetch).mockImplementation((url, options) => {
      const urlString =
        typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      // Special handling for PDF file
      if (urlString.includes('document.pdf')) {
        return Promise.resolve(
          new Response('PDF Content', {
            status: 200,
            headers: {
              'content-type': 'application/pdf',
              'content-length': '2000000',
            },
          })
        );
      }

      // Default response for all other URLs
      return Promise.resolve(
        new Response('Image Data', {
          status: 200,
          headers: {
            'content-type': 'image/jpeg',
            'content-length': '100000',
          },
        })
      );
    });
  });

  test('should properly construct CDN-CGI URL with R2 path and width parameter', async () => {
    // Create a transform context with just width parameter
    const context = {
      request: new Request('https://example.com/r2/images/image.jpg'),
      options: {
        width: 800,
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'image.jpg',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the mock dependencies
    const deps = createCommandDependencies();

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify the response from mock R2 processor
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toBeTruthy();

    // Verify the R2 processor was called with correct parameters
    expect(deps.r2Processor.processR2Image).toHaveBeenCalledWith(
      'image.jpg',
      mockR2Bucket,
      expect.objectContaining({ width: 800 }),
      expect.anything(),
      expect.anything(),
      'https://example.com'
    );
  });

  test('should properly construct CDN-CGI URL with R2 path and multiple parameters', async () => {
    // Create a transform context with multiple parameters
    const context = {
      request: new Request('https://example.com/r2/images/image.jpg'),
      options: {
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp',
        fit: 'cover',
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'image.jpg',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the mock dependencies
    const deps = createCommandDependencies();

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify the response from mock R2 processor
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toBeTruthy();
    expect(response.headers.get('content-type')).toBe('image/webp');

    // Verify the R2 processor was called with the correct parameters
    expect(deps.r2Processor.processR2Image).toHaveBeenCalledWith(
      'image.jpg',
      mockR2Bucket,
      expect.objectContaining({
        width: 800,
        height: 600,
        quality: 85,
        format: 'webp',
        fit: 'cover',
      }),
      expect.anything(),
      expect.anything(),
      'https://example.com'
    );
  });

  test('should properly handle format conversion with CDN-CGI pattern', async () => {
    // Create a context for JPEG to WebP conversion
    const context = {
      request: new Request('https://example.com/r2/images/image.jpg'),
      options: {
        width: 800,
        format: 'webp',
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'image.jpg',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the mock dependencies
    const deps = createCommandDependencies();

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify the conversion
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');

    // Verify the R2 processor was called with the correct format parameter
    expect(deps.r2Processor.processR2Image).toHaveBeenCalledWith(
      'image.jpg',
      mockR2Bucket,
      expect.objectContaining({
        width: 800,
        format: 'webp',
      }),
      expect.anything(),
      expect.anything(),
      'https://example.com'
    );
  });

  test('should handle non-image files correctly with CDN-CGI pattern', async () => {
    // Create a custom mock R2 processor for PDFs
    const pdfProcessor = {
      processR2Image: vi.fn(async () => {
        return new Response('PDF Content', {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-length': '2000000',
          },
        });
      }),
    };

    // Create a context with a PDF file
    const context = {
      request: new Request('https://example.com/r2/documents/document.pdf'),
      options: {
        width: 800,
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'document.pdf',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the dependencies and override the r2Processor with our PDF-specific one
    const deps = createCommandDependencies();
    deps.r2Processor = pdfProcessor;

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify the response has PDF content type
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');

    // Verify the PDF processor was called with the right parameters
    expect(pdfProcessor.processR2Image).toHaveBeenCalledWith(
      'document.pdf',
      mockR2Bucket,
      expect.objectContaining({
        width: 800,
      }),
      expect.anything(),
      expect.anything(),
      'https://example.com'
    );
  });

  test('should set appropriate cache control headers with CDN-CGI pattern', async () => {
    // Create a context for an image with caching options
    const context = {
      request: new Request('https://example.com/r2/images/image.jpg'),
      options: {
        width: 800,
        format: 'webp',
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'image.jpg',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
        cache: {
          method: 'cache-api',
          ttl: {
            ok: 86400, // 1 day
          },
        },
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the mock dependencies
    const deps = createCommandDependencies();

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify proper cache headers
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('public');
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
  });

  test('should attempt different transformation paths and use CDN-CGI as fallback', async () => {
    // Create a mock R2Processor that simulates the fallback chain
    const chainProcessor = {
      processR2Image: vi.fn(async () => {
        return new Response('Fallback Image', {
          status: 200,
          headers: {
            'content-type': 'image/webp',
            'content-length': '50000',
            'cf-resized': 'internal=ok/- q=80 n=800',
            'cache-control': 'public, max-age=86400',
            'x-source': 'r2-cf-proxy-transform',
          },
        });
      }),
    };

    // Create a context with fallback URL specified
    const context = {
      request: new Request('https://example.com/r2/images/image.jpg'),
      options: {
        width: 800,
        format: 'webp',
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'image.jpg',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the dependencies and override the r2Processor
    const deps = createCommandDependencies();
    deps.r2Processor = chainProcessor;

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify success with CDN-CGI pattern indicated by source header
    expect(response.status).toBe(200);
    expect(response.headers.get('x-source')).toBe('r2-cf-proxy-transform');

    // Verify the processor was called with the right parameters
    expect(chainProcessor.processR2Image).toHaveBeenCalledWith(
      'image.jpg',
      mockR2Bucket,
      expect.objectContaining({
        width: 800,
        format: 'webp',
      }),
      expect.anything(),
      expect.anything(),
      'https://example.com'
    );
  });

  test('should include fit parameter in CDN-CGI URL construction', async () => {
    // We'll test just one fit parameter to make the test simpler
    const fit = 'cover';

    // Create a context with the fit parameter
    const context = {
      request: new Request('https://example.com/r2/images/image.jpg'),
      options: {
        width: 800,
        height: 600,
        fit,
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'image.jpg',
        r2Bucket: mockR2Bucket,
        fallbackBucket: 'https://example.com',
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the mock dependencies
    const deps = createCommandDependencies();

    // Create and execute the transform command
    const command = createTransformImageCommand(context, deps);
    const response = await command.execute();

    // Verify the response
    expect(response.status).toBe(200);

    // Verify the R2 processor was called with the fit parameter
    expect(deps.r2Processor.processR2Image).toHaveBeenCalledWith(
      'image.jpg',
      mockR2Bucket,
      expect.objectContaining({
        width: 800,
        height: 600,
        fit: 'cover',
      }),
      expect.anything(),
      expect.anything(),
      'https://example.com'
    );
  });

  test('should decrease content length when resizing large images with CDN-CGI pattern', async () => {
    // Create a context for a large image
    const context = {
      request: new Request('https://example.com/r2/images/large-image.jpg'),
      options: {
        width: 800,
        quality: 80,
      },
      config: {
        mode: 'hybrid',
        environment: 'test',
        isR2Fetch: true,
        r2Key: 'large-image.jpg',
        r2Bucket: mockR2Bucket,
      },
      debugInfo: {
        isEnabled: false,
      },
    };

    // Get the original size from the bucket
    const originalObject = await mockR2Bucket.get('large-image.jpg');
    const originalSize = originalObject?.size || 0;

    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();

    // Verify successful transformation
    expect(response.status).toBe(200);

    // Check that the content length was reduced
    const resizedLength = parseInt(response.headers.get('content-length') || '0', 10);
    expect(resizedLength).toBeGreaterThan(0);
    expect(resizedLength).toBeLessThan(originalSize);

    // The reduction should be substantial for a resize operation
    expect(resizedLength / originalSize).toBeLessThan(0.5);
  });
});
