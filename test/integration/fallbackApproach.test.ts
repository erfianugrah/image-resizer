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
        const bytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // Simple JPEG header
        controller.enqueue(bytes);
        controller.close();
      }
    });
  }
}

// Mock a complete R2 bucket for testing
class MockR2Bucket {
  objects: Map<string, MockR2Object>;
  name: string;
  getError: boolean = false;
  getErrorKey: string | null = null;

  constructor(name: string) {
    this.name = name;
    this.objects = new Map<string, MockR2Object>();
    
    // Add some default test objects
    this.addObject('test.jpg', 'image/jpeg', 100000);
    this.addObject('test.png', 'image/png', 150000);
    this.addObject('error-trigger.jpg', 'image/jpeg', 100000);
  }

  addObject(key: string, contentType: string, size: number) {
    this.objects.set(key, new MockR2Object(key, contentType, size));
  }

  // Special method to configure error triggering
  setErrorMode(enabled: boolean, specificKey: string | null = null) {
    this.getError = enabled;
    this.getErrorKey = specificKey;
  }

  async get(key: string): Promise<MockR2Object | null> {
    // Check if error mode is enabled for all keys or this specific key
    if (this.getError && (this.getErrorKey === null || key === this.getErrorKey)) {
      throw new Error(`Simulated R2 error for key: ${key}`);
    }
    
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

// Implement the fallback strategy for testing
async function fetchWithFallback(
  key: string,
  r2Bucket: MockR2Bucket,
  options: { 
    width?: string;
    format?: string;
    quality?: string;
  } = {}
): Promise<Response> {
  try {
    // APPROACH 1: Try to get the object directly from R2 first
    const object = await r2Bucket.get(key);
    
    if (!object) {
      return new Response('Not Found', { 
        status: 404, 
        headers: { 'content-type': 'text/plain' }
      });
    }
    
    // If no transformations are needed, return the original object
    if (!options.width && !options.format && !options.quality) {
      return new Response(await streamToBuffer(object.body), {
        status: 200,
        headers: {
          'content-type': object.httpMetadata.contentType,
          'content-length': String(object.size),
          'cache-control': 'public, max-age=3600',
          'x-source': 'r2-direct',
        }
      });
    }
    
    try {
      // APPROACH 2: Try direct R2 transformation (simulated)
      // In a real implementation, this might fail for various reasons
      
      // We'll simulate a failure for certain objects
      if (key === 'error-trigger.jpg') {
        throw new Error('Simulated direct transformation error');
      }
      
      const headers = new Headers({
        'content-type': options.format === 'webp' ? 'image/webp' : object.httpMetadata.contentType,
        'content-length': String(Math.floor(object.size * 0.8)), // Simulate reduced size
        'cache-control': 'public, max-age=3600',
        'x-source': 'r2-direct-transform',
      });
      
      // Add resizing headers
      if (options.width) {
        headers.set('cf-resized', `internal=ok/- n=${options.width} q=${options.quality || 80}`);
      }
      
      return new Response('Transformed Image Data', { 
        status: 200, 
        headers
      });
    } catch (directError) {
      console.log('Direct transformation failed, trying CDN-CGI approach:', directError);
      
      // APPROACH 3: Fall back to CDN-CGI pattern
      // Build the CDN-CGI URL
      let cdnCgiUrl = 'https://example.com/cdn-cgi/image/';
      const params = [];
      
      if (options.width) params.push(`width=${options.width}`);
      if (options.format) params.push(`format=${options.format}`);
      if (options.quality) params.push(`quality=${options.quality}`);
      
      cdnCgiUrl += params.join(',') + '/' + key;
      
      // Fetch using CDN-CGI pattern
      try {
        const response = await fetch(cdnCgiUrl);
        
        // Add source header to indicate it came from the fallback path
        const newHeaders = new Headers(response.headers);
        newHeaders.set('x-source', 'r2-cdn-cgi-fallback');
        
        return new Response(response.body, {
          status: response.status,
          headers: newHeaders,
        });
      } catch (cdnCgiError) {
        console.log('CDN-CGI approach failed, trying remote fetch:', cdnCgiError);
        
        // APPROACH 4: Fall back to remote fetch if all else fails
        try {
          const remoteUrl = `https://cdn.example.com/${key}`;
          const response = await fetch(remoteUrl);
          
          // Add source header
          const newHeaders = new Headers(response.headers);
          newHeaders.set('x-source', 'r2-remote-fallback');
          
          return new Response(response.body, {
            status: response.status,
            headers: newHeaders,
          });
        } catch (remoteError) {
          // If all fallback approaches fail, return the original error
          console.error('All fallback approaches failed:', remoteError);
          throw directError;
        }
      }
    }
  } catch (error) {
    // If even the initial R2 fetch fails
    console.error('Failed to fetch object from R2:', error);
    return new Response('Error fetching from R2', { 
      status: 500, 
      headers: { 'content-type': 'text/plain' }
    });
  }
}

// Helper function to convert ReadableStream to Buffer
async function streamToBuffer(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const { value } = await reader.read();
  return value || new Uint8Array();
}

describe('Multi-layered Fallback Approach for R2', () => {
  let mockR2Bucket: MockR2Bucket;
  
  beforeEach(() => {
    mockR2Bucket = new MockR2Bucket('IMAGES_BUCKET');
    
    // Mock fetch for CDN-CGI and remote fallbacks
    vi.mocked(fetch).mockImplementation((url) => {
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      // CDN-CGI pattern response
      if (urlString.includes('/cdn-cgi/image/')) {
        // Parse parameters from URL
        const paramsMatch = urlString.match(/\/cdn-cgi\/image\/([^/]+)/);
        const params = paramsMatch ? paramsMatch[1].split(',') : [];
        
        // Create parameter map
        const paramMap: Record<string, string> = {};
        params.forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) paramMap[key] = value;
        });
        
        // Determine content type based on format parameter
        let contentType = 'image/jpeg';
        if (paramMap.format === 'webp') contentType = 'image/webp';
        
        // Create response headers
        const headers = new Headers({
          'content-type': contentType,
          'content-length': '50000', // Smaller than original
          'cf-resized': `internal=ok/- q=${paramMap.quality || 80}${paramMap.width ? ` n=${paramMap.width}` : ''}`,
          'cache-control': 'public, max-age=3600',
        });
        
        return Promise.resolve(new Response('CDN-CGI Transformed Image', { 
          status: 200, 
          headers 
        }));
      }
      
      // Remote fallback response
      if (urlString.includes('cdn.example.com')) {
        return Promise.resolve(new Response('Remote Image Data', { 
          status: 200,
          headers: {
            'content-type': 'image/jpeg',
            'content-length': '100000',
            'cache-control': 'public, max-age=3600',
          }
        }));
      }
      
      // Default response for any other URLs
      return Promise.resolve(new Response('Unknown Source', { status: 404 }));
    });
    
    // Reset fetch mock before each test
    vi.mocked(fetch).mockClear();
  });
  
