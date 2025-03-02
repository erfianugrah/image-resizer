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
  console.log("processImage - Initial options:", JSON.stringify(options));
  console.log("processImage - Cache config:", JSON.stringify(cache));

  // Remove 'auto' width as it's not supported in Workers API
  if (options.width === "auto") {
    console.warn(
      "width=auto is not supported in Workers API. Using responsive sizing fallback.",
    );

    // This should never happen with fixed responsiveWidthUtils.js,
    // but we'll add this check as a safeguard anyway
    options.width = 1200; // Safe default for desktop
  }

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

  // Ensure width is numeric, never "auto" (which causes 400 errors)
  if (imageOptions.width === "auto") {
    imageOptions.width = 1200; // Fallback
  }

  // Log full request headers for debugging
  const headerDebug = {};
  request.headers.forEach((value, key) => {
    headerDebug[key] = value;
  });
  console.log("Request headers:", JSON.stringify(headerDebug));

  // Log options for debugging
  console.log("Final image options:", JSON.stringify(imageOptions));

  try {
    const response = await fetch(request, {
      cf: {
        polish: cache.imageCompression || "off",
        mirage: cache.mirage || false,
        cacheEverything: cache.cacheability || false,
        cacheTtl: cache.ttl?.ok,
        image: imageOptions,
        cacheTags: generateCacheTags(debugInfo.bucketName, options.derivative),
      },
    });

    // Log response details
    console.log("Response status:", response.status);
    console.log(
      "Response content-length:",
      response.headers.get("content-length"),
    );
    console.log("Response content-type:", response.headers.get("content-type"));

    return response;
  } catch (error) {
    console.error("Error fetching image:", error);
    // Return a valid response that indicates the error
    return new Response(`Error processing image: ${error.message}`, {
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
  newResponse.headers.set("x-actual-width", options.width || "unknown");

  // Add all client hints headers to debug output
  const clientHintsDebug = {
    "sec-ch-viewport-width": request.headers.get("Sec-CH-Viewport-Width"),
    "sec-ch-dpr": request.headers.get("Sec-CH-DPR"),
    "width": request.headers.get("Width"),
    "viewport-width": request.headers.get("Viewport-Width"),
    "cf-device-type": request.headers.get("CF-Device-Type"),
  };
  newResponse.headers.set(
    "debug-client-hints",
    JSON.stringify(clientHintsDebug),
  );

  // Enhanced client hints headers for future requests
  newResponse.headers.set(
    "Accept-CH",
    "Sec-CH-DPR, Sec-CH-Viewport-Width, Width, Viewport-Width",
  );
  newResponse.headers.set(
    "Permissions-Policy",
    "ch-dpr=(self), ch-viewport-width=(self)",
  );
  newResponse.headers.set("Critical-CH", "Sec-CH-DPR, Sec-CH-Viewport-Width");

  // Add debug info for user agent
  const userAgent = request.headers.get("User-Agent") || "";
  newResponse.headers.set("debug-ua", userAgent);

  return newResponse;
}
