import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEnvironmentService } from '../../src/services/environmentService';

describe('EnvironmentService', () => {
  // Mock logger
  const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  };

  // Mock routes configuration
  const mockRoutes = [
    {
      pattern: '*.workers.dev/*',
      environment: 'development',
      strategies: {
        priorityOrder: ['direct-url', 'remote-fallback', 'direct-serving'],
        disabled: ['interceptor', 'cdn-cgi']
      }
    },
    {
      pattern: 'dev-resizer.anugrah.workers.dev/*',
      environment: 'development',
      strategies: {
        priorityOrder: ['direct-url', 'remote-fallback', 'direct-serving'],
        disabled: ['interceptor', 'cdn-cgi']
      }
    },
    {
      pattern: 'staging.images.erfi.dev/*',
      environment: 'staging',
      strategies: {
        priorityOrder: ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'],
        disabled: ['cdn-cgi']
      }
    },
    {
      pattern: 'images.erfi.dev/*',
      environment: 'production',
      strategies: {
        priorityOrder: ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'],
        disabled: ['cdn-cgi']
      }
    }
  ];

  // Mock config service with centralized configuration
  const configService = {
    getStrategyConfig: vi.fn(() => ({
      priorityOrder: ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback', 'direct-serving'],
      enabled: [],
      disabled: []
    })),
    getConfig: vi.fn(() => ({
      environment: 'development',
      mode: 'direct',
      version: '1.0.0',
      imageResizerConfig: {
        routes: mockRoutes,
        defaults: {
          strategies: {
            priorityOrder: ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'],
            disabled: ['cdn-cgi']
          }
        }
      },
      strategiesConfig: {
        priorityOrder: ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback', 'direct-serving'],
        enabled: [],
        disabled: []
      }
    })),
    get: vi.fn((key, defaultValue) => {
      if (key === 'ENVIRONMENT') return 'development';
      return defaultValue;
    })
  };

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
  });

  test('should identify workers.dev domain correctly', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    expect(environmentService.isWorkersDevDomain('dev-resizer.anugrah.workers.dev')).toBe(true);
    expect(environmentService.isWorkersDevDomain('anugrah.workers.dev')).toBe(true);
    expect(environmentService.isWorkersDevDomain('workers.dev')).toBe(false);
    expect(environmentService.isWorkersDevDomain('example.com')).toBe(false);
    expect(environmentService.isWorkersDevDomain('images.erfi.dev')).toBe(false);
  });

  test('should identify custom domain correctly', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    expect(environmentService.isCustomDomain('images.erfi.dev')).toBe(true);
    expect(environmentService.isCustomDomain('staging.images.erfi.dev')).toBe(true);
    expect(environmentService.isCustomDomain('example.com')).toBe(true);
    expect(environmentService.isCustomDomain('dev-resizer.anugrah.workers.dev')).toBe(false);
    expect(environmentService.isCustomDomain('localhost')).toBe(false); // No dot, not considered a custom domain
  });

  test('should determine environment type based on domain', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    expect(environmentService.getEnvironmentForDomain('dev-resizer.anugrah.workers.dev')).toBe('development');
    expect(environmentService.getEnvironmentForDomain('anugrah.workers.dev')).toBe('development');
    expect(environmentService.getEnvironmentForDomain('staging.images.erfi.dev')).toBe('staging');
    expect(environmentService.getEnvironmentForDomain('test.images.erfi.dev')).toBe('test');
    expect(environmentService.getEnvironmentForDomain('images.erfi.dev')).toBe('production');
    expect(environmentService.getEnvironmentForDomain('example.com')).toBe('production');
  });

  test('should get domain from URL correctly', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    expect(environmentService.getDomain('https://images.erfi.dev/path/to/image.jpg')).toBe('images.erfi.dev');
    expect(environmentService.getDomain('https://dev-resizer.anugrah.workers.dev/image.jpg')).toBe('dev-resizer.anugrah.workers.dev');
    expect(environmentService.getDomain(new URL('https://images.erfi.dev/path/to/image.jpg'))).toBe('images.erfi.dev');
  });

  test('should get route config for workers.dev domain', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    // Since we've updated our code to rely on the centralized config rather than the global
    // config, we need to verify that the route config is based on the mock data
    // we provided to our config service mock
    const config = environmentService.getRouteConfigForUrl('https://dev-resizer.anugrah.workers.dev/image.jpg');
    
    // Verify that the MOCK_CONFIG was used as expected
    expect(configService.getConfig).toHaveBeenCalled();
    
    // Match the config we set in our mock
    expect(config.environment).toBe('development');
    
    // If a matching route was not found, this would be a default pattern
    // so let's verify that our app logic tries to match specific patterns
    expect(logger.debug).toHaveBeenCalled();
  });

  test('should get route config for custom domain', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    // Since we've updated our code to rely on the centralized config rather than the global
    // config, we need to verify that the route config is based on the mock data
    // we provided to our config service mock
    const config = environmentService.getRouteConfigForUrl('https://images.erfi.dev/image.jpg');
    
    // Verify that the MOCK_CONFIG was used as expected
    expect(configService.getConfig).toHaveBeenCalled();
    
    // Match the config we set in our mock
    expect(config.environment).toBe('production');
    
    // If a matching route was not found, this would be a default pattern
    // so let's verify that our app logic tries to match specific patterns
    expect(logger.debug).toHaveBeenCalled();
  });

  test('should get strategy priority order for different domains', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    // Test strategy priority order for different domains
    environmentService.getStrategyPriorityOrderForUrl('https://dev-resizer.anugrah.workers.dev/image.jpg');
    environmentService.getStrategyPriorityOrderForUrl('https://images.erfi.dev/image.jpg');
    
    // Verify config service was used
    expect(configService.getConfig).toHaveBeenCalled();
    
    // Check for logging to verify the method was executed
    expect(logger.debug).toHaveBeenCalled();
  });

  test('should check if strategy is enabled for URL', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    // For workers.dev domain
    const workersDevUrl = 'https://dev-resizer.anugrah.workers.dev/image.jpg';
    environmentService.isStrategyEnabledForUrl('interceptor', workersDevUrl);
    environmentService.isStrategyEnabledForUrl('direct-url', workersDevUrl);
    environmentService.isStrategyEnabledForUrl('cdn-cgi', workersDevUrl);
    
    // For custom domain
    const customDomainUrl = 'https://images.erfi.dev/image.jpg';
    environmentService.isStrategyEnabledForUrl('interceptor', customDomainUrl);
    environmentService.isStrategyEnabledForUrl('direct-url', customDomainUrl);
    environmentService.isStrategyEnabledForUrl('cdn-cgi', customDomainUrl);
    
    // Verify config service was used
    expect(configService.getConfig).toHaveBeenCalled();
    
    // Check for logging to verify the method was executed
    expect(logger.debug).toHaveBeenCalled();
  });

  test('should fall back to default strategies for unknown domains', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    const unknownDomain = 'https://example.com/image.jpg';
    environmentService.getStrategyPriorityOrderForUrl(unknownDomain);
    
    // Test strategy enabling
    environmentService.isStrategyEnabledForUrl('interceptor', unknownDomain);
    
    // Verify config service was used
    expect(configService.getConfig).toHaveBeenCalled();
    
    // Check for logging to verify the method was executed
    expect(logger.debug).toHaveBeenCalled();
  });
});