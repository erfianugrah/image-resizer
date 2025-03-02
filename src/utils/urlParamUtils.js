/**
 * Extract image parameters from URL query parameters
 * @param {URLSearchParams} urlParams - URL parameters
 * @param {string} path - URL path
 * @returns {Object} - Extracted image parameters
 */
export function extractImageParams(urlParams, path = "") {
  // Define parameters with default values
  const paramDefinitions = {
    // Core parameters
    derivative: null,
    width: null,
    height: null,
    quality: null,
    fit: null,
    format: null,
    metadata: "copyright",

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
  return Object.entries(paramDefinitions).reduce(
    (params, [key, defaultValue]) => {
      params[key] = urlParams.get(key) || defaultValue;
      return params;
    },
    {},
  );
}

/**
 * Parse width parameter into numeric value, "auto", or null if not numeric
 * @param {string} widthParam - Width parameter from URL
 * @returns {number|string|null} - Parsed width, "auto", or null if not a valid number
 */
export function parseWidthParam(widthParam) {
  if (!widthParam) {
    return null;
  }
  
  if (widthParam === "auto") {
    return "auto";
  }

  const parsedWidth = parseInt(widthParam);
  return !isNaN(parsedWidth) ? parsedWidth : null;
}

/**
 * Find closest width from available widths
 * @param {number} targetWidth - Requested width
 * @param {number[]} availableWidths - Array of available widths
 * @returns {number} - Closest available width
 */
export function findClosestWidth(targetWidth, availableWidths) {
  if (!availableWidths || availableWidths.length === 0) {
    return targetWidth;
  }

  return availableWidths.reduce((prev, curr) => {
    return (Math.abs(curr - targetWidth) < Math.abs(prev - targetWidth))
      ? curr
      : prev;
  });
}
