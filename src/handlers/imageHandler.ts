/**
 * Main image handling entry point
 * Using service-oriented architecture for better separation of concerns
 */
import { determineImageOptions } from './imageOptionsService';
import { transformImage } from '../services/imageTransformationService';
import { debug, error, info } from '../utils/loggerUtils';
import { getDerivativeFromPath } from '../utils/pathUtils';
import { AppConfig } from '../config/configManager';

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

    // Extract information from request - using path-based derivative detection
    const pathDerivative = getDerivativeFromPath(url.pathname, config.pathTemplates);

    // Determine which derivative to use (URL param > path-based)
    if (pathDerivative && !urlParams.get('derivative')) {
      urlParams.set('derivative', pathDerivative);

      debug('ImageHandler', 'Applied path-based derivative', {
        path: url.pathname,
        derivative: pathDerivative,
      });
    }

    // Determine image options using the options service
    const imageOptions = await determineImageOptions(request, urlParams, url.pathname);

    debug('ImageHandler', 'Processing image request', {
      url: url.toString(),
      path: url.pathname,
      options: imageOptions,
    });

    // Prepare debug information from configuration
    const debugInfo = {
      isEnabled: config.debug.enabled,
      isVerbose: config.debug.verbose,
      includeHeaders: config.debug.includeHeaders,
      includePerformance: true,
    };

    // Get path patterns from config
    const pathPatterns = config.pathPatterns || [];

    // Use the image transformation service
    const response = await transformImage(request, imageOptions, pathPatterns, debugInfo, config);

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
