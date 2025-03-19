import { describe, it, expect, vi, beforeEach } from 'vitest';

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
        // For image types, create content based on type
        let bytes: Uint8Array;

        if (contentType === 'image/jpeg') {
          bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
        } else if (contentType === 'image/png') {
          bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        } else if (contentType === 'image/webp') {
          bytes = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
          ]);
        } else {
          bytes = new TextEncoder().encode('Mock content for ' + key);
        }

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
    this.addObject('metadata-test.jpg', 'image/jpeg', 200000, {
      'cache-control': 'public, max-age=86400',
      'x-custom-field': 'test-value',
    });
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
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    return this.objects.get(normalizedKey) || null;
  }

  async head(key: string): Promise<{
    key: string;
    size: number;
    contentType?: string;
    customMetadata?: Record<string, string>;
  } | null> {
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    const object = this.objects.get(normalizedKey);
    if (!object) return null;

    return {
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata.contentType,
      customMetadata: object.customMetadata,
    };
  }
}

// Create a simple test function for fetching R2 objects directly
async function fetchR2Object(
  bucket: MockR2Bucket,
  key: string,
  transformOptions?: Record<string, string>
): Promise<Response> {
  // Get the object from the bucket
  const object = await bucket.get(key);

  if (!object) {
    return new Response('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // Create a response with the object's properties
  const headers = new Headers({
    'content-type': object.httpMetadata.contentType,
    'content-length': String(object.size),
    'cache-control': object.customMetadata?.['cache-control'] || 'public, max-age=3600',
  });

  // Add custom metadata to headers
  if (object.customMetadata) {
    Object.entries(object.customMetadata).forEach(([key, value]) => {
      if (key !== 'cache-control') {
        // cache-control already added
        headers.set(key, value);
      }
    });
  }

  // If transformation options are provided, apply them
  if (transformOptions) {
    // Apply width transformation
    if (transformOptions.width) {
      const width = parseInt(transformOptions.width);
      // Simulate content length reduction based on width
      if (!isNaN(width)) {
        const newSize = Math.floor(object.size * (width / 1000));
        headers.set('content-length', String(newSize));

        // Add resizing header
        headers.set('cf-resized', `internal=ok/- q=80 n=${width}`);
      }
    }

    // Apply format transformation
    if (transformOptions.format) {
      const format = transformOptions.format;

      if (format === 'webp') {
        headers.set('content-type', 'image/webp');
        // WebP is typically smaller than JPEG
        const currentSize = parseInt(headers.get('content-length') || String(object.size));
        headers.set('content-length', String(Math.floor(currentSize * 0.8)));
      } else if (format === 'avif') {
        headers.set('content-type', 'image/avif');
        // AVIF is even smaller than WebP
        const currentSize = parseInt(headers.get('content-length') || String(object.size));
        headers.set('content-length', String(Math.floor(currentSize * 0.7)));
      }
    }

    // Apply quality transformation
    if (transformOptions.quality) {
      const quality = parseInt(transformOptions.quality);
      if (!isNaN(quality)) {
        const currentSize = parseInt(headers.get('content-length') || String(object.size));
        headers.set('content-length', String(Math.floor(currentSize * (quality / 100))));

        // Update resizing header with quality
        const existingResized = headers.get('cf-resized') || 'internal=ok/-';
        headers.set('cf-resized', `${existingResized} q=${quality}`);
      }
    }

    // Add debug header if requested
    if (transformOptions.debug) {
      headers.set('debug-r2', 'true');
      headers.set('debug-ir', JSON.stringify(transformOptions));
    }
  }

  // Get content from object's body stream
  const reader = object.body.getReader();
  const { value } = await reader.read();

  return new Response(value, {
    status: 200,
    headers,
  });
}

describe('Direct R2 Object Access and Transformation', () => {
  let mockR2Bucket: MockR2Bucket;

  beforeEach(() => {
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');
  });

  it('should retrieve different image formats directly from R2', async () => {
    // Test with different image formats
    const imageFormats = [
      { key: 'test.jpg', contentType: 'image/jpeg' },
      { key: 'test.png', contentType: 'image/png' },
      { key: 'test.webp', contentType: 'image/webp' },
    ];

    for (const format of imageFormats) {
      // Fetch the object directly
      const response = await fetchR2Object(mockR2Bucket, format.key);

      // Assert correct retrieval
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe(format.contentType);
      expect(parseInt(response.headers.get('content-length') || '0')).toBeGreaterThan(0);
    }
  });

  it('should handle non-existent objects with 404 responses', async () => {
    // Fetch a non-existent object
    const response = await fetchR2Object(mockR2Bucket, 'does-not-exist.jpg');

    // Assert 404 response
    expect(response.status).toBe(404);
  });

  it('should apply width transformation to R2 objects', async () => {
    // Fetch with width transformation
    const response = await fetchR2Object(mockR2Bucket, 'test.jpg', { width: '800' });

    // Assert transformation
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toContain('n=800');

    // Content length should be reduced
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(100000); // Original size
    expect(contentLength).toBeGreaterThan(0);
  });

  it('should convert image formats for R2 objects', async () => {
    // Test format conversion from JPEG to WebP
    const response = await fetchR2Object(mockR2Bucket, 'test.jpg', { format: 'webp' });

    // Assert format conversion
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');

    // Content length should be reduced due to WebP compression
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(100000); // Original size
  });

  it('should apply quality settings to R2 objects', async () => {
    // Test with quality parameter
    const response = await fetchR2Object(mockR2Bucket, 'test.jpg', { quality: '50' });

    // Assert quality transformation
    expect(response.status).toBe(200);
    expect(response.headers.get('cf-resized')).toContain('q=50');

    // Content length should be reduced due to quality setting
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(100000); // Original size
    expect(contentLength).toBeGreaterThan(0);
  });

  it('should apply multiple transformations simultaneously', async () => {
    // Test with multiple parameters
    const response = await fetchR2Object(mockR2Bucket, 'test.jpg', {
      width: '400',
      format: 'webp',
      quality: '75',
    });

    // Assert all transformations
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cf-resized')).toContain('n=400');
    expect(response.headers.get('cf-resized')).toContain('q=75');

    // Content length should be significantly reduced
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    expect(contentLength).toBeLessThan(50000); // Should be much smaller due to all transformations
  });

  it('should preserve custom metadata from R2 objects', async () => {
    // Fetch object with custom metadata
    const response = await fetchR2Object(mockR2Bucket, 'metadata-test.jpg');

    // Assert custom metadata
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(response.headers.get('x-custom-field')).toBe('test-value');
  });

  it('should add debug headers when requested', async () => {
    // Fetch with debug option
    const response = await fetchR2Object(mockR2Bucket, 'test.jpg', {
      width: '800',
      debug: 'true',
    });

    // Assert debug headers
    expect(response.status).toBe(200);
    expect(response.headers.get('debug-r2')).toBe('true');
    expect(response.headers.get('debug-ir')).toBeTruthy();

    // Parse debug info
    const debugInfo = JSON.parse(response.headers.get('debug-ir') || '{}');
    expect(debugInfo.width).toBe('800');
    expect(debugInfo.debug).toBe('true');
  });
});
