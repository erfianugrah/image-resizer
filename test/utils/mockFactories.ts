/**
 * Mock factory functions for testing
 * This file provides factory functions that create mock implementations of our service interfaces
 * for use in unit tests. Each factory creates a complete mock with vi.fn() for all methods.
 */

import { vi } from 'vitest';
import { IPathUtils, PathMatch, PathPattern } from '../../src/types/utils/path';
import { IUrlParamUtils } from '../../src/types/utils/urlParam';
import { IUrlTransformUtils } from '../../src/types/utils/urlTransform';
import { IClientDetectionUtils, DeviceInfo } from '../../src/types/utils/clientDetection';
import { IFormatUtils } from '../../src/types/utils/format';
import { IValidationUtils, ValidationResult } from '../../src/types/utils/validation';
import { ILogger } from '../../src/types/core/logger';
import { IConfigManager } from '../../src/types/core/config';

/**
 * Create a mock path utilities implementation
 * @returns Mock implementation of IPathUtils
 */
export function createMockPathUtils(): IPathUtils {
  return {
    getDerivativeFromPath: vi.fn().mockReturnValue('thumbnail'),
    isImagePath: vi.fn().mockReturnValue(true),
    getFilenameFromPath: vi.fn().mockReturnValue('image.jpg'),
    findMatchingPathPattern: vi.fn().mockReturnValue({ name: 'test', matcher: '.*' }),
    matchPathWithCaptures: vi.fn().mockReturnValue({
      pattern: { name: 'test', matcher: '.*' },
      captures: { '1': 'capture1' },
    }),
    extractVideoId: vi.fn().mockReturnValue('video123'),
  };
}

/**
 * Create a mock URL parameter utilities implementation
 * @returns Mock implementation of IUrlParamUtils
 */
export function createMockUrlParamUtils(): IUrlParamUtils {
  return {
    extractImageParams: vi.fn().mockReturnValue({
      width: 800,
      height: 600,
      quality: 80,
      format: 'auto',
    }),
    parseParamValue: vi.fn().mockImplementation((value) => {
      if (typeof value === 'string' && !isNaN(Number(value))) {
        return Number(value);
      }
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }),
    createQueryString: vi.fn().mockReturnValue('width=800&height=600'),
    getParamValue: vi.fn().mockImplementation((params, name, defaultValue) => {
      const mockParams: Record<string, any> = {
        width: 800,
        height: 600,
        quality: 80,
        format: 'auto',
      };
      return mockParams[name] || defaultValue;
    }),
  };
}

/**
 * Create a mock URL transform utilities implementation
 * @returns Mock implementation of IUrlTransformUtils
 */
export function createMockUrlTransformUtils(): IUrlTransformUtils {
  return {
    transformUrlToImageDelivery: vi.fn().mockImplementation((url) => {
      return `https://imagedelivery.net/xxx/${url.split('/').pop()}`;
    }),
    buildImageOptions: vi.fn().mockReturnValue({
      width: 800,
      height: 600,
      quality: 80,
      format: 'auto',
      fit: 'cover',
    }),
    applyOptionsToUrl: vi.fn().mockImplementation((url, options) => {
      let result = url;
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(options)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }

      const queryString = params.toString();
      if (queryString) {
        result += (url.includes('?') ? '&' : '?') + queryString;
      }

      return result;
    }),
    processUrl: vi.fn().mockImplementation((url) => {
      return {
        sourceUrl: url,
        transformedUrl: `https://imagedelivery.net/xxx/${url.split('/').pop()}?width=800&height=600`,
        options: {
          width: 800,
          height: 600,
          quality: 80,
          format: 'auto',
          fit: 'cover',
        },
      };
    }),
  };
}

/**
 * Create a mock client detection utilities implementation
 * @returns Mock implementation of IClientDetectionUtils
 */
