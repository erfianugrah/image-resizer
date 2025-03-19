/**
 * Streaming Transformation Service
 * Provides a modular approach to image transformation with pluggable strategies
 */
import {
  IStreamingTransformationService,
  IImageTransformationStrategy,
  StreamingTransformationDependencies,
  TransformationStrategyParams,
} from '../types/services/streaming';
import { ImageTransformOptions } from '../types/services/image';
import { CacheConfig } from '../types/utils/cache';
import { TransformationOptionFormat } from '../utils/transformationUtils';
import { StrategyDiagnostics, addEnhancedDebugHeaders, getEnhancedDebugInfo } from '../utils/enhanced_debug_headers';
import { IEnvironmentService } from '../types/services/environment';
import { getDebugInfoFromRequest } from '../utils/loggerUtils';

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

/**
 * Base class for transformation strategies
 */
abstract class BaseTransformationStrategy implements IImageTransformationStrategy {
  abstract name: string;
  abstract priority: number;

  constructor(protected dependencies: StreamingTransformationDependencies) {}

  /**
   * Get unified logger with module name support
   * This provides a consistent interface for logging across standard and minimal loggers
   */
  protected getLogger() {
    const { logger } = this.dependencies;
    // Determine if logger has module parameter (standard logger) or not (minimal logger)
    const isStandardLogger = typeof logger.debug === 'function' && logger.debug.length >= 2; // Standard logger has at least 2 parameters
    
    // Create a strategy-specific module prefix for consistent logging
    const modulePrefix = `Strategy.${this.name}`;

    return {
      debug: (message: string, data?: Record<string, unknown>) => {
        // Only log if debug logging is enabled - this check is handled by the underlying logger
        // but we check explicitly for isLevelEnabled to avoid overhead when not needed
        if (isStandardLogger) {
          // Standard logger - we need to pass the module name
          (logger.debug as (module: string, message: string, data?: Record<string, unknown>) => void)(
            modulePrefix, 
            message, 
            data
          );
        } else {
          // Minimal logger - just pass message and data
          (logger.debug as (message: string, data?: Record<string, unknown>) => void)(
            message,
            data
          );
        }
      },

      error: (message: string, data?: Record<string, unknown>) => {
        if (isStandardLogger) {
          (logger.error as (module: string, message: string, data?: Record<string, unknown>) => void)(
            modulePrefix, 
            message, 
            data
          );
        } else {
          (logger.error as (message: string, data?: Record<string, unknown>) => void)(
            message,
            data
          );
        }
      },

      info: (message: string, data?: Record<string, unknown>) => {
        if (!logger.info) {
          // No info method available, fall back to debug
          this.getLogger().debug(message, data);
          return;
        }

        if (isStandardLogger) {
          (logger.info as (module: string, message: string, data?: Record<string, unknown>) => void)(
            modulePrefix, 
            message, 
            data
          );
        } else {
          (logger.info as (message: string, data?: Record<string, unknown>) => void)(
            message,
            data
          );
        }
      },
    };
  }

  /**
   * Helper to get response headers
   */
  protected async getResponseHeaders(
    response: Response | null,
    cacheConfig: CacheConfig,
    source: string
  ): Promise<Headers> {
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

    // Use the transformation cache if available to get cache control
    let cacheControlValue: string;
    if (this.dependencies.transformationCache) {
      const tempHeaders = this.dependencies.transformationCache.createCacheHeaders(
        200,
        cacheConfig,
        source,
        null
      );
      cacheControlValue = tempHeaders.get('Cache-Control') || '';
    } else {
      cacheControlValue = this.dependencies.cache.determineCacheControl(200, cacheConfig);
    }

    // If we have a headers builder, use it
    if (headersBuilder) {
      // Build the headers with the builder
      let builder = headersBuilder
        .withCacheControlValue(cacheControlValue)
        .withSourceHeader(source);

      if (response) {
        builder = builder.withPreservedHeaders(response, [
          'content-type',
          'content-encoding',
          'content-length',
          'etag',
          'last-modified',
          'cf-resized',
        ]);
      }

      return builder.build();
    } else {
      // Fall back to legacy approach
      const headers = new Headers();
      headers.set('Cache-Control', cacheControlValue);
      headers.set('X-Source', source);

      // Copy relevant headers from the response if available
      if (response) {
        const preserveHeaders = [
          'content-type',
          'content-encoding',
          'content-length',
          'etag',
          'last-modified',
          'cf-resized',
        ];

        for (const header of preserveHeaders) {
          const value = response.headers.get(header);
          if (value) {
            headers.set(header, value);
          }
        }
      }

      return headers;
    }
  }

