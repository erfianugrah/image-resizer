/**
 * Tests for the R2 Image Processor Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createR2ImageProcessorService } from '../../src/services/r2ImageProcessorService';
import { ImageTransformOptions } from '../../src/types/services/image';

// Mock R2 bucket and object for testing
class MockR2Object implements R2Object {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: R2HTTPMetadata | undefined;
  customMetadata?: Record<string, string> | undefined;
  body: ReadableStream;

  constructor(key: string, type = 'image/jpeg') {
    this.key = key;
    this.size = 1000;
    this.etag = 'etag-123';
    this.httpMetadata = {
      contentType: type,
    };

    // Create a simple readable stream with some content
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode('test-content');
    this.body = new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });
  }
}

class MockR2Bucket implements R2Bucket {
  objects: Map<string, R2Object | null>;

  constructor() {
    this.objects = new Map();
    // Add some test objects
    this.objects.set('test.jpg', new MockR2Object('test.jpg'));
    this.objects.set('test.png', new MockR2Object('test.png', 'image/png'));
    this.objects.set('error.jpg', null); // To simulate not found
  }

  async head(key: string): Promise<R2Object | null> {
    return this.objects.get(key) || null;
  }

  async get(key: string): Promise<R2Object | null> {
    return this.objects.get(key) || null;
  }

  async put(): Promise<R2Object> {
    throw new Error('Not implemented');
  }

  async delete(): Promise<void> {
    throw new Error('Not implemented');
  }

  async list(): Promise<R2Objects> {
    throw new Error('Not implemented');
  }

  async createMultipartUpload(): Promise<R2MultipartUpload> {
    throw new Error('Not implemented');
  }

  async resumeMultipartUpload(): Promise<R2MultipartUpload> {
    throw new Error('Not implemented');
  }
}

// Create a minimal logger mock
const createLoggerMock = () => ({
  // The minimal logger interface doesn't have the module name parameter
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
});

// Create a cache mock
const createCacheMock = () => ({
  determineCacheControl: vi.fn().mockReturnValue('public, max-age=86400'),
});

describe('R2ImageProcessorService', () => {
  let r2Bucket: MockR2Bucket;
  let logger: ReturnType<typeof createLoggerMock>;
  let cache: ReturnType<typeof createCacheMock>;

  // Setup before each test
  beforeEach(() => {
    r2Bucket = new MockR2Bucket();
    logger = createLoggerMock();
    cache = createCacheMock();

    // Reset fetch mock
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should process an image directly when no transformations are requested', async () => {
    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Define test options with no transformations
    const options: ImageTransformOptions = {};

    // Process the image
    const response = await r2Processor.processR2Image(
      'test.jpg',
      r2Bucket,
      options,
      new Request('https://example.com/test.jpg'),
      { cacheability: true, ttl: { ok: 86400 } }
    );

    // Verify the response
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('X-Source')).toBe('r2-direct');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');

    // Verify logger was called - with minimal logger format
    expect(logger.info).toHaveBeenCalledWith(
      'Successfully retrieved object from R2',
      expect.objectContaining({ key: 'test.jpg' })
    );
  });

  it('should handle non-existent objects with 404 response', async () => {
    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Process a non-existent image
    const response = await r2Processor.processR2Image(
      'error.jpg',
      r2Bucket,
      {},
      new Request('https://example.com/error.jpg'),
      { cacheability: true, ttl: { ok: 86400 } }
    );

    // Verify the response
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('X-Source')).toBe('r2-not-found');

    // Verify logger was called - with minimal logger format
    expect(logger.debug).toHaveBeenCalledWith(
      'Object not found in R2',
      expect.objectContaining({ key: 'error.jpg' })
    );
  });

  it('should try CDN-CGI approach when transformations are requested', async () => {
    // Mock successful fetch response
    const mockResponse = new Response('transformed', {
      headers: {
        'Content-Type': 'image/jpeg',
        'cf-resized': 'width=100',
        'Content-Length': '500',
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Define test options with transformations
    const options: ImageTransformOptions = {
      width: 100,
      height: 100,
      fit: 'cover',
      quality: 80,
    };

    // Process the image
    const response = await r2Processor.processR2Image(
      'test.jpg',
      r2Bucket,
      options,
      new Request('https://example.com/test.jpg'),
      { cacheability: true, ttl: { ok: 86400 } },
      'https://cdn.example.com'
    );

    // Verify the response
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Source')).toBe('r2-cf-proxy-transform');

    // Verify fetch was called with a URL
    expect(fetchMock).toHaveBeenCalled();

    // Check that the fetch URL contains the key elements without being too strict on format
    const fetchUrl = fetchMock.mock.calls[0][0];
    expect(typeof fetchUrl).toBe('string');
    expect(fetchUrl).toContain('cdn-cgi/image/');
  });

  it('should handle fallback chain if CDN-CGI fails', async () => {
    // Mock failed CDN-CGI response but successful direct URL response
    const failedResponse = new Response('error', { status: 500 });
    const successResponse = new Response('success', {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'cf-resized': 'width=100',
        'Content-Length': '500',
      },
    });

    // Create a fetch mock that fails first time, succeeds second time
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call (CDN-CGI) fails
        return Promise.resolve(failedResponse);
      } else {
        // Second call (direct URL) succeeds
        return Promise.resolve(successResponse);
      }
    });

    vi.stubGlobal('fetch', fetchMock);

    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Define test options with transformations
    const options: ImageTransformOptions = {
      width: 100,
    };

    // Process the image
    const response = await r2Processor.processR2Image(
      'test.jpg',
      r2Bucket,
      options,
      new Request('https://example.com/test.jpg'),
      { cacheability: true, ttl: { ok: 86400 } },
      'https://cdn.example.com'
    );

    // Verify the response
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second call should be to the direct URL method
    const secondCallUrl = fetchMock.mock.calls[1][0];
    expect(secondCallUrl).not.toContain('/cdn-cgi/image/');

    // Just check that the calls were made - the specific URL format may vary
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should fall back to direct R2 response if all transformation methods fail', async () => {
    // Mock failed responses for all approaches
    const failedResponse = new Response('error', { status: 500 });
    const fetchMock = vi.fn().mockResolvedValue(failedResponse);
    vi.stubGlobal('fetch', fetchMock);

    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Define test options with transformations
    const options: ImageTransformOptions = {
      width: 100,
    };

    // Process the image
    const response = await r2Processor.processR2Image(
      'test.jpg',
      r2Bucket,
      options,
      new Request('https://example.com/test.jpg'),
      { cacheability: true, ttl: { ok: 86400 } },
      'https://cdn.example.com'
    );

    // Verify direct R2 response was used as fallback
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Source')).toBe('r2-direct-fallback');
    expect(response.headers.get('X-Transform-Failed')).toBe('true');
    expect(response.headers.get('X-Transform-Attempts')).toBeTruthy();
  });

  it('should use the correct content type for different file types', async () => {
    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Process a PNG image
    const response = await r2Processor.processR2Image(
      'test.png',
      r2Bucket,
      {},
      new Request('https://example.com/test.png'),
      { cacheability: true, ttl: { ok: 86400 } }
    );

    // Verify the content type was set correctly
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('should handle errors with R2 bucket gracefully', async () => {
    // Create a bucket that throws errors
    const errorBucket = {
      get: vi.fn().mockRejectedValue(new Error('R2 bucket error')),
      head: vi.fn().mockRejectedValue(new Error('R2 bucket error')),
    } as unknown as R2Bucket;

    // Create the service
    const r2Processor = createR2ImageProcessorService({
      logger,
      cache,
    });

    // Process an image with the error bucket
    const response = await r2Processor.processR2Image(
      'test.jpg',
      errorBucket,
      {},
      new Request('https://example.com/test.jpg'),
      { cacheability: true, ttl: { ok: 86400 } }
    );

    // Verify error response
    expect(response.status).toBe(500);
    expect(response.headers.get('X-Error-Code')).toBe('R2_PROCESSING_FAILED');
    expect(response.headers.get('X-Error-Source')).toBe('r2-processor');

    // Verify logger was called with error - using minimal logger format
    expect(logger.error).toHaveBeenCalledWith(
      'Error processing R2 image',
      expect.objectContaining({
        error: 'R2 bucket error',
        code: 'R2_PROCESSING_FAILED',
      })
    );
  });
});
