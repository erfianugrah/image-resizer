/**
 * Configuration Manager interfaces and types
 * These define the configuration system for the application
 */
import {
  CachingConfig,
  DerivativeTemplate,
  ResponsiveConfig,
  ValidationConfig,
  DefaultsConfig,
  CacheConfigEntry,
} from '../../config/imageConfig';
import { PathPattern } from '../../utils/pathUtils';
import { ILogger } from './logger';

/**
 * Debug configuration interface
 */
export interface DebugConfig {
  enabled: boolean;
  verbose?: boolean;  // Kept for backward compatibility
  isVerbose?: boolean; // New property that aligns with the schema
  includeHeaders?: string[];
  prefix?: string;
  specialHeaders?: Record<string, boolean>;
  allowedEnvironments?: string[];
}

/**
 * Logging configuration interface
 */
export interface LoggingConfig {
  level: string;
  includeTimestamp: boolean;
  enableStructuredLogs: boolean;
}

/**
 * Path transform configuration interface
 */
export interface PathTransformConfig {
  prefix: string;
  removePrefix: boolean;
}

/**
 * Strategy configuration interface
 */
export interface StrategyConfig {
  priorityOrder: string[];
  disabled: string[];
  enabled: string[];
}

/**
 * Route configuration interface
 */
export interface RouteConfig {
  pattern: string;
  environment?: 'development' | 'staging' | 'production' | 'test';
  strategies?: StrategyConfig;
  cache?: {
    ttl?: number;
    enabled?: boolean;
  };
}

/**
 * Image resizer configuration interface
 */
export interface ImageResizerConfig {
  routes: RouteConfig[];
  defaults: {
    strategies?: StrategyConfig;
  };
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  // Core settings
  environment: string;
  mode: string;
  version: string;
  fallbackBucket?: string;
  [key: string]: unknown;

  // Additional structured configuration from wrangler.jsonc
  strategiesConfig?: StrategyConfig;
  imageResizerConfig?: ImageResizerConfig;
  originConfig?: {
    default_priority?: string[];
    r2?: {
      enabled: boolean;
      binding_name: string;
    };
    remote?: {
      enabled: boolean;
    };
    fallback?: {
      enabled: boolean;
      url: string;
    };
  };

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
  paramMapping?: Record<string, string>;

  // URL transformation settings
  pathTemplates: Record<string, string>;
  remoteBuckets?: Record<string, string>;
  pathTransforms?: Record<string, PathTransformConfig>;
  pathPatterns?: PathPattern[];
}

/**
 * Configuration manager interface
 * Central access point for application configuration
 */
export interface IConfigManager {
  /**
   * Initialize configuration from environment variables
   * @param env Environment variables
   */
  initialize(env: Record<string, unknown>): void;

  /**
   * Get the full application configuration
   * @returns Application configuration
   */
  getConfig(): AppConfig;
}

/**
 * Configuration validator interface
 * Validates configuration against schemas
 */
export interface IConfigValidator {
  /**
   * Validate application configuration
   * @param config Configuration to validate
   * @returns Boolean indicating whether the configuration is valid
   */
  validateAppConfig(config: unknown): boolean;

  /**
   * Validate application configuration with detailed results
   * @param config Configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateAppConfigWithDetails(config: unknown): ValidationResult;

  /**
   * Validate the default configuration
   * @returns Boolean indicating whether the default configuration is valid
   */
  validateDefaultConfig(): boolean;

  /**
   * Validate a derivative template
   * @param derivativeName The name of the derivative template
   * @returns Boolean indicating whether the derivative template is valid
   */
  validateDerivativeTemplate(derivativeName: string): boolean;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration manager dependencies
 */
export interface ConfigManagerDependencies {
  logger: ILogger;
}