  /**
   * Helper to get content type from key
   */
  protected determineContentType(key: string, fallback = 'application/octet-stream'): string {
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

  abstract canHandle(params: TransformationStrategyParams): boolean;
  abstract execute(params: TransformationStrategyParams): Promise<Response>;
}

/**
 * Direct serving strategy - no transformation
 */
export class DirectServingStrategy extends BaseTransformationStrategy {
  name = 'direct-serving';
  priority = 10; // Lower priority, use only when no transformations needed

  canHandle(params: TransformationStrategyParams): boolean {
    // Can handle if object is available and no transformations are needed
    if (!params.object) return false;

    const { options } = params;
    const hasTransformations =
      !!options.width || !!options.height || !!options.format || !!options.quality;

    return !hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    const { key, object, cacheConfig } = params;
    const logger = this.getLogger();

    // The object must exist for this strategy
    if (!object) {
      throw new Error(`Object is required for direct serving strategy`);
    }

    // Determine content type
    const contentType =
      (object as R2ObjectBody).httpMetadata?.contentType ||
      this.determineContentType(key, 'application/octet-stream');

    logger.debug('Using direct serving strategy', { key, contentType });

    // Get headers
    const headers = await this.getResponseHeaders(null, cacheConfig, 'r2-direct');
    headers.set('Content-Type', contentType);

    // Create response
    return new Response((object as R2ObjectBody).body, {
      headers,
      status: 200,
    });
  }
}

/**
 * CDN-CGI transformation strategy - uses /cdn-cgi/image/ path pattern
 */
export class CdnCgiStrategy extends BaseTransformationStrategy {
  name = 'cdn-cgi';
  priority = 1; // High priority, try first for transformations

  canHandle(params: TransformationStrategyParams): boolean {
    // Can handle if fallback URL is available, bucket is available, and transformations are needed
    const { fallbackUrl, bucket, options, request } = params;
    
    // Attempt to get fallback URL from multiple sources
    let effectiveFallbackUrl = fallbackUrl;
    if (!effectiveFallbackUrl) {
      try {
        // Try to access process.env or similar for REMOTE_BUCKETS.default
        const remoteBuckets = (globalThis as any).REMOTE_BUCKETS;
        if (remoteBuckets && typeof remoteBuckets === 'object' && remoteBuckets.default) {
          effectiveFallbackUrl = remoteBuckets.default;
        }
      } catch (e) {
        // Ignore errors - we'll try other approaches
      }
    }
    
    // If still no fallback URL, try to use request URL domain for workers.dev
    if (!effectiveFallbackUrl && request) {
      try {
        const url = new URL(request.url);
        const isWorkersDevDomain = url.hostname.includes('workers.dev');
        
        if (isWorkersDevDomain) {
          // For workers.dev domains, we can use the current domain as fallback
          effectiveFallbackUrl = `${url.protocol}//${url.host}`;
        }
      } catch (e) {
        // Ignore errors in URL parsing
      }
    }
    
    // Still need both fallback URL and bucket
    if (!effectiveFallbackUrl || !bucket) return false;

    const hasTransformations =
      !!options.width || !!options.height || !!options.format || !!options.quality;

    return hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    const { key, options, cacheConfig, fallbackUrl } = params;
    const logger = this.getLogger();

    if (!fallbackUrl) {
      throw new Error('Fallback URL is required for CDN-CGI strategy');
    }

    try {
      // Get CDN-CGI parameters
      let cdnCgiParams: string[];

      if (this.dependencies.transformationCache) {
        cdnCgiParams = this.dependencies.transformationCache.getTransformationOptions(
          options,
          TransformationOptionFormat.CDN_CGI
        ) as string[];
      } else {
        // Import dynamically
        const { prepareTransformationOptions } = await import('../utils/transformationUtils');
        cdnCgiParams = prepareTransformationOptions(
          options,
          TransformationOptionFormat.CDN_CGI
        ) as string[];
      }

      // Create the URL with CDN-CGI pattern
      const cfProxyUrl = new URL(fallbackUrl);
      cfProxyUrl.pathname = `/cdn-cgi/image/${cdnCgiParams.join(',')}/${key}`;

      logger.debug('Using CDN-CGI transformation', {
        url: cfProxyUrl.toString(),
        options: cdnCgiParams,
      });

      // Fetch the transformed image
      const response = await fetch(cfProxyUrl.toString());

      if (!response.ok) {
        throw new Error(`CDN-CGI fetch failed with status: ${response.status}`);
      }

      // Get response headers
      const headers = await this.getResponseHeaders(response, cacheConfig, 'r2-cf-proxy-transform');

      // Return the transformed image
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      logger.error('Error in CDN-CGI transformation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl,
        key,
      });

      throw error;
    }
  }
}

