/**
 * Check if client hints headers are present in the request
 * @param {Request} request - The incoming request
 * @returns {boolean} - True if client hints are available
 */
export function hasClientHints(request) {
  // Define client hint headers to check
  const clientHintHeaders = [
    "Sec-CH-Viewport-Width",
    "Sec-CH-DPR",
    "Width",
    "Viewport-Width",
  ];

  // Log all client hints headers for debugging
  const hintsDebug = clientHintHeaders.reduce((debug, header) => {
    debug[header] = request.headers.get(header);
    return debug;
  }, {});

  console.log("Client Hints Headers:", hintsDebug);

  // Check if any of the headers have a non-empty value
  return clientHintHeaders.some((header) => {
    const value = request.headers.get(header);
    return value && value !== "";
  });
}

/**
 * Get responsive width based on client hints headers
 * @param {Request} request - The incoming request
 * @returns {Object} - Width settings based on client hints
 */
export function getWidthFromClientHints(request) {
  // Extract relevant headers
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

  // Calculate specific width based on viewport size
  if (actualViewportWidth) {
    const vw = parseInt(actualViewportWidth);

    // Define viewport breakpoints and corresponding widths
    const breakpoints = [
      { maxWidth: 640, width: 320 }, // mobile
      { maxWidth: 1024, width: 768 }, // tablet
      { maxWidth: 1440, width: 960 }, // desktop
      { maxWidth: Infinity, width: 1200 }, // large desktop
    ];

    // Find appropriate width based on viewport
    const breakpoint = breakpoints.find((bp) => vw <= bp.maxWidth);
    let optimizedWidth = breakpoint.width;

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
