// Main image handling functions
import { imageConfig } from "../config/imageConfig";
import { getDerivativeFromPath } from "../utils/pathUtils";
import { getResponsiveWidth } from "../utils/clientHints";
import { determineCacheConfig } from "../utils/cacheUtils";

/**
 * Main handler for image requests
 * @param {Request} request - The incoming request
 * @returns {Promise<Response>} - The processed image response
 */
export async function handleImageRequest(request) {
  const url = new URL(request.url);
  const urlParams = url.searchParams;
  const path = url.pathname;

  // Determine image options
  const imageOptions = determineImageOptions(request, urlParams, path);

  // Get cache configuration
  const cache = determineCacheConfig(url.hostname + path);

  // Process the image
  const response = await processImage(request, imageOptions, cache);

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
  const height = urlParams.get("height");
  const quality = urlParams.get("quality");
  const fit = urlParams.get("fit");
  const format = urlParams.get("format");
  const metadata = urlParams.get("metadata") || "copyright";

  // Base options
  let options = {};

  // Select derivative configuration
  if (requestedDerivative === "header") {
    options = { ...imageConfig.derivatives.header };
    options.source = "derivative-header";
  } else if (requestedDerivative === "thumbnail") {
    options = { ...imageConfig.derivatives.thumbnail };
    options.source = "derivative-thumbnail";
  } else {
    // PRIORITY 1: Try client hints first (highest priority)
    const clientHintOptions = getResponsiveWidth(
      request,
      imageConfig.derivatives.default.responsiveWidths,
    );

    // PRIORITY 2: Check for explicit width parameter (second priority)
    if (requestedWidth && requestedWidth !== "auto") {
      // Override client hint width with explicitly requested width
      const parsedWidth = parseInt(requestedWidth);
      if (!isNaN(parsedWidth)) {
        // Find closest width from default widths
        const closestWidth = imageConfig.derivatives.default.widths.reduce(
          (prev, curr) => {
            return (Math.abs(curr - parsedWidth) < Math.abs(prev - parsedWidth)
              ? curr
              : prev);
          },
        );
        clientHintOptions.width = closestWidth;
        clientHintOptions.source = "url-param";
      }
    }

    // Use the client hint options (either pure or modified by explicit width)
    options = {
      width: clientHintOptions.width,
      quality: imageConfig.derivatives.default.quality,
      fit: imageConfig.derivatives.default.fit,
      source: clientHintOptions.source,
    };

    // Set height based on aspect ratio if not explicitly specified
    if (!height) {
      options.height = Math.floor(
        options.width * imageConfig.derivatives.default.aspectRatio,
      );
    }
  }

  // Override with any explicitly provided URL parameters (except width which was already handled)
  if (height) options.height = parseInt(height);
  if (quality) options.quality = parseInt(quality);
  if (fit) options.fit = fit;
  if (metadata) options.metadata = metadata;

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
 * @returns {Promise<Response>} - The processed image response
 */
async function processImage(request, options, cache) {
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
