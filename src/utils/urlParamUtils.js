/**
 * Extract image parameters from URL query parameters
 * @param {URLSearchParams} urlParams - URL parameters
 * @param {string} path - URL path
 * @returns {Object} - Extracted image parameters
 */
export function extractImageParams(urlParams, path = "") {
  return {
    derivative: urlParams.get("derivative"),
    width: urlParams.get("width"),
    height: urlParams.get("height"),
    quality: urlParams.get("quality"),
    fit: urlParams.get("fit"),
    format: urlParams.get("format"),
    metadata: urlParams.get("metadata") || "copyright",
    upscale: urlParams.get("upscale") !== "false", // Default to true unless explicitly set to false
  };
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
