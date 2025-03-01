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

    // Check for path-based derivative directly
    const pathDerivative = getDerivativeFromPath(url.pathname);

    // Transform the request URL based on deployment mode
    const transformedRequest = transformRequestUrl(request, config);

    // Extract components from the transformed request
    const {
      originRequest,
      bucketName,
      originUrl,
      derivative: routeDerivative,
      isRemoteFetch,
    } = transformedRequest;

    // Add the route-derived derivative as a parameter if it exists and no explicit derivative set
    // Priority: URL param > path derivative > route derivative
    const explicitDerivative = urlParams.get("derivative");

    if (!explicitDerivative) {
      if (pathDerivative) {
        urlParams.set("derivative", pathDerivative);
      } else if (routeDerivative) {
        urlParams.set("derivative", routeDerivative);
      }
    }

    // Determine image options based on the original request (for parameters)
    // but using the path from the transformed URL
    const imageOptions = determineImageOptions(
      request,
      urlParams,
      url.pathname,
    );

    // Get cache configuration for the target URL
    const cache = determineCacheConfig(originUrl);

    // For debugging
    const debugInfo = {
      deploymentMode: config.deploymentMode,
      isRemoteFetch,
      originalUrl: request.url,
      transformedUrl: originUrl,
      bucketName,
      pathDerivative,
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
