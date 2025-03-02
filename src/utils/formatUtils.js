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

  // Define format checks in order of preference
  const formatChecks = [
    { regex: /image\/avif/, format: "avif" },
    { regex: /image\/webp/, format: "webp" },
  ];

  // Find the first supported format
  const supportedFormat = formatChecks.find((check) =>
    check.regex.test(accept)
  );

  // Return the supported format or default to AVIF
  return supportedFormat ? supportedFormat.format : "avif";
}

/**
 * Get content type based on format
 * @param {string} format - Image format
 * @returns {string} - Content type header value
 */
export function getContentTypeForFormat(format) {
  const contentTypeMap = {
    "avif": "image/avif",
    "webp": "image/webp",
    "png": "image/png",
    "gif": "image/gif",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "svg": "image/svg+xml",
  };

  return contentTypeMap[format.toLowerCase()] || "image/jpeg";
}
