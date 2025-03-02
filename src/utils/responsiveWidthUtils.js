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
  console.log("getImageDimensions - requestedWidth:", requestedWidth);

  // Case 1: Explicitly set width=auto - calculate width instead of using "auto"
  if (requestedWidth === "auto") {
    console.log("Explicit auto width requested");
    // Don't use "auto" directly as it causes 400 errors
    // Instead, use client hints if available, otherwise fall back to UA detection
    if (hasClientHints(request)) {
      return getWidthFromClientHints(request);
    } else if (hasCfDeviceType(request)) {
      return getWidthFromCfDeviceType(request);
    } else {
      return getWidthFromUserAgent(request, responsiveWidths);
    }
  }

  // Case 2: Explicit width parameter
  const parsedWidth = parseInt(requestedWidth);
  if (!isNaN(parsedWidth)) {
    console.log("Explicit width requested:", parsedWidth);
    return {
      width: findClosestWidth(parsedWidth, availableWidths),
      source: "explicit-width",
    };
  }

  // Case 3: No width specified - use responsive detection with priority order
  console.log("No width specified, using responsive detection");
  return getResponsiveWidth(request, responsiveWidths);
}

/**
 * Determine responsive width using all available detection methods in priority order
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width settings based on best available detection method
 */
export function getResponsiveWidth(request, responsiveWidths) {
  console.log("Responsive width detection flow:");

  // PRIORITY 1: Client hints (Chrome, Edge, Opera, etc.)
  const hasClientHintsResult = hasClientHints(request);
  console.log("hasClientHints:", hasClientHintsResult);

  if (hasClientHintsResult) {
    console.log("Using client hints for width");
    return getWidthFromClientHints(request);
  }

  // PRIORITY 2: Cloudflare's device detection
  const hasCfDeviceTypeResult = hasCfDeviceType(request);
  console.log("hasCfDeviceType:", hasCfDeviceTypeResult);
  console.log("CF-Device-Type:", request.headers.get("CF-Device-Type"));

  if (hasCfDeviceTypeResult) {
    console.log("Using CF-Device-Type for width");
    return getWidthFromCfDeviceType(request);
  }

  // PRIORITY 3: User agent detection as fallback
  console.log("Using User-Agent for width");
  console.log("User-Agent:", request.headers.get("User-Agent"));
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
