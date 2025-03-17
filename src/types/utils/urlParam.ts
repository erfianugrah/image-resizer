/**
 * URL parameter utilities interfaces
 */

/**
 * Image parameter options extracted from URL
 */
export interface ImageParamOptions {
  derivative: string | null;
  width: string | null;
  height: string | null;
  quality: string | null;
  fit: string | null;
  format: string | null;
  metadata: string;
  dpr: string | null;
  gravity: string | null;
  trim: string | null;
  brightness: string | null;
  contrast: string | null;
  gamma: string | null;
  rotate: string | null;
  sharpen: string | null;
  saturation: string | null;
  background: string | null;
  blur: string | null;
  border: string | null;
  compression: string | null;
  onerror: string | null;
  anim: string | null;
  [key: string]: string | null;
}

/**
 * Interface for URL parameter utilities
 */
export interface IUrlParamUtils {
  /**
   * Extract image parameters from URL search parameters
   * @param urlParams - URL parameters to extract from
   * @param path - URL path (optional)
   * @returns Extracted image parameters
   */
  extractImageParams(urlParams: URLSearchParams, path?: string): ImageParamOptions;

  /**
   * Parse width parameter into numeric value, "auto", or null if not numeric
   * @param widthParam - Width parameter from URL
   * @returns Parsed width, "auto", or null if not a valid number
   */
  parseWidthParam(widthParam: string | null): number | string | null;

  /**
   * Find closest width from available widths
   * @param targetWidth - Requested width
   * @param availableWidths - Array of available widths
   * @returns Closest available width
   */
  findClosestWidth(targetWidth: number, availableWidths: number[] | null | undefined): number;

  /**
   * Extract default image parameter definitions
   * @returns Default parameter definitions
   */
  extractDefaultImageParams(): ImageParamOptions;
}

/**
 * Dependencies for URL parameter utilities factory
 */
export interface UrlParamUtilsDependencies {
  /**
   * Optional logger for debugging purposes
   */
  logger?: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
}
