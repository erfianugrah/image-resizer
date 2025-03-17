/**
 * URL parameter utilities
 */

import {
  ImageParamOptions,
  IUrlParamUtils,
  UrlParamUtilsDependencies,
} from '../types/utils/urlParam';

// Re-export types for backward compatibility
export type { ImageParamOptions };

/**
 * Create URL parameter utilities service
 * @param dependencies - Optional dependencies for URL parameter utilities
 * @returns URL parameter utilities implementation
 */
export function createUrlParamUtils(dependencies: UrlParamUtilsDependencies = {}): IUrlParamUtils {
  const { logger } = dependencies;

  /**
   * Extract image parameters from URL search parameters
   * @param urlParams - URL parameters to extract from
   * @param path - URL path (unused currently, but kept for interface compatibility)
   * @returns Extracted image parameters
   */
  function extractImageParams(urlParams: URLSearchParams, path = ''): ImageParamOptions {
    logger?.debug('UrlParamUtils', 'Extracting image parameters from URL', { path });

    // Get default parameter definitions
    const paramDefinitions = extractDefaultImageParams();

    // Extract parameters using the definitions
    return Object.entries(paramDefinitions).reduce<ImageParamOptions>(
      (params, [key, defaultValue]) => {
        params[key] = urlParams.get(key) || defaultValue;
        return params;
      },
      {} as ImageParamOptions
    );
  }

  /**
   * Parse width parameter into numeric value, "auto", or null if not numeric
   * @param widthParam - Width parameter from URL
   * @returns Parsed width, "auto", or null if not a valid number
   */
  function parseWidthParam(widthParam: string | null): number | string | null {
    if (!widthParam) {
      return null;
    }

    if (widthParam === 'auto') {
      return 'auto';
    }

    const parsedWidth = parseInt(widthParam);
    return !isNaN(parsedWidth) ? parsedWidth : null;
  }

  /**
   * Find closest width from available widths
   * @param targetWidth - Requested width
   * @param availableWidths - Array of available widths
   * @returns Closest available width
   */
  function findClosestWidth(
    targetWidth: number,
    availableWidths: number[] | null | undefined
  ): number {
    if (!availableWidths || availableWidths.length === 0) {
      return targetWidth;
    }

    return availableWidths.reduce((prev, curr) => {
      return Math.abs(curr - targetWidth) < Math.abs(prev - targetWidth) ? curr : prev;
    });
  }

  /**
   * Extract default image parameter definitions
   * This function centralizes the image parameter definitions
   * @returns Default parameter definitions
   */
  function extractDefaultImageParams(): ImageParamOptions {
    return {
      // Core parameters
      derivative: null,
      width: null,
      height: null,
      quality: null,
      fit: null,
      format: null,
      metadata: 'copyright',

      // Additional Cloudflare parameters
      dpr: null,
      gravity: null,
      trim: null,

      // Visual adjustments
      brightness: null,
      contrast: null,
      gamma: null,
      rotate: null,
      sharpen: null,
      saturation: null,

      // Optional settings
      background: null,
      blur: null,
      border: null,
      compression: null,
      onerror: null,
      anim: null,
    };
  }

  return {
    extractImageParams,
    parseWidthParam,
    findClosestWidth,
    extractDefaultImageParams,
  };
}

// Backward compatibility functions
/**
 * @deprecated Use createUrlParamUtils().extractImageParams instead
 */
export function extractImageParams(urlParams: URLSearchParams, path = ''): ImageParamOptions {
  return createUrlParamUtils().extractImageParams(urlParams, path);
}

/**
 * @deprecated Use createUrlParamUtils().parseWidthParam instead
 */
export function parseWidthParam(widthParam: string | null): number | string | null {
  return createUrlParamUtils().parseWidthParam(widthParam);
}

/**
 * @deprecated Use createUrlParamUtils().findClosestWidth instead
 */
export function findClosestWidth(
  targetWidth: number,
  availableWidths: number[] | null | undefined
): number {
  return createUrlParamUtils().findClosestWidth(targetWidth, availableWidths);
}

/**
 * @deprecated Use createUrlParamUtils().extractDefaultImageParams instead
 */
export function extractDefaultImageParams(): ImageParamOptions {
  return createUrlParamUtils().extractDefaultImageParams();
}
