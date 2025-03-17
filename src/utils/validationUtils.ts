/**
 * Validation utilities for request parameters and configuration
 *
 * This module provides schema-based validation for request parameters
 * to ensure they meet the requirements before processing images.
 * It uses Zod for validation with detailed error messages.
 */
import { z } from 'zod';
import { imageConfig } from '../config/imageConfig';
import {
  IValidationUtils,
  ValidationUtilsDependencies,
  ValidatedImageParams,
  ValidationResult,
} from '../types/utils/validation';

// Re-export types for backward compatibility
export type { ValidatedImageParams };

/**
 * Create validation utilities service
 * @param dependencies - Dependencies for validation utilities
 * @returns Validation utilities implementation
 */
export function createValidationUtils(
  dependencies: ValidationUtilsDependencies = {}
): IValidationUtils {
  const { logger, configProvider } = dependencies;

  /**
   * Log debug message with context data
   * @param message - Debug message
   * @param data - Context data
   */
  const logDebug = (message: string, data?: Record<string, unknown>): void => {
    if (logger?.debug) {
      logger.debug('ValidationUtils', message, data);
    }
  };

  /**
   * Log error message with context data
   * @param message - Error message
   * @param data - Context data
   */
  const logError = (message: string, data?: Record<string, unknown>): void => {
    if (logger?.error) {
      logger.error('ValidationUtils', message, data);
    }
  };

  /**
   * Get validation configuration
   * @returns Validation configuration
   */
  const getValidationConfig = () => {
    // Use configProvider if available, otherwise fall back to imageConfig
    if (configProvider) {
      try {
        const config = configProvider.getConfig().validation;
        return config;
      } catch (error) {
        logError('Error getting config from configProvider', { error });
      }
    }
    return imageConfig.validation;
  };

  /**
   * Create a schema for image transformation parameters
   * @returns Zod schema for image parameters
   */
  const createImageParamsSchema = () => {
    const validation = getValidationConfig();

    logDebug('Creating image parameters schema with validation config', {
      minWidth: validation.minWidth,
      maxWidth: validation.maxWidth,
      // Only include a few key properties to avoid passing the entire validation object
      numRules: validation.fit.length + validation.format.length,
    });

    return z.object({
      width: z
        .union([
          z.literal('auto'),
          z.coerce.number().refine(
            (val) => {
              if (val === undefined) return true;
              const { minWidth, maxWidth } = validation;
              return (
                (minWidth === undefined || val >= minWidth) &&
                (maxWidth === undefined || val <= maxWidth)
              );
            },
            {
              message: `Width must be between ${validation.minWidth} and ${validation.maxWidth}`,
            }
          ),
        ])
        .optional(),
      height: z.coerce
        .number()
        .optional()
        .refine(
          (val) => {
            if (val === undefined) return true;
            const { minHeight, maxHeight } = validation;
            return (
              (minHeight === undefined || val >= minHeight) &&
              (maxHeight === undefined || val <= maxHeight)
            );
          },
          {
            message: `Height must be between ${validation.minHeight} and ${validation.maxHeight}`,
          }
        ),
      quality: z.coerce
        .number()
        .optional()
        .refine(
          (val) => {
            if (val === undefined) return true;
            const { minQuality, maxQuality } = validation;
            return (
              (minQuality === undefined || val >= minQuality) &&
              (maxQuality === undefined || val <= maxQuality)
            );
          },
          {
            message: `Quality must be between ${validation.minQuality} and ${validation.maxQuality}`,
          }
        ),
      fit: z.enum(validation.fit as [string, ...string[]]).optional(),
      format: z.enum(validation.format as [string, ...string[]]).optional(),
      metadata: z.enum(validation.metadata as [string, ...string[]]).optional(),
      gravity: z.enum(validation.gravity as [string, ...string[]]).optional(),
      derivative: z.string().optional(),
      dpr: z.coerce.number().min(0.1).max(5).optional(),
      sharpen: z.coerce.number().min(0).max(10).optional(),
      brightness: z.coerce.number().min(-100).max(100).optional(),
      contrast: z.coerce.number().min(-100).max(100).optional(),
      background: z
        .string()
        .regex(/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
        .optional(),
      responsive: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
    });
  };

  /**
   * Validate image request parameters
   * @param params - URLSearchParams or Record<string, string>
   * @returns Validated parameters or null if validation fails
   */
  function validateImageParams(
    params: URLSearchParams | Record<string, string>
  ): ValidationResult<ValidatedImageParams> {
    try {
      // Create schema for validation
      const schema = createImageParamsSchema();

      // Convert URLSearchParams to Record if needed
      const paramsObj: Record<string, string> =
        params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;

      logDebug('Validating image parameters', { params: paramsObj });

      // Parse and validate
      const result = schema.safeParse(paramsObj);

      if (result.success) {
        logDebug('Validation successful', { validatedParams: result.data });
        return { params: result.data, errors: null };
      } else {
        logDebug('Validation failed', {
          errors: result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
        return { params: null, errors: result.error };
      }
    } catch (error) {
      logError('Error during validation', { error });
      // If we fail to validate due to an exception, return a default ZodError
      const zodError = new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['_general'],
          message: 'Error processing validation request',
        },
      ]);
      return { params: null, errors: zodError };
    }
  }

  /**
   * Format validation errors for HTTP response
   * @param errors - Zod validation errors
   * @returns Formatted error message
   */
  function formatValidationErrors(errors: z.ZodError): string {
    const formattedErrors = {
      error: 'Invalid request parameters',
      details: errors.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    };

    logDebug('Formatting validation errors', { formattedErrors });

    return JSON.stringify(formattedErrors, null, 2);
  }

  return {
    validateImageParams,
    formatValidationErrors,
  };
}

// Export a schema for direct use (backward compatibility)
export const imageRequestParamsSchema = (() => {
  const utils = createValidationUtils();
  // Return a schema by creating it through a dummy validation
  try {
    const dummyParams = {};
    utils.validateImageParams(dummyParams);
    // This is just to provide a compatible export, not actually used
    return z.object({
      // This replicates the same schema shape as the original
      width: z.union([z.literal('auto'), z.number()]).optional(),
      height: z.number().optional(),
      quality: z.number().optional(),
      fit: z.string().optional(),
      format: z.string().optional(),
      metadata: z.string().optional(),
      gravity: z.string().optional(),
      derivative: z.string().optional(),
      dpr: z.number().optional(),
      sharpen: z.number().optional(),
      brightness: z.number().optional(),
      contrast: z.number().optional(),
      background: z.string().optional(),
      responsive: z.boolean().optional(),
    });
  } catch (e) {
    // Fallback to a basic schema
    return z.object({});
  }
})();

// Backward compatibility functions
// ------------------------------

/**
 * @deprecated Use createValidationUtils().validateImageParams instead
 */
export function validateImageParams(
  params: URLSearchParams | Record<string, string>
): ValidationResult<ValidatedImageParams> {
  return createValidationUtils().validateImageParams(params);
}

/**
 * @deprecated Use createValidationUtils().formatValidationErrors instead
 */
export function formatValidationErrors(errors: z.ZodError): string {
  return createValidationUtils().formatValidationErrors(errors);
}
