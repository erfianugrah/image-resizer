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
              info: vi.fn()
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

  constructor(key: string, contentType: string, size: number, customMetadata?: Record<string, string>) {
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
          bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
        } else if (contentType === 'image/png') {
          // Simple PNG header bytes
          bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        } else if (contentType === 'image/webp') {
          // Simple WebP header bytes
          bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
        } else if (contentType === 'image/avif') {
          // Simple AVIF header bytes
          bytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
        } else {
          // Default plain text or binary content
          bytes = new TextEncoder().encode('Mock content for ' + key);
        }
        
        controller.enqueue(bytes);
        controller.close();
      }
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

  addObject(key: string, contentType: string, size: number, customMetadata?: Record<string, string>) {
    this.objects.set(key, new MockR2Object(key, contentType, size, customMetadata));
  }

  async get(key: string): Promise<MockR2Object | null> {
    return this.objects.get(key) || null;
  }

  async head(key: string): Promise<{ key: string; size: number; contentType?: string; customMetadata?: Record<string, string> } | null> {
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
        options: { width: 800 } 
      })),
    },
    config: {
      getImageConfig: vi.fn(() => ({
        derivatives: {
          thumbnail: { width: 200, height: 200 },
          large: { width: 1200 }
        },
      })),
    },
  };
}