/**
 * Direct URL with CF image options strategy
 */
export class DirectUrlStrategy extends BaseTransformationStrategy {
  name = 'direct-url';
  priority = 2; // Medium priority, try if CDN-CGI fails

  canHandle(params: TransformationStrategyParams): boolean {
    // Direct URL strategy can transform images directly from R2 or using a fallback URL
    const { bucket, object, options, request } = params;
    
    // Check if we have transformations to apply
    const hasTransformations =
      !!options.width || !!options.height || !!options.format || !!options.quality;
      
    // Require either R2 object or fallback URL - this strategy can work with either
    const hasObject = !!object;
    const hasWorkersDevDomain = request && 
        request.url.includes('workers.dev') || 
        (request.headers.get('host') || '').includes('workers.dev');
        
    // Check for fallback URL from multiple sources
    let fallbackUrlAvailable = !!params.fallbackUrl;
    
    // If no explicit fallback URL, try to get from environment
    if (!fallbackUrlAvailable) {
      try {
        const remoteBuckets = (globalThis as any).REMOTE_BUCKETS;
        if (remoteBuckets && typeof remoteBuckets === 'object' && remoteBuckets.default) {
          fallbackUrlAvailable = true;
        }
      } catch (e) {
        // Ignore errors when checking for REMOTE_BUCKETS
      }
    }
    
    // On workers.dev domains, this strategy should be more permissive
    if (hasWorkersDevDomain && bucket && hasTransformations) {
      return true;
    }
        
    // For non-workers.dev, require either object or fallback URL
    return (hasObject || fallbackUrlAvailable) && hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    const { key, options, cacheConfig, fallbackUrl, request } = params;
    const logger = this.getLogger();

    let effectiveFallbackUrl = fallbackUrl;
    
    // If we don't have a fallback URL but this is a workers.dev domain, try to get one from REMOTE_BUCKETS
    if (!effectiveFallbackUrl) {
      try {
        const remoteBuckets = (globalThis as any).REMOTE_BUCKETS;
        if (remoteBuckets && typeof remoteBuckets === 'object' && remoteBuckets.default) {
          effectiveFallbackUrl = remoteBuckets.default;
          logger.debug('Using REMOTE_BUCKETS.default as fallback URL', { url: effectiveFallbackUrl });
        }
      } catch (e) {
        logger.error('Error accessing REMOTE_BUCKETS', { error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }
    
    // If still no fallback URL, try to use the current domain
    if (!effectiveFallbackUrl && request) {
      try {
        const url = new URL(request.url);
        effectiveFallbackUrl = `${url.protocol}//${url.host}`;
        logger.debug('Using current domain as fallback URL', { url: effectiveFallbackUrl });
      } catch (e) {
        logger.error('Error creating fallback URL from request', { error: e instanceof Error ? e.message : 'Unknown error' });
      }
    }

    if (!effectiveFallbackUrl) {
      throw new Error('Fallback URL is required for Direct URL strategy');
    }

    try {
      // Create direct URL
      const directUrl = new URL(effectiveFallbackUrl);
      directUrl.pathname = `/${key}`;

      logger.debug('Using direct URL with CF properties', {
        url: directUrl.toString(),
        options,
        isWorkersDevDomain: request && 
          (request.url.includes('workers.dev') || (request.headers.get('host') || '').includes('workers.dev'))
      });

      // Create request with optimized headers
      const directRequest = new Request(directUrl.toString(), {
        headers: new Headers({
          Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
          'User-Agent': 'Cloudflare-Worker',
        }),
      });

      // Get CF image options
      let cfImageOptions: Record<string, string | number | boolean>;
      if (this.dependencies.transformationCache) {
        cfImageOptions = this.dependencies.transformationCache.getTransformationOptions(
          options,
          TransformationOptionFormat.CF_OBJECT
        ) as Record<string, string | number | boolean>;
      } else {
        // Import dynamically
        const { prepareTransformationOptions } = await import('../utils/transformationUtils');
        cfImageOptions = prepareTransformationOptions(
          options,
          TransformationOptionFormat.CF_OBJECT
        ) as Record<string, string | number | boolean>;
      }

      // Fetch with CF properties
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

      // Get response headers
      const headers = await this.getResponseHeaders(
        response,
        cacheConfig,
        'r2-direct-url-transform'
      );

      // Return the transformed image
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      logger.error('Error in direct URL transformation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl,
        key,
      });

      throw error;
    }
  }
}

/**
 * Interceptor strategy - uses cf.image property with intercepted requests
 */
export class InterceptorStrategy extends BaseTransformationStrategy {
  name = 'interceptor';
  priority = 0; // Highest priority, try first if possible

  canHandle(params: TransformationStrategyParams): boolean {
    const { object, options, request } = params;
    
    // Check if this is a subrequest from Cloudflare image resizing
    const via = request.headers.get('via') || '';
    const isImageResizingSubrequest = via.includes('image-resizing');
    
    // If this is a subrequest, we should return the object directly
    if (isImageResizingSubrequest) {
      return true;
    }
    
    // For regular requests, we can handle if object is available and transformations are needed
    if (!object) return false;

    const hasTransformations = 
      !!options.width || !!options.height || !!options.format || !!options.quality;
      
    return hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    const { key, object, options, cacheConfig, request, bucket } = params;
    const logger = this.getLogger();

    // Check if this is a subrequest from Cloudflare image resizing
    const via = request.headers.get('via') || '';
    const isImageResizingSubrequest = via.includes('image-resizing');

    // If this is a subrequest from the image resizing service
    if (isImageResizingSubrequest) {
      logger.debug('Handling image-resizing subrequest', { key, url: request.url });
      
      // Get the object from R2
      if (!bucket) {
        throw new Error('R2 bucket is required for subrequest handling');
      }

      // For direct R2 paths (no /images/ prefix), the key is the path without leading slash
      // This matches how R2 keys are generally stored
      const url = new URL(request.url);
      const pathname = url.pathname;
      const pathKey = pathname.startsWith('/') ? pathname.substring(1) : pathname;
      
      // Log both keys - our original key and what we extracted from the path
      logger.debug('Image key extraction for subrequest', { 
        originalKey: key,
        pathFromUrl: pathname,
        extractedPathKey: pathKey,
        requestUrl: request.url
      });

      // Use the key extracted from the URL path for subrequests
      // This ensures we get the correct object when Cloudflare makes a subrequest
      const r2Object = await bucket.get(pathKey);
      if (!r2Object) {
        logger.error(`Image not found in R2 bucket: ${pathKey}`);
        throw new R2NotFoundError(`Image not found in R2 bucket: ${pathKey}`, pathKey);
      }
      
      // Prepare headers and return the object directly
      const headers = new Headers();
      r2Object.writeHttpMetadata(headers);
      headers.set('etag', r2Object.httpEtag);
      headers.set('Cache-Control', this.dependencies.cache.determineCacheControl(200, cacheConfig));
      headers.set('X-Source', 'r2-interceptor-subrequest');

      logger.debug('Serving original image for resizing subrequest', {
        originalKey: key,
        usedKey: pathKey,
        contentType: r2Object.httpMetadata?.contentType || 'unknown',
        size: r2Object.size,
        headers: Object.fromEntries([...headers.entries()]),
        url: request.url
      });

      return new Response(r2Object.body, {
        headers,
        status: 200
      });
    }

    // For regular requests, create a request with cf.image properties
    if (!object) {
      throw new Error(`Object is required for interceptor strategy`);
    }

    try {
      // Get CF image options
      let cfImageOptions: Record<string, string | number | boolean>;
      if (this.dependencies.transformationCache) {
        cfImageOptions = this.dependencies.transformationCache.getTransformationOptions(
          options,
          TransformationOptionFormat.CF_OBJECT
        ) as Record<string, string | number | boolean>;
      } else {
        const { prepareTransformationOptions } = await import('../utils/transformationUtils');
        cfImageOptions = prepareTransformationOptions(
          options,
          TransformationOptionFormat.CF_OBJECT
        ) as Record<string, string | number | boolean>;
      }

      logger.debug('Using interceptor strategy with CF properties', { key, options: cfImageOptions });

      // Following the exact Cloudflare example approach
      // Use the current request URL directly
      logger.debug('Sending image transform request', { 
        url: request.url,
        cfOptions: cfImageOptions
      });
      
      // Make the fetch request with CF image properties - use exact URL
      // The key difference here is using request.url instead of modifying it
      const response = await fetch(request.url, {
        cf: {
          image: cfImageOptions,
          cacheEverything: true,
          cacheTtl: cacheConfig.ttl?.ok || 86400,
        }
      });
      
      // Check for errors
      if (!response.ok) {
        // Get response body if available to help with debugging
        let responseText = '';
        try {
          const clonedResponse = response.clone();
          responseText = await clonedResponse.text();
        } catch (e) {
          responseText = 'Could not read response body';
        }
        
        logger.error(`Image transform request failed: ${response.status}`, {
          status: response.status,
          url: request.url,
          responseBody: responseText.substring(0, 500), // Limit size to avoid log bloat
          headers: Object.fromEntries([...response.headers.entries()])
        });
        throw new Error(`Image transform request failed: ${response.status}`);
      }

      // Get response headers and return transformed image
      const headers = await this.getResponseHeaders(
        response,
        cacheConfig,
        'r2-interceptor-transform'
      );

      return new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (error) {
      logger.error('Error in interceptor transformation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
      throw error;
    }
  }
}

/**
 * Remote fallback strategy - last resort if other strategies fail
 */
export class RemoteFallbackStrategy extends BaseTransformationStrategy {
  name = 'remote-fallback';
  priority = 3; // Lowest priority, try last

  canHandle(params: TransformationStrategyParams): boolean {
    // Can handle if fallback URL is available and transformations are needed
    const { fallbackUrl, options } = params;
    if (!fallbackUrl) return false;

    const hasTransformations =
      !!options.width || !!options.height || !!options.format || !!options.quality;

    return hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    const { key, options, request, cacheConfig, fallbackUrl } = params;
    const logger = this.getLogger();

    if (!fallbackUrl) {
      throw new Error('Fallback URL is required for remote fallback strategy');
    }

    try {
      // Get transformed URL
      let remoteUrl: URL;
      if (this.dependencies.transformationCache) {
        remoteUrl = this.dependencies.transformationCache.getTransformationOptions(
          options,
          TransformationOptionFormat.QUERY_PARAMS
        ) as URL;
      } else {
        // Import dynamically
        const { prepareTransformationOptions } = await import('../utils/transformationUtils');
        remoteUrl = prepareTransformationOptions(
          options,
          TransformationOptionFormat.QUERY_PARAMS
        ) as URL;
      }

      // Update pathname
      remoteUrl.pathname = `/${key}`;

      logger.debug('Using remote fallback URL', {
        url: remoteUrl.toString(),
      });

      // Create headers from original request
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
        const value = request.headers.get(headerName);
        if (value) {
          headers.set(headerName, value);
        }
      });

      // Create request
      const remoteRequest = new Request(remoteUrl.toString(), {
        method: 'GET',
        headers,
      });

      // Fetch the image
      const response = await fetch(remoteRequest);

      if (!response.ok) {
        throw new Error(`Remote fallback fetch failed with status: ${response.status}`);
      }

      // Get response headers
      const responseHeaders = await this.getResponseHeaders(
        response,
        cacheConfig,
        'r2-remote-fallback'
      );

      // Return the transformed image
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      logger.error('Error in remote fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackUrl,
        key,
      });

      throw error;
    }
  }
}

/**
 * Workers.dev specific strategy for image transformation
 * This strategy is specifically designed to work around the limitations
 * of Cloudflare Image Resizing on workers.dev domains
 */
export class WorkersDevStrategy extends BaseTransformationStrategy {
  name = 'workers-dev';
  priority = 0; // Highest priority for workers.dev domains

