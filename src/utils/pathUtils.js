/**
 * Determine derivative type from URL path
 * @param {string} path - The URL path
 * @returns {string|null} - Derivative type or null if no match
 */
export function getDerivativeFromPath(path) {
  // Check for exact path segments to avoid partial matches
  const segments = path.split("/").filter((segment) => segment);

  if (segments.length > 0) {
    // Check first segment specifically
    if (segments[0] === "header") {
      return "header";
    } else if (segments[0] === "thumbnail") {
      return "thumbnail";
    }
  }

  // Fallback to substring check for backward compatibility
  if (path.includes("/header/")) {
    return "header";
  } else if (path.includes("/thumbnail/")) {
    return "thumbnail";
  }
  // Add more path-based derivatives as needed
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
