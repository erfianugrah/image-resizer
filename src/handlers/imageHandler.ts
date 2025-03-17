/**
 * Main image handling entry point
 * Using service-oriented architecture with dependency injection
 */
import { createImageOptionsService } from './imageOptionsService';
import { createImageTransformationService } from '../services/imageTransformationService';
import { createCacheManagementService } from '../services/cacheManagementService';
import { createDebugService } from '../services/debugService';
import { debug, error, info } from '../utils/loggerUtils';
import { getDerivativeFromPath } from '../utils/pathUtils';
import { AppConfig } from '../config/configManager';
import { transformRequestUrl } from '../utils/urlTransformUtils';
import { buildCacheKey, determineCacheControl, generateCacheTags } from '../utils/cacheUtils';
import {
  createErrorFactory,
  createErrorResponseFactory,
  createErrorFromUnknown,
  createErrorResponse,
} from '../types/utils/errors';
import { hasClientHints, getViewportWidth, getDevicePixelRatio } from '../utils/clientHints';
import { hasCfDeviceType, getDeviceInfo } from '../utils/deviceUtils';
import { getDeviceTypeFromUserAgent } from '../utils/userAgentUtils';
import { extractImageParams } from '../utils/urlParamUtils';
import { snapToBreakpoint } from '../utils/responsiveWidthUtils';
import { createImageOptionsFactory } from '../utils/optionsFactory';

/**
 * Main handler for image requests using dependency injection
 * @param request The incoming request
 * @param config Application configuration
 * @returns A response with the processed image
 */
// Define these at module scope to avoid TypeScript errors
let globalErrorFactory: ReturnType<typeof createErrorFactory> | undefined;
let globalErrorResponseFactory: ReturnType<typeof createErrorResponseFactory> | undefined;

export async function handleImageRequest(request: Request, config: AppConfig): Promise<Response> {
  try {
    const url = new URL(request.url);
    const urlParams = url.searchParams;

    // Create error handling factories with logger dependency
    // and store references at module level for error handling
    globalErrorFactory = createErrorFactory({
      logger: {
        error: (module: string, message: string, data?: Record<string, unknown>) =>
          error(module, message, data as any),
      },
    });

    globalErrorResponseFactory = createErrorResponseFactory({
      errorFactory: globalErrorFactory,
      logger: {
        error: (module: string, message: string, data?: Record<string, unknown>) =>
          error(module, message, data as any),
      },
    });

    // Create services with dependencies injected
    const cacheService = createCacheManagementService({
      logger: {
        debug: (module: string, message: string, data?: Record<string, unknown>) =>
          debug(module, message, data as any),
        error: (module: string, message: string, data?: Record<string, unknown>) =>
          error(module, message, data as any),
      },
      config: {
        getConfig: () => ({ caching: config.cache }),
      },
      utils: {
        buildCacheKey,
        determineCacheControl,
        generateCacheTags,
      },
    });

    // Create debug service for potential future use
    createDebugService({
      logger: {
        debug: (module: string, message: string, data?: Record<string, unknown>) =>
          debug(module, message, data as any),
      },
    });

    const imageService = createImageTransformationService({
      logger: {
        debug: (module: string, message: string, data?: Record<string, unknown>) =>
          debug(module, message, data as any),
        error: (module: string, message: string, data?: Record<string, unknown>) =>
          error(module, message, data as any),
        logResponse: () => {},
      },
      cache: {
        getCachedResponse: cacheService.getCachedResponse,
        cacheResponse: cacheService.cacheResponse,
        applyCacheHeaders: cacheService.applyCacheHeaders,
      },
    });

    // Try to get the response from cache first
    const cachedResponse = await cacheService.getCachedResponse(request);
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

    // Create the image options service with DI
    const imageOptionsService = createImageOptionsService({
      logger: {
        debug: (module: string, message: string, data?: Record<string, unknown>) =>
          debug(module, message, data as any),
        error: (module: string, message: string, data?: Record<string, unknown>) =>
          error(module, message, data as any),
      },
      config: {
        getConfig: () => ({
          derivatives: config.derivatives || {},
          responsive: {
            breakpoints: config.responsive?.breakpoints || [],
            deviceWidths: config.responsive?.deviceWidths || {},
          },
          defaults: config.defaults
            ? { ...config.defaults }
            : {
                quality: 80,
                fit: 'cover',
                format: 'auto',
                metadata: 'none',
              },
        }),
      },
      clientDetection: {
        hasClientHints,
        getViewportWidth,
        getDevicePixelRatio,
        hasCfDeviceType,
        getDeviceInfo,
        getDeviceTypeFromUserAgent,
      },
      urlUtils: {
        extractImageParams,
        snapToBreakpoint,
      },
      optionsFactory: {
        create: (factoryConfig) => {
          // Type cast to convert factoryConfig to the format expected by createImageOptionsFactory
          const typedConfig = {
            derivatives: factoryConfig.derivatives,
            responsive: {
              quality: 80,
              fit: 'cover',
              metadata: 'none',
              format: 'auto',
              availableWidths: [320, 480, 640, 768, 1024, 1366, 1600, 1920],
              breakpoints: [320, 768, 960, 1440, 1920, 2048],
              deviceWidths: { mobile: 480, tablet: 768, desktop: 1440 },
              deviceMinWidthMap: { mobile: 0, tablet: 640, desktop: 1024 },
              ...(factoryConfig.responsive as any),
            },
            defaults: {
              quality: 80,
              fit: 'cover',
              format: 'auto',
              metadata: 'none',
              ...(factoryConfig.defaults as any),
            },
          };
          return createImageOptionsFactory(typedConfig);
        },
      },
    });

    // Determine image options using the service
    const imageOptions = await imageOptionsService.determineImageOptions(
      request,
      urlParams,
      url.pathname
    );

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
    const response = await imageService.transformImage(
      processingRequest,
      imageOptions,
      pathPatterns,
      debugInfo,
      config
    );

    // Store the response in cache if it's cacheable
    if (response.headers.get('Cache-Control')?.includes('max-age=')) {
      // Use a non-blocking cache write to avoid delaying the response
      cacheService.cacheResponse(request, response.clone()).catch((err) => {
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

    // Use the error factory for consistent error handling
    // Check if we created the factories at the beginning of the function
    if (globalErrorResponseFactory) {
      // Use the factory we created
      return globalErrorResponseFactory.createErrorResponse(err);
    } else {
      // Fallback to the backward compatibility functions for safety
      const appError = createErrorFromUnknown(err, 'Error processing image');
      return createErrorResponse(appError);
    }
  }
}
