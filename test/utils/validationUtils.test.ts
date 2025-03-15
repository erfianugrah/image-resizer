/**
 * Tests for validation utilities
 */
import { describe, it, expect } from 'vitest';
import { validateImageParams, formatValidationErrors } from '../../src/utils/validationUtils';
import { z } from 'zod';

describe('validationUtils', () => {
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

    it('should convert string numeric values to numbers', () => {
      const params = new URLSearchParams({
        width: '1024',
        quality: '90',
        dpr: '2',
      });

      const result = validateImageParams(params);
      expect(result.errors).toBeNull();
      expect(result.params?.width).toBe(1024);
      expect(result.params?.quality).toBe(90);
      expect(result.params?.dpr).toBe(2);
    });

    it('should accept width=auto special value', () => {
      const params = new URLSearchParams({
        width: 'auto',
        quality: '85',
      });

      const result = validateImageParams(params);
      expect(result.errors).toBeNull();
      expect(result.params?.width).toBe('auto');
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
