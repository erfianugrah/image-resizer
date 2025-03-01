/**
 * Check if client hints headers are present in the request
 * @param {Request} request - The incoming request
 * @returns {boolean} - True if client hints are available
 */
export function hasClientHints(request) {
  const viewportWidth = request.headers.get("Sec-CH-Viewport-Width");
  const dpr = request.headers.get("Sec-CH-DPR");

  return Boolean(viewportWidth) || Boolean(dpr);
}

/**
 * Get responsive width based on client hints headers - simplified to use 'auto'
 * @param {Request} request - The incoming request
 * @returns {Object|null} - Width settings for client hints or null if not available
 */
export function getWidthFromClientHints(request) {
  // Check if client hints are available
  if (hasClientHints(request)) {
    return {
      width: "auto", // Let Cloudflare handle the sizing with client hints
      source: "client-hints-auto",
    };
  }

  return null;
}
