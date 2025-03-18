import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUrlParamUtils,
  extractImageParams,
  parseWidthParam,
  findClosestWidth,
  extractDefaultImageParams,
} from '../../src/utils/urlParamUtils';
import { ImageParamOptions } from '../../src/types/utils/urlParam';

describe('UrlParamUtils', () => {
  describe('createUrlParamUtils', () => {
    const mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should create a UrlParamUtils instance with default dependencies', () => {
      const utils = createUrlParamUtils();
      expect(utils).toHaveProperty('extractImageParams');
      expect(utils).toHaveProperty('parseWidthParam');
      expect(utils).toHaveProperty('findClosestWidth');
    });

    it('should create a UrlParamUtils instance with provided dependencies', () => {
      const utils = createUrlParamUtils({ logger: mockLogger });
      expect(utils).toHaveProperty('extractImageParams');
      expect(utils).toHaveProperty('parseWidthParam');
      expect(utils).toHaveProperty('findClosestWidth');
    });
  });

  describe('extractImageParams', () => {
    const mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should extract parameters from URL search params', () => {
      const urlParams = new URLSearchParams('width=800&height=600&quality=80&format=webp');
      const result = extractImageParams(urlParams);

      expect(result).toHaveProperty('width', '800');
      expect(result).toHaveProperty('height', '600');
      expect(result).toHaveProperty('quality', '80');
      expect(result).toHaveProperty('format', 'webp');
    });

    it('should extract parameters with factory function and logger', () => {
      const utils = createUrlParamUtils({ logger: mockLogger });
      const urlParams = new URLSearchParams('width=800&height=600&quality=80&format=webp');
      const result = utils.extractImageParams(urlParams, '/image.jpg');

      expect(result).toHaveProperty('width', '800');
      expect(result).toHaveProperty('height', '600');
      expect(result).toHaveProperty('quality', '80');
      expect(result).toHaveProperty('format', 'webp');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'UrlParamUtils',
        'Extracting image parameters from URL',
        { path: '/image.jpg' }
      );
    });

    it('should extract R2 URL parameters', () => {
      const urlParams = new URLSearchParams(
        'width=800&height=600&quality=80&format=webp&fit=cover&derivative=thumbnail'
      );
      const result = extractImageParams(urlParams, '/r2/bucket/image.jpg');

      expect(result).toHaveProperty('width', '800');
      expect(result).toHaveProperty('height', '600');
      expect(result).toHaveProperty('quality', '80');
      expect(result).toHaveProperty('format', 'webp');
      expect(result).toHaveProperty('fit', 'cover');
      expect(result).toHaveProperty('derivative', 'thumbnail');
    });

    it('should handle empty URL parameters', () => {
      const urlParams = new URLSearchParams('');
      const result = extractImageParams(urlParams);

      expect(result).toHaveProperty('width', null);
      expect(result).toHaveProperty('height', null);
      expect(result).toHaveProperty('quality', null);
      expect(result).toHaveProperty('format', null);
    });

    it('should extract optional Cloudflare parameters', () => {
      const urlParams = new URLSearchParams('dpr=2&gravity=auto&trim=10&brightness=5&contrast=10');
      const result = extractImageParams(urlParams);

      expect(result).toHaveProperty('dpr', '2');
      expect(result).toHaveProperty('gravity', 'auto');
      expect(result).toHaveProperty('trim', '10');
      expect(result).toHaveProperty('brightness', '5');
      expect(result).toHaveProperty('contrast', '10');
    });

    it('should extract animation parameters', () => {
      const urlParams = new URLSearchParams('anim=true&format=gif');
      const result = extractImageParams(urlParams);

      expect(result).toHaveProperty('anim', 'true');
      expect(result).toHaveProperty('format', 'gif');
    });

    it('should extract derivative parameters for R2 paths', () => {
      const urlParams = new URLSearchParams('derivative=thumbnail');
      const result = extractImageParams(urlParams, '/r2/IMAGES_BUCKET/image.jpg');

      expect(result).toHaveProperty('derivative', 'thumbnail');
    });

    it('should include default metadata parameter', () => {
      const urlParams = new URLSearchParams('');
      const result = extractImageParams(urlParams);

      expect(result).toHaveProperty('metadata', 'copyright');
    });

    it('should override metadata parameter if provided', () => {
      const urlParams = new URLSearchParams('metadata=none');
      const result = extractImageParams(urlParams);

      expect(result).toHaveProperty('metadata', 'none');
    });
  });

  describe('parseWidthParam', () => {
    it('should return null for null input', () => {
      expect(parseWidthParam(null)).toBeNull();
    });

    it('should return "auto" for "auto" input', () => {
      expect(parseWidthParam('auto')).toBe('auto');
    });

    it('should return number for numeric input', () => {
      expect(parseWidthParam('800')).toBe(800);
    });

    it('should return null for non-numeric input', () => {
      expect(parseWidthParam('invalid')).toBeNull();
    });

    it('should parse width with factory function', () => {
      const utils = createUrlParamUtils();
      expect(utils.parseWidthParam('800')).toBe(800);
    });
  });

  describe('findClosestWidth', () => {
    it('should return the target width if availableWidths is null', () => {
      expect(findClosestWidth(800, null)).toBe(800);
    });

    it('should return the target width if availableWidths is empty', () => {
      expect(findClosestWidth(800, [])).toBe(800);
    });

    it('should find the closest width in availableWidths', () => {
      expect(findClosestWidth(800, [320, 640, 960, 1280])).toBe(640);
    });

    it('should find closest width with factory function', () => {
      const utils = createUrlParamUtils();
      expect(utils.findClosestWidth(800, [320, 640, 960, 1280])).toBe(640);
    });

    it('should handle undefined availableWidths', () => {
      expect(findClosestWidth(800, undefined)).toBe(800);
    });

    it('should find closest responsive width for R2 images', () => {
      // Common responsive widths used for R2 images
      const availableWidths = [320, 480, 640, 768, 1024, 1366, 1600, 1920];
      // The current implementation finds the "closest" width, not necessarily the next larger width
      expect(findClosestWidth(800, availableWidths)).toBe(768);
      expect(findClosestWidth(1100, availableWidths)).toBe(1024);
      expect(findClosestWidth(2000, availableWidths)).toBe(1920);
    });
  });

  describe('extractDefaultImageParams', () => {
    it('should return default image parameter definitions', () => {
      const defaults = extractDefaultImageParams();
      
      expect(defaults).toHaveProperty('derivative', null);
      expect(defaults).toHaveProperty('width', null);
      expect(defaults).toHaveProperty('height', null);
      expect(defaults).toHaveProperty('quality', null);
      expect(defaults).toHaveProperty('fit', null);
      expect(defaults).toHaveProperty('format', null);
      expect(defaults).toHaveProperty('metadata', 'copyright');
      
      // Cloudflare-specific parameters
      expect(defaults).toHaveProperty('dpr', null);
      expect(defaults).toHaveProperty('gravity', null);
      expect(defaults).toHaveProperty('trim', null);
      
      // Visual adjustments
      expect(defaults).toHaveProperty('brightness', null);
      expect(defaults).toHaveProperty('contrast', null);
      expect(defaults).toHaveProperty('gamma', null);
      expect(defaults).toHaveProperty('rotate', null);
      expect(defaults).toHaveProperty('sharpen', null);
      expect(defaults).toHaveProperty('saturation', null);
      
      // Optional settings
      expect(defaults).toHaveProperty('background', null);
      expect(defaults).toHaveProperty('blur', null);
      expect(defaults).toHaveProperty('border', null);
      expect(defaults).toHaveProperty('compression', null);
      expect(defaults).toHaveProperty('onerror', null);
      expect(defaults).toHaveProperty('anim', null);
    });

    it('should get defaults with factory function', () => {
      const utils = createUrlParamUtils();
      const defaults = utils.extractDefaultImageParams();
      
      expect(defaults).toHaveProperty('derivative', null);
      expect(defaults).toHaveProperty('width', null);
      expect(defaults).toHaveProperty('height', null);
    });

    it('should handle all Cloudflare Image Resizing parameters', () => {
      const defaults = extractDefaultImageParams();
      
      // Check that all expected Cloudflare parameters are included
      const allExpectedParams = [
        'width', 'height', 'fit', 'quality', 'format',
        'background', 'gravity', 'trim', 'dpr', 'rotate',
        'blur', 'sharpen', 'brightness', 'contrast', 'gamma',
        'saturation', 'metadata', 'onerror', 'anim'
      ];
      
      allExpectedParams.forEach(param => {
        expect(defaults).toHaveProperty(param);
      });
    });
  });
});