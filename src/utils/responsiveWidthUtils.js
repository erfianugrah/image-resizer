import { getWidthFromClientHints, hasClientHints } from "./clientHints.js";
import {
  getWidthFromCfDeviceType,
  getWidthFromUserAgent,
  hasCfDeviceType,
} from "./deviceUtils.js";
import { findClosestWidth } from "./urlParamUtils.js";

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
  // Case 1: Explicitly set width=auto - use Cloudflare's native auto sizing
  if (requestedWidth === "auto") {
    return {
      width: "auto",
      source: "explicit-auto",
    };
  }

  // Case 2: Explicit width parameter
  const parsedWidth = parseInt(requestedWidth);
  if (!isNaN(parsedWidth)) {
    return {
      width: findClosestWidth(parsedWidth, availableWidths),
      source: "explicit-width",
    };
  }

  // Case 3: No width specified - use responsive detection with priority order
  return getResponsiveWidth(request, responsiveWidths);
}

/**
 * Determine responsive width using all available detection methods in priority order
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width settings based on best available detection method
 */
export function getResponsiveWidth(request, responsiveWidths) {
  // PRIORITY 1: Client hints (Chrome, Edge, Opera, etc.) - use 'auto'
  if (hasClientHints(request)) {
    // Use the result from client hints
    return getWidthFromClientHints(request);
  }

  // PRIORITY 2: Cloudflare's device detection - use specific widths (480p/720p/1080p)
  if (hasCfDeviceType(request)) {
    return getWidthFromCfDeviceType(request);
  }

  // PRIORITY 3: User agent detection as fallback - use specific widths
  return getWidthFromUserAgent(request, responsiveWidths);
}

/**
 * Calculate responsive height based on width and aspect ratio
 * @param {number|string} width - The width value
 * @param {number} aspectRatio - The aspect ratio (height/width)
 * @returns {number|undefined} - Calculated height or undefined if width is "auto"
 */
export function calculateResponsiveHeight(width, aspectRatio = 9 / 16) {
  // Don't calculate height for "auto" width
  if (width === "auto") {
    return undefined;
  }

  // Calculate height based on aspect ratio for numeric widths
  if (!isNaN(parseInt(width))) {
    return Math.floor(parseInt(width) * aspectRatio);
  }

  return undefined;
}
