/**
 * R2 Image Processor Service
 *
 * Handles image processing from R2 storage with multiple fallback strategies
 */
import {
  ImageTransformOptions,
  IR2ImageProcessorService,
  R2ImageProcessorDependencies,
} from '../types/services/image';
import { CacheConfig } from '../types/utils/cache';
import {
  prepareTransformationOptions,
  TransformationOptionFormat,
} from '../utils/transformationUtils';

// Import R2ObjectBody type which extends R2Object with the body property
type R2ObjectBody = R2Object & {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
};

/**
 * Custom error types for R2 image processing
 */
class R2ProcessingError extends Error {
  code: string;
  statusCode: number;
  cause?: Error;

  constructor(message: string, code: string, statusCode = 500, cause?: Error) {
    super(message);
    this.name = 'R2ProcessingError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

class R2NotFoundError extends R2ProcessingError {
  constructor(message: string, key: string) {
    super(message, 'R2_NOT_FOUND', 404);
    this.name = 'R2NotFoundError';
  }
}

class R2TransformationError extends R2ProcessingError {
  constructor(message: string, method: string, cause?: Error) {
    super(message, `R2_TRANSFORM_FAILED_${method.toUpperCase()}`, 500, cause);
    this.name = 'R2TransformationError';
  }
}

class R2NetworkError extends R2ProcessingError {
  constructor(message: string, cause?: Error) {
    super(message, 'R2_NETWORK_ERROR', 502, cause);
    this.name = 'R2NetworkError';
  }
}

/**
 * Create an R2 image processor service
 * @param dependencies Service dependencies
 * @returns R2 image processor service implementation
 */
export function createR2ImageProcessorService(
  dependencies: R2ImageProcessorDependencies
): IR2ImageProcessorService {
  const { logger, cache, formatUtils, errorFactory } = dependencies;

  // Determine if logger has module parameter (standard logger) or not (minimal logger)
  // This check detects the logger type at runtime
  const isStandardLogger = typeof logger.debug === 'function' && logger.debug.length >= 2; // Standard logger has at least 2 parameters

  // Create a unified logger interface that works with both logger types
  const minimalLogger = {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (isStandardLogger) {
        // Standard logger - we need to pass the module name
        (logger.debug as (module: string, message: string, data?: Record<string, unknown>) => void)(
          'R2ImageProcessor',
          message,
          data
        );
      } else {
        // Minimal logger - just pass message and data
        (logger.debug as (message: string, data?: Record<string, unknown>) => void)(message, data);
      }
    },

    error: (message: string, data?: Record<string, unknown>) => {
      if (isStandardLogger) {
        (logger.error as (module: string, message: string, data?: Record<string, unknown>) => void)(
          'R2ImageProcessor',
          message,
          data
        );
      } else {
        (logger.error as (message: string, data?: Record<string, unknown>) => void)(message, data);
      }
    },

    info: (message: string, data?: Record<string, unknown>) => {
      if (!logger.info) {
        // No info method available, fall back to debug
        minimalLogger.debug(message, data);
        return;
      }

      if (isStandardLogger) {
        (logger.info as (module: string, message: string, data?: Record<string, unknown>) => void)(
          'R2ImageProcessor',
          message,
          data
        );
      } else {
        (logger.info as (message: string, data?: Record<string, unknown>) => void)(message, data);
      }
    },
  };

  // Use these functions for logging
  const logDebug = minimalLogger.debug;
  const logError = minimalLogger.error;
  const logInfo = minimalLogger.info;

  /**
   * Process an image directly from R2 without transformations
   */
  async function processDirect(
    r2Object: R2Object,
    cacheConfig: CacheConfig,
    imageType: string
  ): Promise<Response> {
    // Try to get the headers builder from the ServiceRegistry
    let headersBuilder;
    try {
      const { ServiceRegistry } = await import('../core/serviceRegistry');
      const registry = ServiceRegistry.getInstance();

      if (registry.isRegistered('IResponseHeadersBuilder')) {
        const builderFactory = registry.resolve<any>('IResponseHeadersBuilder');
        headersBuilder = builderFactory.create();
      }
    } catch (error) {
      // If we can't get the builder from the registry, create it directly
      try {
        const { createResponseHeadersBuilder } = await import('../utils/headersBuilder');
        headersBuilder = createResponseHeadersBuilder();
      } catch (e) {
        // If import fails, we'll use the legacy approach
      }
    }

    // If we have a headers builder, use it
    if (headersBuilder) {
      // Use the transformation cache if available
      let cacheControlValue: string;
      if (dependencies.transformationCache) {
        try {
          const tempHeaders = dependencies.transformationCache.createCacheHeaders(
            200,
            cacheConfig,
            'r2-direct',
            null
          );
          cacheControlValue = tempHeaders.get('Cache-Control') || '';
        } catch (error) {
          cacheControlValue = cache.determineCacheControl(200, cacheConfig);
        }
      } else {
        cacheControlValue = cache.determineCacheControl(200, cacheConfig);
      }

      // Build the headers with the builder
      const headers = headersBuilder
        .withContentType(imageType)
        .withCacheControlValue(cacheControlValue)
        .withSourceHeader('r2-direct')
        .build();

      // Create a response with the R2 object's data
      return new Response((r2Object as R2ObjectBody).body, {
        headers,
        status: 200,
      });
    } else {
      // Fall back to legacy approach
      const headers = new Headers();
      headers.set('Content-Type', imageType);
      headers.set('Cache-Control', cache.determineCacheControl(200, cacheConfig));
      headers.set('X-Source', 'r2-direct');

      return new Response((r2Object as R2ObjectBody).body, {
        headers,
        status: 200,
      });
    }
  }

  /**
   * Process an image using CDN-CGI approach
   */
  async function processCdnCgi(
    fallbackUrl: string,
    r2Key: string,
    imageOptions: ImageTransformOptions,
    cacheConfig: CacheConfig
  ): Promise<Response> {
    try {
      let cdnCgiParams: string[];

      // Use transformation cache if available
      if (dependencies.transformationCache) {
        cdnCgiParams = dependencies.transformationCache.getTransformationOptions(
          imageOptions,
          TransformationOptionFormat.CDN_CGI
        ) as string[];
      } else {
        // Otherwise use the utility directly
        cdnCgiParams = prepareTransformationOptions(
          imageOptions,
          TransformationOptionFormat.CDN_CGI
        ) as string[];
      }

      // Create a URL with /cdn-cgi/image/ prefix for Cloudflare Image Resizing
      const cfProxyUrl = new URL(fallbackUrl);

      // Construct the full URL with CDN-CGI pattern
      cfProxyUrl.pathname = `/cdn-cgi/image/${cdnCgiParams.join(',')}/${r2Key}`;

      logDebug('Using CDN-CGI URL for image transformation', {
        url: cfProxyUrl.toString(),
        options: cdnCgiParams,
      });

      // Fetch the image
      const response = await fetch(cfProxyUrl.toString());

      if (!response.ok) {
        throw new Error(`CDN-CGI fetch failed with status: ${response.status}`);
      }

      // Create headers for the response using the headers builder pattern
      let headersBuilder;

      // Try to get the headers builder from the ServiceRegistry
      try {
        const { ServiceRegistry } = await import('../core/serviceRegistry');
        const registry = ServiceRegistry.getInstance();

        if (registry.isRegistered('IResponseHeadersBuilder')) {
          const builderFactory = registry.resolve<any>('IResponseHeadersBuilder');
          headersBuilder = builderFactory.create();
        }
      } catch (error) {
        // If we can't get the builder from the registry, create it directly
        const { createResponseHeadersBuilder } = await import('../utils/headersBuilder');
        headersBuilder = createResponseHeadersBuilder();
      }

      // If we still don't have a headers builder, fall back to legacy approach
      if (!headersBuilder) {
        // Create headers manually
        const legacyHeaders = new Headers(response.headers);
        legacyHeaders.set('Cache-Control', cache.determineCacheControl(200, cacheConfig));
        legacyHeaders.set('X-Source', 'r2-cf-proxy-transform');
        return new Response(response.body, {
          status: response.status,
          headers: legacyHeaders,
        });
      }

      // Use the transformation cache if available to get cache control
      let cacheControlValue: string;
      if (dependencies.transformationCache) {
        const tempHeaders = dependencies.transformationCache.createCacheHeaders(
          200,
          cacheConfig,
          'r2-cf-proxy-transform',
          null
        );
        cacheControlValue = tempHeaders.get('Cache-Control') || '';
      } else {
        cacheControlValue = cache.determineCacheControl(200, cacheConfig);
      }

      // Build the headers with the builder
      const headers = headersBuilder
        .withCacheControlValue(cacheControlValue)
        .withSourceHeader('r2-cf-proxy-transform')
        .withPreservedHeaders(response, [
          'content-type',
          'content-encoding',
          'content-length',
          'etag',
          'last-modified',
          'cf-resized',
        ])
        .build();

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      logError('Error in CDN-CGI transformation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl,
        r2Key,
      });

      throw error;
    }
  }

