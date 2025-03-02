/**
 * Extract image parameters from URL query parameters
 * @param {URLSearchParams} urlParams - URL parameters
 * @param {string} path - URL path
 * @returns {Object} - Extracted image parameters
 */
export function extractImageParams(urlParams, path = "") {
  // Define parameters with default values
  const paramDefinitions = {
    derivative: null,
    width: null,
    height: null,
    quality: null,
    fit: null,
    format: null,
    metadata: "copyright",
    upscale: "false",
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
 * Parse width parameter into numeric value or null if not numeric
 * @param {string} widthParam - Width parameter from URL
 * @returns {number|null} - Parsed width or null if not a valid number
 */
export function parseWidthParam(widthParam) {
  if (!widthParam || widthParam === "auto") {
    return null;
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
