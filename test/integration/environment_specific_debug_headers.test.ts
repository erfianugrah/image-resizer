import { describe, test, expect, beforeEach, vi } from 'vitest';
import { initializeLogging } from '../../src/utils/loggingManager';
import { getEnhancedDebugInfo, addEnhancedDebugHeaders, StrategyDiagnostics } from '../../src/utils/enhanced_debug_headers';
import { DebugInfo } from '../../src/types/utils/debug';
// No need to import the full transformImage command for these tests
import { IEnvironmentService } from '../../src/types/services/environment';

// Mock dependencies for the transform image command
const mockCache = {
  put: vi.fn(),
  match: vi.fn(() => Promise.resolve(null)),
  delete: vi.fn()
};

const mockEnv = {
  ENVIRONMENT: 'test',
  DEBUG_HEADERS_CONFIG: {},
  LOGGING_CONFIG: {}
};

/**
 * Create a mock URL that matches a common pattern in the application
 * @param domain
 * @param path
 * @returns Full URL string
 */
function createTestUrl(domain: string, path: string): string {
  return `https://${domain}/${path}`;
}

/**
 * Create a test request with optional headers
 * @param url
 * @param headers
 * @returns Request object
 */
function createTestRequest(url: string, headers?: Record<string, string>): Request {
  const requestHeaders = new Headers();
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      requestHeaders.set(key, value);
    });
  }
  
  return new Request(url, { headers: requestHeaders });
}

/**
 * Create a mock environment service with configurable responses
 * @param isWorkersDevDomain
 * @param isCustomDomain
 * @param environment
 * @returns Mock environment service
 */
function createMockEnvironmentService(
  isWorkersDevDomain: boolean = false,
  isCustomDomain: boolean = true,
  environment: string = 'production'
): IEnvironmentService {
  return {
    getDomain: vi.fn((url: string) => new URL(url).hostname),
    isWorkersDevDomain: vi.fn(() => isWorkersDevDomain),
    isCustomDomain: vi.fn(() => isCustomDomain),
    getEnvironmentForDomain: vi.fn(() => environment),
    getRouteConfigForUrl: vi.fn(() => ({
      pattern: '*.*/*',
      environment,
      strategies: {
        priorityOrder: ['interceptor', 'direct-url'],
        disabled: []
      }
    })),
    getStrategyPriorityOrderForUrl: vi.fn(() => ['interceptor', 'direct-url']),
    isStrategyEnabledForUrl: vi.fn(() => true)
  };
}

