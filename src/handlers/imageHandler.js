// Main image handling entry point
import { transformRequestUrl } from "../utils/urlTransformUtils.js";
import { determineImageOptions } from "./imageOptionsService.js";
import { processImage } from "./imageProcessingService.js";
import { determineCacheConfig } from "../utils/cacheUtils.js";
import { getDerivativeFromPath } from "../utils/pathUtils.js";

/**
 * Main handler for image requests
 * @param {Request} request - The incoming request
 * @param {Object} config - Environment configuration
 * @returns {Promise<Response>} - The processed image response
 */
export async function handleImageRequest(request, config) {
  try {
    const url = new URL(request.url);
    const urlParams = url.searchParams;

    // Extract information from request
    const pathDerivative = getDerivativeFromPath(url.pathname);

    // Transform the request URL based on deployment mode
    const transformedRequest = transformRequestUrl(request, config);
    const {
      originRequest,
      bucketName,
      originUrl,
      derivative: routeDerivative,
      isRemoteFetch,
    } = transformedRequest;

    // Determine which derivative to use (URL param > path > route)
    const derivativeSources = [
      { type: "explicit", value: urlParams.get("derivative") },
      { type: "path", value: pathDerivative },
      { type: "route", value: routeDerivative },
    ];

    // Find first non-null derivative and set it as a parameter
    const derivativeSource = derivativeSources.find((source) => source.value);
    if (derivativeSource && !urlParams.get("derivative")) {
      urlParams.set("derivative", derivativeSource.value);
    }

    // Determine image options
    const imageOptions = determineImageOptions(
      request,
      urlParams,
      url.pathname,
    );

    // Get cache configuration
    const cache = determineCacheConfig(originUrl);

    // Debug information
    const debugInfo = {
      deploymentMode: config.deploymentMode,
      isRemoteFetch,
      originalUrl: request.url,
      transformedUrl: originUrl,
      bucketName,
      pathDerivative,
      routeDerivative,
    };

    // Process the image - use appropriate request based on mode
    const processingRequest = isRemoteFetch ? originRequest : request;
    return await processImage(
      processingRequest,
      imageOptions,
      cache,
      debugInfo,
    );
  } catch (error) {
    console.error("Error handling image request:", error);
    return new Response(`Error processing image: ${error.message}`, {
      status: 500,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store",
      },
    });
  }
}
