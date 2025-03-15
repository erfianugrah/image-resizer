import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  addDebugHeaders, 
  createDebugReport, 
  extractRequestHeaders 
} from '../../src/services/debugService';

vi.mock('../../src/utils/loggerUtils', async () => ({
  debug: vi.fn()
}));

describe('DebugService', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  
  beforeEach(() => {
    // Create a mock request with various headers for testing
    mockRequest = new Request('https://example.com/test.jpg', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'accept': 'image/avif,image/webp,image/png,image/*',
        'sec-ch-viewport-width': '1200',
        'sec-ch-dpr': '2.0',
        'cf-device-type': 'desktop'
      }
    });
    
    // Create a mock response
    mockResponse = new Response('Test image data', {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });
  });
  
  describe('extractRequestHeaders', () => {
    it('should extract relevant headers from a request', () => {
      // Act
      const result = extractRequestHeaders(mockRequest);
      
      // Assert
      expect(result).toEqual({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'accept': 'image/avif,image/webp,image/png,image/*',
        'sec-ch-viewport-width': '1200',
        'sec-ch-dpr': '2.0',
        'cf-device-type': 'desktop'
      });
    });
    
    it('should only include headers that are present', () => {
      // Arrange
      const minimalRequest = new Request('https://example.com/test.jpg', {
        headers: {
          'user-agent': 'Simple UA'
        }
      });
      
      // Act
      const result = extractRequestHeaders(minimalRequest);
      
      // Assert
      expect(result).toEqual({
        'user-agent': 'Simple UA'
      });
    });
  });
  
  describe('addDebugHeaders', () => {
    it('should not modify response when debug is not enabled', () => {
      // Arrange
      const debugInfo = {
        isEnabled: false
      };
      const diagnosticsInfo = {
        processingTimeMs: 42,
        transformParams: { width: 800 }
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
        includePerformance: true
      };
      const diagnosticsInfo = {
        processingTimeMs: 42,
        transformParams: { width: 800, height: 600 },
        transformSource: 'explicit-width',
        pathMatch: 'test-pattern'
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
        isVerbose: true
      };
      const diagnosticsInfo = {
        browserCapabilities: { avif: true, webp: true },
        networkQuality: 'fast',
        errors: ['Test error'],
        warnings: ['Test warning']
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
        isEnabled: true
      };
      const diagnosticsInfo = {}; // Empty diagnostics
      
      // Act
      const result = addDebugHeaders(mockResponse, debugInfo, diagnosticsInfo);
      
      // Assert
      expect(result).not.toBe(mockResponse); // Should be a new response
      // Check that no specific headers were added but also no error occurred
      expect([...result.headers.keys()].filter(k => k.startsWith('debug-'))).toHaveLength(0);
    });
  });
  
  describe('createDebugReport', () => {
    it('should generate HTML debug report with basic information', () => {
      // Arrange
      const diagnosticsInfo = {
        originalUrl: 'https://example.com/test.jpg',
        processingTimeMs: 42,
        transformSource: 'explicit-width',
        pathMatch: 'test-pattern'
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
          format: 'webp'
        }
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
          webp: true
        },
        networkQuality: 'fast'
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
        cachingMethod: 'cache-api'
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
        warnings: ['Warning 1']
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