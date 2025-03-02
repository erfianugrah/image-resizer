import { imageConfig } from "../config/imageConfig.js";
import { getDerivativeFromPath } from "../utils/pathUtils.js";
import { getImageDimensions } from "../utils/responsiveWidthUtils.js";
import { extractImageParams } from "../utils/urlParamUtils.js";
import { determineFormat } from "../utils/formatUtils.js";

/**
 * Determine which image options to use based on request parameters
 * @param {Request} request - The incoming request
 * @param {URLSearchParams} urlParams - URL parameters
 * @param {string} path - Request path
 * @returns {Object} - Image processing options
 */
export function determineImageOptions(request, urlParams, path) {
  // Extract all image parameters from URL
  const params = extractImageParams(urlParams, path);

  // Check if this is a direct request with explicit parameters
  const hasExplicitParams = Object.entries(params).some(([key, value]) =>
    value !== null &&
    key !== "derivative" &&
    key !== "metadata" // metadata has a default but shouldn't trigger derivative logic
  );

  // If user specified explicit parameters, use only those parameters
  if (hasExplicitParams) {
    const options = {};

    // Only add parameters that were explicitly provided
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null) {
        // Parse numeric parameters
        if (
          [
            "width",
            "height",
            "quality",
            "brightness",
            "contrast",
            "gamma",
            "sharpen",
            "saturation",
            "dpr",
            "blur",
          ].includes(key)
        ) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            options[key] = numValue;
          }
        } else {
          options[key] = value;
        }
      }
    });

    // If width specified but format not, determine format from Accept header
    if (!options.format) {
      options.format = determineFormat(request, null);
    }

    // For debugging, mark the source as "explicit-params"
    options.source = "explicit-params";

    return options;
  }

  // Check for path-based derivative or explicit derivative parameter
  const pathDerivative = getDerivativeFromPath(path);
  const requestedDerivative = params.derivative || pathDerivative;

  // If a specific derivative was requested, apply it
  if (requestedDerivative && imageConfig.derivatives[requestedDerivative]) {
    const options = {
      ...imageConfig.derivatives[requestedDerivative],
      source: `derivative-${requestedDerivative}`,
      derivative: requestedDerivative,
    };

    // Override with explicitly provided URL parameters
    applyParameterOverrides(options, params);

    // Determine image format
    options.format = determineFormat(request, params.format);

    return options;
  }

  // If no derivative was requested and no explicit params, use responsive sizing
  const options = applyResponsiveSizing(request, params);
  // Determine image format
  options.format = determineFormat(request, params.format);
  return options;
}

/**
 * Apply responsive sizing logic
 * @param {Request} request - The incoming request
 * @param {Object} params - Request parameters
 * @returns {Object} - Image options with responsive sizing
 */
function applyResponsiveSizing(request, params) {
  // Basic quality and fit settings from responsive config
  const options = {
    quality: imageConfig.responsive.quality,
    fit: imageConfig.responsive.fit,
    metadata: imageConfig.responsive.metadata,
  };

  // Get dimensions based on device detection
  const dimensionOptions = getImageDimensions(
    request,
    params.width,
    imageConfig.responsive.availableWidths,
    imageConfig.responsive.breakpoints,
  );

  options.width = dimensionOptions.width;
  options.source = dimensionOptions.source;

  // Override with explicitly provided URL parameters
  applyParameterOverrides(options, params);

  return options;
}

/**
 * Apply parameter overrides to options
 * @param {Object} options - Base options
 * @param {Object} params - URL parameters
 */
function applyParameterOverrides(options, params) {
  // Define parameters that need parsing/conversion
  const numericParams = [
    "height",
    "quality",
    "brightness",
    "contrast",
    "gamma",
    "sharpen",
    "saturation",
    "dpr",
    "blur",
  ];

  const stringParams = [
    "fit",
    "metadata",
    "gravity",
    "background",
    "border",
    "compression",
    "onerror",
    "rotate",
    "trim",
  ];

  const booleanParams = ["anim"];

  // Apply numeric parameters
  numericParams.forEach((param) => {
    if (params[param] !== null && params[param] !== undefined) {
      const value = parseFloat(params[param]);
      if (!isNaN(value)) {
        options[param] = value;
      }
    }
  });

  // Apply string parameters
  stringParams.forEach((param) => {
    if (params[param] !== null && params[param] !== undefined) {
      options[param] = params[param];
    }
  });

  // Apply boolean parameters
  booleanParams.forEach((param) => {
    if (params[param] !== null && params[param] !== undefined) {
      options[param] = params[param] === "true" || params[param] === "1";
    }
  });
}
