/**
 * Determine optimal image format based on Accept header and parameters
 * @param {Request} request - The incoming request
 * @param {string|null} formatParam - Format parameter from URL
 * @returns {string} - Optimal image format
 */
export function determineFormat(request, formatParam) {
  // If format is explicitly specified, use that
  if (formatParam) return formatParam;

  // Otherwise determine from Accept header
  const accept = request.headers.get("Accept");

  if (/image\/avif/.test(accept)) {
    return "avif"; // Use AVIF if supported
  } else if (/image\/webp/.test(accept)) {
    return "webp"; // Use WebP as fallback
  }

  // Default to AVIF (Cloudflare will handle fallback if needed)
  return "avif";
}

/**
 * Get content type based on format
 * @param {string} format - Image format
 * @returns {string} - Content type header value
 */
export function getContentTypeForFormat(format) {
  switch (format.toLowerCase()) {
    case "avif":
      return "image/avif";
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}
