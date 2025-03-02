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

  // Define width determination strategies in order of priority
  const strategies = [
    // Case 1: Explicitly set width=auto - calculate width instead of using "auto"
    {
      condition: () => requestedWidth === "auto",
      action: () => {
        console.log("Explicit auto width requested");
        // Try client hints first, then CF device type, then user agent
        if (hasClientHints(request)) {
          return getWidthFromClientHints(request);
        }
        if (hasCfDeviceType(request)) {
          return getWidthFromCfDeviceType(request);
        }
        return getWidthFromUserAgent(request, responsiveWidths);
      },
    },

    // Case 2: Explicit width parameter
    {
      condition: () => {
        const parsedWidth = parseInt(requestedWidth);
        return !isNaN(parsedWidth);
      },
      action: () => {
        const parsedWidth = parseInt(requestedWidth);
        console.log("Explicit width requested:", parsedWidth);
        return {
          width: findClosestWidth(parsedWidth, availableWidths),
          source: "explicit-width",
        };
      },
    },

    // Case 3: No width specified - use responsive detection
    {
      condition: () => true, // default case
      action: () => {
        console.log("No width specified, using responsive detection");
        return getResponsiveWidth(request, responsiveWidths);
      },
    },
  ];

  // Find and execute the first matching strategy
  for (const strategy of strategies) {
    if (strategy.condition()) {
      return strategy.action();
    }
  }
}

/**
 * Determine responsive width using all available detection methods in priority order
 * @param {Request} request - The incoming request
 * @param {number[]} responsiveWidths - Available responsive widths
 * @returns {Object} - Width settings based on best available detection method
 */
export function getResponsiveWidth(request, responsiveWidths) {
  console.log("Responsive width detection flow:");

  // Define detection methods in priority order
  const detectionMethods = [
    {
      name: "Client Hints",
      check: () => hasClientHints(request),
      getWidth: () => getWidthFromClientHints(request),
    },
    {
      name: "Cloudflare Device Type",
      check: () => hasCfDeviceType(request),
      getWidth: () => getWidthFromCfDeviceType(request),
    },
    {
      name: "User Agent",
      check: () => true, // Always available as fallback
      getWidth: () => getWidthFromUserAgent(request, responsiveWidths),
    },
  ];

  // Try each method in order
  for (const method of detectionMethods) {
    console.log(`Checking ${method.name}...`);

    if (method.name === "Cloudflare Device Type") {
      console.log("CF-Device-Type:", request.headers.get("CF-Device-Type"));
    } else if (method.name === "User Agent") {
      console.log("User-Agent:", request.headers.get("User-Agent"));
    }

    if (method.check()) {
      console.log(`Using ${method.name} for width`);
      return method.getWidth();
    }
  }

  // Fallback (should never reach here due to User Agent always returning true)
  return { width: 1200, source: "default-fallback" };
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
