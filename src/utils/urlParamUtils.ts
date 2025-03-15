/**
 * Extract image parameters from URL query parameters
 * @param urlParams - URL parameters
 * @param path - URL path
 * @returns Extracted image parameters
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

export function extractImageParams(urlParams: URLSearchParams, _path = ''): ImageParamOptions {
  // Define parameters with default values
  const paramDefinitions: ImageParamOptions = {
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
export function parseWidthParam(widthParam: string | null): number | string | null {
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
export function findClosestWidth(
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
