/**
 * Main image handling entry point
 * Using service-oriented architecture for better separation of concerns
 */
import { determineImageOptions } from './imageOptionsService';
import { transformImage } from '../services/imageTransformationService';
import { debug, error, info } from '../utils/loggerUtils';
import { getDerivativeFromPath } from '../utils/pathUtils';
import { AppConfig } from '../config/configManager';
import { transformRequestUrl } from '../utils/urlTransformUtils';

/**
 * Main handler for image requests
 * @param request The incoming request
 * @param config Application configuration
 * @returns A response with the processed image
 */
export async function handleImageRequest(request: Request, config: AppConfig): Promise<Response> {
  try {
    const url = new URL(request.url);
    const urlParams = url.searchParams;

    // Import the cache management service
    const { getCachedResponse, cacheResponse } = await import('../services/cacheManagementService');

    // Try to get the response from cache first
    const cachedResponse = await getCachedResponse(request);
    if (cachedResponse) {
      info('ImageHandler', 'Serving from cache', {
        url: url.toString(),
        cacheControl: cachedResponse.headers.get('Cache-Control'),
      });
      return cachedResponse;
    }

    // Transform the request URL based on deployment mode - matching main branch behavior
    const transformedRequest = transformRequestUrl(request, config);
    const {
      originRequest,
      bucketName,
      originUrl,
      derivative: routeDerivative,
      isRemoteFetch,
    } = transformedRequest;

    // Extract information from request - using path-based derivative detection
    const pathDerivative = getDerivativeFromPath(url.pathname, config.pathTemplates);

    // Determine which derivative to use (URL param > path > route)
    // Order of precedence matching main branch
    const derivativeSources = [
      { type: 'explicit', value: urlParams.get('derivative') },
      { type: 'path', value: pathDerivative },
      { type: 'route', value: routeDerivative },
    ];

    // Find first non-null derivative and set it as a parameter
    const derivativeSource = derivativeSources.find((source) => source.value);
    if (derivativeSource?.value && !urlParams.get('derivative')) {
      urlParams.set('derivative', derivativeSource.value);

      debug('ImageHandler', `Applied ${derivativeSource.type}-based derivative`, {
        path: url.pathname,
        derivative: derivativeSource.value,
        source: derivativeSource.type,
      });
    }

    // Determine image options using the options service
    const imageOptions = await determineImageOptions(request, urlParams, url.pathname);

    debug('ImageHandler', 'Processing image request', {
      url: url.toString(),
      path: url.pathname,
      options: imageOptions,
      isRemoteFetch,
      bucketName,
      originUrl: isRemoteFetch ? originUrl : url.toString(),
    });

    // Prepare debug information from configuration
    const debugInfo = {
      isEnabled: config.debug.enabled,
      isVerbose: config.debug.verbose,
      includeHeaders: config.debug.includeHeaders,
      includePerformance: true,
      deploymentMode: config.mode,
      isRemoteFetch,
      originalUrl: request.url,
      transformedUrl: originUrl,
      bucketName,
      pathDerivative,
      routeDerivative,
    };

    // Get path patterns from config
    const pathPatterns = config.pathPatterns || [];

    // Process the image - use appropriate request based on mode
    // matching main branch behavior
    const processingRequest = isRemoteFetch ? originRequest : request;

    // Use the image transformation service
    const response = await transformImage(
      processingRequest,
      imageOptions,
      pathPatterns,
      debugInfo,
      config
    );

    // Store the response in cache if it's cacheable
    if (response.headers.get('Cache-Control')?.includes('max-age=')) {
      // Use a non-blocking cache write to avoid delaying the response
      cacheResponse(request, response.clone()).catch((err) => {
        error('ImageHandler', 'Error caching response', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    }

    return response;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const errorStack = err instanceof Error ? err.stack : undefined;

    error('ImageHandler', 'Error handling image request', {
      error: errorMessage,
      stack: errorStack,
    });

    return new Response(`Error processing image: ${errorMessage}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store',
      },
    });
  }
}
