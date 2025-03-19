/**
 * Service for validating image transformation options
 */
import { ImageTransformOptions } from '../types/services/image';
import {
  IImageValidationService,
  ImageValidationConfig,
  ImageValidationServiceDependencies,
  ValidationResult,
  ValidationCacheConfig,
} from '../types/services/imageValidation';
import { ValidationError } from '../types/utils/errors';

/**
 * Default validation configuration
 */
const DEFAULT_VALIDATION_CONFIG: ImageValidationConfig = {
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
};

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: ValidationCacheConfig = {
  enabled: true,
  maxSize: 100,
  ttl: 60000, // 1 minute
};

/**
 * Generate a cache key for a set of options and config
 */
function generateCacheKey(options: ImageTransformOptions, config?: ImageValidationConfig): string {
  // Create a deterministic string representation of options and config
  const optionsKey = JSON.stringify(options, Object.keys(options).sort());
  const configKey = config ? JSON.stringify(config, Object.keys(config).sort()) : 'default';
  return `${optionsKey}:${configKey}`;
}

/**
 * Create an image validation service
 * @param dependencies Service dependencies
 * @returns Image validation service
 */
export function createImageValidationService(
  dependencies: ImageValidationServiceDependencies = {}
): IImageValidationService {
  const { logger, errorFactory, cacheConfig } = dependencies;

  // Initialize validation results cache
  const validationCache = new Map<string, { result: ValidationResult; timestamp: number }>();

  // Use provided cache config or default
  const cacheSettings = {
    ...DEFAULT_CACHE_CONFIG,
    ...(cacheConfig || {}),
  };

  /**
   * Log debug messages if logger is available
   */
  const logDebug = (message: string, data?: Record<string, unknown>) => {
    if (logger?.debug) {
      logger.debug('ImageValidationService', message, data);
    }
  };

  /**
   * Log error messages if logger is available
   */
  const logError = (message: string, data?: Record<string, unknown>) => {
    if (logger?.error) {
      logger.error('ImageValidationService', message, data);
    }
  };

  /**
   * Create a validation error using the error factory or basic Error
   */
  const createValidationError = (
    message: string,
    field?: string,
    value?: unknown
  ): ValidationError => {
    if (errorFactory?.createValidationError) {
      return errorFactory.createValidationError(message, field, value);
    }

    // Basic implementation if no error factory is provided
    const error = new ValidationError(message, field, value);
    return error;
  };

  /**
   * Validate a numeric value is within bounds
   */
  const validateNumericBounds = (
    value: number,
    field: string,
    min: number,
    max: number
  ): ValidationError | null => {
    if (isNaN(value) || value < min || value > max) {
      const error = createValidationError(
        `${field} must be between ${min} and ${max}`,
        field,
        value
      );
      return error;
    }
    return null;
  };

  /**
   * Validate value is in an allowable set
   */
  const validateAllowedValues = (
    value: string,
    field: string,
    allowedValues: string[]
  ): ValidationError | null => {
    if (!allowedValues.includes(value)) {
      const error = createValidationError(
        `Invalid ${field}: ${value}. Must be one of: ${allowedValues.join(', ')}`,
        field,
        value
      );
      return error;
    }
    return null;
  };

  /**
   * Get cached validation result if available and valid
   */
  const getCachedValidation = (cacheKey: string): ValidationResult | null => {
    if (!cacheSettings.enabled) return null;

    const cached = validationCache.get(cacheKey);
    if (!cached) return null;

    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > cacheSettings.ttl) {
      // Expired entry, remove it
      validationCache.delete(cacheKey);
      return null;
    }

    logDebug('Using cached validation result', { cacheKey });
    return cached.result;
  };

  /**
   * Cache a validation result
   */
  const cacheValidationResult = (cacheKey: string, result: ValidationResult): void => {
    if (!cacheSettings.enabled) return;

    // Enforce cache size limits by removing oldest entries if needed
    if (validationCache.size >= cacheSettings.maxSize) {
      // Get oldest entries (by timestamp) and remove them
      const entries = Array.from(validationCache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );

      // Remove oldest entry
      if (entries.length > 0) {
        validationCache.delete(entries[0][0]);
      }
    }

    // Cache the result with current timestamp
    validationCache.set(cacheKey, {
      result: { ...result }, // Make a copy to prevent modification
      timestamp: Date.now(),
    });

    logDebug('Cached validation result', {
      cacheKey,
      cacheSize: validationCache.size,
    });
  };

  /**
   * Clear the validation cache
   */
  const clearCache = (): void => {
    const cacheSize = validationCache.size;
    validationCache.clear();
    logDebug('Cleared validation cache', { entriesRemoved: cacheSize });
  };

  /**
   * Perform actual validation of options
   */
  const performValidation = (
    options: ImageTransformOptions,
    validationConfig: ImageValidationConfig
  ): ValidationResult => {
    // Make a copy of the options to avoid modifying the original
    const validatedOptions = { ...options };
    const errors: ValidationError[] = [];

    // Validate width
    if (
      validatedOptions.width !== null &&
      validatedOptions.width !== undefined &&
      validatedOptions.width !== 'auto'
    ) {
      const width = Number(validatedOptions.width);
      const minWidth = validationConfig.minWidth || DEFAULT_VALIDATION_CONFIG.minWidth!;
      const maxWidth = validationConfig.maxWidth || DEFAULT_VALIDATION_CONFIG.maxWidth!;

      const error = validateNumericBounds(width, 'width', minWidth, maxWidth);
      if (error) {
        errors.push(error);
      }
    }

    // Validate height
    if (validatedOptions.height !== null && validatedOptions.height !== undefined) {
      const minHeight = validationConfig.minHeight || DEFAULT_VALIDATION_CONFIG.minHeight!;
      const maxHeight = validationConfig.maxHeight || DEFAULT_VALIDATION_CONFIG.maxHeight!;

      const error = validateNumericBounds(validatedOptions.height, 'height', minHeight, maxHeight);
      if (error) {
        errors.push(error);
      }
    }

    // Validate quality
    if (validatedOptions.quality !== null && validatedOptions.quality !== undefined) {
      const minQuality = validationConfig.minQuality || DEFAULT_VALIDATION_CONFIG.minQuality!;
      const maxQuality = validationConfig.maxQuality || DEFAULT_VALIDATION_CONFIG.maxQuality!;

      const error = validateNumericBounds(
        validatedOptions.quality,
        'quality',
        minQuality,
        maxQuality
      );
      if (error) {
        errors.push(error);
      }
    }

    // Validate fit
    if (validatedOptions.fit) {
      const validFit = validationConfig.fit || DEFAULT_VALIDATION_CONFIG.fit!;
      const error = validateAllowedValues(validatedOptions.fit, 'fit', validFit);
      if (error) {
        errors.push(error);
      }
    }

    // Validate format
    if (validatedOptions.format) {
      const validFormats = validationConfig.format || DEFAULT_VALIDATION_CONFIG.format!;
      const error = validateAllowedValues(validatedOptions.format, 'format', validFormats);
      if (error) {
        errors.push(error);
      }
    }

    // Validate metadata
    if (validatedOptions.metadata) {
      const validMetadata = validationConfig.metadata || DEFAULT_VALIDATION_CONFIG.metadata!;
      const error = validateAllowedValues(validatedOptions.metadata, 'metadata', validMetadata);
      if (error) {
        errors.push(error);
      }
    }

    // Validate gravity
    if (validatedOptions.gravity) {
      const validGravity = validationConfig.gravity || DEFAULT_VALIDATION_CONFIG.gravity!;
      const error = validateAllowedValues(validatedOptions.gravity, 'gravity', validGravity);
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      options: validatedOptions,
    };
  };

  return {
    /**
     * Get the default validation configuration
     */
    getDefaultValidationConfig(): ImageValidationConfig {
      return { ...DEFAULT_VALIDATION_CONFIG };
    },

    /**
     * Create a validation error
     */
    createError(message: string, field?: string, value?: unknown): ValidationError {
      return createValidationError(message, field, value);
    },

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; enabled: boolean; maxSize: number; ttl: number } {
      return {
        size: validationCache.size,
        enabled: cacheSettings.enabled,
        maxSize: cacheSettings.maxSize,
        ttl: cacheSettings.ttl,
      };
    },

    /**
     * Clear the validation cache
     */
    clearCache(): void {
      clearCache();
    },

    /**
     * Configure the validation cache
     */
    configureCaching(config: Partial<ValidationCacheConfig>): void {
      Object.assign(cacheSettings, config);
      logDebug('Updated cache configuration', { cacheSettings });

      // If cache disabled, clear it
      if (!cacheSettings.enabled) {
        clearCache();
      }
    },

    /**
     * Validate image transformation options
     */
    validateOptions(
      options: ImageTransformOptions,
      config?: ImageValidationConfig
    ): ValidationResult {
      // Use provided config or default
      const validationConfig = config || this.getDefaultValidationConfig();

      // Generate cache key
      const cacheKey = generateCacheKey(options, validationConfig);

      // Check cache first
      const cachedResult = getCachedValidation(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      logDebug('Validating image options', {
        options,
        config: validationConfig,
        cacheEnabled: cacheSettings.enabled,
      });

      // Perform the validation
      const result = performValidation(options, validationConfig);

      // Log results
      if (!result.isValid) {
        logError('Validation failed', {
          options,
          errors: result.errors.map((e) => ({
            message: e.message,
            field: e.field,
            value: e.value,
          })),
        });
      } else {
        logDebug('Validation successful', { options });
      }

      // Cache the result for future use
      cacheValidationResult(cacheKey, result);

      return result;
    },
  };
}

/**
 * @deprecated Use createImageValidationService instead
 */
export const imageValidationService: IImageValidationService = createImageValidationService();