  it('should use direct R2 access when no transformations are needed', async () => {
    // Fetch without any transformation options
    const response = await fetchWithFallback('test.jpg', mockR2Bucket);
    
    // Assert direct access was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-source')).toBe('r2-direct');
    
    // No fetch calls should have been made
    expect(fetch).not.toHaveBeenCalled();
  });
  
  it('should use direct R2 transformation when possible', async () => {
    // Fetch with transformation options
    const response = await fetchWithFallback('test.jpg', mockR2Bucket, {
      width: '800',
      format: 'webp',
    });
    
    // Assert direct transformation was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-source')).toBe('r2-direct-transform');
    
    // No fetch calls should have been made
    expect(fetch).not.toHaveBeenCalled();
  });
  
  it('should fall back to CDN-CGI pattern when direct transformation fails', async () => {
    // Fetch a file that triggers an error in direct transformation
    const response = await fetchWithFallback('error-trigger.jpg', mockR2Bucket, {
      width: '800',
      format: 'webp',
    });
    
    // Assert fallback to CDN-CGI was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-source')).toBe('r2-cdn-cgi-fallback');
    
    // Verify fetch was called with CDN-CGI URL
    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl] = vi.mocked(fetch).mock.lastCall || [];
    const url = typeof fetchUrl === 'string' ? fetchUrl : fetchUrl?.url;
    expect(url).toContain('/cdn-cgi/image/');
    expect(url).toContain('width=800');
    expect(url).toContain('format=webp');
  });
  
  it('should fall back to remote fetch if both direct and CDN-CGI fail', async () => {
    // Setup to make CDN-CGI approach fail
    vi.mocked(fetch).mockImplementationOnce(() => {
      throw new Error('Simulated CDN-CGI error');
    });
    
    // Fetch a file that triggers an error in direct transformation
    const response = await fetchWithFallback('error-trigger.jpg', mockR2Bucket, {
      width: '800',
    });
    
    // Assert fallback to remote was used
    expect(response.status).toBe(200);
    expect(response.headers.get('x-source')).toBe('r2-remote-fallback');
    
    // Verify fetch was called twice (once for CDN-CGI, once for remote)
    expect(fetch).toHaveBeenCalledTimes(2);
    
    // Check the second call was to the remote URL
    const calls = vi.mocked(fetch).mock.calls;
    const lastUrl = typeof calls[1][0] === 'string' ? calls[1][0] : calls[1][0]?.url;
    expect(lastUrl).toContain('cdn.example.com');
  });
  
  it('should handle R2 fetch errors gracefully', async () => {
    // Configure R2 bucket to throw errors
    mockR2Bucket.setErrorMode(true);
    
    // Try to fetch an object
    const response = await fetchWithFallback('test.jpg', mockR2Bucket);
    
    // Assert error handling
    expect(response.status).toBe(500);
    expect(await response.text()).toContain('Error fetching from R2');
  });
  
  it('should handle not found objects with 404 responses', async () => {
    // Fetch a non-existent object
    const response = await fetchWithFallback('does-not-exist.jpg', mockR2Bucket);
    
    // Assert 404 response
    expect(response.status).toBe(404);
  });
  
  it('should log each fallback attempt for debugging', async () => {
    // Spy on console.log
    const consoleLogSpy = vi.spyOn(console, 'log');
    
    // Setup to make both direct transformation and CDN-CGI approach fail
    vi.mocked(fetch).mockImplementationOnce(() => {
      throw new Error('Simulated CDN-CGI error');
    });
    
    // Fetch a file that triggers the fallback chain
    await fetchWithFallback('error-trigger.jpg', mockR2Bucket, {
      width: '800',
    });
    
    // Verify logging of fallback attempts
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Direct transformation failed'),
      expect.any(Error)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('CDN-CGI approach failed'),
      expect.any(Error)
    );
    
    // Clean up
    consoleLogSpy.mockRestore();
  });
  
  it('should preserve transformation parameters through the fallback chain', async () => {
    // Fetch with specific parameters
    const response = await fetchWithFallback('error-trigger.jpg', mockR2Bucket, {
      width: '600',
      format: 'webp',
      quality: '85',
    });
    
    // Assert transformation parameters were preserved
    expect(response.status).toBe(200);
    
    // Check the URL used in fetch includes all parameters
    const [fetchUrl] = vi.mocked(fetch).mock.lastCall || [];
    const url = typeof fetchUrl === 'string' ? fetchUrl : fetchUrl?.url;
    expect(url).toContain('width=600');
    expect(url).toContain('format=webp');
    expect(url).toContain('quality=85');
  });
});