  canHandle(params: TransformationStrategyParams): boolean {
    const { request, bucket, options } = params;
    
    // First check if this is a workers.dev domain
    if (!request) return false;
    
    const isWorkersDevDomain = request.url.includes('workers.dev') || 
                               (request.headers.get('host') || '').includes('workers.dev');
    
    // This strategy is only for workers.dev domains
    if (!isWorkersDevDomain) return false;
    
    // Need a bucket and transformations to work with
    if (!bucket) return false;
    
    // Check if we have transformations to apply
    const hasTransformations =
      !!options.width || !!options.height || !!options.format || !!options.quality;
      
    return hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    const { key, object, options, request, cacheConfig } = params;
    const logger = this.getLogger();

    if (!object) {
      throw new Error('Object is required for workers.dev strategy');
    }

    try {
      logger.debug('Using workers.dev specific transformation strategy', {
        key,
        options,
        url: request.url
      });
      
      // We'll use a hybrid approach for workers.dev domains:
      // 1. First, get the original image from R2
      // 2. Create a custom response with resize/transformation instructions
      // 3. Apply transformations client-side when possible
      
      // Determine content type
      const contentType =
        (object as R2ObjectBody).httpMetadata?.contentType ||
        this.determineContentType(key, 'application/octet-stream');
      
      // Get headers
      const headers = await this.getResponseHeaders(null, cacheConfig, 'r2-workersdev-transform');
      headers.set('Content-Type', contentType);
      
      // Determine output format based on options or accept header
      let outputFormat = options.format || '';
      if (outputFormat === 'auto') {
        // Handle auto format selection based on Accept header
        const accept = request.headers.get('Accept') || '';
        if (accept.includes('image/avif')) {
          outputFormat = 'avif';
        } else if (accept.includes('image/webp')) {
          outputFormat = 'webp'; 
        } else {
          // Default to jpeg/png depending on transparency
          outputFormat = contentType.includes('png') ? 'png' : 'jpeg';
        }
      }
      
      // Add special headers to indicate what transformations were requested
      // These can be used by a middleware or edge function if implemented
      if (options.width) {
        headers.set('X-Image-Width', options.width.toString());
      }
      if (options.height) {
        headers.set('X-Image-Height', options.height.toString());
      }
      if (outputFormat) {
        headers.set('X-Image-Format', outputFormat);
      }
      if (options.quality) {
        headers.set('X-Image-Quality', options.quality.toString());
      }
      if (options.fit) {
        headers.set('X-Image-Fit', options.fit);
      }
      
      // Create response with original image and transformation headers
      return new Response((object as R2ObjectBody).body, {
        headers,
        status: 200,
      });
    } catch (error) {
      logger.error('Error in workers.dev transformation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
      throw error;
    }
  }
}

/**
 * Create the streaming transformation service
 */
export function createStreamingTransformationService(
  dependencies: StreamingTransformationDependencies
): IStreamingTransformationService {
  // Create logger
  const { logger, cache } = dependencies;
  const isStandardLogger = typeof logger.debug === 'function' && logger.debug.length >= 2;
  
  // Define the service name for consistent logging
  const SERVICE_NAME = 'StreamingTransformation';

  // Create a unified logger interface that works with both logger types
  // This will respect the central logging configuration through the underlying logger
  const minimalLogger = {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (isStandardLogger) {
        // Standard logger - we need to pass the module name
        (logger.debug as (module: string, message: string, data?: Record<string, unknown>) => void)(
          SERVICE_NAME,
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
          SERVICE_NAME,
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
          SERVICE_NAME,
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

  // Initialize strategies array
  const strategies: IImageTransformationStrategy[] = dependencies.strategies || [];

  // Register default strategies if none are provided
  if (strategies.length === 0) {
    strategies.push(
      new WorkersDevStrategy(dependencies), // Add the workers.dev specific strategy first
      new InterceptorStrategy(dependencies),
      new DirectServingStrategy(dependencies),
      new CdnCgiStrategy(dependencies),
      new DirectUrlStrategy(dependencies),
      new RemoteFallbackStrategy(dependencies)
    );
  }

  // Sort strategies by priority
  const sortedStrategies = () => [...strategies].sort((a, b) => a.priority - b.priority);

  /**
   * Process an image from R2 with streaming and transformation strategies
   */
  const processR2Image = async (
    r2Key: string,
    r2Bucket: R2Bucket,
    imageOptions: ImageTransformOptions,
    request: Request,
    cacheConfig: CacheConfig,
    fallbackUrl?: string
  ): Promise<Response> => {
    try {
      // Start by fetching the object from R2
      const r2Object = (await r2Bucket.get(r2Key)) as unknown as R2ObjectBody;

      // If object doesn't exist, return 404
      if (r2Object === null) {
        logDebug('Object not found in R2', { key: r2Key });

        const notFoundError = new R2NotFoundError(`Image not found in R2 bucket: ${r2Key}`, r2Key);

        // If errorFactory is available, use it to create a standardized error response
        if (dependencies.errorFactory) {
          const appError = dependencies.errorFactory.createNotFoundError(
            `Image not found: ${r2Key}`
          );
          return dependencies.errorFactory.createErrorResponse(appError);
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

      // Log that we found the object
      logInfo('Successfully retrieved object from R2', {
        key: r2Key,
        size: r2Object.size,
        contentType: r2Object.httpMetadata?.contentType,
      });

      // Create parameters for strategies
      const params: TransformationStrategyParams = {
        key: r2Key,
        bucket: r2Bucket,
        object: r2Object,
        options: imageOptions,
        request,
        cacheConfig,
        fallbackUrl,
      };

      // Track transformation attempts and errors
      const transformationAttempts: string[] = [];
      const errors: Record<string, string> = {};
      
      // Get environment info if available
      let strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: transformationAttempts
      };
      
      // Get domain-specific info if environment service is available
      const { environmentService } = dependencies;
      if (environmentService) {
        const url = request.url;
        const domain = environmentService.getDomain(url);
        const isWorkersDevDomain = environmentService.isWorkersDevDomain(domain);
        const isCustomDomain = environmentService.isCustomDomain(domain);
        const environmentType = environmentService.getEnvironmentForDomain(domain);
        const priorityOrder = environmentService.getStrategyPriorityOrderForUrl(url);
        
        // Store domain and environment info for debug headers
        strategyDiagnostics = {
          ...strategyDiagnostics,
          domainType: isWorkersDevDomain ? 'workers.dev' : (isCustomDomain ? 'custom' : 'other'),
          environmentType,
          isWorkersDevDomain,
          isCustomDomain,
          priorityOrder
        };
        
        // Get enabled/disabled strategies
        const allStrategies = sortedStrategies().map(s => s.name);
        strategyDiagnostics.enabledStrategies = allStrategies.filter(name => 
          environmentService.isStrategyEnabledForUrl(name, url)
        );
        strategyDiagnostics.disabledStrategies = allStrategies.filter(name => 
          !strategyDiagnostics.enabledStrategies!.includes(name)
        );
        
        logDebug('Domain and environment info', {
          domain,
          isWorkersDevDomain,
          isCustomDomain,
          environmentType,
          priorityOrder,
          enabledStrategies: strategyDiagnostics.enabledStrategies,
          disabledStrategies: strategyDiagnostics.disabledStrategies
        });
      }

      // Try each strategy in order of priority
      for (const strategy of sortedStrategies()) {
        try {
          // Skip disabled strategies if environment service is available
          if (environmentService) {
            const isEnabled = environmentService.isStrategyEnabledForUrl(strategy.name, request.url);
            if (!isEnabled) {
              logDebug(`Strategy ${strategy.name} is disabled for this domain, skipping`);
              continue;
            }
          }
          
          // Check if strategy can handle the request with more detailed logging
          const canHandle = strategy.canHandle(params);
          if (!canHandle) {
            // Add more detailed diagnostics for debugging
            const { fallbackUrl, bucket, options } = params;
            const hasTransformations = !!options.width || !!options.height || !!options.format || !!options.quality;
            
            logDebug(`Strategy ${strategy.name} cannot handle this request, skipping`, {
              hasFallbackUrl: !!fallbackUrl,
              hasBucket: !!bucket,
              hasTransformations,
              fallbackUrl: fallbackUrl ? fallbackUrl.substring(0, 30) + '...' : 'undefined', 
              transformOptions: options
            });
            continue;
          }

          transformationAttempts.push(strategy.name);
          logDebug(`Attempting ${strategy.name} transformation`, { key: r2Key });

          // Execute strategy
          const response = await strategy.execute(params);
          
          // Update strategy diagnostics with the selected strategy
          strategyDiagnostics.attemptedStrategies = transformationAttempts;
          strategyDiagnostics.selectedStrategy = strategy.name;
          strategyDiagnostics.failedStrategies = Object.keys(errors).length > 0 ? errors : undefined;
          
          // Get environment type if available
          const currentEnvironment = (environmentService && 'getEnvironmentName' in environmentService) 
            ? environmentService.getEnvironmentName() 
            : undefined;
          
          // Use the centralized debug info from either config or request headers
          const debugOptions = getEnhancedDebugInfo(request, currentEnvironment);
            
          // Add enhanced debug headers if debug is enabled
          if (debugOptions.isEnabled) {
            // Cast the environmentService to IEnvironmentService to handle typings
            const typedEnvironmentService = environmentService as IEnvironmentService | undefined;
            
            // Create a better logging boundary in debug mode
            logger.debug('Strategy execution complete', { 
              selectedStrategy: strategyDiagnostics.selectedStrategy,
              attempts: strategyDiagnostics.attemptedStrategies
            });
            
            // Add enhanced debug headers
            return addEnhancedDebugHeaders(response, debugOptions, strategyDiagnostics, typedEnvironmentService);
          }
          
          return response;
        } catch (error) {
          // Record error and continue to next strategy
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

      // Create content type for direct fallback
      const contentType =
        r2Object.httpMetadata?.contentType ||
        (() => {
          const extension = r2Key.split('.').pop()?.toLowerCase();
          if (!extension) return 'application/octet-stream';

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

          return contentTypeMap[extension] || 'application/octet-stream';
        })();

      // Create headers for the direct fallback response
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', cache.determineCacheControl(200, cacheConfig));
      headers.set('X-Source', 'r2-direct-fallback');

      // Add diagnostic headers
      headers.set('X-Transform-Attempts', transformationAttempts.join(','));
      headers.set('X-Transform-Failed', 'true');
      
      // Update strategy diagnostics for the fallback
      strategyDiagnostics.attemptedStrategies = transformationAttempts;
      strategyDiagnostics.selectedStrategy = 'direct-fallback';
      strategyDiagnostics.failedStrategies = errors;

      // Create response
      let response = new Response((r2Object as R2ObjectBody).body, {
        headers,
        status: 200,
      });
      
      // Get environment type if available
      const currentEnvironment = (environmentService && 'getEnvironmentName' in environmentService) 
        ? environmentService.getEnvironmentName() 
        : undefined;
      
      // Use the centralized debug info from either config or request headers
      const debugOptions = getEnhancedDebugInfo(request, currentEnvironment);
        
      // Add enhanced debug headers if debug is enabled
      if (debugOptions.isEnabled) {
        // Log that we're using direct fallback
        logger.debug('All strategies failed, using direct fallback', {
          attempts: strategyDiagnostics.attemptedStrategies,
          errors: Object.keys(errors).length,
          key: r2Key
        });
        
        // Add enhanced debug headers with type casting for proper type compatibility
        const typedEnvironmentService = environmentService as IEnvironmentService | undefined;
        return addEnhancedDebugHeaders(response, debugOptions, strategyDiagnostics, typedEnvironmentService);
      }
      
      return response;
    } catch (error) {
      // Handle errors fetching from R2
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError('Error processing R2 image', {
        error: errorMessage,
        key: r2Key,
        hasR2Bucket: !!r2Bucket,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Create error diagnostics 
      const strategyDiagnostics: StrategyDiagnostics = {
        attemptedStrategies: [],
        selectedStrategy: 'error',
        failedStrategies: { 'init': errorMessage },
        domainType: dependencies.environmentService ? 
          (dependencies.environmentService.isWorkersDevDomain(dependencies.environmentService.getDomain(request.url)) ? 'workers.dev' : 'custom') : 
          undefined
      };
      
      // Create a response using the error factory or fallback
      let errorResponse;
      if (dependencies.errorFactory) {
        const appError = dependencies.errorFactory.createError(
          'INTERNAL_SERVER_ERROR',
          `Error processing image: ${r2Key}`
        );
        errorResponse = dependencies.errorFactory.createErrorResponse(appError);
      } else {
        // Fallback to basic response
        errorResponse = new Response(`Error processing image from R2: ${errorMessage}`, {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store',
            'X-Error-Source': 'r2-processor',
          },
        });
      }
      
      // Get environment type if available
      const currentEnvironment = (dependencies.environmentService && 'getEnvironmentName' in dependencies.environmentService) 
        ? dependencies.environmentService.getEnvironmentName() 
        : undefined;
      
      // Use the centralized debug info from either config or request headers
      const debugOptions = getEnhancedDebugInfo(request, currentEnvironment);
        
      // Add enhanced debug headers if debug is enabled
      if (debugOptions.isEnabled) {
        // Log the error with full details
        logger.error('Error processing image', {
          error: errorMessage,
          key: r2Key,
          diagnostics: strategyDiagnostics
        });
        
        // Add enhanced debug headers with type casting for proper type compatibility
        const typedEnvironmentService = dependencies.environmentService as IEnvironmentService | undefined;
        return addEnhancedDebugHeaders(errorResponse, debugOptions, strategyDiagnostics, typedEnvironmentService);
      }
      
      return errorResponse;
    }
  };

  // Return the public interface
  return {
    processR2Image,

    registerStrategy: (strategy: IImageTransformationStrategy): void => {
      // Register new strategy, replacing any with the same name
      const index = strategies.findIndex((s) => s.name === strategy.name);
      if (index !== -1) {
        strategies[index] = strategy;
      } else {
        strategies.push(strategy);
      }

      logDebug(`Registered strategy ${strategy.name} with priority ${strategy.priority}`);
    },

    getStrategies: (): IImageTransformationStrategy[] => {
      return sortedStrategies();
    },
  };
}
