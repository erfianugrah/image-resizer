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
import { error, warn } from '../utils/loggerUtils';
import { AppConfig } from './configManager';

/**
 * Validate application configuration against schema
 * @param config Configuration to validate
 * @returns Boolean indicating whether the configuration is valid
 */
export function validateAppConfig(config: unknown): boolean {
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
              sourceUrl: z.string(),
              regex: z.string().optional(),
            })
          )
          .optional(),
        pathTemplates: z.record(z.string(), z.string()).optional(),
        derivatives: z.record(z.any()),
        responsive: z.any(),
        validation: z.any(),
        defaults: z.any(),
        paramMapping: z.any(),
        cache: z.any().optional(),
        caching: z.any().optional(),
        cacheConfig: z.record(z.any()).optional(),
        logging: z.any().optional(),
      })
      .partial();

    // Validate basic structure first
    const structureResult = appConfigSchema.safeParse(config);

    if (!structureResult.success) {
      const formattedError = JSON.stringify(structureResult.error.format(), null, 2);
      error('ConfigValidator', 'Invalid application configuration structure', {
        error: formattedError,
      });
      return false;
    }

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

    const result = imageConfigSchema.safeParse(imageConfigPortion);

    if (result.success) {
      return true;
    } else {
      const formattedError = JSON.stringify(result.error.format(), null, 2);
      error('ConfigValidator', 'Invalid image configuration', {
        error: formattedError,
      });
      return false;
    }
  } catch (err) {
    error('ConfigValidator', 'Error validating configuration', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Validate the default image configuration
 * @returns Boolean indicating whether the default configuration is valid
 */
export function validateDefaultConfig(): boolean {
  try {
    const result = imageConfigSchema.safeParse(imageConfig);

    if (result.success) {
      return true;
    } else {
      const formattedError = JSON.stringify(result.error.format(), null, 2);
      error('ConfigValidator', 'Invalid default image configuration', {
        error: formattedError,
      });
      return false;
    }
  } catch (err) {
    error('ConfigValidator', 'Error validating default configuration', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Check if a derivative template exists and is valid
 * @param derivativeName The name of the derivative template
 * @returns Boolean indicating whether the derivative template is valid
 */
export function validateDerivativeTemplate(derivativeName: string): boolean {
  if (!imageConfig.derivatives[derivativeName]) {
    warn('ConfigValidator', 'Derivative template not found', {
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
      warn('ConfigValidator', 'Invalid derivative template', {
        derivative: derivativeName,
        error: formattedError,
      });
      return false;
    }
  } catch (err) {
    warn('ConfigValidator', 'Error validating derivative template', {
      derivative: derivativeName,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return false;
  }
}
