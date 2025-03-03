import { debug } from "./loggerUtils.js";
import { hasClientHints } from "./clientHints.js";

// Default config for debug headers
const defaultConfig = {
  enabled: false, // Default to false so it must be explicitly enabled
  prefix: "debug-",
  includeHeaders: [
    "ir", // Image resizing options
    "cache", // Cache configuration
    "mode", // Processing mode
    "client-hints", // Client hints information
    "ua", // User agent
  ],
  // Special non-prefixed headers
  specialHeaders: {
    "x-processing-mode": true,
    "x-size-source": true,
    "x-actual-width": true,
    "x-responsive-sizing": true,
  },
};

let headerConfig = { ...defaultConfig };

/**
 * Configure debug headers
 * @param {Object} config - Configuration object
 */
export function configureDebugHeaders(config = {}) {
  // IMPORTANT: Don't overwrite the enabled property here
  // Store the current enabled state
  const currentEnabled = headerConfig.enabled;
  
  // Properly merge nested objects to avoid losing default specialHeaders
  headerConfig = {
    ...defaultConfig,
    ...config,
    // Ensure specialHeaders is properly merged - not overwritten
    specialHeaders: {
      ...defaultConfig.specialHeaders,
      ...(config.specialHeaders || {}),
    },
    // Maintain the current enabled state - this is critical!
    enabled: config.enabled !== undefined ? config.enabled : currentEnabled,
  };

  debug("DebugHeaders", "Configured debug headers", { config: headerConfig });
}

/**
 * Enable or disable debug headers
 * @param {boolean} enabled - Whether headers are enabled
 */
export function setDebugHeadersEnabled(enabled) {
  headerConfig.enabled = !!enabled;
  debug("DebugHeaders", `Debug headers ${enabled ? "enabled" : "disabled"}`);
}

/**
 * Get current debug headers configuration
 * @returns {Object} - Current configuration
 */
export function getDebugHeadersConfig() {
  return { ...headerConfig };
}

/**
 * Check if debug headers are enabled
 * @returns {boolean} - Whether debug headers are enabled
 */
export function isDebugHeadersEnabled() {
  return headerConfig.enabled;
}

/**
 * Extract client hints debug info from request
 * @param {Request} request - The request
 * @returns {Object} - Client hints debug info
 */
function getClientHintsDebug(request) {
  // Define client hint headers to collect
  const clientHintHeaders = [
    "Sec-CH-Viewport-Width",
    "Sec-CH-DPR",
    "Width",
    "Viewport-Width",
    "CF-Device-Type",
  ];

  // Extract headers into debug object
  return clientHintHeaders.reduce((debug, header) => {
    debug[header.toLowerCase()] = request.headers.get(header);
    return debug;
  }, {});
}

/**
 * Add standard client hints headers to responses
 * These headers are essential for responsive image sizing functionality
 *
 * @param {Response} response - The response to add headers to
 */
function addClientHintsResponseHeaders(response) {
  const clientHintsHeaders = {
    "Accept-CH": "Sec-CH-DPR, Sec-CH-Viewport-Width, Width, Viewport-Width",
    "Permissions-Policy": "ch-dpr=(self), ch-viewport-width=(self)",
    "Critical-CH": "Sec-CH-DPR, Sec-CH-Viewport-Width",
  };

  Object.entries(clientHintsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

/**
 * Apply debug headers to a response
 * @param {Request} request - Original request
 * @param {Response} response - Response to add headers to
 * @param {Object} debugData - Object containing debug data
 * @param {Object} debugData.options - Image options used
 * @param {Object} debugData.cache - Cache configuration used
 * @param {Object} debugData.debugInfo - Additional debug information
 * @returns {Response} - Response with debug headers
 */
export function applyDebugHeaders(
  request,
  response,
  { options, cache, debugInfo = {} },
) {
  const newResponse = new Response(response.body, response);

  // Always add client hints headers regardless of debug header settings
  // These are needed for responsive image functionality
  addClientHintsResponseHeaders(newResponse);

  // If debug headers are disabled, return the response with only client hints headers
  // This check wasn't actually preventing debug headers from being added - fixed now
  if (!headerConfig.enabled) {
    debug("DebugHeaders", "Debug headers are disabled, skipping", { enabled: headerConfig.enabled });
    return newResponse;
  }

  // Extract device information for debugging
  const deviceInfo = {
    "cf-device-type": request.headers.get("CF-Device-Type") || "not-available",
    "client-hints-available": hasClientHints(request),
    "device-detection-method": options?.source || "unknown",
  };

  // Define all debug data objects
  const debugData = {
    "ir": options,
    "cache": cache,
    "mode": debugInfo,
    "client-hints": getClientHintsDebug(request),
    "ua": request.headers.get("User-Agent") || "",
    "device": deviceInfo,
  };

  // Set prefixed debug headers that are enabled
  headerConfig.includeHeaders.forEach((headerKey) => {
    if (debugData[headerKey]) {
      const headerName = `${headerConfig.prefix}${headerKey}`;
      const headerValue = typeof debugData[headerKey] === "string"
        ? debugData[headerKey]
        : JSON.stringify(debugData[headerKey]);

      newResponse.headers.set(headerName, headerValue);
    }
  });

  // Set special headers - with safety check for specialHeaders
  if (options && headerConfig.specialHeaders) {
    const specialHeaders = headerConfig.specialHeaders;

    if (specialHeaders["x-processing-mode"]) {
      const processingMode = options.derivative
        ? `template:${options.derivative}`
        : (options.source === "explicit-params" ? "explicit" : "responsive");
      newResponse.headers.set("x-processing-mode", processingMode);
    }

    if (specialHeaders["x-size-source"] && options.source) {
      newResponse.headers.set("x-size-source", options.source);
    }

    if (specialHeaders["x-actual-width"]) {
      newResponse.headers.set("x-actual-width", options.width || "unknown");
    }

    if (specialHeaders["x-responsive-sizing"]) {
      newResponse.headers.set(
        "x-responsive-sizing",
        options.source?.includes("client-hints") ||
          options.source?.includes("cf-device-type") ||
          options.source?.includes("ua-")
          ? "true"
          : "false",
      );
    }
  }

  return newResponse;
}
