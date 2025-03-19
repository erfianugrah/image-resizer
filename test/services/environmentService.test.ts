import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEnvironmentService } from '../../src/services/environmentService';

describe('EnvironmentService', () => {
  // Mock logger
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  };

  // Mock config service
  const configService = {
    getStrategyConfig: vi.fn(() => ({
      priorityOrder: ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback', 'direct-serving'],
      enabled: [],
      disabled: []
    }))
  };

  // Mock global config
  const mockWranglerConfig = {
    imageResizer: {
      routes: [
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
      ],
      defaults: {
        strategies: {
          priorityOrder: ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'],
          disabled: ['cdn-cgi']
        }
      }
    }
  };

  beforeEach(() => {
    // Set up the mock wrangler config
    (global as any).__WRANGLER_CONFIG__ = mockWranglerConfig;
  });

  afterEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    delete (global as any).__WRANGLER_CONFIG__;
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
    
    const config = environmentService.getRouteConfigForUrl('https://dev-resizer.anugrah.workers.dev/image.jpg');
    expect(config.pattern).toBe('*.workers.dev/*');
    expect(config.environment).toBe('development');
    expect(config.strategies?.priorityOrder).toEqual(['direct-url', 'remote-fallback', 'direct-serving']);
    expect(config.strategies?.disabled).toEqual(['interceptor', 'cdn-cgi']);
  });

  test('should get route config for custom domain', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    const config = environmentService.getRouteConfigForUrl('https://images.erfi.dev/image.jpg');
    expect(config.pattern).toBe('images.erfi.dev/*');
    expect(config.environment).toBe('production');
    expect(config.strategies?.priorityOrder).toEqual(['interceptor', 'direct-url', 'remote-fallback', 'direct-serving']);
    expect(config.strategies?.disabled).toEqual(['cdn-cgi']);
  });

  test('should get strategy priority order for different domains', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    expect(environmentService.getStrategyPriorityOrderForUrl('https://dev-resizer.anugrah.workers.dev/image.jpg'))
      .toEqual(['direct-url', 'remote-fallback', 'direct-serving']);
    
    expect(environmentService.getStrategyPriorityOrderForUrl('https://images.erfi.dev/image.jpg'))
      .toEqual(['interceptor', 'direct-url', 'remote-fallback', 'direct-serving']);
  });

  test('should check if strategy is enabled for URL', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    // For workers.dev domain
    const workersDevUrl = 'https://dev-resizer.anugrah.workers.dev/image.jpg';
    expect(environmentService.isStrategyEnabledForUrl('interceptor', workersDevUrl)).toBe(false);
    expect(environmentService.isStrategyEnabledForUrl('direct-url', workersDevUrl)).toBe(true);
    expect(environmentService.isStrategyEnabledForUrl('cdn-cgi', workersDevUrl)).toBe(false);
    
    // For custom domain
    const customDomainUrl = 'https://images.erfi.dev/image.jpg';
    expect(environmentService.isStrategyEnabledForUrl('interceptor', customDomainUrl)).toBe(true);
    expect(environmentService.isStrategyEnabledForUrl('direct-url', customDomainUrl)).toBe(true);
    expect(environmentService.isStrategyEnabledForUrl('cdn-cgi', customDomainUrl)).toBe(false);
  });

  test('should fall back to default strategies for unknown domains', () => {
    const environmentService = createEnvironmentService({ logger, configService });
    
    const unknownDomain = 'https://example.com/image.jpg';
    expect(environmentService.getStrategyPriorityOrderForUrl(unknownDomain))
      .toEqual(['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback', 'direct-serving']);
    
    // By default, interceptor should be enabled for unknown domains
    expect(environmentService.isStrategyEnabledForUrl('interceptor', unknownDomain)).toBe(true);
  });
});