import { describe, it, expect, vi, beforeEach } from 'vitest';

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
        // Create content based on type
        let bytes: Uint8Array;
        
        if (contentType === 'image/jpeg') {
          bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
        } else if (contentType === 'image/png') {
          bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        } else if (contentType === 'image/webp') {
          bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
        } else {
          bytes = new TextEncoder().encode('Mock content for ' + key);
        }
        
        controller.enqueue(bytes);
        controller.close();
      }
    });
  }
}

// Base R2Bucket interface
interface R2BucketLike {
  get(key: string): Promise<MockR2Object | null>;
  head(key: string): Promise<{ key: string; size: number; contentType?: string } | null>;
  put?(key: string, value: ReadableStream | ArrayBuffer, options?: any): Promise<any>;
  list?(options?: any): Promise<any>;
  delete?(key: string): Promise<any>;
}

// Mock a complete R2 bucket for testing
class MockR2Bucket implements R2BucketLike {
  objects: Map<string, MockR2Object>;
  name: string;
  accessCount: Map<string, number>;
  errorKeys: Set<string>;

  constructor(name: string) {
    this.name = name;
    this.objects = new Map<string, MockR2Object>();
    this.accessCount = new Map<string, number>();
    this.errorKeys = new Set<string>();
    
    // Add some default test objects
    this.addObject('test.jpg', 'image/jpeg', 100000);
    this.addObject('test.png', 'image/png', 150000);
    this.addObject('test.webp', 'image/webp', 80000);
    this.addObject('error-key.jpg', 'image/jpeg', 100000);
  }

  addObject(key: string, contentType: string, size: number, customMetadata?: Record<string, string>) {
    this.objects.set(key, new MockR2Object(key, contentType, size, customMetadata));
    this.accessCount.set(key, 0);
  }

  setErrorKey(key: string) {
    this.errorKeys.add(key);
  }

  async get(key: string): Promise<MockR2Object | null> {
    // Normalize the key
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    // Track access count
    const currentCount = this.accessCount.get(normalizedKey) || 0;
    this.accessCount.set(normalizedKey, currentCount + 1);
    
    // Check if this key should trigger an error
    if (this.errorKeys.has(normalizedKey)) {
      throw new Error(`Simulated R2 error for key: ${normalizedKey}`);
    }
    
    return this.objects.get(normalizedKey) || null;
  }

  async head(key: string): Promise<{ key: string; size: number; contentType?: string; customMetadata?: Record<string, string> } | null> {
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

  // Additional methods that would be on a real R2 bucket
  async put(key: string, value: ReadableStream | ArrayBuffer, options?: any): Promise<any> {
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    
    // Create a simple mock object
    const contentType = options?.httpMetadata?.contentType || 'application/octet-stream';
    const size = value instanceof ArrayBuffer ? value.byteLength : 1000; // Default size for ReadableStream
    
    this.addObject(normalizedKey, contentType, size, options?.customMetadata);
    
    return {
      key: normalizedKey,
      version: 'mock-version-' + Date.now(),
      uploadedAt: new Date()
    };
  }

  async list(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix || '';
    const limit = options?.limit || 1000;
    
    const matchingKeys = Array.from(this.objects.keys())
      .filter(key => key.startsWith(prefix))
      .slice(0, limit)
      .map(key => ({ key }));
    
    return {
      objects: matchingKeys,
      truncated: false
    };
  }

  async delete(key: string): Promise<void> {
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    this.objects.delete(normalizedKey);
  }
}

// Mock class for R2 buckets that implement the basic interface but return null or throw errors
class EmptyMockR2Bucket implements R2BucketLike {
  name: string;
  shouldThrow: boolean;

  constructor(name: string, shouldThrow = false) {
    this.name = name;
    this.shouldThrow = shouldThrow;
  }

  async get(key: string): Promise<MockR2Object | null> {
    if (this.shouldThrow) {
      throw new Error(`Simulated R2 bucket error: ${this.name}`);
    }
    return null;
  }

