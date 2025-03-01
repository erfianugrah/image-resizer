// Main image handling functions
import { imageConfig } from "../config/imageConfig";
import { getDerivativeFromPath } from "../utils/pathUtils";
import { getResponsiveWidth } from "../utils/clientHints";
import { determineCacheConfig } from "../utils/cacheUtils";
import { transformRequestUrl } from "../utils/urlTransformUtils";

/**
 * Main handler for image requests
 * @param {Request} request - The incoming request
 * @param {Object} config - Environment configuration
 * @returns {Promise<Response>} - The processed image response
 */
export async function handleImageRequest(request, config) {
  // Transform the request URL based on deployment mode
  const {
    originRequest,
    bucketName,
    originUrl,
    derivative: routeDerivative,
    isRemoteFetch,
  } = transformRequestUrl(request, config);

  const url = new URL(request.url);
  const urlParams = url.searchParams;

  // Add the route-derived derivative as a parameter if it exists
  if (routeDerivative && !urlParams.has("derivative")) {
    urlParams.set("derivative", routeDerivative);
  }

  // Determine image options based on the original request (for parameters)
  // but using the path from the transformed URL
  const imageOptions = determineImageOptions(request, urlParams, url.pathname);

  // Get cache configuration for the target URL
  const cache = determineCacheConfig(originUrl);

  // For debugging
  const debugInfo = {
    deploymentMode: config.deploymentMode,
    isRemoteFetch,
    originalUrl: request.url,
    transformedUrl: originUrl,
    bucketName,
    routeDerivative,
  };

  // Process the image - use the origin request for remote fetches
  const response = await processImage(
    isRemoteFetch ? originRequest : request,
    imageOptions,
    cache,
    debugInfo,
  );

  return response;
}

/**
 * Determine which image options to use based on request parameters
 * @param {Request} request - The incoming request
 * @param {URLSearchParams} urlParams - URL parameters
 * @param {string} path - Request path
 * @returns {Object} - Image processing options
 */
function determineImageOptions(request, urlParams, path) {
  // Extract parameters
  const requestedDerivative = urlParams.get("derivative") ||
    getDerivativeFromPath(path);
  const requestedWidth = urlParams.get("width");
  const requestedHeight = urlParams.get("height");
  const quality = urlParams.get("quality");
  const fit = urlParams.get("fit");
  const format = urlParams.get("format");
  const metadata = urlParams.get("metadata") || "copyright";
  const upscale = urlParams.get("upscale") !== "false"; // Default to true unless explicitly set to false

  // Base options
  let options = {
    source: "default",
  };

  // First determine the derivative to use
  if (requestedDerivative === "header") {
    options = {
      ...imageConfig.derivatives.header,
      source: "derivative-header",
    };
  } else if (requestedDerivative === "thumbnail") {
    options = {
      ...imageConfig.derivatives.thumbnail,
      source: "derivative-thumbnail",
    };
  } else {
    // Using default derivative configuration
    options.quality = imageConfig.derivatives.default.quality;
    options.fit = imageConfig.derivatives.default.fit;

    // Handle width selection with proper priority
    if (requestedWidth === "auto") {
      // PRIORITY 1: Explicit "auto" - Use client hints/UA detection
      const clientHintOptions = getResponsiveWidth(
        request,
        imageConfig.derivatives.default.responsiveWidths,
      );
      options.width = clientHintOptions.width;
      options.source = "auto-" + clientHintOptions.source;
    } else if (requestedWidth) {
      // PRIORITY 2: Explicit width parameter
      const parsedWidth = parseInt(requestedWidth);
      if (!isNaN(parsedWidth)) {
        // Find closest predefined width
        const availableWidths = imageConfig.derivatives.default.widths;
        const closestWidth = availableWidths.reduce((prev, curr) => {
          return (Math.abs(curr - parsedWidth) < Math.abs(prev - parsedWidth))
            ? curr
            : prev;
        });
        options.width = closestWidth;
        options.source = "explicit-width";
      } else {
        // Invalid width parameter - use default width
        options.width = imageConfig.derivatives.default.widths[2]; // Use the middle option (1024px)
        options.source = "default-invalid-width";
      }
    } else {
      // PRIORITY 3: No width specified - use default width
      options.width = imageConfig.derivatives.default.widths[2]; // Use the middle option (1024px)
      options.source = "default-no-width";
    }

    // Calculate height based on aspect ratio if not provided
    if (!requestedHeight) {
      options.height = Math.floor(
        options.width * imageConfig.derivatives.default.aspectRatio,
      );
    }
  }

  // Override with explicitly provided URL parameters
  if (requestedHeight) options.height = parseInt(requestedHeight);
  if (quality) options.quality = parseInt(quality);
  if (fit) options.fit = fit;
  if (metadata) options.metadata = metadata;
  if (upscale !== undefined) options.upscale = upscale;

  // Store the derivative name for debugging
  options.derivative = requestedDerivative || "default";

  // Determine image format
  options.format = determineFormat(request, format);

  return options;
}

