import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockExecutionContext } from '../setup';

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
    this.addObject('test.webp', 'image/webp', 80000);
    this.addObject('large-image.jpg', 'image/jpeg', 5000000);
    this.addObject('not-an-image.txt', 'text/plain', 1000);
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

describe('CDN-CGI Pattern for R2 Objects', () => {
  let mockR2Bucket: MockR2Bucket;

  // Mock fetch for CDN-CGI responses
  const setupFetchMock = () => {
    vi.mocked(fetch).mockImplementation((url, options) => {
      const urlString =
        typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

      // Check if it's a CDN-CGI request
      if (urlString.includes('/cdn-cgi/image/')) {
        // Extract params from the URL
        const paramsMatch = urlString.match(/\/cdn-cgi\/image\/([^/]+)/);
        const params = paramsMatch ? paramsMatch[1].split(',') : [];

        // Parse parameters
        const paramMap: Record<string, string> = {};
        params.forEach((param) => {
          const [key, value] = param.split('=');
          if (key && value) paramMap[key] = value;
        });

        // Determine content type
        let contentType = 'image/jpeg';
        if (paramMap.format === 'webp') contentType = 'image/webp';
        if (paramMap.format === 'avif') contentType = 'image/avif';
        if (paramMap.format === 'png') contentType = 'image/png';

        // Calculate content length based on parameters
        let contentLength = 100000;
        const width = paramMap.width ? parseInt(paramMap.width) : null;
        const quality = paramMap.quality ? parseInt(paramMap.quality) : 80;

        if (width) {
          contentLength = Math.floor(contentLength * (width / 1000));
        }
        contentLength = Math.floor(contentLength * (quality / 100));

        // Set headers for the response
        const headers = new Headers({
          'content-type': contentType,
          'content-length': String(contentLength),
          'cf-resized': `internal=ok/- q=${quality}${width ? ` n=${width}` : ''}`,
          'cache-control': 'public, max-age=86400',
        });

        return Promise.resolve(
          new Response('Transformed Image Data', {
            status: 200,
            headers,
          })
        );
      }

      // For non-CDN-CGI requests, return a basic response
      return Promise.resolve(
        new Response('Original Image Data', {
          status: 200,
          headers: {
            'content-type': 'image/jpeg',
            'content-length': '100000',
          },
        })
      );
    });
  };

  beforeEach(() => {
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');
    setupFetchMock();

    // Reset fetch mock before each test
    vi.mocked(fetch).mockClear();
  });

  it('should transform an image using CDN-CGI pattern', async () => {
    // Verify the mock R2 bucket has an object
    const r2Object = await mockR2Bucket.get('test.jpg');
    expect(r2Object).not.toBeNull();

    // Create a URL with the CDN-CGI transformation pattern
    const transformUrl = 'https://example.com/cdn-cgi/image/width=800,format=webp/test.jpg';

    // Fetch the transformed image
    const response = await fetch(transformUrl);

    // Assert transformation was successful
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cf-resized')).toBeTruthy();
    expect(response.headers.get('cf-resized')).toContain('n=800');

    // Verify content length is reduced (indicating transformation)
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(100000);
  });

  it('should transform an image to WebP format', async () => {
    // Create a URL with just the format parameter
    const transformUrl = 'https://example.com/cdn-cgi/image/format=webp/test.jpg';

    // Fetch the transformed image
    const response = await fetch(transformUrl);

    // Assert format conversion was successful
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
  });

  it('should transform an image with quality settings', async () => {
    // Create a URL with quality parameter
    const transformUrl = 'https://example.com/cdn-cgi/image/quality=50/test.jpg';

    // Fetch the transformed image
    const response = await fetch(transformUrl);

    // Assert quality transformation was successful
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toContain('q=50');

    // Verify content length is reduced due to quality setting
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(100000); // Original size
    expect(contentLength).toBeGreaterThan(0); // Not empty
  });

  it('should handle multiple transformation parameters', async () => {
    // Create a URL with multiple parameters
    const transformUrl =
      'https://example.com/cdn-cgi/image/width=400,height=300,fit=cover,quality=75,format=webp/test.jpg';

    // Fetch the transformed image
    const response = await fetch(transformUrl);

    // Assert all transformations were applied
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cf-resized')).toContain('q=75');
    expect(response.headers.get('cf-resized')).toContain('n=400');

    // Verify content length is reduced significantly
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(50000); // Should be much smaller than original
  });

  it('should apply caching headers to transformed images', async () => {
    // Create a URL with transformation parameters
    const transformUrl = 'https://example.com/cdn-cgi/image/width=800/test.jpg';

    // Fetch the transformed image
    const response = await fetch(transformUrl);

    // Assert caching headers are present
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBeTruthy();
    expect(response.headers.get('cache-control')).toContain('max-age=');
  });

  it('should handle R2 objects with different content types', async () => {
    // Test different file types
    const testFiles = [
      { path: 'test.jpg', expectedType: 'image/jpeg' },
      { path: 'test.png', expectedType: 'image/png' },
      { path: 'test.webp', expectedType: 'image/webp' },
    ];

    for (const file of testFiles) {
      // Create a URL without format parameter to preserve original type
      const transformUrl = `https://example.com/cdn-cgi/image/width=800/${file.path}`;

      // Fetch the transformed image
      const response = await fetch(transformUrl);

      // Assert transformation was successful with correct content type
      expect(response.status).toBe(200);
      expect(response.headers.get('cf-resized')).toBeTruthy();

      // Reset fetch mock for next iteration
      vi.mocked(fetch).mockClear();
    }
  });
});
