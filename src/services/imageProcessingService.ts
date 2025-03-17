/**
 * Image Processing Service
 * Handles the low-level interaction with Cloudflare's Image Resizing API
 */
import {
  ImageProcessingDependencies,
  IImageProcessingService,
} from '../types/services/imageProcessing';
import { CacheConfig, CacheConfigRecord } from '../types/utils/cache';
import { DiagnosticsInfo, _DebugInfo as DebugInfo } from '../types/utils/debug';
import { ImageTransformOptions } from '../types/services/image';

/**
 * Image processing options interface
 * @deprecated Use ImageTransformOptions from types/services/image instead
 */
export type ImageProcessingOptions = ImageTransformOptions;

/**
 * @deprecated Use DiagnosticsInfo from types/utils/debug instead
 */
export interface DebugInformation extends DiagnosticsInfo {}

/**
 * Factory function to create an image processing service
 * @param dependencies - Dependencies required by the service
 * @returns Image processing service implementation
 */
export function createImageProcessingService(
  dependencies: ImageProcessingDependencies
): IImageProcessingService {
  // Destructure dependencies for convenience
  const { logger, debug, cache, utils, config } = dependencies;

  return {
    /**
     * Process the image using Cloudflare's Image Resizing
     * @param request - The incoming request
     * @param options - Image processing options
     * @param cacheConfig - Cache configuration
     * @param debugInfo - Debug information
     * @returns The processed image response
     */
    async processImage(
      request: Request,
      options: ImageTransformOptions,
      cacheConfig: CacheConfig,
      debugInfo: DiagnosticsInfo = {}
    ): Promise<Response> {
      logger.debug('ImageProcessor', 'Processing image', {
        options,
        cache: cacheConfig as CacheConfigRecord,
        debugInfo,
      });

      // Handle 'auto' width - not supported in Workers API
      if (options.width === 'auto') {
        logger.debug(
          'ImageProcessor',
          'width=auto is not supported in Workers API. Using responsive sizing.'
        );

        // Use the breakpoints from config or default to empty array if not found
        const breakpoints = config.getImageConfig().responsive?.breakpoints || [];

        // Get a responsive width based on device type
        const responsiveWidth = utils.getResponsiveWidth(request, breakpoints);

        // Update the options with the detected width
        options.width = responsiveWidth.width;

        // Keep track of the original source and add the fallback info
        const originalSource = options.source;
        options.source = `${originalSource}-fallback`;

        logger.debug('ImageProcessor', 'Replaced auto width with responsive width', {
          originalWidth: 'auto',
          newWidth: options.width,
          detectionSource: responsiveWidth.source,
        });
      }

      // Make the request with our configured options
      const newResponse = await this.fetchWithImageOptions(
        request,
        options,
        cacheConfig,
        debugInfo
      );

      // Build the enhanced response with debug headers
      const response = this.buildResponse(request, newResponse, options, cacheConfig, debugInfo);

      // Log response details
      logger.logResponse('ImageProcessor', response);

      // Return the response or fallback to original request if error
      return response.ok || response.redirected ? response : fetch(request);
    },

    /**
     * Fetch image with Cloudflare image resizing options
     * @param request - The incoming request
     * @param options - Image processing options
     * @param cacheConfig - Cache configuration
     * @param debugInfo - Debug information
     * @returns Cloudflare response
     */
    async fetchWithImageOptions(
      request: Request,
      options: ImageTransformOptions,
      cacheConfig: CacheConfig,
      debugInfo: DiagnosticsInfo
    ): Promise<Response> {
      // Create a copy of options for the cf.image object
      const imageOptions = { ...options };

      // Remove non-Cloudflare options
      const nonCloudflareOptions = ['source', 'derivative'];
      nonCloudflareOptions.forEach((opt) => delete imageOptions[opt]);

      // Only include defined parameters to avoid sending empty/null values to Cloudflare API
      const cfImageOptions: Record<string, string | number | boolean> = {};
      Object.entries(imageOptions).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          cfImageOptions[key] = value;
        }
      });

      // Log request details
      logger.debug('ImageProcessor', 'Preparing Cloudflare image resize fetch', {
        imageOptions: cfImageOptions,
        url: request.url,
      });

      try {
        const cacheTags = cache.generateCacheTags(
          debugInfo.bucketName?.toString(),
          options.derivative
        );

        // Create fetch options with CloudFlare-specific properties
        const fetchOptions: RequestInit & {
          cf?: {
            polish?: 'off' | 'lossy' | 'lossless';
            mirage?: boolean;
            cacheEverything?: boolean;
            cacheTtl?: number;
            image?: Record<string, string | number | boolean>;
            cacheTags?: string[];
          };
        } = {
          cf: {
            polish: (cacheConfig.imageCompression || 'off') as 'off' | 'lossy' | 'lossless',
            mirage: cacheConfig.mirage || false,
            cacheEverything: cacheConfig.cacheability || false,
            image: cfImageOptions,
          },
        };

        // Only add cache TTL if defined
        if (cacheConfig.ttl?.ok) {
          fetchOptions.cf!.cacheTtl = cacheConfig.ttl.ok;
        }

        // Add cache tags if they exist
        if (cacheTags && cacheTags.length > 0) {
          fetchOptions.cf!.cacheTags = cacheTags;
        }

        const response = await fetch(request, fetchOptions);

        logger.info('ImageProcessor', 'Image processed successfully', {
          status: response.status,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length'),
        });

        return response;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorStack = err instanceof Error ? err.stack : undefined;

        logger.error('ImageProcessor', 'Error fetching image', {
          error: errorMessage,
          stack: errorStack,
        });

        return new Response(`Error processing image: ${errorMessage}`, {
          status: 500,
        });
      }
    },

    /**
     * Build the final response with appropriate headers
     * @param request - Original request
     * @param response - Original Cloudflare response
     * @param options - Image transformation options
     * @param cacheConfig - Cache configuration
     * @param debugInfo - Debug information
     * @returns Final response with proper headers
     */
    buildResponse(
      request: Request,
      response: Response,
      options: ImageTransformOptions,
      cacheConfig: CacheConfig,
      debugInfo: DiagnosticsInfo
    ): Response {
      // Create new response to avoid mutating the original
      const newResponse = new Response(response.body, response);

      // Convert to the right format for addDebugHeaders
      const debugContext = {
        ...debugInfo,
        irOptions: options,
        cacheConfig: cacheConfig as CacheConfigRecord,
      };

      // Use the debug service for adding debug headers
      return debug.addDebugHeaders(
        newResponse,
        {
          isEnabled: debugInfo.isEnabled === true,
          isVerbose: debugInfo.isVerbose === true,
          includePerformance: true,
        },
        debugContext
      );
    },
  };
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use the createImageProcessingService factory function instead
 */
