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
  // Make the request with our configured options
  const newResponse = await fetchWithImageOptions(
    request,
    options,
    cache,
    debugInfo,
  );

  // Pass the request to buildResponse for debugging
  const response = buildResponse(
    request,
    newResponse,
    options,
    cache,
    debugInfo,
  );

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
  // Create a copy of options for the cf.image object to avoid modifying the original
  const imageOptions = { ...options };

  // Remove non-Cloudflare options that shouldn't be passed to the API
  delete imageOptions.source;
  delete imageOptions.derivative;

  // Log options for debugging
  console.log("Final image options:", JSON.stringify(imageOptions));

  return fetch(request, {
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
function buildResponse(request, response, options, cache, debugInfo) {
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

  // Add debug info for user agent
  const userAgent = request.headers.get("User-Agent") || "";
  newResponse.headers.set("debug-ua", userAgent);

  return newResponse;
}
