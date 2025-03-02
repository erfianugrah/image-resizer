import {
  determineCacheControl,
  generateCacheTags,
} from "../utils/cacheControlUtils.js";
import { debug, error, info, logResponse, warn } from "../utils/loggerUtils.js";
import { applyDebugHeaders } from "../utils/debugHeadersUtils.js";
import { getResponsiveWidth } from "../utils/responsiveWidthUtils.js";
import { imageConfig } from "../config/imageConfig.js";

/**
 * Process the image using Cloudflare's Image Resizing
 * @param {Request} request - The incoming request
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @param {Object} debugInfo - Debug information
 * @returns {Promise<Response>} - The processed image response
 */
export async function processImage(request, options, cache, debugInfo = {}) {
  debug("ImageProcessor", "Processing image", { options, cache, debugInfo });

  // Handle 'auto' width - not supported in Workers API
  if (options.width === "auto") {
    warn(
      "ImageProcessor",
      "width=auto is not supported in Workers API. Using responsive sizing.",
    );

    // Instead of a fixed fallback, use the responsive width detection
    const responsiveSettings = getResponsiveWidth(
      request,
      imageConfig.responsive.breakpoints,
    );

    // Update the options with the detected width
    options.width = responsiveSettings.width;

    // Keep track of the original source and add the fallback info
    const originalSource = options.source;
    options.source = `${originalSource}-fallback`;

    debug("ImageProcessor", "Replaced auto width with responsive width", {
      originalWidth: "auto",
      newWidth: options.width,
      detectionSource: responsiveSettings.source,
    });
  }

  // Make the request with our configured options
  const newResponse = await fetchWithImageOptions(
    request,
    options,
    cache,
    debugInfo,
  );

  // Build the enhanced response with debug headers
  const response = buildResponse(
    request,
    newResponse,
    {
      options,
      cache,
      debugInfo,
    },
  );

  // Log response details
  logResponse("ImageProcessor", response);

  // Return the response or fallback to original request if error
  return response.ok || response.redirected ? response : fetch(request);
}

/**
 * Fetch image with Cloudflare image resizing options
 * @param {Request} request - The incoming request
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @returns {Promise<Response>} - Cloudflare response
 */
async function fetchWithImageOptions(request, options, cache, debugInfo) {
  // Create a copy of options for the cf.image object
  const imageOptions = { ...options };

  // Remove non-Cloudflare options
  const nonCloudflareOptions = ["source", "derivative"];
  nonCloudflareOptions.forEach((opt) => delete imageOptions[opt]);

  // Only include defined parameters to avoid sending empty/null values to Cloudflare API
  const cfImageOptions = {};
  Object.entries(imageOptions).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      cfImageOptions[key] = value;
    }
  });

  // Log request details
  debug("ImageProcessor", "Preparing Cloudflare image resize fetch", {
    imageOptions: cfImageOptions,
    url: request.url,
  });

  try {
    const cacheTags = generateCacheTags(
      debugInfo.bucketName,
      options.derivative,
    );

    const response = await fetch(request, {
      cf: {
        polish: cache.imageCompression || "off",
        mirage: cache.mirage || false,
        cacheEverything: cache.cacheability || false,
        cacheTtl: cache.ttl?.ok,
        image: cfImageOptions,
        cacheTags,
      },
    });

    info("ImageProcessor", "Image processed successfully", {
      status: response.status,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
    });

    return response;
  } catch (err) {
    error("ImageProcessor", "Error fetching image", {
      error: err.message,
      stack: err.stack,
    });

    return new Response(`Error processing image: ${err.message}`, {
      status: 500,
    });
  }
}

/**
 * Build the final response with appropriate headers
 * @param {Response} response - Original Cloudflare response
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @param {Object} debugInfo - Debug information
 * @returns {Response} - Final response with proper headers
 */
function buildResponse(request, response, { options, cache, debugInfo }) {
  const newResponse = new Response(response.body, response);

  // Set cache control headers
  const cacheControl = determineCacheControl(response.status, cache);
  newResponse.headers.set("Cache-Control", cacheControl);

  // Apply all debug headers through our utility
  return applyDebugHeaders(request, newResponse, { options, cache, debugInfo });
}