  /**
   * Process an image using direct URL with CF image options
   */
  async function processDirectUrl(
    fallbackUrl: string,
    r2Key: string,
    imageOptions: ImageTransformOptions,
    cacheConfig: CacheConfig
  ): Promise<Response> {
    try {
      // Create the URL to the image without CDN-CGI pattern
      const directUrl = new URL(fallbackUrl);
      directUrl.pathname = `/${r2Key}`;

      logDebug('Using direct URL with CF properties', {
        url: directUrl.toString(),
        options: imageOptions,
      });

      // Create a request to this URL
      const directRequest = new Request(directUrl.toString(), {
        headers: new Headers({
          Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
          'User-Agent': 'Cloudflare-Worker',
        }),
      });

      // Get CF image options - use transformation cache if available
      let cfImageOptions: Record<string, string | number | boolean>;
      if (dependencies.transformationCache) {
        cfImageOptions = dependencies.transformationCache.getTransformationOptions(
          imageOptions,
          TransformationOptionFormat.CF_OBJECT
        ) as Record<string, string | number | boolean>;
      } else {
        cfImageOptions = prepareTransformationOptions(
          imageOptions,
          TransformationOptionFormat.CF_OBJECT
        ) as Record<string, string | number | boolean>;
      }

      // Fetch the image with CF properties
      const response = await fetch(directRequest, {
        cf: {
          image: cfImageOptions,
          cacheEverything: true,
          cacheTtl: cacheConfig.ttl?.ok || 86400,
        },
      });

      if (!response.ok) {
        throw new Error(`Direct URL fetch failed with status: ${response.status}`);
      }

      // Create headers for the response using the headers builder pattern
      let headersBuilder;

      // Try to get the headers builder from the ServiceRegistry
      try {
        const { ServiceRegistry } = await import('../core/serviceRegistry');
        const registry = ServiceRegistry.getInstance();

        if (registry.isRegistered('IResponseHeadersBuilder')) {
          const builderFactory = registry.resolve<any>('IResponseHeadersBuilder');
          headersBuilder = builderFactory.create();
        }
      } catch (error) {
        // If we can't get the builder from the registry, create it directly
        const { createResponseHeadersBuilder } = await import('../utils/headersBuilder');
        headersBuilder = createResponseHeadersBuilder();
      }

      // If we still don't have a headers builder, fall back to legacy approach
      if (!headersBuilder) {
        // Create headers manually
        const legacyHeaders = new Headers(response.headers);
        legacyHeaders.set('Cache-Control', cache.determineCacheControl(200, cacheConfig));
        legacyHeaders.set('X-Source', 'r2-direct-url-transform');
        return new Response(response.body, {
          status: response.status,
          headers: legacyHeaders,
        });
      }

      // Use the transformation cache if available to get cache control
      let cacheControlValue: string;
      if (dependencies.transformationCache) {
        const tempHeaders = dependencies.transformationCache.createCacheHeaders(
          200,
          cacheConfig,
          'r2-direct-url-transform',
          null
        );
        cacheControlValue = tempHeaders.get('Cache-Control') || '';
      } else {
        cacheControlValue = cache.determineCacheControl(200, cacheConfig);
      }

      // Build the headers with the builder
      const headers = headersBuilder
        .withCacheControlValue(cacheControlValue)
        .withSourceHeader('r2-direct-url-transform')
        .withPreservedHeaders(response, [
          'content-type',
          'content-encoding',
          'content-length',
          'etag',
          'last-modified',
          'cf-resized',
        ])
        .build();

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      logError('Error in direct URL transformation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl,
        r2Key,
      });

      throw error;
    }
  }

  /**
   * Process an image using remote fallback
   */
  async function processRemoteFallback(
    fallbackUrl: string,
    r2Key: string,
    imageOptions: ImageTransformOptions,
    originalRequest: Request,
    cacheConfig: CacheConfig
  ): Promise<Response> {
    try {
      // Get URL with query parameters - use transformation cache if available
      let remoteUrl: URL;
      if (dependencies.transformationCache) {
        remoteUrl = dependencies.transformationCache.getTransformationOptions(
          imageOptions,
          TransformationOptionFormat.QUERY_PARAMS
        ) as URL;
      } else {
        remoteUrl = prepareTransformationOptions(
          imageOptions,
          TransformationOptionFormat.QUERY_PARAMS
        ) as URL;
      }

      // Update the pathname to match our r2Key
      remoteUrl.pathname = `/${r2Key}`;

      logDebug('Using remote fallback URL', {
        url: remoteUrl.toString(),
      });

      // Create request with original headers
      const headers = new Headers();

      // Add useful headers from the original request
      const headersToKeep = [
        'Accept',
        'Accept-Encoding',
        'Accept-Language',
        'User-Agent',
        'Viewport-Width',
        'DPR',
        'Width',
      ];

      headersToKeep.forEach((headerName) => {
        const value = originalRequest.headers.get(headerName);
        if (value) {
          headers.set(headerName, value);
        }
      });

      // Create the request
      const remoteRequest = new Request(remoteUrl.toString(), {
        method: 'GET',
        headers,
      });

      // Fetch the image
      const response = await fetch(remoteRequest);

      if (!response.ok) {
        throw new Error(`Remote fallback fetch failed with status: ${response.status}`);
      }

      // Create headers for the response using the headers builder pattern
      let headersBuilder;

      // Try to get the headers builder from the ServiceRegistry
      try {
        const { ServiceRegistry } = await import('../core/serviceRegistry');
        const registry = ServiceRegistry.getInstance();

        if (registry.isRegistered('IResponseHeadersBuilder')) {
          const builderFactory = registry.resolve<any>('IResponseHeadersBuilder');
          headersBuilder = builderFactory.create();
        }
      } catch (error) {
        // If we can't get the builder from the registry, create it directly
        const { createResponseHeadersBuilder } = await import('../utils/headersBuilder');
        headersBuilder = createResponseHeadersBuilder();
      }

      // If we still don't have a headers builder, fall back to legacy approach
      if (!headersBuilder) {
        // Create headers manually
        const legacyHeaders = new Headers(response.headers);
        legacyHeaders.set('Cache-Control', cache.determineCacheControl(200, cacheConfig));
        legacyHeaders.set('X-Source', 'r2-remote-fallback');
        return new Response(response.body, {
          status: response.status,
          headers: legacyHeaders,
        });
      }

      // Use the transformation cache if available to get cache control
      let cacheControlValue: string;
      if (dependencies.transformationCache) {
        const tempHeaders = dependencies.transformationCache.createCacheHeaders(
          200,
          cacheConfig,
          'r2-remote-fallback',
          null
        );
        cacheControlValue = tempHeaders.get('Cache-Control') || '';
      } else {
        cacheControlValue = cache.determineCacheControl(200, cacheConfig);
      }

      // Build the headers with the builder
      const responseHeaders = headersBuilder
        .withCacheControlValue(cacheControlValue)
        .withSourceHeader('r2-remote-fallback')
        .withPreservedHeaders(response, [
          'content-type',
          'content-encoding',
          'content-length',
          'etag',
          'last-modified',
          'cf-resized',
        ])
        .build();

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      logError('Error in remote fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl,
        r2Key,
      });

      throw error;
    }
  }

  /**
   * Determines the appropriate content type based on file extension
   */
  function determineContentType(key: string, fallback = 'application/octet-stream'): string {
    const extension = key.split('.').pop()?.toLowerCase();

    if (!extension) {
      return fallback;
    }

    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      bmp: 'image/bmp',
      ico: 'image/x-icon',
    };

    return contentTypeMap[extension] || fallback;
  }

  return {
    /**
     * Process an image from R2 with multiple fallback strategies
     */
    async processR2Image(
      r2Key: string,
      r2Bucket: R2Bucket,
      imageOptions: ImageTransformOptions,
      request: Request,
      cacheConfig: CacheConfig,
      fallbackUrl?: string
    ): Promise<Response> {
      try {
        // Start by fetching the object from R2
        // Cast to R2ObjectBody to access the body property
        const r2Object = (await r2Bucket.get(r2Key)) as unknown as R2ObjectBody;

        // If object doesn't exist, return 404
        if (r2Object === null) {
          logDebug('Object not found in R2', { key: r2Key });

          const notFoundError = new R2NotFoundError(
            `Image not found in R2 bucket: ${r2Key}`,
            r2Key
          );

          // If errorFactory is available, use it to create a standardized error response
          if (errorFactory) {
            const appError = errorFactory.createNotFoundError(`Image not found: ${r2Key}`);
            return errorFactory.createErrorResponse(appError);
          }

          // Fallback to basic response if no error factory
          return new Response(`Image not found in R2 bucket: ${r2Key}`, {
            status: 404,
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'no-store, must-revalidate',
              'X-Source': 'r2-not-found',
              'X-Error-Code': notFoundError.code,
            },
          });
        }

        // Determine content type
        const contentType =
          r2Object.httpMetadata?.contentType ||
          determineContentType(r2Key, 'application/octet-stream');

        // Log that we found the object
        if (logInfo) {
          logInfo('Successfully retrieved object from R2', {
            key: r2Key,
            size: r2Object.size,
            contentType,
          });
        }

        // If no transformations needed, return directly from R2
        const hasTransformations =
          imageOptions.width || imageOptions.height || imageOptions.format || imageOptions.quality;

        if (!hasTransformations) {
          logDebug('No transformations requested, returning directly from R2', { key: r2Key });
          return processDirect(r2Object, cacheConfig, contentType);
        }

        // If no fallback URL provided, we can't transform, so return direct
        if (!fallbackUrl) {
          logDebug('No fallback URL provided, returning directly from R2', { key: r2Key });
          return processDirect(r2Object, cacheConfig, contentType);
        }

        // Define transformation strategies
        type TransformStrategy = {
          name: string;
          execute: () => Promise<Response>;
        };

        // Create an array of transformation strategies to try in sequence
        const strategies: TransformStrategy[] = [
          {
            name: 'cdn-cgi',
            execute: () => processCdnCgi(fallbackUrl!, r2Key, imageOptions, cacheConfig),
          },
          {
            name: 'direct-url',
            execute: () => processDirectUrl(fallbackUrl!, r2Key, imageOptions, cacheConfig),
          },
          {
            name: 'remote-fallback',
            execute: () =>
              processRemoteFallback(fallbackUrl!, r2Key, imageOptions, request, cacheConfig),
          },
        ];

        // Track transformation attempts and errors
        const transformationAttempts: string[] = [];
        const errors: Record<string, string> = {};

        // Try each strategy in sequence
        for (const strategy of strategies) {
          try {
            transformationAttempts.push(strategy.name);
            logDebug(`Attempting ${strategy.name} transformation`, { key: r2Key });

            // Execute the strategy and return if successful
            return await strategy.execute();
          } catch (error) {
            // Record the error and continue to the next strategy
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors[strategy.name] = errorMessage;

            logDebug(`${strategy.name} transformation failed, trying next method`, {
              error: errorMessage,
              key: r2Key,
            });
          }
        }

        // If we get here, all strategies have failed
        logDebug('All transformation approaches failed, returning directly from R2', {
          errors,
          attempts: transformationAttempts,
          key: r2Key,
        });

        // Create headers for the direct fallback response
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', cache.determineCacheControl(200, cacheConfig));
        headers.set('X-Source', 'r2-direct-fallback');

        // Add diagnostic headers
        headers.set('X-Transform-Attempts', transformationAttempts.join(','));
        headers.set('X-Transform-Failed', 'true');

        // Return direct from R2 as the final fallback
        return new Response((r2Object as R2ObjectBody).body, {
          headers,
          status: 200,
        });
      } catch (error) {
        // Handle errors fetching from R2
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Create a typed error for better diagnostics
        const r2Error = new R2ProcessingError(
          `Error processing R2 image: ${errorMessage}`,
          'R2_PROCESSING_FAILED',
          500,
          error instanceof Error ? error : undefined
        );

        logError('Error processing R2 image', {
          error: errorMessage,
          code: r2Error.code,
          key: r2Key,
          hasR2Bucket: !!r2Bucket,
          stack: error instanceof Error ? error.stack : undefined,
        });

        // If errorFactory is available, use it for standardized error responses
        if (errorFactory) {
          const appError = errorFactory.createError(
            'INTERNAL_SERVER_ERROR',
            `Error processing image: ${r2Key}`
          );
          return errorFactory.createErrorResponse(appError);
        }

        // Fallback to basic response if no error factory
        return new Response(`Error processing image from R2: ${errorMessage}`, {
          status: r2Error.statusCode,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store',
            'X-Error-Code': r2Error.code,
            'X-Error-Source': 'r2-processor',
          },
        });
      }
    },
  };
}
