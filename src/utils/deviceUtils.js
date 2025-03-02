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

  // Define device type to width mapping
  const deviceWidthMap = {
    "mobile": 480, // Mobile specific width (480p)
    "tablet": 768, // Tablet specific width (768p)
    "desktop": 1440, // Desktop specific width (1440p)
  };

  // Get width for the device type or use desktop default
  const width = deviceWidthMap[cfDeviceType] || deviceWidthMap.desktop;

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
  return getWidthForDeviceType(deviceType, false, responsiveWidths);
}
