import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigurationManager } from '../../src/config/configManager';

// Mock logger functions
vi.mock('../../src/utils/loggerUtils', () => ({
  debug: vi.fn(),
  error: vi.fn(),
}));

describe('ConfigurationManager', () => {
  // Save the original ConfigurationManager instance
  let originalInstance: any;

  beforeEach(() => {
    // Store the original instance (if any)
    originalInstance = (ConfigurationManager as any).instance;
    // Reset the instance
    (ConfigurationManager as any).instance = undefined;

    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Restore the original instance
    (ConfigurationManager as any).instance = originalInstance;
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      // Get the instance twice
      const instance1 = ConfigurationManager.getInstance();
      const instance2 = ConfigurationManager.getInstance();

      // Verify they are the same instance
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize the configuration with defaults when env variables are empty', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const emptyEnv = {};

      // Act
      manager.initialize(emptyEnv);
      const config = manager.getConfig();

      // Assert
      expect(config).toMatchObject({
        environment: 'development',
        mode: 'direct',
        version: '1.0.0',
        debug: { enabled: false },
      });
    });

    it('should parse string environment variables correctly', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        ENVIRONMENT: 'production',
        DEPLOYMENT_MODE: 'remote',
        VERSION: '2.0.0',
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config).toMatchObject({
        environment: 'production',
        mode: 'remote',
        version: '2.0.0',
      });
    });

    it('should parse JSON environment variables correctly', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          verbose: true,
          includeHeaders: ['cache', 'mode'],
        }),
        DERIVATIVE_TEMPLATES: JSON.stringify({
          thumbnail: {
            width: 320,
            height: 150,
            quality: 85,
          },
        }),
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config.debug).toMatchObject({
        enabled: true,
        verbose: true,
        includeHeaders: ['cache', 'mode'],
      });

      expect(config.derivatives).toMatchObject({
        thumbnail: {
          width: 320,
          height: 150,
          quality: 85,
        },
      });
    });

    it('should handle object environment variables without parsing', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        DEBUG_HEADERS_CONFIG: {
          enabled: true,
          verbose: true,
          includeHeaders: ['cache', 'mode'],
        },
        DERIVATIVE_TEMPLATES: {
          thumbnail: {
            width: 320,
            height: 150,
            quality: 85,
          },
        },
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config.debug).toMatchObject({
        enabled: true,
        verbose: true,
        includeHeaders: ['cache', 'mode'],
      });

      expect(config.derivatives).toMatchObject({
        thumbnail: {
          width: 320,
          height: 150,
          quality: 85,
        },
      });
    });

    it('should handle parsing errors gracefully', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        DEBUG_HEADERS_CONFIG: '{invalid-json',
        DERIVATIVE_TEMPLATES: '{also-invalid',
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert - should fall back to defaults
      expect(config.debug).toMatchObject({
        enabled: false,
      });

      expect(config.derivatives).toEqual({});
    });
  });

  describe('getConfig', () => {
    it('should throw an error if configuration is not initialized', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();

      // Act & Assert
      expect(() => manager.getConfig()).toThrow('Configuration not initialized');
    });

    it('should return the full configuration when initialized', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      manager.initialize({});

      // Act
      const config = manager.getConfig();

      // Assert
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('mode');
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('debug');
      expect(config).toHaveProperty('cache');
      expect(config).toHaveProperty('responsive');
    });
  });

  describe('Configuration parsing', () => {
    it('should parse debug configuration correctly', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          verbose: true,
          includeHeaders: ['cache', 'mode'],
          prefix: 'x-debug-',
          specialHeaders: {
            'x-processing-time': true,
          },
          allowedEnvironments: ['development', 'staging'],
        }),
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config.debug).toMatchObject({
        enabled: true,
        verbose: true,
        includeHeaders: ['cache', 'mode'],
        prefix: 'x-debug-',
        specialHeaders: {
          'x-processing-time': true,
        },
        allowedEnvironments: ['development', 'staging'],
      });
    });

    it('should parse logging configuration correctly', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        LOGGING_CONFIG: JSON.stringify({
          level: 'DEBUG',
          includeTimestamp: true,
          enableStructuredLogs: true,
        }),
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config.logging).toMatchObject({
        level: 'DEBUG',
        includeTimestamp: true,
        enableStructuredLogs: true,
      });
    });

    it('should parse path templates correctly', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        PATH_TEMPLATES: JSON.stringify({
          'profile-pictures': 'avatar',
          'hero-banners': 'header',
          products: 'product',
        }),
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config.pathTemplates).toMatchObject({
        'profile-pictures': 'avatar',
        'hero-banners': 'header',
        products: 'product',
      });
    });

    it('should parse responsive configuration correctly', () => {
      // Arrange
      const manager = ConfigurationManager.getInstance();
      const env = {
        RESPONSIVE_CONFIG: JSON.stringify({
          availableWidths: [320, 768, 1024, 1440],
          breakpoints: [320, 768, 1440],
          deviceWidths: {
            mobile: 480,
            tablet: 768,
            desktop: 1440,
          },
          quality: 90,
          fit: 'cover',
        }),
      };

      // Act
      manager.initialize(env);
      const config = manager.getConfig();

      // Assert
      expect(config.responsive).toMatchObject({
        availableWidths: [320, 768, 1024, 1440],
        breakpoints: [320, 768, 1440],
        deviceWidths: {
          mobile: 480,
          tablet: 768,
          desktop: 1440,
        },
        quality: 90,
        fit: 'cover',
      });
    });
  });
});