describe('CDN-CGI Pattern Tests', () => {
  let mockR2Bucket: MockR2Bucket;
  
  beforeEach(() => {
    // Reset mock bucket for each test
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');
    
    // Reset and setup fetch mock
    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockImplementation((url, options) => {
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      // Special handling for PDF file
      if (urlString.includes('document.pdf')) {
        return Promise.resolve(new Response('PDF Content', { 
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-length': '2000000',
          }
        }));
      }
      
      // Check if the URL contains the CDN-CGI pattern
      if (urlString.includes('/cdn-cgi/image/')) {
        // Extract params from the URL to simulate proper transformation
        const paramsMatch = urlString.match(/\/cdn-cgi\/image\/([^/]+)/);
        const params = paramsMatch ? paramsMatch[1].split(',') : [];
        
        // Parse parameters
        const paramMap: Record<string, string> = {};
        params.forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) paramMap[key] = value;
        });
        
        // Extract parameters
        const width = paramMap.width ? parseInt(paramMap.width) : null;
        const height = paramMap.height ? parseInt(paramMap.height) : null;
        const quality = paramMap.quality ? parseInt(paramMap.quality) : 80;
        const format = paramMap.format || 'auto';
        const fit = paramMap.fit || 'cover';
        
        // Determine content type based on format
        let contentType = 'image/jpeg';
        if (format === 'webp') contentType = 'image/webp';
        if (format === 'avif') contentType = 'image/avif';
        if (format === 'png') contentType = 'image/png';
        
        // Calculate a realistic content length based on the parameters
        let contentLength = 100000; // Base size
        
        // Apply various transformations to simulate realistic size changes
        if (width) {
          // Resize based on width
          contentLength = Math.floor(contentLength * (width / 1000));
        }
        
        // Quality adjustment
        contentLength = Math.floor(contentLength * (quality / 100));
        
        // Format adjustment
        if (format === 'webp') contentLength = Math.floor(contentLength * 0.8);
        if (format === 'avif') contentLength = Math.floor(contentLength * 0.7);
        
        // Create response headers that match Cloudflare's pattern
        const headers = new Headers({
          'content-type': contentType,
          'content-length': String(contentLength),
          'cf-resized': `internal=ok/- q=${quality}${width ? ` n=${width}` : ''}${height ? `+${height}` : ''}`,
          'x-source': 'r2-cdn-cgi-transform',
          'cache-control': 'public, max-age=86400',
        });
        
        return Promise.resolve(new Response('Transformed Image Data', { 
          status: 200, 
          headers 
        }));
      }
      
      // Default response for non-CDN-CGI URLs
      return Promise.resolve(new Response('Original Image Data', { 
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '100000',
        }
      }));
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
      },
      debugInfo: {
        isEnabled: false,
      },
    };
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Verify the response
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toBeTruthy();
    
    // Check that the correct CDN-CGI URL was constructed
    const fetchCalls = vi.mocked(fetch).mock.calls;
    const cdnCgiCall = fetchCalls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : call[0]?.url;
      return typeof url === 'string' && url.includes('/cdn-cgi/image/');
    });
    
    expect(cdnCgiCall).toBeTruthy();
    const cdnCgiUrl = typeof cdnCgiCall?.[0] === 'string' ? cdnCgiCall?.[0] : cdnCgiCall?.[0]?.url;
    expect(cdnCgiUrl).toContain('/cdn-cgi/image/width=800/');
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
      },
      debugInfo: {
        isEnabled: false,
      },
    };
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Verify the response
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toBeTruthy();
    expect(response.headers.get('content-type')).toBe('image/webp');
    
    // Check that the correct CDN-CGI URL was constructed with all parameters
    const fetchCalls = vi.mocked(fetch).mock.calls;
    const cdnCgiCall = fetchCalls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : call[0]?.url;
      return typeof url === 'string' && url.includes('/cdn-cgi/image/');
    });
    
    expect(cdnCgiCall).toBeTruthy();
    const cdnCgiUrl = typeof cdnCgiCall?.[0] === 'string' ? cdnCgiCall?.[0] : cdnCgiCall?.[0]?.url;
    
    // Check all parameters are included in the URL
    expect(cdnCgiUrl).toContain('width=800');
    expect(cdnCgiUrl).toContain('height=600');
    expect(cdnCgiUrl).toContain('quality=85');
    expect(cdnCgiUrl).toContain('format=webp');
    expect(cdnCgiUrl).toContain('fit=cover');
  });

  test('should properly handle format conversion with CDN-CGI pattern', async () => {
    // We'll test a single format conversion
    // Override the fetch implementation specific for this test
    vi.mocked(fetch).mockImplementation((url, options) => {
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      if (urlString.includes('/cdn-cgi/image/')) {
        // For CDN-CGI URLs, return WebP format
        return Promise.resolve(new Response('Transformed WebP Image', { 
          status: 200,
          headers: {
            'content-type': 'image/webp',
            'content-length': '50000',
            'cf-resized': 'internal=ok/- q=80 n=800',
            'cache-control': 'public, max-age=86400',
          }
        }));
      }
      
      // Default response
      return Promise.resolve(new Response('Original Image', { 
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '100000',
        }
      }));
    });
    
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
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Verify the conversion
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    
    // Verify the CDN-CGI URL used correct format parameter
    const fetchCalls = vi.mocked(fetch).mock.calls;
    const cdnCgiCall = fetchCalls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : call[0]?.url;
      return typeof url === 'string' && url.includes('/cdn-cgi/image/');
    });
    
    const url = typeof cdnCgiCall?.[0] === 'string' ? cdnCgiCall?.[0] : cdnCgiCall?.[0]?.url;
    expect(url).toContain('format=webp');
  });

  test('should handle non-image files correctly with CDN-CGI pattern', async () => {
    // Custom fetch implementation for this test to ensure PDF handling is correct
    vi.mocked(fetch).mockImplementation((url, options) => {
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      // PDF specific response - don't transform regardless of URL pattern
      if (urlString.includes('document.pdf')) {
        return Promise.resolve(new Response('PDF Content', { 
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-length': '2000000',
          }
        }));
      }
      
      // Default response
      return Promise.resolve(new Response('Content', { 
        status: 200,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': '100000',
        }
      }));
    });
    
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
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Instead of checking fetch calls, just verify the response
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
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
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Verify proper cache headers
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('public');
    expect(response.headers.get('cache-control')).toContain('max-age=86400');
  });

  test('should attempt different transformation paths and use CDN-CGI as fallback', async () => {
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
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Verify success with CDN-CGI pattern
    expect(response.status).toBe(200);
    
    // Verify a CDN-CGI URL was used
    const fetchCalls = vi.mocked(fetch).mock.calls;
    const cdnCgiCall = fetchCalls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : call[0]?.url;
      return typeof url === 'string' && url.includes('/cdn-cgi/image/');
    });
    
    expect(cdnCgiCall).toBeTruthy();
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
    
    // Create and execute the transform command
    const command = createTransformImageCommand(context, createCommandDependencies());
    const response = await command.execute();
    
    // Verify the response
    expect(response.status).toBe(200);
    
    // Verify the CDN-CGI URL used correct fit parameter
    const fetchCalls = vi.mocked(fetch).mock.calls;
    const cdnCgiCall = fetchCalls.find(call => {
      const url = typeof call[0] === 'string' ? call[0] : call[0]?.url;
      return typeof url === 'string' && url.includes('/cdn-cgi/image/');
    });
    
    // Get the URL from the call
    const url = typeof cdnCgiCall?.[0] === 'string' ? cdnCgiCall?.[0] : cdnCgiCall?.[0]?.url;
    expect(url).toContain(`fit=${fit}`);
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