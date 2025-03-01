// Main image handling entry point
import { transformRequestUrl } from "../utils/urlTransformUtils";
import { determineImageOptions } from "./imageOptionsService";
import { processImage } from "./imageProcessingService";
import { determineCacheConfig } from "../utils/cacheUtils";

/**
 * Main handler for image requests
 * @param {Request} request - The incoming request
 * @param {Object} config - Environment configuration
 * @returns {Promise<Response>} - The processed image response
 */
export async function handleImageRequest(request, config) {
  try {
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

    const url = new URL(request.url);
    const urlParams = url.searchParams;

    // Add the route-derived derivative as a parameter if it exists
    if (routeDerivative && !urlParams.has("derivative")) {
      urlParams.set("derivative", routeDerivative);
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
