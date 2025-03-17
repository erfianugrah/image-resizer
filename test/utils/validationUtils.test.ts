/**
 * Tests for validation utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateImageParams,
  formatValidationErrors,
  createValidationUtils,
} from '../../src/utils/validationUtils';
import { z } from 'zod';

describe('validationUtils', () => {
  // Test the deprecated, backward-compatible functions
  describe('Legacy API', () => {
    describe('validateImageParams', () => {
      it('should validate valid parameters', () => {
        const params = new URLSearchParams({
          width: '800',
          height: '600',
          quality: '85',
          fit: 'scale-down',
          format: 'webp',
          metadata: 'copyright',
        });

        const result = validateImageParams(params);
        expect(result.errors).toBeNull();
        expect(result.params).toEqual({
          width: 800,
          height: 600,
          quality: 85,
          fit: 'scale-down',
          format: 'webp',
          metadata: 'copyright',
        });
      });

      it('should reject invalid width', () => {
        const params = new URLSearchParams({
          width: '9', // Below min width of 10
          height: '600',
        });

        const result = validateImageParams(params);
        expect(result.params).toBeNull();
        expect(result.errors).toBeInstanceOf(z.ZodError);
        expect(result.errors?.errors[0].path).toContain('width');
      });

      it('should reject invalid fit value', () => {
        const params = new URLSearchParams({
          width: '800',
          height: '600',
          fit: 'invalid-fit-value',
        });

        const result = validateImageParams(params);
        expect(result.params).toBeNull();
        expect(result.errors).toBeInstanceOf(z.ZodError);
        expect(result.errors?.errors[0].path).toContain('fit');
      });

      it('should handle empty parameters', () => {
        const params = new URLSearchParams();
        const result = validateImageParams(params);
        expect(result.errors).toBeNull();
        expect(result.params).toEqual({});
      });

      it('should handle record object input', () => {
        const params = {
          width: '800',
          height: '600',
        };

        const result = validateImageParams(params);
        expect(result.errors).toBeNull();
        expect(result.params).toEqual({
          width: 800,
          height: 600,
        });
      });
    });

    describe('formatValidationErrors', () => {
      it('should format validation errors', () => {
        // Create a mock ZodError
        const params = new URLSearchParams({
          width: '9',
          fit: 'invalid',
        });

        const result = validateImageParams(params);
        expect(result.params).toBeNull();
        expect(result.errors).toBeInstanceOf(z.ZodError);

        if (result.errors) {
          const formatted = formatValidationErrors(result.errors);
          const parsed = JSON.parse(formatted);

          expect(parsed.error).toBe('Invalid request parameters');
          expect(parsed.details).toBeInstanceOf(Array);
          expect(parsed.details.length).toBeGreaterThan(0);
          expect(parsed.details[0]).toHaveProperty('path');
          expect(parsed.details[0]).toHaveProperty('message');
        }
      });
    });
  });

  // Test the new factory pattern implementation
  describe('Factory API', () => {
    // Mock dependencies
    const mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
    };

    // We need to import the imageConfig directly
    const imageConfig = {
      validation: {
        minWidth: 10,
        maxWidth: 8192,
        minHeight: 10,
        maxHeight: 8192,
        minQuality: 1,
        maxQuality: 100,
        fit: ['cover', 'contain', 'fill', 'scale-down'],
        format: ['auto', 'avif', 'webp', 'png', 'jpeg', 'jpg', 'gif'],
        metadata: ['none', 'copyright', 'all'],
        gravity: ['auto', 'center', 'face', 'edge', 'top', 'bottom', 'left', 'right'],
      },
    };

    // Mock configuration provider that returns the actual imageConfig
    const mockConfigProvider = {
      getConfig: vi.fn().mockImplementation(() => ({
        validation: imageConfig.validation,
      })),
    };

    // Reset mocks before each test
    beforeEach(() => {
      mockLogger.debug.mockReset();
      mockLogger.error.mockReset();
      mockConfigProvider.getConfig.mockClear();
    });

    describe('createValidationUtils', () => {
      it('should create ValidationUtils instance with dependencies', () => {
        // Act
        const validationUtils = createValidationUtils({
          logger: mockLogger,
          configProvider: mockConfigProvider,
        });

        // Assert
        expect(validationUtils).toBeDefined();
        expect(typeof validationUtils.validateImageParams).toBe('function');
        expect(typeof validationUtils.formatValidationErrors).toBe('function');
      });

      it('should create ValidationUtils instance without dependencies', () => {
        // Act
        const validationUtils = createValidationUtils();

        // Assert
        expect(validationUtils).toBeDefined();
        expect(typeof validationUtils.validateImageParams).toBe('function');
      });
    });

    describe('validateImageParams', () => {
      it('should validate image parameters with custom config', () => {
        // Arrange
        const validationUtils = createValidationUtils({
          logger: mockLogger,
          configProvider: mockConfigProvider,
        });

        const params = new URLSearchParams({
          width: '800',
          height: '600',
          quality: '85',
          fit: 'cover',
          format: 'webp',
        });

        // Act
        const result = validationUtils.validateImageParams(params);

        // Assert
        expect(result.errors).toBeNull();
        expect(result.params).toEqual({
          width: 800,
          height: 600,
          quality: 85,
          fit: 'cover',
          format: 'webp',
        });
        expect(mockConfigProvider.getConfig).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it('should handle validation failure gracefully', () => {
        // Arrange
        const validationUtils = createValidationUtils({
          logger: mockLogger,
          configProvider: mockConfigProvider,
        });

        const params = new URLSearchParams({
          width: '9', // Too small (min is 10)
          fit: 'invalid', // Invalid enum value
        });

        // Act
        const result = validationUtils.validateImageParams(params);

        // Assert
        expect(result.params).toBeNull();
        expect(result.errors).toBeInstanceOf(z.ZodError);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'ValidationUtils',
          'Validation failed',
          expect.any(Object)
        );
      });
    });

    describe('formatValidationErrors', () => {
      it('should format validation errors with logging', () => {
        // Arrange
        const validationUtils = createValidationUtils({
          logger: mockLogger,
        });

        // Generate a ZodError
        const zodError = new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['width'],
            message: 'Width must be at least 10px',
          },
          {
            code: z.ZodIssueCode.invalid_enum_value,
            path: ['fit'],
            message: 'Invalid enum value',
            options: ['cover', 'contain', 'fill'],
            received: 'invalid',
          },
        ]);

        // Act
        const result = validationUtils.formatValidationErrors(zodError);

        // Assert
        const parsed = JSON.parse(result);
        expect(parsed.error).toBe('Invalid request parameters');
        expect(parsed.details).toHaveLength(2);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'ValidationUtils',
          'Formatting validation errors',
          expect.any(Object)
        );
      });
    });
  });
});
