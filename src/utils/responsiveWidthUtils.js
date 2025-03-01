import { getWidthFromClientHints } from "./clientHints";
import { getWidthFromCfDeviceType, getWidthFromUserAgent } from "./deviceUtils";
import { findClosestWidth, parseWidthParam } from "./urlParamUtils";

/**
 * Determine responsive width using all available detection methods in priority order
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @param {string} requestedWidth - Width parameter from URL, can be "auto" or null
 * @returns {Object} - Width settings based on best available detection method
 */
export function getResponsiveWidth(request, responsiveWidths, requestedWidth) {
  // PRIORITY 1: Client hints (Chrome, Edge, Opera, etc.)
  const clientHintsResult = getWidthFromClientHints(request, responsiveWidths);
  if (clientHintsResult) {
    return clientHintsResult;
  }

  // PRIORITY 2: Cloudflare's device detection
  const cfDeviceTypeResult = getWidthFromCfDeviceType(
    request,
    responsiveWidths,
    requestedWidth,
  );
  if (cfDeviceTypeResult) {
    return cfDeviceTypeResult;
  }

  // PRIORITY 3: User agent detection as fallback
  return getWidthFromUserAgent(request, responsiveWidths, requestedWidth);
}

/**
 * Get image dimensions based on requested width or responsive detection
 * @param {Request} request - The incoming request
 * @param {string} requestedWidth - Width parameter from URL
 * @param {number[]} availableWidths - Available predefined widths
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width and source information
 */
export function getImageDimensions(
  request,
  requestedWidth,
  availableWidths,
  responsiveWidths,
) {
  // Case 1: Auto width or no width specified - use responsive detection
  if (requestedWidth === "auto" || !requestedWidth) {
    return getResponsiveWidth(request, responsiveWidths, requestedWidth);
  }

  // Case 2: Explicit width parameter
  const parsedWidth = parseWidthParam(requestedWidth);
  if (parsedWidth) {
    const closestWidth = findClosestWidth(parsedWidth, availableWidths);
    return {
      width: closestWidth,
      source: "explicit-width",
    };
  }

  // Case 3: Invalid width parameter - fallback to responsive detection
  const responsiveOptions = getResponsiveWidth(
    request,
    responsiveWidths,
    requestedWidth,
  );
  return {
    width: responsiveOptions.width,
    source: "fallback-" + responsiveOptions.source,
  };
}