export const processImage = async (
  request: Request,
  options: ImageProcessingOptions,
  cache: CacheConfig,
  debugInfo: DebugInformation = {}
): Promise<Response> => {
  // Import dependencies to avoid circular dependencies
  const { addDebugHeaders, debug, error, info, logResponse } = await import('../utils/loggerUtils');

  const { generateCacheTags } = await import('../utils/cacheControlUtils');
  const { imageConfig } = await import('../config/imageConfig');
  // We need our own implementation of getResponsiveWidth with compatible signature
  const getResponsiveWidthCompat = (
    request: Request,
    breakpoints: number[]
  ): { width: number; source: string } => {
    // Simple responsive width based on user agent
    const userAgent = request.headers.get('user-agent') || '';

    let width: number;
    let source: string;

    // This basic implementation matches the core logic in clientDetectionUtils
    if (
      userAgent.toLowerCase().includes('mobile') ||
      userAgent.toLowerCase().includes('android') ||
      userAgent.toLowerCase().includes('iphone')
    ) {
      width = 640;
      source = 'user-agent-mobile';
    } else if (
      userAgent.toLowerCase().includes('tablet') ||
      userAgent.toLowerCase().includes('ipad')
    ) {
      width = 1024;
      source = 'user-agent-tablet';
    } else {
      width = 1440;
      source = 'user-agent-desktop';
    }

    // Snap to breakpoint if provided
    if (breakpoints && breakpoints.length > 0) {
      // Find the closest breakpoint
      const closestBreakpoint = breakpoints.reduce((prev, curr) => {
        return Math.abs(curr - width) < Math.abs(prev - width) ? curr : prev;
      }, breakpoints[0]);

      width = closestBreakpoint;
    }

    return { width, source };
  };

  // Create a service instance with required dependencies
  const service = createImageProcessingService({
    logger: {
      debug: (module: string, message: string, data?: Record<string, unknown>) => {
        // Force type through any to bypass type checking
        debug(module, message, data as any);
      },
      error: (module: string, message: string, data?: Record<string, unknown>) => {
        // Force type through any to bypass type checking
        error(module, message, data as any);
      },
      info: (module: string, message: string, data?: Record<string, unknown>) => {
        // Force type through any to bypass type checking
        info(module, message, data as any);
      },
      logResponse: (module: string, response: Response) => logResponse(module, response),
    },
    debug: {
      addDebugHeaders,
    },
    cache: {
      generateCacheTags,
    },
    utils: {
      getResponsiveWidth: getResponsiveWidthCompat,
    },
    config: {
      getImageConfig: () => imageConfig,
    },
  });

  // Delegate to the service implementation
  return service.processImage(request, options, cache, debugInfo);
};
