/**
 * Validation utilities interfaces
 */

import { z } from 'zod';

/**
 * Type for parsed and validated image request parameters
 */
export type ValidatedImageParams = {
  width?: number | 'auto';
  height?: number;
  quality?: number;
  fit?: string;
  format?: string;
  metadata?: string;
  gravity?: string;
  derivative?: string;
  dpr?: number;
  sharpen?: number;
  brightness?: number;
  contrast?: number;
  background?: string;
  responsive?: boolean;
  [key: string]: unknown;
};

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { params: T; errors?: null }
  | { params: null; errors: z.ZodError };

/**
 * Interface for validation utility service
 */
export interface IValidationUtils {
  /**
   * Validate image request parameters
   * @param params - URLSearchParams or Record<string, string>
   * @returns Validated parameters or null if validation fails
   */
  validateImageParams(
    params: URLSearchParams | Record<string, string>
  ): ValidationResult<ValidatedImageParams>;

  /**
   * Format validation errors for HTTP response
   * @param errors - Zod validation errors
   * @returns Formatted error message
   */
  formatValidationErrors(errors: z.ZodError): string;
}

/**
 * Dependencies for validation utilities factory
 */
export interface ValidationUtilsDependencies {
  /**
   * Optional logger for debugging purposes
   */
  logger?: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };

  /**
   * Optional validation config source
   */
  configProvider?: {
    getConfig: () => {
      validation: {
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
        minQuality?: number;
        maxQuality?: number;
        fit: string[];
        format: string[];
        metadata: string[];
        gravity: string[];
      };
    };
  };
}
