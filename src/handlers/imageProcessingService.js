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

  // Handle 'auto' width - not supported in Workers API
  if (options.width === "auto") {
    console.warn(
      "width=auto is not supported in Workers API. Using responsive sizing fallback.",
    );
    options.width = 1200; // Safe default for desktop
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
  // Create a copy of options for the cf.image object
  const imageOptions = { ...options };

  // Remove non-Cloudflare options
  const nonCloudflareOptions = ["source", "derivative"];
  nonCloudflareOptions.forEach((opt) => delete imageOptions[opt]);

  // Ensure width is numeric, never "auto"
  if (imageOptions.width === "auto") {
    imageOptions.width = 1200; // Fallback
  }

  // Only include defined parameters to avoid sending empty/null values to Cloudflare API
  const cfImageOptions = {};
  Object.entries(imageOptions).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      cfImageOptions[key] = value;
    }
  });

  // Log request headers for debugging
  const headerDebug = {};
  request.headers.forEach((value, key) => headerDebug[key] = value);
  console.log("Request headers:", JSON.stringify(headerDebug));
  console.log("Final image options:", JSON.stringify(cfImageOptions));

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

    // Log response details
    const responseDetails = {
      status: response.status,
      "content-length": response.headers.get("content-length"),
      "content-type": response.headers.get("content-type"),
    };
    console.log("Response details:", responseDetails);

    return response;
  } catch (error) {
    console.error("Error fetching image:", error);
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

  // Determine processing mode for debug headers
  const processingMode = options.derivative
    ? `template:${options.derivative}`
    : (options.source === "explicit-params" ? "explicit" : "responsive");

  // Define standard headers to set
  const standardHeaders = {
    "Cache-Control": cacheControl,
    "debug-ir": JSON.stringify(options),
    "debug-cache": JSON.stringify(cache),
    "debug-mode": JSON.stringify(debugInfo),
    "x-processing-mode": processingMode,
    "x-size-source": options.source || "unknown",
    "x-actual-width": options.width || "unknown",
  };

  // Add all client hints headers to debug output
  const clientHintHeaders = [
    "Sec-CH-Viewport-Width",
    "Sec-CH-DPR",
    "Width",
    "Viewport-Width",
    "CF-Device-Type",
  ];

  const clientHintsDebug = clientHintHeaders.reduce((debug, header) => {
    debug[header.toLowerCase()] = request.headers.get(header);
    return debug;
  }, {});

  standardHeaders["debug-client-hints"] = JSON.stringify(clientHintsDebug);
  standardHeaders["debug-ua"] = request.headers.get("User-Agent") || "";

  // Add client hints related headers
  const clientHintsResponseHeaders = {
    "Accept-CH": "Sec-CH-DPR, Sec-CH-Viewport-Width, Width, Viewport-Width",
    "Permissions-Policy": "ch-dpr=(self), ch-viewport-width=(self)",
    "Critical-CH": "Sec-CH-DPR, Sec-CH-Viewport-Width",
  };

  // Set all headers
  Object.entries({ ...standardHeaders, ...clientHintsResponseHeaders }).forEach(
    ([key, value]) => newResponse.headers.set(key, value),
  );

  return newResponse;
}
