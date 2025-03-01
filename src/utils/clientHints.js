/**
 * Determine responsive width based on client hints
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width settings based on device
 */
export function getResponsiveWidth(request, responsiveWidths) {
  // Ensure we have a sorted array of widths
  const sortedWidths = [...responsiveWidths].sort((a, b) => a - b);
  const options = {};

  // PRIORITY 1: Client hints are the highest priority
  const viewportWidth = parseInt(request.headers.get("Sec-CH-Viewport-Width"));
  const dpr = parseFloat(request.headers.get("Sec-CH-DPR")) || 1;

  if (viewportWidth) {
    // Calculate ideal image width based on viewport width and device pixel ratio
    const idealWidth = Math.floor(viewportWidth * dpr);

    // Find the closest responsive width that's at least as large as the ideal width
    // or use the largest available if none are large enough
    options.width = sortedWidths.find((w) => w >= idealWidth) ||
      sortedWidths[sortedWidths.length - 1];
    options.source = "client-hints";
    return options;
  }

  // PRIORITY 2: Cloudflare device detection
  const cfDeviceType = request.headers.get("CF-Device-Type");

  if (cfDeviceType) {
    switch (cfDeviceType) {
      case "mobile":
        options.width = sortedWidths.find((w) => w >= 320) || 320;
        break;
      case "tablet":
        options.width = sortedWidths.find((w) => w >= 768) || 768;
        break;
      default: // desktop or other
        options.width = sortedWidths.find((w) => w >= 1024) || 1024;
    }
    options.source = "cf-device-type";
    return options;
  }

  // PRIORITY 3: User agent detection as lowest priority
  const userAgent = request.headers.get("User-Agent") || "";

  if (/mobile|android|iphone|ipod|webos|iemobile|opera mini/i.test(userAgent)) {
    options.width = sortedWidths.find((w) => w >= 320) || 320; // Mobile
  } else if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    options.width = sortedWidths.find((w) => w >= 768) || 768; // Tablet
  } else if (
    /macintosh|windows/i.test(userAgent) &&
    /screen and \(min-width: 1440px\)/.test(userAgent)
  ) {
    options.width = sortedWidths.find((w) => w >= 1200) || 1200; // Large desktop
  } else {
    options.width = sortedWidths.find((w) => w >= 960) || 960; // Default desktop
  }

  options.source = "user-agent";
  return options;
}
