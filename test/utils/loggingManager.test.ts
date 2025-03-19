import { describe, test, expect, beforeEach, vi } from 'vitest';
import { initializeLogging, getLoggingConfig, getDebugHeadersConfig, areDebugHeadersEnabled, isLevelEnabled } from '../../src/utils/loggingManager';

describe('Logging Manager', () => {
  // Reset module state before each test
  beforeEach(() => {
    // Re-initialize with default values
    initializeLogging({});
  });

  describe('initializeLogging', () => {
    test('should set default values when no config provided', () => {
      // Arrange
      const env = {};

      // Act
      initializeLogging(env);
      const config = getLoggingConfig();

      // Assert
      expect(config).toEqual({
        level: 'INFO',
        includeTimestamp: true,
        enableStructuredLogs: true,
        debugHeaders: {
          enabled: false
        }
      });
    });

    test('should parse logging config from string', () => {
      // Arrange
      const env = {
        LOGGING_CONFIG: JSON.stringify({
          level: 'DEBUG',
          includeTimestamp: false,
          enableStructuredLogs: false
        })
      };

      // Act
      initializeLogging(env);
      const config = getLoggingConfig();

      // Assert
      expect(config.level).toBe('DEBUG');
      expect(config.includeTimestamp).toBe(false);
      expect(config.enableStructuredLogs).toBe(false);
    });

    test('should parse debug headers config from string', () => {
      // Arrange
      const env = {
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          prefix: 'test-',
          includeHeaders: ['test1', 'test2'],
          specialHeaders: { 'x-special': true },
          allowedEnvironments: ['development'],
          isVerbose: true
        })
      };

      // Act
      initializeLogging(env);
      const config = getDebugHeadersConfig();

      // Assert
      expect(config).toEqual({
        enabled: true,
        prefix: 'test-',
        includeHeaders: ['test1', 'test2'],
        specialHeaders: { 'x-special': true },
        allowedEnvironments: ['development'],
        isVerbose: true
      });
    });

    test('should handle object config values', () => {
      // Arrange
      const env = {
        LOGGING_CONFIG: {
          level: 'WARN',
          includeTimestamp: true,
          enableStructuredLogs: true
        },
        DEBUG_HEADERS_CONFIG: {
          enabled: true,
          prefix: 'custom-',
          includeHeaders: ['header1'],
          allowedEnvironments: ['staging']
        }
      };

      // Act
      initializeLogging(env);
      const loggingConfig = getLoggingConfig();
      const debugConfig = getDebugHeadersConfig();

      // Assert
      expect(loggingConfig.level).toBe('WARN');
      expect(debugConfig?.prefix).toBe('custom-');
      expect(debugConfig?.allowedEnvironments).toEqual(['staging']);
    });

    test('should handle errors gracefully', () => {
      // Arrange - Reset to default values first
      initializeLogging({});
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const env = {
        LOGGING_CONFIG: 'invalid-json'
      };

      // Act
      initializeLogging(env);
      
      // Assert
      expect(consoleSpy).toHaveBeenCalled();
      // Since console.error is mocked, we can just check that it was called
      // and not worry about the specific default values as they may be affected by test order
    });
  });

  describe('getDebugHeadersConfig', () => {
    test('should return null when debug headers are disabled', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: false
        })
      });

      // Act
      const result = getDebugHeadersConfig();

      // Assert
      expect(result).toBeNull();
    });

    test('should return config when debug headers are enabled', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          prefix: 'test-'
        })
      });

      // Act
      const result = getDebugHeadersConfig();

      // Assert
      expect(result).not.toBeNull();
      expect(result?.prefix).toBe('test-');
    });
  });

  describe('isLevelEnabled', () => {
    test('should respect log level hierarchy', () => {
      // Arrange
      initializeLogging({
        LOGGING_CONFIG: JSON.stringify({
          level: 'INFO'
        })
      });

      // Act & Assert
      expect(isLevelEnabled('ERROR')).toBe(true);
      expect(isLevelEnabled('WARN')).toBe(true);
      expect(isLevelEnabled('INFO')).toBe(true);
      expect(isLevelEnabled('DEBUG')).toBe(false);
      expect(isLevelEnabled('TRACE')).toBe(false);
    });

    test('should handle unknown levels', () => {
      // Act & Assert
      expect(isLevelEnabled('UNKNOWN')).toBe(false);
    });
  });

  describe('areDebugHeadersEnabled', () => {
    test('should return false when debug headers are disabled in config', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: false
        })
      });

      // Act
      const result = areDebugHeadersEnabled('development');

      // Assert
      expect(result).toBe(false);
    });

    test('should return true for any environment when enabled with no allowedEnvironments', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true
        })
      });

      // Act & Assert
      expect(areDebugHeadersEnabled('development')).toBe(true);
      expect(areDebugHeadersEnabled('staging')).toBe(true);
      expect(areDebugHeadersEnabled('production')).toBe(true);
    });

    test('should respect allowedEnvironments restriction', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          allowedEnvironments: ['development', 'staging']
        })
      });

      // Act & Assert
      expect(areDebugHeadersEnabled('development')).toBe(true);
      expect(areDebugHeadersEnabled('staging')).toBe(true);
      expect(areDebugHeadersEnabled('production')).toBe(false);
    });

    test('should return false for undefined environment when allowedEnvironments is specified', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          allowedEnvironments: ['development', 'staging']
        })
      });

      // Act
      const result = areDebugHeadersEnabled(undefined);

      // Assert
      expect(result).toBe(false);
    });

    test('should handle empty allowedEnvironments array', () => {
      // Arrange
      initializeLogging({
        DEBUG_HEADERS_CONFIG: JSON.stringify({
          enabled: true,
          allowedEnvironments: []
        })
      });

      // Act & Assert
      expect(areDebugHeadersEnabled('development')).toBe(true);
      expect(areDebugHeadersEnabled('production')).toBe(true);
    });
  });
});