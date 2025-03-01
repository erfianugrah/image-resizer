import {
  getDeviceTypeFromUserAgent,
  getWidthForDeviceType,
} from "./userAgentUtils.js";

/**
 * Check if CF-Device-Type header is present
 * @param {Request} request - The incoming request
 * @returns {boolean} - True if CF-Device-Type is available
 */
export function hasCfDeviceType(request) {
  return Boolean(request.headers.get("CF-Device-Type"));
}

/**
 * Get responsive width based on CF-Device-Type header - using specific widths
 * @param {Request} request - The incoming request
 * @returns {Object} - Width settings based on CF-Device-Type
 */
export function getWidthFromCfDeviceType(request) {
  const cfDeviceType = request.headers.get("CF-Device-Type");

  // Use specific widths based on CF-Device-Type
  let width;
  switch (cfDeviceType) {
    case "mobile":
      width = 480; // Mobile specific width (480p)
      break;
    case "tablet":
      width = 720; // Tablet specific width (720p)
      break;
    default: // desktop or other
      width = 1080; // Desktop specific width (1080p)
  }

  return {
    width,
    source: `cf-device-type-${cfDeviceType}`,
  };
}

/**
 * Get responsive width based on User-Agent string
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width settings based on User-Agent detection
 */
export function getWidthFromUserAgent(request, responsiveWidths) {
  const userAgent = request.headers.get("User-Agent") || "";
  const deviceType = getDeviceTypeFromUserAgent(userAgent);

  // Fallback: use specific width based on user agent detection
  return getWidthForDeviceType(deviceType, responsiveWidths);
}
