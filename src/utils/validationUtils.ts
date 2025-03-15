/**
 * Validation utilities for request parameters and configuration
 *
 * This module provides schema-based validation for request parameters
 * to ensure they meet the requirements before processing images.
 * It uses Zod for validation with detailed error messages.
 */
import { z } from 'zod';
import { imageConfig } from '../config/imageConfig';

/**
 * Create a schema for image transformation parameters
 */
export const imageRequestParamsSchema = z.object({
  width: z
    .union([
      z.literal('auto'),
      z.coerce.number().refine(
        (val) => {
          if (val === undefined) return true;
          const { minWidth, maxWidth } = imageConfig.validation;
          return (
            (minWidth === undefined || val >= minWidth) &&
            (maxWidth === undefined || val <= maxWidth)
          );
        },
        {
          message: `Width must be between ${imageConfig.validation.minWidth} and ${imageConfig.validation.maxWidth}`,
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
        const { minHeight, maxHeight } = imageConfig.validation;
        return (
          (minHeight === undefined || val >= minHeight) &&
          (maxHeight === undefined || val <= maxHeight)
        );
      },
      {
        message: `Height must be between ${imageConfig.validation.minHeight} and ${imageConfig.validation.maxHeight}`,
      }
    ),
  quality: z.coerce
    .number()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        const { minQuality, maxQuality } = imageConfig.validation;
        return (
          (minQuality === undefined || val >= minQuality) &&
          (maxQuality === undefined || val <= maxQuality)
        );
      },
      {
        message: `Quality must be between ${imageConfig.validation.minQuality} and ${imageConfig.validation.maxQuality}`,
      }
    ),
  fit: z.enum(imageConfig.validation.fit as [string, ...string[]]).optional(),
  format: z.enum(imageConfig.validation.format as [string, ...string[]]).optional(),
  metadata: z.enum(imageConfig.validation.metadata as [string, ...string[]]).optional(),
  gravity: z.enum(imageConfig.validation.gravity as [string, ...string[]]).optional(),
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

/**
 * Type for parsed and validated image request parameters
 */
export type ValidatedImageParams = z.infer<typeof imageRequestParamsSchema>;

/**
 * Validate image request parameters
 * @param params - URLSearchParams or Record<string, string>
 * @returns Validated parameters or null if validation fails
 */
export function validateImageParams(
  params: URLSearchParams | Record<string, string>
): { params: ValidatedImageParams; errors?: null } | { params: null; errors: z.ZodError } {
  // Convert URLSearchParams to Record if needed
  const paramsObj: Record<string, string> =
    params instanceof URLSearchParams ? Object.fromEntries(params.entries()) : params;

  // Parse and validate
  const result = imageRequestParamsSchema.safeParse(paramsObj);

  if (result.success) {
    return { params: result.data, errors: null };
  } else {
    return { params: null, errors: result.error };
  }
}

/**
 * Format validation errors for HTTP response
 * @param errors - Zod validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: z.ZodError): string {
  return JSON.stringify(
    {
      error: 'Invalid request parameters',
      details: errors.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    },
    null,
    2
  );
}
