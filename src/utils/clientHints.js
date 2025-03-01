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
  const viewportWidth = request.headers.get("Sec-CH-Viewport-Width");
  const dpr = request.headers.get("Sec-CH-DPR");

  // Check if client hints are available
  if (viewportWidth && dpr) {
    // Best case: We have both width and DPR
    return {
      width: "auto", // Let Cloudflare handle with full client hints
      source: "client-hints-complete",
    };
  } else if (viewportWidth) {
    // We have viewport width but no DPR
    return {
      width: "auto",
      source: "client-hints-viewport",
    };
  } else if (dpr) {
    // We have DPR but no viewport width - still use auto as Cloudflare can use DPR
    return {
      width: "auto",
      source: "client-hints-dpr",
    };
  }

  return null;
}
