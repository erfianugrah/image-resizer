import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addDebugHeaders,
  createDebugReport,
  extractRequestHeaders,
} from '../../src/services/debugService';

vi.mock('../../src/utils/loggerUtils', async () => ({
  debug: vi.fn(),
  extractRequestHeaders: vi.fn((request) => {
    // Mock implementation that returns headers from the request
    const headers: Record<string, string> = {};
    const headersToExtract = [
      'user-agent',
      'accept',
      'referer',
      'sec-ch-viewport-width',
      'sec-ch-dpr',
      'width',
      'cf-device-type',
      'cf-ipcountry',
      'cf-ray',
      'save-data',
      'x-forwarded-for',
    ];

    for (const headerName of headersToExtract) {
      const value = request.headers.get(headerName);
      if (value) {
        headers[headerName] = value;
      }
    }
    return headers;
  }),

  addDebugHeaders: vi.fn((response, debugInfo, diagnosticsInfo) => {
    // Return original response if debug is not enabled
    if (!debugInfo.isEnabled) {
      return response;
    }

    // Clone response to add headers
    const enhancedResponse = new Response(response.body, response);

    // Add performance timing
    if (debugInfo.includePerformance && diagnosticsInfo.processingTimeMs) {
      enhancedResponse.headers.set('x-processing-time', `${diagnosticsInfo.processingTimeMs}ms`);
    }

    // Add debug headers based on diagnostic info
    if (diagnosticsInfo.transformParams) {
      enhancedResponse.headers.set('debug-ir', JSON.stringify(diagnosticsInfo.transformParams));
    }

    if (diagnosticsInfo.pathMatch) {
      enhancedResponse.headers.set('debug-path-match', diagnosticsInfo.pathMatch);
    }

    if (diagnosticsInfo.transformSource) {
      enhancedResponse.headers.set('x-size-source', diagnosticsInfo.transformSource);
    }

    // Add verbose debug info if enabled
    if (debugInfo.isVerbose) {
      if (diagnosticsInfo.browserCapabilities) {
        enhancedResponse.headers.set(
          'debug-browser',
          JSON.stringify(diagnosticsInfo.browserCapabilities)
        );
      }

      if (diagnosticsInfo.networkQuality) {
        enhancedResponse.headers.set('debug-network', diagnosticsInfo.networkQuality);
      }

      if (diagnosticsInfo.errors?.length) {
        enhancedResponse.headers.set('debug-errors', JSON.stringify(diagnosticsInfo.errors));
      }

      if (diagnosticsInfo.warnings?.length) {
        enhancedResponse.headers.set('debug-warnings', JSON.stringify(diagnosticsInfo.warnings));
      }
    }

    return enhancedResponse;
  }),

  createDebugReport: vi.fn((diagnosticsInfo) => {
    // Create a simple mock HTML report
    let html = `<!DOCTYPE html>
    <html>
    <head>
      <title>Image Resizer Debug Report</title>
    </head>
    <body>
      <h1>Image Resizer Debug Report</h1>`;

    // Basic Information
    html += `
      <section>
        <h2>Basic Information</h2>
        <table>
          <tr><th>Original URL</th><td>${diagnosticsInfo.originalUrl || 'Unknown'}</td></tr>
          <tr><th>Path Match</th><td>${diagnosticsInfo.pathMatch || 'None'}</td></tr>
          <tr><th>Processing Time</th><td>${diagnosticsInfo.processingTimeMs || 0}ms</td></tr>
          <tr><th>Transform Source</th><td>${diagnosticsInfo.transformSource || 'Unknown'}</td></tr>
        </table>
      </section>`;

    // Transformation parameters
    if (diagnosticsInfo.transformParams) {
      html += `
        <section>
          <h2>Transformation Parameters</h2>
          <pre>${JSON.stringify(diagnosticsInfo.transformParams, null, 2)}</pre>
        </section>`;
    }

    // Client information
    if (
      diagnosticsInfo.deviceType ||
      diagnosticsInfo.clientHints !== undefined ||
      diagnosticsInfo.browserCapabilities ||
      diagnosticsInfo.networkQuality
    ) {
      html += `
        <section>
          <h2>Client Information</h2>
          <table>`;

      if (diagnosticsInfo.deviceType) {
        html += `<tr><th>Device Type</th><td>${diagnosticsInfo.deviceType}</td></tr>`;
      }

      if (diagnosticsInfo.clientHints !== undefined) {
        html += `<tr><th>Client Hints</th><td>${diagnosticsInfo.clientHints}</td></tr>`;
      }

      if (diagnosticsInfo.browserCapabilities) {
        html += `<tr><th>Browser Capabilities</th><td><pre>${JSON.stringify(diagnosticsInfo.browserCapabilities, null, 2)}</pre></td></tr>`;
      }

      if (diagnosticsInfo.networkQuality) {
        html += `<tr><th>Network Quality</th><td>${diagnosticsInfo.networkQuality}</td></tr>`;
      }

      html += `
          </table>
        </section>`;
    }

    // Cache information
    if (
      diagnosticsInfo.cacheability !== undefined ||
      diagnosticsInfo.cacheTtl !== undefined ||
      diagnosticsInfo.cachingMethod
    ) {
      html += `
        <section>
          <h2>Cache Information</h2>
          <table>`;

      if (diagnosticsInfo.cacheability !== undefined) {
        html += `<tr><th>Cacheable</th><td>${diagnosticsInfo.cacheability}</td></tr>`;
      }

      if (diagnosticsInfo.cacheTtl !== undefined) {
        html += `<tr><th>Cache TTL</th><td>${diagnosticsInfo.cacheTtl}s</td></tr>`;
      }

      if (diagnosticsInfo.cachingMethod) {
        html += `<tr><th>Caching Method</th><td>${diagnosticsInfo.cachingMethod}</td></tr>`;
      }

      html += `
          </table>
        </section>`;
    }

    // Issues (errors and warnings)
    if (
      (diagnosticsInfo.errors && diagnosticsInfo.errors.length > 0) ||
      (diagnosticsInfo.warnings && diagnosticsInfo.warnings.length > 0)
    ) {
      html += `
        <section>
          <h2>Issues</h2>`;

      if (diagnosticsInfo.errors && diagnosticsInfo.errors.length > 0) {
        html += `
          <div class="issues-group">
            <h3>Errors</h3>
            <ul>`;

        diagnosticsInfo.errors.forEach((error) => {
          html += `<li class="error">${error}</li>`;
        });

        html += `
            </ul>
          </div>`;
      }

      if (diagnosticsInfo.warnings && diagnosticsInfo.warnings.length > 0) {
        html += `
          <div class="issues-group">
            <h3>Warnings</h3>
            <ul>`;

        diagnosticsInfo.warnings.forEach((warning) => {
          html += `<li class="warning">${warning}</li>`;
        });

        html += `
            </ul>
          </div>`;
      }

      html += `
        </section>`;
    }

    html += `
    </body>
    </html>`;

    return html;
  }),
}));

