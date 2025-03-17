/**
 * Configuration validator for the image resizer
 * Validates the configuration against schemas to catch errors early
 *
 * This module ensures that configuration values are valid before
 * the application starts, preventing runtime errors due to
 * misconfiguration. It provides detailed error messages when
 * validation fails.
 */
import { z } from 'zod';
import { imageConfig, imageConfigSchema } from './imageConfig';
import { AppConfig, IConfigValidator, ValidationResult } from '../types/core/config';
import { ILogger } from '../types/core/logger';

/**
 * Configuration validator dependencies
 */
export interface ConfigValidatorDependencies {
  logger: ILogger;
}

/**
 * Create a configuration validator
 * @param dependencies Dependencies required by the configuration validator
 * @returns A configuration validator instance
 */
export function createConfigValidator(dependencies: ConfigValidatorDependencies): IConfigValidator {
  const { logger } = dependencies;

  // Define a more specific type for Zod errors
  interface ZodErrorObject {
    _errors?: string[];
    [key: string]: unknown;
  }

  /**
   * Format Zod errors into readable strings
   * @param errors Zod format() output
   * @param path Current path
   * @returns Array of formatted error strings
   */
  const formatZodErrors = (errors: ZodErrorObject, path = ''): string[] => {
    const result: string[] = [];

    if (errors._errors && Array.isArray(errors._errors) && errors._errors.length > 0) {
      result.push(`${path ? path : 'Root'}: ${errors._errors.join(', ')}`);
    }

    for (const key in errors) {
      if (key !== '_errors') {
        const newPath = path ? `${path}.${key}` : key;
        // Type assertion here is needed because we know the structure recursively
        result.push(...formatZodErrors(errors[key] as ZodErrorObject, newPath));
      }
    }

    return result;
  };

  /**
   * Validate cache TTL settings for reasonable values
   */
  // Define interfaces for config objects
  interface CacheTTL {
    ok?: number;
    redirects?: number;
    clientError?: number;
    serverError?: number;
  }

  interface CacheConfig {
    ttl?: CacheTTL;
    method?: string;
  }

  interface ValidatorConfig {
    cache?: CacheConfig;
    cacheConfig?: Record<string, { ttl?: CacheTTL }>;
    derivatives?: Record<string, DerivativeConfig>;
    remoteBuckets?: Record<string, string>;
    [key: string]: unknown;
  }

  interface DerivativeConfig {
    width?: number;
    height?: number;
    quality?: number;
    fit?: string;
    metadata?: string;
    gravity?: string;
    format?: string;
    [key: string]: unknown;
  }

  const validateCacheTTLs = (config: ValidatorConfig, result: ValidationResult): void => {
    // Check main cache configuration
    if (config.cache?.ttl) {
      const { ttl } = config.cache;

      // Warn about very long TTLs
      if (ttl.ok && ttl.ok > 31536000) {
        // 1 year
        result.warnings.push(
          'Main cache.ttl.ok is set to more than 1 year, which may be excessive'
        );
      }

      // Warn about very short success TTLs
      if (ttl.ok && ttl.ok < 60 && ttl.ok > 0) {
        result.warnings.push(
          'Main cache.ttl.ok is set to less than 60 seconds, which may cause high origin traffic'
        );
      }

      // Warn about caching server errors
      if (ttl.serverError && ttl.serverError > 60) {
        result.warnings.push(
          'Caching server errors for more than 60 seconds may lead to prolonged outages'
        );
      }
    }

    // Check cache config entries
    if (config.cacheConfig) {
      for (const [key, entry] of Object.entries(config.cacheConfig)) {
        const cacheEntry = entry as Record<string, unknown>;

        if (cacheEntry.ttl) {
          if (
            cacheEntry.ttl &&
            typeof cacheEntry.ttl === 'object' &&
            'ok' in cacheEntry.ttl &&
            typeof cacheEntry.ttl.ok === 'number' &&
            cacheEntry.ttl.ok > 31536000
          ) {
            result.warnings.push(`Cache config '${key}' has ttl.ok set to more than 1 year`);
          }

          if (
            cacheEntry.ttl &&
            typeof cacheEntry.ttl === 'object' &&
            'serverError' in cacheEntry.ttl &&
            typeof cacheEntry.ttl.serverError === 'number' &&
            cacheEntry.ttl.serverError > 60
          ) {
            result.warnings.push(
              `Cache config '${key}' caches server errors for more than 60 seconds`
            );
          }
        }
      }
    }
  };

  /**
   * Validate path patterns for conflicts and coverage
   */
  const validatePathPatterns = (
    config: Record<string, unknown>,
    result: ValidationResult
  ): void => {
    if (!config.pathPatterns || !Array.isArray(config.pathPatterns)) {
      return;
    }

    const patterns = config.pathPatterns;

    // Check for duplicate patterns
    const patternStrings = patterns.map((p) => p.pattern);
    const duplicates = patternStrings.filter(
      (item, index) => patternStrings.indexOf(item) !== index
    );

    if (duplicates.length > 0) {
      result.errors.push(`Duplicate path patterns found: ${duplicates.join(', ')}`);
    }

    // Check for valid derivatives in patterns
    if (config.derivatives) {
      const validDerivatives = Object.keys(config.derivatives);

      for (const pattern of patterns) {
        if (pattern.derivative && !validDerivatives.includes(pattern.derivative)) {
          result.errors.push(
            `Path pattern '${pattern.pattern}' references unknown derivative '${pattern.derivative}'`
          );
        }
      }
    }

    // Check for invalid regex patterns
    for (const pattern of patterns) {
      try {
        // Try to compile the pattern as regex to validate it
        new RegExp(pattern.pattern);
      } catch (err) {
        result.errors.push(
          `Invalid regex in path pattern '${pattern.pattern}': ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  };

  /**
   * Validate derivatives for consistency
   */
  const validateDerivatives = (config: ValidatorConfig, result: ValidationResult): void => {
    if (!config.derivatives) {
      return;
    }

    for (const [name, derivative] of Object.entries(config.derivatives)) {
      const derivObj = derivative as DerivativeConfig;

      // Check width and height constraints
      if (derivObj.width && derivObj.width < 10) {
        result.errors.push(`Derivative '${name}' has width less than 10px (${derivObj.width})`);
      }

      if (derivObj.width && derivObj.width > 8192) {
        result.errors.push(
          `Derivative '${name}' has width greater than 8192px (${derivObj.width})`
        );
      }

      if (derivObj.height && derivObj.height < 10) {
        result.errors.push(`Derivative '${name}' has height less than 10px (${derivObj.height})`);
      }

      if (derivObj.height && derivObj.height > 8192) {
        result.errors.push(
          `Derivative '${name}' has height greater than 8192px (${derivObj.height})`
        );
      }

      // Check quality constraints
      if (derivObj.quality && (derivObj.quality < 1 || derivObj.quality > 100)) {
        result.errors.push(
          `Derivative '${name}' has invalid quality (${derivObj.quality}). Must be between 1-100`
        );
      }

      // Check for valid fit values
      const validFit = ['scale-down', 'contain', 'cover', 'crop', 'pad'];
      if (derivObj.fit && !validFit.includes(derivObj.fit)) {
        result.errors.push(
          `Derivative '${name}' has invalid fit value (${derivObj.fit}). Must be one of: ${validFit.join(', ')}`
        );
      }

      // Check for valid metadata values
      const validMetadata = ['keep', 'copyright', 'none'];
      if (derivObj.metadata && !validMetadata.includes(derivObj.metadata)) {
        result.errors.push(
          `Derivative '${name}' has invalid metadata value (${derivObj.metadata}). Must be one of: ${validMetadata.join(', ')}`
        );
      }
    }
  };

  /**
   * Validate remote buckets configuration
   */
  const validateRemoteBuckets = (config: ValidatorConfig, result: ValidationResult): void => {
    if (!config.remoteBuckets) {
      return;
    }

    // Check for default bucket
    if (!config.remoteBuckets.default) {
      result.warnings.push(
        'No default remote bucket specified. This may cause issues in remote mode'
      );
    }

    // Validate URLs in remote buckets
    for (const [name, url] of Object.entries(config.remoteBuckets)) {
      if (typeof url !== 'string') {
        result.errors.push(`Remote bucket '${name}' has invalid URL (not a string)`);
        continue;
      }

      try {
        // Try to parse the URL to validate it
        new URL(url as string);
      } catch (err) {
        result.errors.push(
          `Remote bucket '${name}' has invalid URL (${url}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  };

  return {
    /**
     * Validate application configuration against schema
     * @param config Configuration to validate
     * @returns Boolean indicating whether the configuration is valid
     */
    validateAppConfig: (config: unknown): boolean => {
      const result = validateAppConfigWithDetails(config);
      return result.valid;
    },

    /**
     * Validate application configuration with detailed results
     * @param config Configuration to validate
     * @returns Validation result with errors and warnings
     */
    validateAppConfigWithDetails: (config: unknown): ValidationResult => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      try {
        // Create a partial validation schema for AppConfig
        const appConfigSchema = z
          .object({
            environment: z.string(),
            mode: z.string(),
            version: z.string(),
            debug: z.object({
              enabled: z.boolean(),
              verbose: z.boolean().optional(),
              includeHeaders: z.union([z.boolean(), z.array(z.string())]).optional(),
            }),
            pathPatterns: z
              .array(
                z.object({
                  pattern: z.string(),
                  sourceUrl: z.string().optional(),
                  regex: z.string().optional(),
                  ttl: z
                    .object({
                      ok: z.number().int().min(0).optional(),
                      redirects: z.number().int().min(0).optional(),
                      clientError: z.number().int().min(0).optional(),
                      serverError: z.number().int().min(0).optional(),
                    })
                    .optional(),
                  derivative: z.string().optional(),
                  transformOrigin: z.boolean().optional(),
                  cacheability: z.boolean().optional(),
                })
              )
              .optional(),
            pathTemplates: z.record(z.string(), z.string()).optional(),
            derivatives: z.record(z.any()),
            responsive: z.any(),
            validation: z.any(),
            defaults: z.any(),
            paramMapping: z.any().optional(),
            cache: z.any().optional(),
            caching: z.any().optional(),
            cacheConfig: z.record(z.any()).optional(),
            logging: z.any().optional(),
            security: z
              .object({
                cors: z
                  .object({
                    allowOrigins: z.array(z.string()).optional(),
                    allowMethods: z.array(z.string()).optional(),
                    allowHeaders: z.array(z.string()).optional(),
                    exposeHeaders: z.array(z.string()).optional(),
                    maxAge: z.number().int().min(0).optional(),
                    credentials: z.boolean().optional(),
                  })
                  .optional(),
                csp: z
                  .object({
                    enabled: z.boolean().optional(),
                    policy: z.record(z.string(), z.array(z.string())).optional(),
                  })
                  .optional(),
                rateLimiting: z
                  .object({
                    enabled: z.boolean().optional(),
                    requestsPerMinute: z.number().int().min(1).optional(),
                    blockOverages: z.boolean().optional(),
                  })
                  .optional(),
                allowedReferrers: z.array(z.string()).optional(),
                allowedIPs: z.array(z.string()).optional(),
              })
              .optional(),
            watermark: z
              .object({
                enabled: z.boolean().optional(),
                defaultWatermark: z.string().optional(),
                position: z
                  .enum(['topleft', 'topright', 'bottomleft', 'bottomright', 'center'])
                  .optional(),
                opacity: z.number().min(0).max(1).optional(),
                margin: z.number().int().min(0).optional(),
                minSize: z.number().int().min(0).optional(),
                watermarks: z
                  .record(
                    z.string(),
                    z.object({
                      imagePath: z.string(),
                      position: z
                        .enum(['topleft', 'topright', 'bottomleft', 'bottomright', 'center'])
                        .optional(),
                      opacity: z.number().min(0).max(1).optional(),
                      margin: z.number().int().min(0).optional(),
                      minSize: z.number().int().min(0).optional(),
                    })
                  )
                  .optional(),
              })
              .optional(),
            limits: z
              .object({
                maxSourceImageSize: z.number().int().min(1).optional(),
                maxOutputImageSize: z.number().int().min(1).optional(),
                maxConcurrentRequests: z.number().int().min(1).optional(),
                timeoutMs: z.number().int().min(100).max(60000).optional(),
                maxTransformationsPerRequest: z.number().int().min(1).optional(),
              })
              .optional(),
          })
          .partial();

        // Validate basic structure first
        const structureResult = appConfigSchema.safeParse(config);

        if (!structureResult.success) {
          result.valid = false;
          const formattedErrors = formatZodErrors(structureResult.error.format());
          result.errors.push(...formattedErrors);

          logger.error('ConfigValidator', 'Invalid application configuration structure', {
            errors: formattedErrors,
          });
        } else {
          // Validate the image configuration portions
          const appConfig = config as AppConfig;
          const imageConfigPortion = {
            derivatives: appConfig.derivatives,
            responsive: appConfig.responsive,
            validation: appConfig.validation,
            defaults: appConfig.defaults,
            paramMapping: appConfig.paramMapping || {},
            caching: appConfig.cache,
            cacheConfig: appConfig.cacheConfig,
          };

          const imageResult = imageConfigSchema.safeParse(imageConfigPortion);

          if (!imageResult.success) {
            result.valid = false;
            const formattedErrors = formatZodErrors(imageResult.error.format());
            result.errors.push(...formattedErrors);

            logger.error('ConfigValidator', 'Invalid image configuration', {
              errors: formattedErrors,
            });
          }

          // Perform additional semantic validations
          validateCacheTTLs(appConfig, result);
          validatePathPatterns(appConfig, result);
          validateDerivatives(appConfig, result);
          validateRemoteBuckets(appConfig, result);
        }
      } catch (err) {
        result.valid = false;
        result.errors.push(`Validation error: ${err instanceof Error ? err.message : String(err)}`);

        logger.error('ConfigValidator', 'Error validating configuration', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      return result;
    },

    /**
     * Validate the default image configuration
     * @returns Boolean indicating whether the default configuration is valid
     */
    validateDefaultConfig: (): boolean => {
      try {
        const result = imageConfigSchema.safeParse(imageConfig);

        if (result.success) {
          return true;
        } else {
          const formattedError = JSON.stringify(result.error.format(), null, 2);
          logger.error('ConfigValidator', 'Invalid default image configuration', {
            error: formattedError,
          });
          return false;
        }
      } catch (err) {
        logger.error('ConfigValidator', 'Error validating default configuration', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return false;
      }
    },

    /**
     * Check if a derivative template exists and is valid
     * @param derivativeName The name of the derivative template
     * @returns Boolean indicating whether the derivative template is valid
     */
    validateDerivativeTemplate: (derivativeName: string): boolean => {
      if (!imageConfig.derivatives[derivativeName]) {
        logger.warn('ConfigValidator', 'Derivative template not found', {
          derivative: derivativeName,
        });
        return false;
      }

      try {
        const templateSchema = z
          .object({
            width: z.number().int().min(1),
            height: z.number().int().min(1),
            quality: z.number().int().min(1).max(100),
            fit: z.enum(imageConfig.validation.fit as [string, ...string[]]),
            metadata: z.enum(imageConfig.validation.metadata as [string, ...string[]]),
          })
          .partial()
          .catchall(z.any());

        const result = templateSchema.safeParse(imageConfig.derivatives[derivativeName]);

        if (result.success) {
          return true;
        } else {
          const formattedError = JSON.stringify(result.error.format(), null, 2);
          logger.warn('ConfigValidator', 'Invalid derivative template', {
            derivative: derivativeName,
            error: formattedError,
          });
          return false;
        }
      } catch (err) {
        logger.warn('ConfigValidator', 'Error validating derivative template', {
          derivative: derivativeName,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return false;
      }
    },
  };
}

// For backward compatibility
/**
 * @deprecated Use createConfigValidator with dependency injection instead
 */
export function validateAppConfig(config: unknown): boolean {
  try {
    // Import dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createLogger } = require('../core/logger');
    const logger = createLogger('ConfigValidator');
    const validator = createConfigValidator({ logger });
    return validator.validateAppConfig(config);
  } catch (err) {
    // Fallback for tests
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      logRequest: () => {},
      logResponse: () => {},
    };
    const validator = createConfigValidator({ logger: mockLogger });
    return validator.validateAppConfig(config);
  }
}

/**
 * @deprecated Use createConfigValidator with dependency injection instead
 */
export function validateAppConfigWithDetails(config: unknown): ValidationResult {
  try {
    // Import dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createLogger } = require('../core/logger');
    const logger = createLogger('ConfigValidator');
    const validator = createConfigValidator({ logger });
    return validator.validateAppConfigWithDetails(config);
  } catch (err) {
    // Fallback for tests
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      logRequest: () => {},
      logResponse: () => {},
    };
    const validator = createConfigValidator({ logger: mockLogger });
    return validator.validateAppConfigWithDetails(config);
  }
}

/**
 * @deprecated Use createConfigValidator with dependency injection instead
 */
export function validateDefaultConfig(): boolean {
  try {
    // Import dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createLogger } = require('../core/logger');
    const logger = createLogger('ConfigValidator');
    const validator = createConfigValidator({ logger });
    return validator.validateDefaultConfig();
  } catch (err) {
    // Fallback for tests
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      logRequest: () => {},
      logResponse: () => {},
    };
    const validator = createConfigValidator({ logger: mockLogger });
    return validator.validateDefaultConfig();
  }
}

/**
 * @deprecated Use createConfigValidator with dependency injection instead
 */
export function validateDerivativeTemplate(derivativeName: string): boolean {
  try {
    // Import dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createLogger } = require('../core/logger');
    const logger = createLogger('ConfigValidator');
    const validator = createConfigValidator({ logger });
    return validator.validateDerivativeTemplate(derivativeName);
  } catch (err) {
    // Fallback for tests
    const mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      logRequest: () => {},
      logResponse: () => {},
    };
    const validator = createConfigValidator({ logger: mockLogger });
    return validator.validateDerivativeTemplate(derivativeName);
  }
}

// Local ValidationResult declaration removed - using the one from src/types/core/config.ts
