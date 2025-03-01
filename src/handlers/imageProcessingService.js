import {
  determineCacheControl,
  generateCacheTags,
} from "../utils/cacheControlUtils.js";

/**
 * Process the image using Cloudflare's Image Resizing
 * @param {Request} request - The incoming request
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @param {Object} debugInfo - Debug information
 * @returns {Promise<Response>} - The processed image response
 */
export async function processImage(request, options, cache, debugInfo = {}) {
  // First check if this is a request from image resizing to avoid loops
  if (isImageResizingLoop(request)) {
    return fetch(request);
  }

  // Make the request with our configured options
  const newResponse = await fetchWithImageOptions(
    request,
    options,
    cache,
    debugInfo,
  );
  const response = buildResponse(newResponse, options, cache, debugInfo);

  // Return the response or fallback to original request if error
  return response.ok || response.redirected ? response : fetch(request);
}

/**
 * Check if this is a request that would cause an image resizing loop
 * @param {Request} request - The incoming request
 * @returns {boolean} - True if this would cause a loop
 */
function isImageResizingLoop(request) {
  return /image-resizing/.test(request.headers.get("via"));
}

/**
 * Fetch image with Cloudflare image resizing options
 * @param {Request} request - The incoming request
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @returns {Promise<Response>} - Cloudflare response
 */
async function fetchWithImageOptions(request, options, cache, debugInfo) {
  // Create a copy of options for the cf.image object to avoid modifying the original
  const imageOptions = { ...options };

  // Remove non-Cloudflare options that shouldn't be passed to the API
  delete imageOptions.source;
  delete imageOptions.derivative;

  return fetch(request, {
    headers: {
      "cf-feat-tiered-cache": "image",
    },
    cf: {
      polish: cache.imageCompression || "off",
      mirage: cache.mirage || false,
      cacheEverything: cache.cacheability || false,
      cacheTtl: cache.ttl?.ok,
      image: imageOptions,
      cacheTags: generateCacheTags(debugInfo.bucketName, options.derivative),
    },
  });
}

/**
 * Build the final response with appropriate headers
 * @param {Response} response - Original Cloudflare response
 * @param {Object} options - Image processing options
 * @param {Object} cache - Cache configuration
 * @param {Object} debugInfo - Debug information
 * @returns {Response} - Final response with proper headers
 */
function buildResponse(response, options, cache, debugInfo) {
  const newResponse = new Response(response.body, response);

  // Set cache control headers
  const cacheControl = determineCacheControl(response.status, cache);

  // Set response headers
  newResponse.headers.set("Cache-Control", cacheControl);
  newResponse.headers.set("debug-ir", JSON.stringify(options));
  newResponse.headers.set("debug-cache", JSON.stringify(cache));
  newResponse.headers.set("debug-mode", JSON.stringify(debugInfo));
  newResponse.headers.set("x-derivative", options.derivative || "default");
  newResponse.headers.set("x-size-source", options.source || "default");

  // Enable client hints for future requests
  newResponse.headers.set("Accept-CH", "Sec-CH-DPR, Sec-CH-Viewport-Width");
  newResponse.headers.set("Critical-CH", "Sec-CH-DPR, Sec-CH-Viewport-Width");

  return newResponse;
}