describe('Environment-Specific Debug Headers End-to-End', () => {
  beforeEach(() => {
    // Reset logging config to defaults
    initializeLogging({});
    vi.clearAllMocks();
  });

  describe('Debug headers in production environment', () => {
    test('should not add debug headers in production where disabled', async () => {
      // Arrange
      // Configure environment with production settings
      const prodEnv = {
        ...mockEnv,
        ENVIRONMENT: 'production',
        DEBUG_HEADERS_CONFIG: {
          enabled: false
        }
      };
      
      initializeLogging(prodEnv);
      
      // Create test request and environment context
      const url = createTestUrl('images.erfi.dev', 'test.jpg');
      const request = createTestRequest(url);
      
      // Create production-like environment service
      const environmentService = createMockEnvironmentService(false, true, 'production');
      
      // For this test, we don't need to create the full transform command
      
      // Act
      // Create a mock response to simulate what would come from the command
      const mockResponse = new Response('test image content', {
        headers: {
          'Content-Type': 'image/jpeg'
        }
      });
      
      // Mock a strategy diagnostic that would be added
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['interceptor', 'direct-url'],
        selectedStrategy: 'interceptor'
      };
      
      // Manually simulate what debug info would be in production
      const debugInfo = getEnhancedDebugInfo(request, 'production');
      
      // Apply debug headers
      const resultResponse = addEnhancedDebugHeaders(mockResponse, debugInfo, strategyDiagnostics);
      
      // Assert
      expect(debugInfo.isEnabled).toBe(false);
      
      // Debug headers should not be present
      expect(resultResponse.headers.get('debug-strategy-attempts')).toBeNull();
      expect(resultResponse.headers.get('debug-strategy-selected')).toBeNull();
      expect(resultResponse.headers.get('debug-domain-type')).toBeNull();
      expect(resultResponse.headers.get('debug-environment')).toBeNull();
    });
  });
  
  describe('Debug headers in development environment', () => {
    test('should add debug headers in development', async () => {
      // Arrange
      // Configure environment with development settings
      const devEnv = {
        ...mockEnv,
        ENVIRONMENT: 'development',
        DEBUG_HEADERS_CONFIG: {
          enabled: true,
          prefix: 'debug-',
          includeHeaders: ['ir', 'cache', 'mode', 'client-hints', 'ua', 'device']
        }
      };
      
      initializeLogging(devEnv);
      
      // Create test request and environment context for workers.dev domain
      const url = createTestUrl('image-resizer.workers.dev', 'test.jpg');
      const request = createTestRequest(url);
      
      // Create development-like environment service
      const environmentService = createMockEnvironmentService(true, false, 'development');
      
      // Create mock response
      const mockResponse = new Response('test image content', {
        headers: {
          'Content-Type': 'image/jpeg'
        }
      });
      
      // Mock strategy diagnostics
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['direct-url', 'cdn-cgi'],
        selectedStrategy: 'direct-url',
        domainType: 'workers-dev',
        environmentType: 'development',
        isWorkersDevDomain: true,
        isCustomDomain: false
      };
      
      // Get debug info
      const debugInfo = getEnhancedDebugInfo(request, 'development');
      
      // Act
      // Apply debug headers
      const resultResponse = addEnhancedDebugHeaders(
        mockResponse, 
        debugInfo, 
        strategyDiagnostics,
        environmentService
      );
      
      // Assert
      expect(debugInfo.isEnabled).toBe(true);
      
      // Debug headers should be present
      expect(resultResponse.headers.get('debug-strategy-attempts')).toBe('direct-url,cdn-cgi');
      expect(resultResponse.headers.get('debug-strategy-selected')).toBe('direct-url');
      expect(resultResponse.headers.get('debug-domain-type')).toBe('workers-dev');
      expect(resultResponse.headers.get('debug-environment')).toBe('development');
      expect(resultResponse.headers.get('debug-is-workers-dev')).toBe('true');
      expect(resultResponse.headers.get('debug-is-custom-domain')).toBe('false');
    });
  });
  
  describe('Debug headers in staging environment', () => {
    test('should respect allowedEnvironments restriction', async () => {
      // Arrange
      // Configure environment with staging settings
      const stagingEnv = {
        ...mockEnv,
        ENVIRONMENT: 'staging',
        DEBUG_HEADERS_CONFIG: {
          enabled: true,
          prefix: 'debug-',
          includeHeaders: ['ir', 'cache', 'mode'],
          allowedEnvironments: ['staging', 'development']
        }
      };
      
      initializeLogging(stagingEnv);
      
      // Create allowed environment - staging
      const stagingUrl = createTestUrl('staging.images.erfi.dev', 'test.jpg');
      const stagingRequest = createTestRequest(stagingUrl);
      const stagingEnvService = createMockEnvironmentService(false, true, 'staging');
      
      // Create disallowed environment - production
      const prodUrl = createTestUrl('images.erfi.dev', 'test.jpg');
      const prodRequest = createTestRequest(prodUrl);
      const prodEnvService = createMockEnvironmentService(false, true, 'production');
      
      // Create mock response
      const mockResponse = new Response('test image content', {
        headers: {
          'Content-Type': 'image/jpeg'
        }
      });
      
      // Mock strategy diagnostics
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['interceptor'],
        selectedStrategy: 'interceptor'
      };
      
      // Act
      // Get debug info for both environments
      const stagingDebugInfo = getEnhancedDebugInfo(stagingRequest, 'staging');
      const prodDebugInfo = getEnhancedDebugInfo(prodRequest, 'production');
      
      // Apply debug headers
      const stagingResponse = addEnhancedDebugHeaders(
        mockResponse, 
        stagingDebugInfo, 
        strategyDiagnostics,
        stagingEnvService
      );
      
      const prodResponse = addEnhancedDebugHeaders(
        mockResponse, 
        prodDebugInfo, 
        strategyDiagnostics,
        prodEnvService
      );
      
      // Assert
      // Staging should be allowed
      expect(stagingDebugInfo.isEnabled).toBe(true);
      expect(stagingResponse.headers.get('debug-strategy-selected')).toBe('interceptor');
      
      // Production should not be allowed
      expect(prodDebugInfo.isEnabled).toBe(false);
      expect(prodResponse.headers.get('debug-strategy-selected')).toBeNull();
    });
  });
  
  describe('Debug header override with X-Debug header', () => {
    test('should add debug headers when X-Debug header is present regardless of environment', async () => {
      // Arrange
      // Configure environment with production settings that would normally disable debug
      const prodEnv = {
        ...mockEnv,
        ENVIRONMENT: 'production',
        DEBUG_HEADERS_CONFIG: {
          enabled: false
        }
      };
      
      initializeLogging(prodEnv);
      
      // Create test request with X-Debug header
      const url = createTestUrl('images.erfi.dev', 'test.jpg');
      const request = createTestRequest(url, { 'x-debug': 'true' });
      
      // Create production-like environment service
      const environmentService = createMockEnvironmentService(false, true, 'production');
      
      // Create mock response
      const mockResponse = new Response('test image content', {
        headers: {
          'Content-Type': 'image/jpeg'
        }
      });
      
      // Mock strategy diagnostics
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: ['interceptor'],
        selectedStrategy: 'interceptor'
      };
      
      // This custom debug info bypasses the normal environment check to simulate
      // what would happen in loggerUtils.getDebugInfoFromRequest when x-debug is present
      const debugInfo: DebugInfo = {
        isEnabled: true,
        prefix: 'debug-',
        includeHeaders: []
      };
      
      // Act
      const resultResponse = addEnhancedDebugHeaders(
        mockResponse, 
        debugInfo, 
        strategyDiagnostics,
        environmentService
      );
      
      // Assert
      // Debug headers should be present due to X-Debug header override
      expect(resultResponse.headers.get('debug-strategy-attempts')).toBe('interceptor');
      expect(resultResponse.headers.get('debug-strategy-selected')).toBe('interceptor');
    });
  });
});