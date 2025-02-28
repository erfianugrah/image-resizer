/**
 * Determine responsive width based on client hints
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width settings based on device
 */
export function getResponsiveWidth(request, responsiveWidths) {
  const options = {};

  // Client hints are the highest priority - use them if available
  const viewportWidth = parseInt(request.headers.get("Sec-CH-Viewport-Width"));
  const dpr = parseFloat(request.headers.get("Sec-CH-DPR")) || 1;

  if (viewportWidth) {
    // Calculate ideal image width based on viewport width and device pixel ratio
    const idealWidth = Math.floor(viewportWidth * dpr);

    // Find the closest responsive width that's at least as large as the ideal width
    // or use the largest available if none are large enough
    options.width = responsiveWidths.find((w) => w >= idealWidth) ||
      responsiveWidths[responsiveWidths.length - 1];
    options.source = "client-hints";
    return options;
  }

  // Fallback to user agent detection as lowest priority
  const userAgent = request.headers.get("User-Agent") || "";
  const cfDeviceType = request.headers.get("CF-Device-Type");

  if (
    cfDeviceType === "mobile" ||
    /mobile|android|iphone|ipod|webos|iemobile|opera mini/i.test(userAgent)
  ) {
    options.width = 320; // Mobile
  } else if (
    cfDeviceType === "tablet" || /ipad|tablet|playbook|silk/i.test(userAgent)
  ) {
    options.width = 768; // Tablet
  } else if (
    /macintosh|windows/i.test(userAgent) &&
    /screen and (min-width: 1440px)/.test(userAgent)
  ) {
    options.width = 1200; // Large desktop
  } else {
    options.width = 960; // Default desktop
  }

  options.source = "user-agent";
  return options;
}
