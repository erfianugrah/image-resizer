/**
 * Determine derivative type from URL path
 * @param {string} path - The URL path
 * @param {Object} config - Environment configuration
 * @returns {string|null} - Derivative type or null if no match
 */
export function getDerivativeFromPath(path, config = null) {
  // Define known derivatives
  const knownDerivatives = ["header", "thumbnail", "avatar", "product"];

  // Check for exact path segments to avoid partial matches
  const segments = path.split("/").filter((segment) => segment);

  // Check first segment specifically
  if (segments.length > 0 && knownDerivatives.includes(segments[0])) {
    return segments[0];
  }

  // If config is available, check path templates
  if (config && config.pathTemplates) {
    const matchedPath = Object.keys(config.pathTemplates).find((pathPattern) =>
      path.includes(`/${pathPattern}/`)
    );

    if (matchedPath) {
      return config.pathTemplates[matchedPath];
    }
  }

  // Fallback to substring check for backward compatibility
  for (const derivative of knownDerivatives) {
    if (path.includes(`/${derivative}/`)) {
      return derivative;
    }
  }

  return null;
}

/**
 * Check if the path contains image file extension
 * @param {string} path - The URL path
 * @returns {boolean} - True if path ends with image extension
 */
export function isImagePath(path) {
  return /\.(jpe?g|JPG|png|gif|webp|svg)$/i.test(path);
}

/**
 * Extract filename from path
 * @param {string} path - The URL path
 * @returns {string} - Filename
 */
export function getFilenameFromPath(path) {
  const segments = path.split("/");
  return segments[segments.length - 1];
}
