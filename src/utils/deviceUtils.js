import {
  getDeviceTypeFromUserAgent,
  getWidthForDeviceType,
} from "./userAgentUtils.js";

/**
 * Get responsive width based on CF-Device-Type header
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @param {string} requestedWidth - Width parameter from URL, can be "auto" or null
 * @returns {Object|null} - Width settings based on CF-Device-Type or null if not available
 */
export function getWidthFromCfDeviceType(
  request,
  responsiveWidths,
  requestedWidth,
) {
  // We'll use the standard responsive widths from Cloudflare documentation if none provided
  const standardWidths = [320, 768, 960, 1200];
  const widthsToUse = responsiveWidths && responsiveWidths.length > 0
    ? responsiveWidths
    : standardWidths;

  // Check for CF-Device-Type header
  const cfDeviceType = request.headers.get("CF-Device-Type");

  // Return null if CF-Device-Type is not available
  if (!cfDeviceType) {
    return null;
  }

  let width;

  switch (cfDeviceType) {
    case "mobile":
      width = standardWidths[0]; // 320
      break;
    case "tablet":
      width = standardWidths[1]; // 768
      break;
    default: // desktop or other
      width = requestedWidth === "auto" ? standardWidths[3] : standardWidths[2]; // 1200 or 960
  }

  return {
    width,
    source: "cf-device-type",
  };
}

/**
 * Get responsive width based on User-Agent string
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @param {string} requestedWidth - Width parameter from URL, can be "auto" or null
 * @returns {Object} - Width settings based on User-Agent detection
 */
export function getWidthFromUserAgent(
  request,
  responsiveWidths,
  requestedWidth,
) {
  const userAgent = request.headers.get("User-Agent") || "";
  const deviceType = getDeviceTypeFromUserAgent(userAgent);
  const isAutoRequested = requestedWidth === "auto";

  return getWidthForDeviceType(deviceType, isAutoRequested, responsiveWidths);
}