/**
 * Determine optimal image format based on Accept header and parameters
 * @param {Request} request - The incoming request
 * @param {string|null} formatParam - Format parameter from URL
 * @returns {string} - Optimal image format
 */
function determineFormat(request, formatParam) {
  // If format is explicitly specified, use that
  if (formatParam) return formatParam;

  // Otherwise determine from Accept header
  const accept = request.headers.get("Accept");

  if (/image\/avif/.test(accept)) {
    return "avif"; // Use AVIF if supported
  } else if (/image\/webp/.test(accept)) {
    return "webp"; // Use WebP as fallback
  }

  // Default to AVIF (Cloudflare will handle fallback if needed)
  return "avif";
}

/**
 * Process the image using Cloudflare's Image Resizing
 * @param {Request} request - The incoming request
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @param {Object} debugInfo - Debug information
 * @returns {Promise<Response>} - The processed image response
 */
async function processImage(request, options, cache, debugInfo = {}) {
  // Make the request with our configured options
  const newResponse = await fetch(request, {
    headers: {
      "cf-feat-tiered-cache": "image",
    },
    cf: {
      polish: cache.imageCompression || "off",
      mirage: cache.mirage || false,
      cacheEverything: cache.cacheability || false,
      cacheTtl: cache.ok,
      image: {
        width: options.width,
        height: options.height,
        fit: options.fit,
        metadata: options.metadata,
        quality: options.quality,
        format: options.format,
        // Don't upscale if specified in options
        upscale: options.upscale !== undefined ? options.upscale : true,
      },
      cacheTags: [
        "image",
      ],
    },
  });

  const response = new Response(newResponse.body, newResponse);

  // Set cache control headers
  const cacheControl = determineCacheControl(newResponse.status, cache);

  // Set response headers
  response.headers.set("Cache-Control", cacheControl);
  response.headers.set("debug-ir", JSON.stringify(options));
  response.headers.set("debug-cache", JSON.stringify(cache));
  response.headers.set("debug-mode", JSON.stringify(debugInfo));
  response.headers.set("x-derivative", options.derivative || "default");
  response.headers.set("x-size-source", options.source || "default");

  // Enable client hints for future requests
  response.headers.set("Accept-CH", "Sec-CH-DPR, Sec-CH-Viewport-Width");
  response.headers.set("Critical-CH", "Sec-CH-DPR, Sec-CH-Viewport-Width");

  // Return the response or fallback to original request if error
  return response.ok || response.redirected ? response : fetch(request);
}

/**
 * Determine cache control header based on response status
 * @param {number} status - HTTP status code
 * @param {Object} cache - Cache configuration
 * @returns {string} - Cache-Control header value
 */
function determineCacheControl(status, cache) {
  if (!cache || !cache.ttl) return "";

  const statusGroup = Math.floor(status / 100);
  let ttl = 0;

  switch (statusGroup) {
    case 2: // 200-299 status codes
      ttl = cache.ttl.ok;
      break;
    case 3: // 300-399 status codes
      ttl = cache.ttl.redirects;
      break;
    case 4: // 400-499 status codes
      ttl = cache.ttl.clientError;
      break;
    case 5: // 500-599 status codes
      ttl = cache.ttl.serverError;
      break;
  }

  return ttl ? `public, max-age=${ttl}` : "";
}
