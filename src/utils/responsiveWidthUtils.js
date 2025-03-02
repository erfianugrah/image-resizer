import { debug, warn } from "./loggerUtils.js";
import { getWidthFromClientHints, hasClientHints } from "./clientHints.js";
import {
  getWidthFromCfDeviceType,
  getWidthFromUserAgent,
  hasCfDeviceType,
} from "./deviceUtils.js";
import { getDeviceTypeFromUserAgent } from "./userAgentUtils.js";

/**
 * Get image dimensions based on requested width or responsive detection
 * @param {Request} request - The incoming request
 * @param {string} requestedWidth - Width parameter from URL
 * @param {number[]} responsiveWidths - Available responsive widths for auto sizing
 * @returns {Object} - Width and source information
 */
export function getImageDimensions(
  request,
  requestedWidth,
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

    // Case 2: Explicit width parameter - use exact value as specified by user
    {
      condition: () => {
        const parsedWidth = parseInt(requestedWidth);
        return !isNaN(parsedWidth);
      },
      action: () => {
        const parsedWidth = parseInt(requestedWidth);
        console.log("Explicit width requested:", parsedWidth);
        return {
          width: parsedWidth, // Use exact requested width
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
  debug("ResponsiveWidth", "Starting responsive width detection", {
    responsiveWidths,
    url: request.url,
    hasClientHints: request.headers.has("Sec-CH-Viewport-Width") ||
      request.headers.has("Viewport-Width"),
    hasCfDeviceType: request.headers.has("CF-Device-Type"),
    userAgent: request.headers.get("User-Agent")?.substring(0, 50), // Truncate for log readability
  });

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
    debug("ResponsiveWidth", `Checking ${method.name} detection method`);

    if (method.name === "Client Hints") {
      // Log all relevant client hints headers
      const clientHintHeaders = {
        "Sec-CH-Viewport-Width": request.headers.get("Sec-CH-Viewport-Width"),
        "Sec-CH-DPR": request.headers.get("Sec-CH-DPR"),
        "Width": request.headers.get("Width"),
        "Viewport-Width": request.headers.get("Viewport-Width"),
      };
      debug("ResponsiveWidth", "Client Hints headers", clientHintHeaders);
    } else if (method.name === "Cloudflare Device Type") {
      debug("ResponsiveWidth", "CF-Device-Type", {
        value: request.headers.get("CF-Device-Type"),
      });
    } else if (method.name === "User Agent") {
      const userAgent = request.headers.get("User-Agent") || "";
      debug("ResponsiveWidth", "User-Agent detection", {
        userAgent: userAgent.substring(0, 100), // Truncate for log
        detectedDevice: getDeviceTypeFromUserAgent(userAgent),
      });
    }

    if (method.check()) {
      const widthSettings = method.getWidth();
      debug(
        "ResponsiveWidth",
        `Selected ${method.name} for width determination`,
        widthSettings,
      );
      return widthSettings;
    }
  }

  // Fallback (should never reach here due to User Agent always returning true)
  warn(
    "ResponsiveWidth",
    "All detection methods failed, using default fallback",
  );
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