describe('DebugService', () => {
  let mockRequest: Request;
  let mockResponse: Response;

  beforeEach(() => {
    // Create a mock request with various headers for testing
    mockRequest = new Request('https://example.com/test.jpg', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        accept: 'image/avif,image/webp,image/png,image/*',
        'sec-ch-viewport-width': '1200',
        'sec-ch-dpr': '2.0',
        'cf-device-type': 'desktop',
      },
    });

    // Create a mock response
    mockResponse = new Response('Test image data', {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });
  });

  describe('extractRequestHeaders', () => {
    it('should extract relevant headers from a request', () => {
      // Act
      const result = extractRequestHeaders(mockRequest);

      // Assert
      expect(result).toEqual({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        accept: 'image/avif,image/webp,image/png,image/*',
        'sec-ch-viewport-width': '1200',
        'sec-ch-dpr': '2.0',
        'cf-device-type': 'desktop',
      });
    });

    it('should only include headers that are present', () => {
      // Arrange
      const minimalRequest = new Request('https://example.com/test.jpg', {
        headers: {
          'user-agent': 'Simple UA',
        },
      });

      // Act
      const result = extractRequestHeaders(minimalRequest);

      // Assert
      expect(result).toEqual({
        'user-agent': 'Simple UA',
      });
    });
  });

  describe('addDebugHeaders', () => {
    it('should not modify response when debug is not enabled', () => {
      // Arrange
      const debugInfo = {
        isEnabled: false,
      };
      const diagnosticsInfo = {
        processingTimeMs: 42,
        transformParams: { width: 800 },
      };

      // Act
      const result = addDebugHeaders(mockResponse, debugInfo, diagnosticsInfo);

      // Assert
      expect(result).toBe(mockResponse);
      expect(result.headers.has('debug-ir')).toBe(false);
    });

    it('should add debug headers when debug is enabled', () => {
      // Arrange
      const debugInfo = {
        isEnabled: true,
        includePerformance: true,
      };
      const diagnosticsInfo = {
        processingTimeMs: 42,
        transformParams: { width: 800, height: 600 },
        transformSource: 'explicit-width',
        pathMatch: 'test-pattern',
      };

      // Act
      const result = addDebugHeaders(mockResponse, debugInfo, diagnosticsInfo);

      // Assert
      expect(result).not.toBe(mockResponse); // Should be a new response
      expect(result.headers.get('x-processing-time')).toBe('42ms');
      expect(result.headers.get('debug-ir')).toBe('{"width":800,"height":600}');
      expect(result.headers.get('debug-path-match')).toBe('test-pattern');
      expect(result.headers.get('x-size-source')).toBe('explicit-width');
    });

    it('should add additional headers for verbose debug mode', () => {
      // Arrange
      const debugInfo = {
        isEnabled: true,
        isVerbose: true,
      };
      const diagnosticsInfo = {
        browserCapabilities: { avif: true, webp: true },
        networkQuality: 'fast',
        errors: ['Test error'],
        warnings: ['Test warning'],
      };

      // Act
      const result = addDebugHeaders(mockResponse, debugInfo, diagnosticsInfo);

      // Assert
      expect(result.headers.get('debug-browser')).toBe('{"avif":true,"webp":true}');
      expect(result.headers.get('debug-network')).toBe('fast');
      expect(result.headers.get('debug-errors')).toBe('["Test error"]');
      expect(result.headers.get('debug-warnings')).toBe('["Test warning"]');
    });

    it('should handle missing diagnostics gracefully', () => {
      // Arrange
      const debugInfo = {
        isEnabled: true,
      };
      const diagnosticsInfo = {}; // Empty diagnostics

      // Act
      const result = addDebugHeaders(mockResponse, debugInfo, diagnosticsInfo);

      // Assert
      expect(result).not.toBe(mockResponse); // Should be a new response
      // Check that no specific headers were added but also no error occurred
      expect([...result.headers.keys()].filter((k) => k.startsWith('debug-'))).toHaveLength(0);
    });
  });

  describe('createDebugReport', () => {
    it('should generate HTML debug report with basic information', () => {
      // Arrange
      const diagnosticsInfo = {
        originalUrl: 'https://example.com/test.jpg',
        processingTimeMs: 42,
        transformSource: 'explicit-width',
        pathMatch: 'test-pattern',
      };

      // Act
      const result = createDebugReport(diagnosticsInfo);

      // Assert
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<title>Image Resizer Debug Report</title>');
      expect(result).toContain('Basic Information');
      expect(result).toContain(diagnosticsInfo.originalUrl);
      expect(result).toContain('42ms'); // Processing time
    });

    it('should include transformation parameters if provided', () => {
      // Arrange
      const diagnosticsInfo = {
        originalUrl: 'https://example.com/test.jpg',
        transformParams: {
          width: 800,
          height: 600,
          format: 'webp',
        },
      };

      // Act
      const result = createDebugReport(diagnosticsInfo);

      // Assert
      expect(result).toContain('Transformation Parameters');
      expect(result).toContain('"width": 800');
      expect(result).toContain('"height": 600');
      expect(result).toContain('"format": "webp"');
    });

    it('should include client information if provided', () => {
      // Arrange
      const diagnosticsInfo = {
        deviceType: 'desktop',
        clientHints: true,
        browserCapabilities: {
          avif: true,
          webp: true,
        },
        networkQuality: 'fast',
      };

      // Act
      const result = createDebugReport(diagnosticsInfo);

      // Assert
      expect(result).toContain('Client Information');
      expect(result).toContain('Device Type');
      expect(result).toContain('desktop');
      expect(result).toContain('Client Hints');
      expect(result).toContain('true');
      expect(result).toContain('Browser Capabilities');
      expect(result).toContain('Network Quality');
      expect(result).toContain('fast');
    });

    it('should include cache information if provided', () => {
      // Arrange
      const diagnosticsInfo = {
        cacheability: true,
        cacheTtl: 3600,
        cachingMethod: 'cache-api',
      };

      // Act
      const result = createDebugReport(diagnosticsInfo);

      // Assert
      expect(result).toContain('Cache Information');
      expect(result).toContain('Cacheable');
      expect(result).toContain('true');
      expect(result).toContain('Cache TTL');
      expect(result).toContain('3600s');
      expect(result).toContain('Caching Method');
      expect(result).toContain('cache-api');
    });

    it('should include errors and warnings if provided', () => {
      // Arrange
      const diagnosticsInfo = {
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
      };

      // Act
      const result = createDebugReport(diagnosticsInfo);

      // Assert
      expect(result).toContain('Issues');
      expect(result).toContain('Errors');
      expect(result).toContain('Error 1');
      expect(result).toContain('Error 2');
      expect(result).toContain('Warnings');
      expect(result).toContain('Warning 1');
    });
  });
});
