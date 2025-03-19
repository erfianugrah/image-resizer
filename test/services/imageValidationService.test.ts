/**
 * Tests for the Image Validation Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createImageValidationService } from '../../src/services/imageValidationService';
import { ImageTransformOptions } from '../../src/types/services/image';
import { ValidationCacheConfig } from '../../src/types/services/imageValidation';

describe('ImageValidationService', () => {
  // Create a mock logger
  const createLoggerMock = () => ({
    debug: vi.fn(),
    error: vi.fn(),
  });

  // Create a mock error factory
  const createErrorFactoryMock = () => ({
    createValidationError: vi.fn((message, field, value) => ({
      message,
      field,
      value,
      type: 'VALIDATION_ERROR',
    })),
  });

  it('should validate options correctly', () => {
    // Arrange
    const loggerMock = createLoggerMock();
    const errorFactoryMock = createErrorFactoryMock();

    const validationService = createImageValidationService({
      logger: loggerMock,
      errorFactory: errorFactoryMock,
    });

    // Valid options
    const validOptions: ImageTransformOptions = {
      width: 800,
      height: 600,
      fit: 'cover',
      quality: 80,
      format: 'webp',
    };

    // Act
    const result = validationService.validateOptions(validOptions);

    // Assert
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.options).toEqual(validOptions);
  });

  it('should detect invalid options', () => {
    // Arrange
    const loggerMock = createLoggerMock();
    const errorFactoryMock = createErrorFactoryMock();

    const validationService = createImageValidationService({
      logger: loggerMock,
      errorFactory: errorFactoryMock,
    });

    // Invalid options
    const invalidOptions: ImageTransformOptions = {
      width: 9, // Too small, minimum is 10
      height: 9000, // Too large, maximum is 8192
      fit: 'invalid', // Not in allowed values
      quality: 110, // Too high, maximum is 100
    };

    // Act
    const result = validationService.validateOptions(invalidOptions);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Check that all expected error fields are present, without relying on order
    const errorFields = result.errors.map((e) => e.field);
    expect(errorFields).toContain('width');
    expect(errorFields).toContain('height');
    expect(errorFields).toContain('fit');
    expect(errorFields).toContain('quality');
  });

  it('should validate against custom config', () => {
    // Arrange
    const loggerMock = createLoggerMock();
    const validationService = createImageValidationService({
      logger: loggerMock,
    });

    // Custom config
    const customConfig = {
      minWidth: 100, // Stricter than default
      maxWidth: 1000, // Stricter than default
      fit: ['cover', 'contain'], // More limited than default
    };

    // Options valid with default config but invalid with custom config
    const options: ImageTransformOptions = {
      width: 50, // Below custom min
      fit: 'crop', // Not in custom allowed values
    };

    // Act
    const result = validationService.validateOptions(options, customConfig);

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].field).toBe('width');
    expect(result.errors[1].field).toBe('fit');
  });

  describe('Validation Caching', () => {
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let validationService: ReturnType<typeof createImageValidationService>;

    beforeEach(() => {
      loggerMock = createLoggerMock();
      validationService = createImageValidationService({
        logger: loggerMock,
        cacheConfig: {
          enabled: true,
          maxSize: 10,
          ttl: 1000, // 1 second TTL for testing
        },
      });
    });

    it('should cache validation results', () => {
      // Arrange
      const options: ImageTransformOptions = {
        width: 800,
        height: 600,
      };

      // Act - validate the same options twice
      const result1 = validationService.validateOptions(options);

      // Clear loggerMock to check if second call used cache
      vi.clearAllMocks();

      const result2 = validationService.validateOptions(options);

      // Assert
      expect(result1).toEqual(result2);

      // The debug log for actual validation should not have been called
      // because the second call should use cached result
      expect(loggerMock.debug).not.toHaveBeenCalledWith(
        'ImageValidationService',
        'Validating image options',
        expect.anything()
      );

      // Instead, it should log that it's using cached result
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'ImageValidationService',
        'Using cached validation result',
        expect.anything()
      );
    });

    it('should return cache statistics', () => {
      // Arrange
      const options1: ImageTransformOptions = { width: 100 };
      const options2: ImageTransformOptions = { width: 200 };

      // Act - add some items to cache
      validationService.validateOptions(options1);
      validationService.validateOptions(options2);

      // Get cache stats
      const stats = validationService.getCacheStats();

      // Assert
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
      expect(stats.ttl).toBe(1000);
    });

    it('should clear cache when requested', () => {
      // Arrange
      const options: ImageTransformOptions = { width: 300 };
      validationService.validateOptions(options);

      // Act - clear cache
      validationService.clearCache();

      // Assert
      expect(validationService.getCacheStats().size).toBe(0);

      // Validating again should not use cache
      vi.clearAllMocks();
      validationService.validateOptions(options);

      expect(loggerMock.debug).toHaveBeenCalledWith(
        'ImageValidationService',
        'Validating image options',
        expect.anything()
      );
    });

    it('should respect TTL and expire entries', async () => {
      // Arrange
      const options: ImageTransformOptions = { width: 400 };

      // Configure with short TTL for testing
      validationService.configureCaching({ ttl: 100 }); // 100ms TTL

      // Act
      validationService.validateOptions(options);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Clear logger mocks
      vi.clearAllMocks();

      // Validate again
      validationService.validateOptions(options);

      // Assert - should perform validation again
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'ImageValidationService',
        'Validating image options',
        expect.anything()
      );
    });

    it('should enforce cache size limits', () => {
      // Arrange
      validationService.configureCaching({ maxSize: 3 });

      // Act - add more items than the cache can hold
      for (let i = 0; i < 5; i++) {
        validationService.validateOptions({ width: 100 + i });
      }

      // Assert
      expect(validationService.getCacheStats().size).toBe(3);
    });

    it('should disable caching when configured', () => {
      // Arrange
      const options: ImageTransformOptions = { width: 500 };

      // Add to cache
      validationService.validateOptions(options);

      // Disable cache
      validationService.configureCaching({ enabled: false });

      // Clear logger mocks
      vi.clearAllMocks();

      // Act - validate again
      validationService.validateOptions(options);

      // Assert - should perform validation again
      expect(loggerMock.debug).toHaveBeenCalledWith(
        'ImageValidationService',
        'Validating image options',
        expect.anything()
      );

      // Cache should be empty
      expect(validationService.getCacheStats().size).toBe(0);
    });
  });
});
