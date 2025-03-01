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

  // Check for path-based derivative
  const pathDerivative = getDerivativeFromPath(path);
  const requestedDerivative = params.derivative || pathDerivative;

  // First determine the derivative to use
  let options;
  if (requestedDerivative === "header") {
    options = applyHeaderDerivative(params);
  } else if (requestedDerivative === "thumbnail") {
    options = applyThumbnailDerivative(params);
  } else {
    // Using default derivative configuration
    options = applyDefaultDerivative(request, params);
  }

  // Store the derivative name for debugging
  options.derivative = requestedDerivative || "default";

  // Determine image format
  options.format = determineFormat(request, params.format);

  return options;
}

/**
 * Apply header derivative settings
 * @param {Object} params - Request parameters
 * @returns {Object} - Image options with header derivative settings
 */
function applyHeaderDerivative(params) {
  const options = {
    ...imageConfig.derivatives.header,
    source: "derivative-header",
  };

  // Override with explicitly provided URL parameters
  applyParameterOverrides(options, params);

  return options;
}

/**
 * Apply thumbnail derivative settings
 * @param {Object} params - Request parameters
 * @returns {Object} - Image options with thumbnail derivative settings
 */
function applyThumbnailDerivative(params) {
  const options = {
    ...imageConfig.derivatives.thumbnail,
    source: "derivative-thumbnail",
  };

  // Override with explicitly provided URL parameters
  applyParameterOverrides(options, params);

  return options;
}

/**
 * Apply default derivative settings
 * @param {Request} request - The incoming request
 * @param {Object} params - Request parameters
 * @returns {Object} - Image options with default derivative settings
 */
function applyDefaultDerivative(request, params) {
  const options = {
    quality: imageConfig.derivatives.default.quality,
    fit: imageConfig.derivatives.default.fit,
  };

  // Get dimensions based on width parameter or device detection
  const dimensionOptions = getImageDimensions(
    request,
    params.width,
    imageConfig.derivatives.default.widths,
    imageConfig.derivatives.default.responsiveWidths,
  );

  options.width = dimensionOptions.width;
  options.source = dimensionOptions.source;

  // Calculate height based on aspect ratio if not provided but width is available
  // (and it's not "auto")
  if (!params.height && options.width && options.width !== "auto") {
    options.height = Math.floor(options.width * (9 / 16)); // 16:9 aspect ratio
  }

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
  if (params.height) options.height = parseInt(params.height);
  if (params.quality) options.quality = parseInt(params.quality);
  if (params.fit) options.fit = params.fit;
  if (params.metadata) options.metadata = params.metadata;
  if (params.upscale !== undefined) options.upscale = params.upscale === "true";
}