  async head(key: string): Promise<{ key: string; size: number; contentType?: string } | null> {
    if (this.shouldThrow) {
      throw new Error(`Simulated R2 bucket error: ${this.name}`);
    }
    return null;
  }
}

// Function to process image requests with R2
async function processImageRequest(request: Request, env: Record<string, any>): Promise<Response> {
  try {
    const url = new URL(request.url);
    
    // Check if this is an R2 path
    if (!url.pathname.startsWith('/r2/')) {
      return new Response('Invalid R2 path', { status: 400 });
    }
    
    // Extract key
    const key = url.pathname.substring(3); // Remove /r2/
    if (!key) {
      return new Response('Missing R2 key', { status: 400 });
    }
    
    // Get R2 configuration
    const r2Config = JSON.parse(env.R2_CONFIG || '{}');
    const bucketName = r2Config.binding_name || 'IMAGES_BUCKET';
    
    // Check if bucket exists
    const bucket = env[bucketName];
    if (!bucket) {
      return new Response(`R2 bucket not found: ${bucketName}`, { status: 500 });
    }
    
    try {
      // Fetch object from R2
      const object = await bucket.get(key);
      
      if (!object) {
        return new Response(`Object not found: ${key}`, { status: 404 });
      }
      
      // Extract metadata
      const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
      const contentLength = String(object.size);
      const customMetadata = object.customMetadata || {};
      
      // Create response headers
      const headers = new Headers({
        'content-type': contentType,
        'content-length': contentLength,
        'cache-control': customMetadata['cache-control'] || 'public, max-age=3600',
        'x-r2-bucket': bucketName,
        'x-r2-key': key.startsWith('/') ? key.substring(1) : key,
      });
      
      // Add custom metadata to headers
      Object.entries(customMetadata).forEach(([k, v]) => {
        if (k !== 'cache-control') { // Already added above
          headers.set(`x-meta-${k}`, v);
        }
      });
      
      // Create response from object body
      return new Response(object.body, { 
        status: 200, 
        headers 
      });
    } catch (bucketError) {
      // Handle R2 bucket errors
      console.error('R2 bucket error:', bucketError);
      return new Response(`R2 bucket error: ${bucketError.message}`, { status: 500 });
    }
  } catch (error) {
    // Handle general errors
    console.error('Error processing image request:', error);
    return new Response(`Error processing image request: ${error.message}`, { status: 500 });
  }
}

describe('R2 Bindings Tests', () => {
  let mockImagesBucket: MockR2Bucket;
  let mockAssetsBucket: MockR2Bucket;
  
  beforeEach(() => {
    // Create mock buckets
    mockImagesBucket = new MockR2Bucket('IMAGES_BUCKET');
    mockAssetsBucket = new MockR2Bucket('ASSETS_BUCKET');
    
    // Reset mock
    vi.clearAllMocks();
  });
  
  it('should retrieve an object from the default R2 bucket', async () => {
    // Create environment with default bucket
    const env = {
      IMAGES_BUCKET: mockImagesBucket,
      R2_CONFIG: JSON.stringify({ binding_name: 'IMAGES_BUCKET' })
    };
    
    // Create request for test.jpg
    const request = new Request('https://example.com/r2/test.jpg');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert successful response
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('x-r2-bucket')).toBe('IMAGES_BUCKET');
    expect(response.headers.get('x-r2-key')).toBe('test.jpg');
    
    // Check access count
    expect(mockImagesBucket.accessCount.get('test.jpg')).toBe(1);
  });
  
  it('should retrieve an object from a custom R2 binding', async () => {
    // Create environment with custom bucket
    const env = {
      ASSETS_BUCKET: mockAssetsBucket,
      R2_CONFIG: JSON.stringify({ binding_name: 'ASSETS_BUCKET' })
    };
    
    // Create request
    const request = new Request('https://example.com/r2/test.png');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert successful response
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-r2-bucket')).toBe('ASSETS_BUCKET');
  });
  
  it('should handle missing R2 bindings gracefully', async () => {
    // Create environment without any R2 buckets
    const env = {
      R2_CONFIG: JSON.stringify({ binding_name: 'MISSING_BUCKET' })
    };
    
    // Create request
    const request = new Request('https://example.com/r2/test.jpg');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert error response
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('bucket not found');
  });
  
  it('should handle R2 errors gracefully', async () => {
    // Set an error key
    mockImagesBucket.setErrorKey('error-key.jpg');
    
    // Create environment
    const env = {
      IMAGES_BUCKET: mockImagesBucket,
      R2_CONFIG: JSON.stringify({ binding_name: 'IMAGES_BUCKET' })
    };
    
    // Create request for the error key
    const request = new Request('https://example.com/r2/error-key.jpg');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert error response
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('R2 bucket error');
  });
  
  it('should handle multiple R2 bindings', async () => {
    // Create environment with multiple buckets
    const env = {
      IMAGES_BUCKET: mockImagesBucket,
      ASSETS_BUCKET: mockAssetsBucket,
    };
    
    // Test with different bucket configs
    const tests = [
      { config: { binding_name: 'IMAGES_BUCKET' }, key: 'test.jpg', expectedBucket: 'IMAGES_BUCKET' },
      { config: { binding_name: 'ASSETS_BUCKET' }, key: 'test.webp', expectedBucket: 'ASSETS_BUCKET' },
    ];
    
    for (const test of tests) {
      // Update R2 config
      env.R2_CONFIG = JSON.stringify(test.config);
      
      // Create request
      const request = new Request(`https://example.com/r2/${test.key}`);
      
      // Process the request
      const response = await processImageRequest(request, env);
      
      // Assert correct bucket was used
      expect(response.status).toBe(200);
      expect(response.headers.get('x-r2-bucket')).toBe(test.expectedBucket);
      expect(response.headers.get('x-r2-key')).toBe(test.key);
    }
  });
  
  it('should handle empty R2 buckets gracefully', async () => {
    // Create empty bucket
    const emptyBucket = new EmptyMockR2Bucket('EMPTY_BUCKET');
    
    // Create environment
    const env = {
      EMPTY_BUCKET: emptyBucket,
      R2_CONFIG: JSON.stringify({ binding_name: 'EMPTY_BUCKET' })
    };
    
    // Create request
    const request = new Request('https://example.com/r2/non-existent.jpg');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert 404 response
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('not found');
  });
  
  it('should handle broken R2 buckets gracefully', async () => {
    // Create bucket that throws errors
    const brokenBucket = new EmptyMockR2Bucket('BROKEN_BUCKET', true);
    
    // Create environment
    const env = {
      BROKEN_BUCKET: brokenBucket,
      R2_CONFIG: JSON.stringify({ binding_name: 'BROKEN_BUCKET' })
    };
    
    // Create request
    const request = new Request('https://example.com/r2/any-key.jpg');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert error response
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('R2 bucket error');
  });
  
  it('should return appropriate headers from R2 metadata', async () => {
    // Add object with custom metadata
    mockImagesBucket.addObject('metadata-test.jpg', 'image/jpeg', 200000, {
      'cache-control': 'public, max-age=86400',
      'x-custom-field': 'test-value',
      'content-disposition': 'attachment; filename="test.jpg"',
    });
    
    // Create environment
    const env = {
      IMAGES_BUCKET: mockImagesBucket,
      R2_CONFIG: JSON.stringify({ binding_name: 'IMAGES_BUCKET' })
    };
    
    // Create request
    const request = new Request('https://example.com/r2/metadata-test.jpg');
    
    // Process the request
    const response = await processImageRequest(request, env);
    
    // Assert metadata handling
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(response.headers.get('x-meta-x-custom-field')).toBe('test-value');
    expect(response.headers.get('x-meta-content-disposition')).toBe('attachment; filename="test.jpg"');
  });
});