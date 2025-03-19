/**
 * Type definitions for image validation service
 */
import { ImageTransformOptions } from './image';
import { ValidationError } from '../utils/errors';

/**
 * Configuration for image transformation validation
 */
export interface ImageValidationConfig {
  /**
   * Valid fit modes for the image
   */
  fit?: string[];

  /**
   * Valid output formats
   */
  format?: string[];

  /**
   * Valid metadata retention modes
   */
  metadata?: string[];

  /**
   * Valid gravity/focus points
   */
  gravity?: string[];

  /**
   * Minimum allowed width in pixels
   */
  minWidth?: number;

  /**
   * Maximum allowed width in pixels
   */
  maxWidth?: number;

  /**
   * Minimum allowed height in pixels
   */
  minHeight?: number;

  /**
   * Maximum allowed height in pixels
   */
  maxHeight?: number;

  /**
   * Minimum allowed quality (1-100)
   */
  minQuality?: number;

  /**
   * Maximum allowed quality (1-100)
   */
  maxQuality?: number;
}

/**
 * Configuration for validation result caching
 */
export interface ValidationCacheConfig {
  /**
   * Whether caching is enabled
   */
  enabled: boolean;

  /**
   * Maximum number of entries to cache
   */
  maxSize: number;

  /**
   * Time-to-live in milliseconds
   */
  ttl: number;
}

/**
 * Validation result containing any validation errors
 */
export interface ValidationResult {
  /**
   * Whether the validation passed
   */
  isValid: boolean;

  /**
   * Any validation errors encountered
   */
  errors: ValidationError[];

  /**
   * The validated and potentially normalized options
   */
  options: ImageTransformOptions;
}

/**
 * Image validation service dependencies
 */
export interface ImageValidationServiceDependencies {
  /**
   * Logger dependency
   */
  logger?: {
    debug?: (module: string, message: string, data?: Record<string, unknown>) => void;
    error?: (module: string, message: string, data?: Record<string, unknown>) => void;
  };

  /**
   * Error factory dependency
   */
  errorFactory?: {
    createValidationError: (message: string, field?: string, value?: unknown) => ValidationError;
  };

  /**
   * Cache configuration
   */
  cacheConfig?: Partial<ValidationCacheConfig>;
}

/**
 * Interface for image validation service
 */
export interface IImageValidationService {
  /**
   * Validate image transformation options against configuration
   * @param options - The options to validate
   * @param config - Validation configuration
   * @returns Validation result with any errors
   */
  validateOptions(options: ImageTransformOptions, config?: ImageValidationConfig): ValidationResult;

  /**
   * Get the default validation configuration
   * @returns Default validation configuration
   */
  getDefaultValidationConfig(): ImageValidationConfig;

  /**
   * Create a validation error
   * @param message - Error message
   * @param field - The field that failed validation
   * @param value - The invalid value
   * @returns Validation error instance
   */
  createError(message: string, field?: string, value?: unknown): ValidationError;

  /**
   * Get cache statistics
   * @returns Current cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean; maxSize: number; ttl: number };

  /**
   * Clear the validation cache
   */
  clearCache(): void;

  /**
   * Configure the validation cache
   * @param config - Cache configuration options
   */
  configureCaching(config: Partial<ValidationCacheConfig>): void;
}
