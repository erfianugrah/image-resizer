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
  return null;
}
