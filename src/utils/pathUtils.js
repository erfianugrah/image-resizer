/**
 * Determine derivative type from URL path
 * @param {string} path - The URL path
 * @returns {string|null} - Derivative type or null if no match
 */
export function getDerivativeFromPath(path) {
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