export function createMockClientDetectionUtils(): IClientDetectionUtils {
  return {
    hasClientHints: vi.fn().mockReturnValue(false),
    hasCfDeviceType: vi.fn().mockReturnValue(true),
    getDeviceTypeFromUserAgent: vi.fn().mockReturnValue('desktop'),
    getDeviceInfo: vi.fn().mockReturnValue({ type: 'desktop', width: 1440 }),
    getViewportWidth: vi.fn().mockReturnValue(1440),
    getDevicePixelRatio: vi.fn().mockReturnValue(2),
    getResponsiveWidth: vi.fn().mockReturnValue({ width: 1440, source: 'device-type' }),
    snapToBreakpoint: vi.fn().mockImplementation((width, breakpoints) => {
      // Simple implementation for tests
      if (!breakpoints || breakpoints.length === 0) return width;

      // Find closest breakpoint
      let closest = breakpoints[0];
      let minDiff = Math.abs(width - closest);

      for (let i = 1; i < breakpoints.length; i++) {
        const diff = Math.abs(width - breakpoints[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closest = breakpoints[i];
        }
      }

      return closest;
    }),
  };
}

/**
 * Create a mock format utilities implementation
 * @returns Mock implementation of IFormatUtils
 */
export function createMockFormatUtils(): IFormatUtils {
  return {
    getBestSupportedFormat: vi.fn().mockReturnValue('webp'),
    getFormatFromAcceptHeader: vi.fn().mockReturnValue('webp'),
    isAnimated: vi.fn().mockReturnValue(false),
    getSupportedFormats: vi.fn().mockReturnValue(['jpeg', 'webp', 'avif']),
    getCompatibleFormats: vi.fn().mockReturnValue(['jpeg', 'webp']),
    getRequireFormat: vi.fn().mockReturnValue(null),
    isClientOptimizable: vi.fn().mockReturnValue(true),
  };
}

/**
 * Create a mock validation utilities implementation
 * @returns Mock implementation of IValidationUtils
 */
export function createMockValidationUtils(): IValidationUtils {
  return {
    validateImageOptions: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      value: { width: 800, height: 600, quality: 80 },
    }),
    validateDomainAllowList: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      value: 'example.com',
    }),
    validatePatternAllowList: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      value: '.*\\.jpg$',
    }),
    createValidationSchema: vi.fn().mockImplementation((schema) => schema),
  };
}

/**
 * Create a mock logger implementation
 * @returns Mock implementation of ILogger
 */
export function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    logRequest: vi.fn(),
    logResponse: vi.fn(),
  };
}

/**
 * Create a mock config manager implementation
 * @returns Mock implementation of IConfigManager
 */
export function createMockConfigManager(): IConfigManager {
  return {
    initialize: vi.fn(),
    getConfig: vi.fn().mockReturnValue({
      mode: 'development',
      version: '1.0.0',
      accountId: 'test-account',
      debug: {
        enabled: true,
        level: 'debug',
      },
      cache: {
        method: 'cf-cache-api',
        ttl: 86400,
        browser: {
          ttl: 3600,
        },
      },
      derivatives: {
        thumbnail: {
          width: 200,
          height: 200,
          fit: 'cover',
        },
        header: {
          width: 1200,
          height: 400,
          fit: 'cover',
        },
      },
      responsive: {
        breakpoints: [320, 768, 1024, 1440, 1920],
        deviceWidths: {
          mobile: 480,
          tablet: 768,
          desktop: 1440,
        },
      },
      defaults: {
        quality: 80,
        fit: 'cover',
        format: 'auto',
        metadata: 'none',
      },
      allowList: {
        domains: ['example.com', 'test.com'],
        patterns: ['.*\\.jpg$', '.*\\.png$'],
      },
    }),
  };
}

/**
 * Create a complete set of mock utilities for testing
 * @returns Object containing all mock utilities
 */
export function createMockUtilitiesBundle() {
  return {
    pathUtils: createMockPathUtils(),
    urlParamUtils: createMockUrlParamUtils(),
    urlTransformUtils: createMockUrlTransformUtils(),
    clientDetectionUtils: createMockClientDetectionUtils(),
    formatUtils: createMockFormatUtils(),
    validationUtils: createMockValidationUtils(),
    logger: createMockLogger(),
    configManager: createMockConfigManager(),
  };
}
