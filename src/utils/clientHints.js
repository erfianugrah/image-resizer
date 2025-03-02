/**
 * Check if client hints headers are present in the request
 * @param {Request} request - The incoming request
 * @returns {boolean} - True if client hints are available
 */
export function hasClientHints(request) {
  // Log all client hints headers for debugging
  console.log("Client Hints Headers:", {
    "Sec-CH-Viewport-Width": request.headers.get("Sec-CH-Viewport-Width"),
    "Sec-CH-DPR": request.headers.get("Sec-CH-DPR"),
    "Width": request.headers.get("Width"),
    "Viewport-Width": request.headers.get("Viewport-Width"),
  });

  const viewportWidth = request.headers.get("Sec-CH-Viewport-Width");
  const dpr = request.headers.get("Sec-CH-DPR");
  const width = request.headers.get("Width");
  const viewportWithLegacy = request.headers.get("Viewport-Width");

  // More strict check - ensure we have actual values, not just headers
  return (viewportWidth && viewportWidth !== "") ||
    (dpr && dpr !== "") ||
    (width && width !== "") ||
    (viewportWithLegacy && viewportWithLegacy !== "");
}

/**
 * Get responsive width based on client hints headers
 * @param {Request} request - The incoming request
 * @returns {Object} - Width settings based on client hints
 */
export function getWidthFromClientHints(request) {
  const viewportWidth = request.headers.get("Sec-CH-Viewport-Width");
  const dpr = request.headers.get("Sec-CH-DPR");
  const width = request.headers.get("Width");
  const viewportWithLegacy = request.headers.get("Viewport-Width");

  // Use actual viewport width from headers
  const actualViewportWidth = viewportWidth || viewportWithLegacy;
  const actualDpr = dpr || "1";

  console.log("Client Hints Values:", {
    viewportWidth,
    dpr,
    width,
    viewportWithLegacy,
  });

  // Calculate specific width based on viewport size instead of using "auto"
  if (actualViewportWidth) {
    const vw = parseInt(actualViewportWidth);
    let optimizedWidth;

    // Use Cloudflare's documented breakpoints
    if (vw <= 640) {
      optimizedWidth = 320; // mobile
    } else if (vw <= 1024) {
      optimizedWidth = 768; // tablet
    } else if (vw <= 1440) {
      optimizedWidth = 960; // desktop
    } else {
      optimizedWidth = 1200; // large desktop/monitor
    }

    // Apply DPR adjustment for high-DPI screens
    if (actualDpr && actualDpr !== "1") {
      const dprValue = parseFloat(actualDpr);
      if (dprValue > 1) {
        optimizedWidth = Math.min(Math.round(optimizedWidth * dprValue), 2560);
      }
    }

    return {
      width: optimizedWidth,
      source: `client-hints-${optimizedWidth}px`,
    };
  }

  // Fallback for partial client hints
  return {
    width: 1200, // Safe default for desktops
    source: "client-hints-fallback",
  };
}
