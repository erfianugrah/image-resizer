/**
 * Configuration Manager for the image resizer
 * Centralizes all configuration access and provides a unified interface
 */
import { debug, error } from '../utils/loggerUtils';
import {
  DerivativeTemplate,
  ResponsiveConfig,
  CachingConfig,
  ValidationConfig,
  DefaultsConfig,
  CacheConfigEntry,
} from './imageConfig';
import { PathPattern } from '../utils/pathUtils';

export interface DebugConfig {
  enabled: boolean;
  verbose?: boolean;
  includeHeaders?: string[];
  prefix?: string;
  specialHeaders?: Record<string, boolean>;
  allowedEnvironments?: string[];
}

export interface LoggingConfig {
  level: string;
  includeTimestamp: boolean;
  enableStructuredLogs: boolean;
}

export interface PathTransformConfig {
  prefix: string;
  removePrefix: boolean;
}

export interface AppConfig {
  // Core settings
  environment: string;
  mode: string;
  version: string;
  fallbackBucket?: string;

  // Debug settings
  debug: DebugConfig;

  // Logging settings
  logging: LoggingConfig;

  // Cache settings
  cache: CachingConfig;
  cacheConfig: Record<string, CacheConfigEntry>;

  // Image transformation settings
  derivatives: Record<string, DerivativeTemplate>;
  responsive: ResponsiveConfig;
  validation: ValidationConfig;
  defaults: DefaultsConfig;

  // URL transformation settings
  pathTemplates: Record<string, string>;
  remoteBuckets?: Record<string, string>;
  pathTransforms?: Record<string, PathTransformConfig>;
  pathPatterns?: PathPattern[];
}

/**
 * ConfigurationManager singleton class for centralized configuration
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: AppConfig | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Initialize configuration from environment variables
   */
  public initialize(env: Record<string, unknown>): void {
    try {
      // Basic configuration
      this.config = {
        environment: this.parseEnvVar(env.ENVIRONMENT) || 'development',
        mode: this.parseEnvVar(env.DEPLOYMENT_MODE) || 'direct',
        version: this.parseEnvVar(env.VERSION) || '1.0.0',
        fallbackBucket: this.parseEnvVar(env.FALLBACK_BUCKET),

        // Debug configuration
        debug: this.parseDebugConfig(env.DEBUG_HEADERS_CONFIG),

        // Logging configuration
        logging: this.parseLoggingConfig(env.LOGGING_CONFIG),

        // Cache configuration
        cache: {
          method: this.parseEnvVar(env.CACHE_METHOD) || 'cache-api',
          debug: this.parseEnvVar(env.CACHE_DEBUG) === 'true',
          ttl: {
            ok: 86400,
            redirects: 86400,
            clientError: 60,
            serverError: 0,
          },
        },

        // Cache config for different content types
        cacheConfig: this.parseCacheConfig(env.CACHE_CONFIG),

        // Derivatives (templates)
        derivatives: this.parseDerivativeTemplates(env.DERIVATIVE_TEMPLATES),

        // Path templates
        pathTemplates: this.parsePathTemplates(env.PATH_TEMPLATES),

        // Remote buckets (if in remote mode)
        remoteBuckets: this.parseRemoteBuckets(env.REMOTE_BUCKETS),

        // Path transforms
        pathTransforms: this.parsePathTransforms(env.PATH_TRANSFORMS),

        // Path patterns
        pathPatterns: this.parsePathPatterns(env.PATH_PATTERNS),

        // Responsive config
        responsive: this.parseResponsiveConfig(env.RESPONSIVE_CONFIG),

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

      debug('ConfigurationManager', 'Configuration initialized', {
        environment: this.config.environment,
        mode: this.config.mode,
        version: this.config.version,
      });
    } catch (err) {
      error('ConfigurationManager', 'Error initializing configuration', {
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      });

      // Create minimal default configuration
      this.config = {
        environment: 'development',
        mode: 'direct',
        version: '1.0.0',
        debug: { enabled: false },
        logging: {
          level: 'INFO',
          includeTimestamp: true,
          enableStructuredLogs: false,
        },
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
        cacheConfig: {},
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
  }

  /**
   * Get the full application configuration
   */
  public getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Helper method to safely parse environment variables
   */
  private parseEnvVar(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  }

  /**
   * Parse debug configuration
   */
  private parseDebugConfig(value: unknown): DebugConfig {
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
      debug('ConfigurationManager', 'Error parsing debug config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return defaultConfig;
    }
  }

  /**
   * Parse logging configuration
   */
  private parseLoggingConfig(value: unknown): LoggingConfig {
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
      debug('ConfigurationManager', 'Error parsing logging config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return defaultConfig;
    }
  }

  /**
   * Parse derivative templates
   */
  private parseDerivativeTemplates(value: unknown): Record<string, DerivativeTemplate> {
    try {
      if (!value) return {};

      return typeof value === 'string'
        ? JSON.parse(value)
        : (value as Record<string, DerivativeTemplate>);
    } catch (err) {
      debug('ConfigurationManager', 'Error parsing derivative templates', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Parse path templates
   */
  private parsePathTemplates(value: unknown): Record<string, string> {
    try {
      if (!value) return {};

      return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, string>);
    } catch (err) {
      debug('ConfigurationManager', 'Error parsing path templates', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Parse remote buckets configuration
   */
  private parseRemoteBuckets(value: unknown): Record<string, string> | undefined {
    try {
      if (!value) return undefined;

      return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, string>);
    } catch (err) {
      debug('ConfigurationManager', 'Error parsing remote buckets', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Parse path transforms configuration
   */
  private parsePathTransforms(value: unknown): Record<string, PathTransformConfig> | undefined {
    try {
      if (!value) return undefined;

      return typeof value === 'string'
        ? JSON.parse(value)
        : (value as Record<string, PathTransformConfig>);
    } catch (err) {
      debug('ConfigurationManager', 'Error parsing path transforms', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Parse path patterns configuration
   */
  private parsePathPatterns(value: unknown): PathPattern[] | undefined {
    try {
      if (!value) return undefined;

      return typeof value === 'string' ? JSON.parse(value) : (value as PathPattern[]);
    } catch (err) {
      debug('ConfigurationManager', 'Error parsing path patterns', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Parse responsive configuration
   */
  private parseResponsiveConfig(value: unknown): ResponsiveConfig {
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
      debug('ConfigurationManager', 'Error parsing responsive config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return defaultConfig;
    }
  }

  /**
   * Parse cache configuration
   */
  private parseCacheConfig(value: unknown): Record<string, CacheConfigEntry> {
    try {
      if (!value) return {};

      return typeof value === 'string'
        ? JSON.parse(value)
        : (value as Record<string, CacheConfigEntry>);
    } catch (err) {
      debug('ConfigurationManager', 'Error parsing cache config', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      return {};
    }
  }
}
