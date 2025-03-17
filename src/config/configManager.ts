/**
 * Configuration Manager for the image resizer
 * Centralizes all configuration access and provides a unified interface
 */
import {
  DerivativeTemplate,
  ResponsiveConfig,
  CachingConfig,
  ValidationConfig,
  DefaultsConfig,
  CacheConfigEntry,
} from './imageConfig';
import { PathPattern } from '../utils/pathUtils';
import {
  IConfigManager,
  ConfigManagerDependencies,
  AppConfig,
  DebugConfig,
  LoggingConfig,
  PathTransformConfig,
} from '../types/core/config';

/**
 * Legacy types exported for backward compatibility
 * @deprecated Use the types from src/types/core/config.ts instead
 */
export type { AppConfig, DebugConfig, LoggingConfig, PathTransformConfig };

/**
 * Create a configuration manager
 * @param dependencies Dependencies required by the configuration manager
 * @returns A configuration manager instance
 */
export function createConfigManager(dependencies: ConfigManagerDependencies): IConfigManager {
  const { logger } = dependencies;
  let config: AppConfig | null = null;

  /**
   * Helper method to safely parse environment variables
   */
  const parseEnvVar = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  };

  /**
   * Parse debug configuration
   */
  const parseDebugConfig = (value: unknown): DebugConfig => {
    const defaultConfig: DebugConfig = {
      enabled: false,
    };

    try {
      if (!value) return defaultConfig;

      const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;

      return {
        enabled: parsedValue.enabled || false,
        verbose: parsedValue.verbose,
        includeHeaders: parsedValue.includeHeaders,
        prefix: parsedValue.prefix,
        specialHeaders: parsedValue.specialHeaders,
        allowedEnvironments: parsedValue.allowedEnvironments,
      };
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing debug config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return defaultConfig;
    }
  };

  /**
   * Parse logging configuration
   */
  const parseLoggingConfig = (value: unknown): LoggingConfig => {
    const defaultConfig: LoggingConfig = {
      level: 'INFO',
      includeTimestamp: true,
      enableStructuredLogs: false,
    };

    try {
      if (!value) return defaultConfig;

      const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;

      return {
        level: parsedValue.level || defaultConfig.level,
        includeTimestamp:
          parsedValue.includeTimestamp !== undefined
            ? parsedValue.includeTimestamp
            : defaultConfig.includeTimestamp,
        enableStructuredLogs:
          parsedValue.enableStructuredLogs !== undefined
            ? parsedValue.enableStructuredLogs
            : defaultConfig.enableStructuredLogs,
      };
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing logging config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return defaultConfig;
    }
  };

  /**
   * Parse derivative templates
   */
  const parseDerivativeTemplates = (value: unknown): Record<string, DerivativeTemplate> => {
    try {
      if (!value) return {};

      return typeof value === 'string'
        ? JSON.parse(value)
        : (value as Record<string, DerivativeTemplate>);
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing derivative templates', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return {};
    }
  };

  /**
   * Parse path templates
   */
  const parsePathTemplates = (value: unknown): Record<string, string> => {
    try {
      if (!value) return {};

      return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, string>);
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing path templates', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return {};
    }
  };

  /**
   * Parse remote buckets configuration
   */
  const parseRemoteBuckets = (value: unknown): Record<string, string> | undefined => {
    try {
      if (!value) return undefined;

      return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, string>);
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing remote buckets', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return undefined;
    }
  };

  /**
   * Parse path transforms configuration
   */
  const parsePathTransforms = (value: unknown): Record<string, PathTransformConfig> | undefined => {
    try {
      if (!value) return undefined;

      return typeof value === 'string'
        ? JSON.parse(value)
        : (value as Record<string, PathTransformConfig>);
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing path transforms', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return undefined;
    }
  };

  /**
   * Parse path patterns configuration
   */
  const parsePathPatterns = (value: unknown): PathPattern[] | undefined => {
    try {
      if (!value) return undefined;

      return typeof value === 'string' ? JSON.parse(value) : (value as PathPattern[]);
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing path patterns', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return undefined;
    }
  };

  /**
   * Parse responsive configuration
   */
  const parseResponsiveConfig = (value: unknown): ResponsiveConfig => {
    const defaultConfig: ResponsiveConfig = {
      availableWidths: [320, 640, 768, 960, 1024, 1440, 1920],
      breakpoints: [320, 768, 960, 1440, 1920],
      deviceWidths: {
        mobile: 480,
        tablet: 768,
        desktop: 1440,
      },
      deviceMinWidthMap: {
        mobile: 320,
        tablet: 768,
        'large-desktop': 1920,
        desktop: 960,
      },
      quality: 85,
      fit: 'scale-down',
      metadata: 'copyright',
      format: 'auto',
    };

    try {
      if (!value) return defaultConfig;

      const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;

      // Merge with defaults to ensure all properties are present
      return {
        availableWidths: parsedValue.availableWidths || defaultConfig.availableWidths,
        breakpoints: parsedValue.breakpoints || defaultConfig.breakpoints,
        deviceWidths: parsedValue.deviceWidths || defaultConfig.deviceWidths,
        deviceMinWidthMap: parsedValue.deviceMinWidthMap || defaultConfig.deviceMinWidthMap,
        quality: parsedValue.quality || defaultConfig.quality,
        fit: parsedValue.fit || defaultConfig.fit,
        metadata: parsedValue.metadata || defaultConfig.metadata,
        format: parsedValue.format || defaultConfig.format,
      };
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing responsive config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return defaultConfig;
    }
  };

  /**
   * Parse cache configuration
   */
  const parseCacheConfig = (value: unknown): Record<string, CacheConfigEntry> => {
    try {
      if (!value) return {};

      return typeof value === 'string'
        ? JSON.parse(value)
        : (value as Record<string, CacheConfigEntry>);
    } catch (err) {
      logger.debug('ConfigurationManager', 'Error parsing cache config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return {};
    }
  };

  /**
   * Extract global TTL settings from cache config
   * This allows us to use TTL settings defined in CACHE_CONFIG.image
   */
  const extractGlobalTtlSettings = (cacheConfig: Record<string, CacheConfigEntry>) => {
    // Default TTL settings
    const defaultTtl = {
      ok: 86400,
      redirects: 86400,
      clientError: 60,
      serverError: 0,
    };

    // Try to find image config and extract TTL settings
    if (cacheConfig.image && cacheConfig.image.ttl) {
      return {
        ok: cacheConfig.image.ttl.ok || defaultTtl.ok,
        redirects: cacheConfig.image.ttl.redirects || defaultTtl.redirects,
        clientError: cacheConfig.image.ttl.clientError || defaultTtl.clientError,
        serverError: cacheConfig.image.ttl.serverError || defaultTtl.serverError,
      };
    }

    return defaultTtl;
  };

  return {
    initialize: (env: Record<string, unknown>): void => {
      try {
        // Basic configuration
        config = {
          environment: parseEnvVar(env.ENVIRONMENT) || 'development',
          mode: parseEnvVar(env.DEPLOYMENT_MODE) || 'direct',
          version: parseEnvVar(env.VERSION) || '1.0.0',
          fallbackBucket: parseEnvVar(env.FALLBACK_BUCKET),

          // Debug configuration
          debug: parseDebugConfig(env.DEBUG_HEADERS_CONFIG),

          // Logging configuration
          logging: parseLoggingConfig(env.LOGGING_CONFIG),

          // Parse cache config first so we can extract TTL settings
          cacheConfig: parseCacheConfig(env.CACHE_CONFIG),

          // Cache configuration
          cache: {
            method: parseEnvVar(env.CACHE_METHOD) || 'cache-api',
            debug: parseEnvVar(env.CACHE_DEBUG) === 'true',
            ttl: extractGlobalTtlSettings(parseCacheConfig(env.CACHE_CONFIG)),
          },

          // Derivatives (templates)
          derivatives: parseDerivativeTemplates(env.DERIVATIVE_TEMPLATES),

          // Path templates
          pathTemplates: parsePathTemplates(env.PATH_TEMPLATES),

          // Remote buckets (if in remote mode)
          remoteBuckets: parseRemoteBuckets(env.REMOTE_BUCKETS),

          // Path transforms
          pathTransforms: parsePathTransforms(env.PATH_TRANSFORMS),

          // Path patterns
          pathPatterns: parsePathPatterns(env.PATH_PATTERNS),

          // Responsive config
          responsive: parseResponsiveConfig(env.RESPONSIVE_CONFIG),

          // Validation config - hardcoded default values with schema validation
          validation: {
            fit: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
            format: ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'],
            metadata: ['keep', 'copyright', 'none'],
            gravity: ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face'],
            minWidth: 10,
            maxWidth: 8192,
            minHeight: 10,
            maxHeight: 8192,
            minQuality: 1,
            maxQuality: 100,
          },

          // Default values
          defaults: {
            quality: 85,
            fit: 'scale-down',
            format: 'auto',
            metadata: 'copyright',
          },
        };

        logger.debug('ConfigurationManager', 'Configuration initialized', {
          environment: config.environment,
          mode: config.mode,
          version: config.version,
        });
      } catch (err) {
        logger.error('ConfigurationManager', 'Error initializing configuration', {
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined,
        });

        // Create minimal default configuration
        config = {
          environment: 'development',
          mode: 'direct',
          version: '1.0.0',
          debug: { enabled: false },
          logging: {
            level: 'INFO',
            includeTimestamp: true,
            enableStructuredLogs: false,
          },
          cacheConfig: {},
          cache: {
            method: 'cache-api',
            debug: false,
            ttl: {
              ok: 86400,
              redirects: 86400,
              clientError: 60,
              serverError: 0,
            },
          },
          derivatives: {},
          responsive: {
            availableWidths: [320, 640, 768, 960, 1024, 1440, 1920],
            breakpoints: [320, 768, 960, 1440, 1920],
            deviceWidths: {
              mobile: 480,
              tablet: 768,
              desktop: 1440,
            },
            deviceMinWidthMap: {
              mobile: 320,
              tablet: 768,
              'large-desktop': 1920,
              desktop: 960,
            },
            quality: 85,
            fit: 'scale-down',
            metadata: 'copyright',
            format: 'auto',
          },
          validation: {
            fit: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
            format: ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'],
            metadata: ['keep', 'copyright', 'none'],
            gravity: ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face'],
          },
          defaults: {
            quality: 85,
            fit: 'scale-down',
            format: 'auto',
            metadata: 'copyright',
          },
          pathTemplates: {},
        };
      }
    },

    getConfig: (): AppConfig => {
      if (!config) {
        throw new Error('Configuration not initialized. Call initialize() first.');
      }
      return config;
    },
  };
}

// For backward compatibility, maintain a singleton instance
/**
 * @deprecated Use createConfigManager with dependency injection instead
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configManager: IConfigManager;

  private constructor() {
    try {
      // Import dynamically to avoid circular dependencies
      const { createLogger } = require('../core/logger');
      const logger = createLogger('ConfigurationManager');
      this.configManager = createConfigManager({ logger });
    } catch (err) {
      // Fallback for tests
      this.configManager = createConfigManager({
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          logRequest: () => {},
          logResponse: () => {},
        },
      });
    }
  }

  /**
   * Get the singleton instance
   * @deprecated Use dependency injection with createConfigManager instead
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Initialize configuration from environment variables
   * @deprecated Use dependency injection with createConfigManager instead
   */
  public initialize(env: Record<string, unknown>): void {
    this.configManager.initialize(env);
  }

  /**
   * Get the full application configuration
   * @deprecated Use dependency injection with createConfigManager instead
   */
  public getConfig(): AppConfig {
    return this.configManager.getConfig();
  }
}
