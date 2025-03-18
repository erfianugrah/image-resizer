/**
 * Command for transforming images using Cloudflare Image Resizing
 */
import { debug, error } from '../../utils/loggerUtils';
// We will import determineCacheConfig dynamically to avoid stale imports
// import { determineCacheConfig } from '../../utils/cacheUtils';

// Define diagnostics interface to avoid using any
import { DiagnosticsInfo } from '../../types/utils/debug';
import { ImageTransformOptions, ImageTransformContext } from '../../types/services/image';

// Re-export types for backward compatibility
export type { ImageTransformOptions, ImageTransformContext };

/**
 * @deprecated Use DiagnosticsInfo from types/utils/debug.ts
 */
export type DiagnosticsData = DiagnosticsInfo;

// Create a type that includes Record<string, unknown> to fix index signature issues
export type ImageTransformOptionsRecord = ImageTransformOptions & Record<string, unknown>;

export type TransformParamValue = string | number | boolean | null;
export type TransformParams = Record<string, TransformParamValue>;

/**
 * Command dependencies interface
 */
export interface TransformImageCommandDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
  debugService?: {
    addDebugHeaders?: (
      response: Response,
      debugInfo: {
        isEnabled: boolean;
        isVerbose?: boolean;
        includeHeaders?: string[];
        includePerformance?: boolean;
      },
      diagnosticsInfo: Record<string, unknown>
    ) => Response;
  };
  cacheUtils: {
    determineCacheConfig: (url: string) => Promise<{
      cacheability: boolean;
      ttl?: {
        ok: number;
      };
      method?: string;
    }>;
  };
  clientDetection: {
    hasCfDeviceType: (request: Request) => boolean;
    getCfDeviceType: (request: Request) => string;
    hasClientHints: (request: Request) => boolean;
    getDeviceTypeFromUserAgent: (userAgent: string) => string;
    normalizeDeviceType: (deviceType: string) => string;
  };
}

/**
 * Interface for the TransformImageCommand
 */
export interface ITransformImageCommand {
  /**
   * Execute the image transformation
   * @returns A response with the transformed image
   */
  execute(): Promise<Response>;
}

/**
 * Factory function to create a transform image command
 * Pure factory function implementation using closures
 * @param context - Image transformation context
 * @param dependencies - Command dependencies
 * @returns TransformImageCommand implementation
 */
export function createTransformImageCommand(
  context: ImageTransformContext,
  dependencies?: TransformImageCommandDependencies
): ITransformImageCommand {
  // Create private methods and state using closures

  /**
   * Validate the options for image transformation
   */
  const validateOptions = (options: ImageTransformOptions): void => {
    // Define interface for validation configuration
    interface ValidationConfig {
      fit: string[];
      format: string[];
      metadata: string[];
      gravity: string[];
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
      minQuality?: number;
      maxQuality?: number;
    }

    // Access validation config from context
    const config = context.config as Record<string, unknown>;
    const validation = (config.validation as ValidationConfig) || {
      fit: ['scale-down', 'contain', 'cover', 'crop', 'pad'],
      format: ['auto', 'webp', 'avif', 'json', 'jpeg', 'png', 'gif'],
      metadata: ['keep', 'copyright', 'none'],
      gravity: ['auto', 'center', 'top', 'bottom', 'left', 'right', 'face'],
      minWidth: 10,
      maxWidth: 8192,
      minHeight: 10,
      maxHeight: 8192,
      minQuality: 1,
      maxQuality: 100,
    };

    // Validate width
    if (options.width !== null && options.width !== undefined && options.width !== 'auto') {
      const width = Number(options.width);
      const minWidth = validation.minWidth || 10;
      const maxWidth = validation.maxWidth || 8192;

      if (isNaN(width) || width < minWidth || width > maxWidth) {
        throw new Error(`Width must be between ${minWidth} and ${maxWidth} pixels or "auto"`);
      }
    }

    // Validate height
    if (options.height !== null && options.height !== undefined) {
      const minHeight = validation.minHeight || 10;
      const maxHeight = validation.maxHeight || 8192;

      if (options.height < minHeight || options.height > maxHeight) {
        throw new Error(`Height must be between ${minHeight} and ${maxHeight} pixels`);
      }
    }

    // Validate quality
    if (options.quality !== null && options.quality !== undefined) {
      const minQuality = validation.minQuality || 1;
      const maxQuality = validation.maxQuality || 100;

      if (options.quality < minQuality || options.quality > maxQuality) {
        throw new Error(`Quality must be between ${minQuality} and ${maxQuality}`);
      }
    }

    // Validate fit
    const validFit = validation.fit || ['scale-down', 'contain', 'cover', 'crop', 'pad'];
    if (options.fit && !validFit.includes(options.fit)) {
      throw new Error(`Invalid fit: ${options.fit}. Must be one of: ${validFit.join(', ')}`);
    }

    // Validate format
    const validFormats = validation.format || [
      'auto',
      'webp',
      'avif',
      'json',
      'jpeg',
      'png',
      'gif',
    ];
    if (options.format && !validFormats.includes(options.format)) {
      throw new Error(
        `Invalid format: ${options.format}. Must be one of: ${validFormats.join(', ')}`
      );
    }

    // Validate metadata
    const validMetadata = validation.metadata || ['keep', 'copyright', 'none'];
    if (options.metadata && !validMetadata.includes(options.metadata)) {
      throw new Error(
        `Invalid metadata: ${options.metadata}. Must be one of: ${validMetadata.join(', ')}`
      );
    }

    // Validate gravity
    const validGravity = validation.gravity || [
      'auto',
      'center',
      'top',
      'bottom',
      'left',
      'right',
      'face',
    ];
    if (options.gravity && !validGravity.includes(options.gravity)) {
      throw new Error(
        `Invalid gravity: ${options.gravity}. Must be one of: ${validGravity.join(', ')}`
      );
    }
  };

  /**
   * Prepare the Cloudflare image resizing options object
   * Based on main branch implementation in fetchWithImageOptions
   */
  const prepareImageResizingOptions = (
    options: ImageTransformOptions
  ): Record<string, string | number | boolean | null | undefined> => {
    // Create a copy of options for the cf.image object
    // This matches the behavior in the main branch
    const imageOptions = { ...options };

    // Remove non-Cloudflare options
    const nonCloudflareOptions = ['source', 'derivative'];
    nonCloudflareOptions.forEach((opt) => {
      delete imageOptions[opt as keyof typeof imageOptions];
    });

    // Special handling for width=auto since Cloudflare API doesn't support 'auto' directly
    if (imageOptions.width === 'auto') {
      // Use direct import or dependency if available
      const logDebug = dependencies?.logger?.debug || debug;
      logDebug('TransformImageCommand', 'Width=auto detected, not including width parameter', {
        url: context.request.url,
        options: options,
      });
      // Remove the width parameter entirely if it's still 'auto'
      // It should have been converted to a number by imageOptionsService
      delete imageOptions.width;
    }

    // Only include defined parameters
    const resizingOptions: Record<string, string | number | boolean | null | undefined> = {};
    Object.entries(imageOptions).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        resizingOptions[key] = value;
      }
    });

    return resizingOptions;
  };

  /**
   * Determine the appropriate HTTP status code based on the error type
   * @param error The error object
   * @returns Appropriate HTTP status code
   */
  const determineErrorStatusCode = (error: unknown): number => {
    // Default to 500 Internal Server Error
    if (!(error instanceof Error)) {
      return 500;
    }

    // Handle different error types
    if (
      error.message.includes('not found') ||
      error.message.includes('does not exist') ||
      error.message.toLowerCase().includes('404')
    ) {
      return 404;
    }

    if (
      error.message.includes('invalid') ||
      error.message.includes('must be') ||
      error.message.includes('expected')
    ) {
      return 400;
    }

    if (
      error.message.includes('forbidden') ||
      error.message.includes('not authorized') ||
      error.message.toLowerCase().includes('permission')
    ) {
      return 403;
    }

    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 504;
    }

    // Check for custom status code property
    if (
      'statusCode' in error &&
      typeof (error as Record<string, unknown>).statusCode === 'number'
    ) {
      return (error as Record<string, unknown>).statusCode as number;
    }

    // Default to 500 Internal Server Error
    return 500;
  };

  // Return the public interface
  return {
    execute: async (): Promise<Response> => {
      // Start timing for performance measurement
      const startTime = performance.now();

      // Initialize diagnostics information
      const diagnosticsInfo: DiagnosticsData = {
        errors: [],
        warnings: [],
        originalUrl: context.request.url,
      };

      try {
        // Extract context information
        const { request, options } = context;
        const url = new URL(request.url);

        // Validate options
        validateOptions(options);

        // Get client detection functions - either from dependencies or via import
        let clientDetection;
        if (dependencies?.clientDetection) {
          clientDetection = dependencies.clientDetection;
        } else {
          // Import client detection utilities dynamically to avoid circular dependencies
          clientDetection = await import('../../utils/clientDetectionUtils');
        }

        // Get cache configuration using simpler dynamic import approach
        const cacheUtils = dependencies?.cacheUtils || (await import('../../utils/cacheUtils'));

        // Get the ServiceRegistry for direct access
        const { ServiceRegistry } = await import('../../core/serviceRegistry');
        const registry = ServiceRegistry.getInstance();
        const configManager = registry.resolve<any>('IConfigManager');
        const globalConfig = configManager.getConfig();

        // Get logging functions - either from dependencies or global imports
        const logDebug = dependencies?.logger?.debug || debug;
        const logError = dependencies?.logger?.error || error;

        // Log global configuration first
        logDebug('TransformImageCommand', '🔍 DIAGNOSTICS - Before cacheConfig', {
          globalConfigCacheMethod: globalConfig.cache?.method || 'not-set',
          globalConfigEnv: globalConfig.environment,
          envSource: 'ServiceRegistry -> IConfigManager',
        });

        // Now get the cache config
        const cacheConfig = await cacheUtils.determineCacheConfig(url.toString());

        // Log after determineCacheConfig
        logDebug('TransformImageCommand', '🔍 DIAGNOSTICS - After cacheConfig', {
          determinedCacheMethod: cacheConfig.method,
          source: 'determineCacheConfig',
        });

        // Add device information to diagnostics
        const userAgent = request.headers.get('user-agent') || '';

        // Determine device type
        let deviceType = 'desktop';
        if (clientDetection.hasCfDeviceType(request)) {
          const cfDeviceType = clientDetection.getCfDeviceType(request);
          // Ensure cfDeviceType is not null before passing to normalizeDeviceType
          deviceType = clientDetection.normalizeDeviceType(cfDeviceType || 'desktop');
        } else {
          deviceType = clientDetection.getDeviceTypeFromUserAgent(userAgent);
        }

        // Add the options to diagnosticsInfo
        diagnosticsInfo.transformParams = options as Record<
          string,
          string | number | boolean | null | undefined
        >;

        // Add additional diagnostic information
        diagnosticsInfo.deviceType = deviceType;
        diagnosticsInfo.clientHints = clientDetection.hasClientHints(request);
        diagnosticsInfo.cacheability = cacheConfig.cacheability;
        diagnosticsInfo.cacheTtl = cacheConfig.ttl?.ok;
        diagnosticsInfo.cachingMethod = cacheConfig.method;
        diagnosticsInfo.transformSource = options.source;
        diagnosticsInfo.actualWidth = typeof options.width === 'number' ? options.width : undefined;
        diagnosticsInfo.responsiveSizing = options.source?.includes('responsive');
        diagnosticsInfo.pathMatch = context.pathPatterns?.length
          ? context.pathPatterns[0].name
          : undefined;

        // Add environment information for header decision making
        const configObject = context.config as Record<string, unknown>;
        diagnosticsInfo.environment = (configObject?.environment as string) || 'unknown';

        // Use the configured cache method from environment, don't force override
        // The cache method should come from CacheManagementService, which reads from wrangler.jsonc
        const actualCacheMethod = cacheConfig.method;

        // Also update the diagnostics info to show the correct cache method
        diagnosticsInfo.cachingMethod = actualCacheMethod;

        // Simplified logging for cache configuration
        logDebug('TransformImageCommand', 'Cache configuration', {
          url: url.toString(),
          method: actualCacheMethod,
          environment: diagnosticsInfo.environment as string,
        });

        // Set up the image resizing options for Cloudflare
        const imageResizingOptions = prepareImageResizingOptions(options);

        // Fetch the image with resizing options
        let response;
        try {
          // Check if we need to use R2 - adding more comprehensive logging
          // Extract R2 properties from both context and config
          const r2KeyFromContext = context.r2Key;
          const r2KeyFromConfig = (context.config as any)?.r2Key;
          const r2BucketFromContext = context.r2Bucket;
          const r2BucketFromConfig = (context.config as any)?.r2Bucket;
          const isR2FetchFromContext = !!context.isR2Fetch;
          const isR2FetchFromConfig = !!(context.config as any)?.isR2Fetch;

          // Use values from either source, preferring context
          const effectiveR2Key = r2KeyFromContext || r2KeyFromConfig;
          const effectiveR2Bucket = r2BucketFromContext || r2BucketFromConfig;
          const effectiveIsR2Fetch = isR2FetchFromContext || isR2FetchFromConfig;

          logDebug('TransformImageCommand', 'R2 context check - comprehensive', {
            // Context values
            contextR2Key: r2KeyFromContext,
            contextR2Bucket: !!r2BucketFromContext,
            contextIsR2Fetch: isR2FetchFromContext,

            // Config values
            configR2Key: r2KeyFromConfig,
            configR2Bucket: !!r2BucketFromConfig,
            configIsR2Fetch: isR2FetchFromConfig,

            // Effective values
            effectiveR2Key,
            effectiveR2Bucket: !!effectiveR2Bucket,
            effectiveIsR2Fetch,

            // Debug
            configKeys: context.config ? Object.keys(context.config) : [],
          });

          if (effectiveIsR2Fetch && effectiveR2Key && effectiveR2Bucket) {
            logDebug('TransformImageCommand', 'Fetching from R2', {
              key: effectiveR2Key,
              bucket: 'r2',
              bucketExists: !!effectiveR2Bucket,
            });

            try {
              // Fetch the object from R2
              const r2Object = await effectiveR2Bucket.get(effectiveR2Key);

              if (r2Object === null) {
                // Object doesn't exist in R2
                logDebug('TransformImageCommand', 'Object not found in R2', {
                  key: effectiveR2Key,
                });

                // Return a 404 response
                return new Response('Image not found in R2 bucket', {
                  status: 404,
                  headers: {
                    'Content-Type': 'text/plain',
                    'Cache-Control': 'no-store, must-revalidate',
                    'X-Source': 'r2-not-found',
                  },
                });
              }

              // Create a response from the R2 object
              const headers = new Headers();

              // Set content type if available
              if (r2Object.httpMetadata?.contentType) {
                headers.set('Content-Type', r2Object.httpMetadata.contentType);
              } else {
                // Try to guess based on file extension
                const fileExt = effectiveR2Key.split('.').pop()?.toLowerCase();
                if (fileExt === 'jpg' || fileExt === 'jpeg') {
                  headers.set('Content-Type', 'image/jpeg');
                } else if (fileExt === 'png') {
                  headers.set('Content-Type', 'image/png');
                } else if (fileExt === 'gif') {
                  headers.set('Content-Type', 'image/gif');
                } else if (fileExt === 'webp') {
                  headers.set('Content-Type', 'image/webp');
                } else if (fileExt === 'svg') {
                  headers.set('Content-Type', 'image/svg+xml');
                } else {
                  headers.set('Content-Type', 'application/octet-stream');
                }
              }

              // Set caching headers for R2 response
              if (cacheConfig) {
                headers.set('Cache-Control', `public, max-age=${cacheConfig.ttl?.ok || 3600}`);
              }

              // Add source header to show it came from R2
              headers.set('X-Source', 'r2');

              // Create init object for new Response
              const init: ResponseInit = {
                headers,
                status: 200,
              };

              // Create a response with the R2 object body
              const r2Response = new Response(r2Object.body, init);

              // Use CF image resizing on the R2 response - pass it through the standard fetch pipeline
              const cfProperties: Record<string, unknown> = {
                image: imageResizingOptions,
              };

              // Apply cache settings
              if (cacheConfig) {
                // Cast config to access cache properties
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const contextCache = (context.config as Record<string, any>)?.cache || {};

                cfProperties.polish = contextCache.imageCompression || 'off';
                cfProperties.mirage = contextCache.mirage || false;
                cfProperties.cacheEverything = cacheConfig.cacheability || false;
                if (cacheConfig.ttl?.ok) {
                  cfProperties.cacheTtl = cacheConfig.ttl.ok;
                }
              }

              // For Cloudflare Image Resizing with R2 objects, we need to use a different approach
              // Since we already have the R2 object in memory, we can create a new Request with its body
              // and then apply CF Image Resizing on that Request - all within the same worker
                            
              // We need to use a different approach. According to Cloudflare documentation,
              // we can't directly apply image resizing to R2 objects in the same worker.
              // The right approach is to:
              // 1. Use a public URL for the R2 bucket if available
              // 2. Alternatively, serve the image directly with custom properties
              
              logDebug('TransformImageCommand', 'R2 image processing', {
                cf: JSON.stringify(cfProperties),
                method: actualCacheMethod,
                originalUrl: request.url,
                r2Key: effectiveR2Key
              });
              
              try {
                // First approach: Create a direct R2 response as fallback
                const r2Response = new Response(r2Object.body, {
                  headers: new Headers({
                    'Content-Type': headers.get('Content-Type') || 'image/jpeg',
                    'Cache-Control': `public, max-age=${cacheConfig.ttl?.ok || 3600}`,
                    'X-Source': 'r2-direct',
                  })
                });
                
                // Try the two-step approach: create a URL to another worker that can resize
                // Get the fallback bucket or a direct URL we can use
                const fallbackUrl = (context.config as any)?.fallbackBucket || 'https://cdn.erfianugrah.com';
                // Use the fallback URL with the key
                const resizableUrl = `${fallbackUrl}/${effectiveR2Key}`;
                
                // Log that we're trying the external URL approach
                logDebug('TransformImageCommand', 'Trying external URL image resizing', {
                  resizableUrl,
                  imageOptions: JSON.stringify(imageResizingOptions)
                });
                
                // Create a new URL for the worker itself with query parameters for transformation
                const transformUrl = new URL(request.url);
                
                // Create a request to this URL that Cloudflare can access
                const imageRequest = new Request(resizableUrl, {
                  method: 'GET',
                  // Don't copy all headers to avoid issues
                  headers: new Headers({
                    'Accept': 'image/*,*/*',
                    'User-Agent': request.headers.get('User-Agent') || 'CloudflareWorker',
                    'X-Resizing-Source': 'r2-fallback'
                  })
                });
                
                // Prepare detailed CF options object to ensure image resizing works
                const cfOptions: any = {
                  // Explicitly structure the image options to match CF's expectations
                  image: {
                    // Ensure required fields are present
                    width: typeof options.width === 'number' ? options.width : 768,
                    height: typeof options.height === 'number' ? options.height : undefined,
                    fit: options.fit || 'contain',
                    quality: typeof options.quality === 'number' ? options.quality : 85,
                    format: options.format || 'auto',
                    metadata: options.metadata || 'none',
                    
                    // Add any additional options that might be in imageResizingOptions
                    ...imageResizingOptions
                  },
                  // Add standard CF caching properties
                  polish: 'off',
                  mirage: false,
                  cacheEverything: true,
                  cacheTtl: cacheConfig.ttl?.ok || 86400
                };
                
                // Log the exact CF options for debugging
                logDebug('TransformImageCommand', 'Applying CF image options', {
                  cfOptions: JSON.stringify(cfOptions),
                  url: resizableUrl
                });
                
                // Attempt to resize the image via a remote URL with precise CF options
                const remoteResponse = await fetch(imageRequest, { cf: cfOptions });
                
                if (remoteResponse.ok) {
                  // Check if resizing was actually applied by checking headers or content length
                  const wasCfResized = remoteResponse.headers.has('cf-resized') || 
                                       (r2Object.size && remoteResponse.headers.get('content-length') && 
                                       parseInt(remoteResponse.headers.get('content-length') || '0', 10) < r2Object.size);
                  
                  logDebug('TransformImageCommand', 'Remote URL resizing result', {
                    resized: wasCfResized,
                    originalSize: r2Object.size,
                    responseSize: remoteResponse.headers.get('content-length'),
                    hasCfResizedHeader: remoteResponse.headers.has('cf-resized'),
                    headers: Object.fromEntries(remoteResponse.headers.entries())
                  });
                  
                  if (wasCfResized) {
                    // If remote resize worked, use that response
                    logDebug('TransformImageCommand', 'Successfully used remote URL for resizing');
                    
                    // Create a new response with our headers
                    const newHeaders = new Headers(remoteResponse.headers);
                    newHeaders.set('X-Source', 'r2-fallback-resized');
                    newHeaders.set('Cache-Control', `public, max-age=${cacheConfig.ttl?.ok || 3600}`);
                    
                    response = new Response(remoteResponse.body, {
                      status: remoteResponse.status,
                      headers: newHeaders
                    });
                  } else {
                    // Remote fetch worked but no resizing was applied
                    logDebug('TransformImageCommand', 'Remote fetch successful but no resizing applied', {
                      fallback: 'Falling back to direct R2 response'
                    });
                    
                    // Try one more approach with explicit CF image processing
                    try {
                      // IMPORTANT: For this approach, we'll try with and without URL parameters
                      // Some versions of Cloudflare's image processing may use different approaches
                      const baseUrl = new URL(fallbackUrl);
                      baseUrl.pathname = `/${effectiveR2Key}`;
                      
                      logDebug('TransformImageCommand', 'Trying direct URL transformation with CF properties only', {
                        url: baseUrl.toString()
                      });
                      
                      // Create a request object with no URL parameters but use CF properties
                      const directRequest = new Request(baseUrl.toString(), {
                        headers: new Headers({
                          'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*',
                          'User-Agent': request.headers.get('User-Agent') || 'Cloudflare-Worker'
                        })
                      });
                      
                      // Create directly compatible CF image object
                      const directImageOptions: any = {
                        // Be very explicit about the structure
                        width: typeof options.width === 'number' ? options.width : 768,
                        height: typeof options.height === 'number' ? options.height : undefined,
                        fit: options.fit || 'contain',
                        quality: typeof options.quality === 'number' ? options.quality : 85,
                        format: options.format || 'auto',
                        metadata: options.metadata || 'none'
                      };
                      
                      // Apply CF properties explicitly in the fetch
                      logDebug('TransformImageCommand', 'Using direct CF image properties', {
                        directImageOptions: JSON.stringify(directImageOptions)
                      });
                      
                      const directResponse = await fetch(directRequest, {
                        cf: {
                          image: directImageOptions,
                          polish: 'off',
                          mirage: false,
                          cacheEverything: true,
                          cacheTtl: cacheConfig.ttl?.ok || 86400
                        } as any // Type cast to avoid TypeScript errors with Cloudflare types
                      });
                      
                      if (directResponse.ok && 
                          (directResponse.headers.has('cf-resized') || 
                          parseInt(directResponse.headers.get('content-length') || '0', 10) < r2Object.size)) {
                        
                        logDebug('TransformImageCommand', 'Direct URL transformation successful');
                        
                        const directHeaders = new Headers(directResponse.headers);
                        directHeaders.set('X-Source', 'r2-direct-url-transform');
                        directHeaders.set('Cache-Control', `public, max-age=${cacheConfig.ttl?.ok || 3600}`);
                        
                        response = new Response(directResponse.body, {
                          status: directResponse.status,
                          headers: directHeaders
                        });
                      } else {
                        // As a last resort for R2 objects, try the Cloudflare proxy URL format
                        // This format is known to work reliably with Cloudflare Image Resizing
                        try {
                          // Create a URL with /cdn-cgi/image/ prefix which Cloudflare recognizes for image resizing
                          const cfProxyUrl = new URL(fallbackUrl);
                          const proxyOptions = [];
                          
                          const width = typeof options.width === 'number' ? options.width : 768;
                          proxyOptions.push(`width=${width}`);
                          
                          if (options.height && typeof options.height === 'number') {
                            proxyOptions.push(`height=${options.height}`);
                          }
                          if (options.fit && typeof options.fit === 'string') {
                            proxyOptions.push(`fit=${options.fit}`);
                          }
                          if (options.quality && typeof options.quality === 'number') {
                            proxyOptions.push(`quality=${options.quality}`);
                          }
                          if (options.format && typeof options.format === 'string') {
                            proxyOptions.push(`format=${options.format}`);
                          }
                          
                          // Construct the Cloudflare Image Resizing URL format
                          cfProxyUrl.pathname = `/cdn-cgi/image/${proxyOptions.join(',')}/${effectiveR2Key}`;
                          
                          logDebug('TransformImageCommand', 'Trying Cloudflare proxy URL as last resort for R2', {
                            url: cfProxyUrl.toString()
                          });
                          
                          const proxyResponse = await fetch(cfProxyUrl.toString());
                          
                          if (proxyResponse.ok && 
                              (proxyResponse.headers.has('cf-resized') || 
                              parseInt(proxyResponse.headers.get('content-length') || '0', 10) < r2Object.size)) {
                            
                            logDebug('TransformImageCommand', 'Cloudflare proxy transformation successful');
                            
                            const proxyHeaders = new Headers(proxyResponse.headers);
                            proxyHeaders.set('X-Source', 'r2-cf-proxy-transform');
                            proxyHeaders.set('Cache-Control', `public, max-age=${cacheConfig.ttl?.ok || 3600}`);
                            
                            response = new Response(proxyResponse.body, {
                              status: proxyResponse.status,
                              headers: proxyHeaders
                            });
                          } else {
                            // Finally fall back to direct R2 response if all approaches fail
                            logDebug('TransformImageCommand', 'All resize approaches failed, using direct R2 response');
                            response = r2Response;
                          }
                        } catch (proxyError) {
                          logDebug('TransformImageCommand', 'Error in Cloudflare proxy transformation', {
                            error: proxyError instanceof Error ? proxyError.message : 'Unknown error'
                          });
                          // Fall back to direct R2 response
                          response = r2Response;
                        }
                      }
                    } catch (transformError) {
                      logDebug('TransformImageCommand', 'Error in direct URL transformation', {
                        error: transformError instanceof Error ? transformError.message : 'Unknown error'
                      });
                      // Fall back to direct R2 response
                      response = r2Response;
                    }
                  }
                } else {
                  // If remote resize failed, use the direct R2 response
                  logDebug('TransformImageCommand', 'Remote resize failed, using direct R2', {
                    status: remoteResponse.status
                  });
                  
                  // Fall back to direct R2 response
                  response = r2Response;
                }
              } catch (error) {
                // If there was an error in the remote approach, return direct R2
                logDebug('TransformImageCommand', 'Error in remote resize, using direct R2', {
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
                
                // Create a direct R2 response
                response = new Response(r2Object.body, {
                  headers: new Headers({
                    'Content-Type': headers.get('Content-Type') || 'image/jpeg',
                    'Cache-Control': `public, max-age=${cacheConfig.ttl?.ok || 3600}`,
                    'X-Source': 'r2-direct-error-fallback',
                  })
                });
              }

              logDebug('TransformImageCommand', 'R2 image processed', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
              });
            } catch (r2Error) {
              logError('TransformImageCommand', 'Error fetching from R2', {
                error: r2Error instanceof Error ? r2Error.message : 'Unknown R2 error',
                stack: r2Error instanceof Error ? r2Error.stack : undefined,
                key: effectiveR2Key,
                isR2BucketValid: typeof effectiveR2Bucket?.get === 'function',
              });

              // Continue with standard fetch if R2 fails
              logDebug('TransformImageCommand', 'Falling back to standard fetch after R2 error', {
                url: request.url,
                fallbackToRemote: true,
                error: r2Error instanceof Error ? r2Error.message : 'Unknown R2 error',
              });
            }
          }

          // If we don't have a response yet (not using R2 or R2 failed), use standard fetch
          if (!response) {
            // Create request options for fetch
            const cfProperties: Record<string, unknown> = {
              image: imageResizingOptions,
            };

            // Use the cache config we loaded from the environment
            if (cacheConfig) {
              // Cast config to access cache properties
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const contextCache = (context.config as Record<string, any>)?.cache || {};

              // Use consistent settings for all environments
              cfProperties.polish = contextCache.imageCompression || 'off';
              cfProperties.mirage = contextCache.mirage || false;
              cfProperties.cacheEverything = cacheConfig.cacheability || false;
              if (cacheConfig.ttl?.ok) {
                cfProperties.cacheTtl = cacheConfig.ttl.ok;
              }
            }

            // Create fetch options
            const fetchOptions: RequestInit = {
              cf: cfProperties,
            };

            // Log the fetch options for debugging
            logDebug('TransformImageCommand', 'Fetch options with CF object', {
              cf: JSON.stringify(cfProperties),
              method: actualCacheMethod,
              requestUrl: request.url,
            });

            // Perform the fetch with enhanced options
            response = await fetch(request, fetchOptions);

            // Log details about the response for debugging
            logDebug('TransformImageCommand', 'Image fetch response', {
              url: request.url,
              status: response.status,
              statusText: response.statusText,
              headers: Object.fromEntries(response.headers.entries()),
            });
          }
        } catch (fetchErr) {
          // Enhanced error handling
          logError('TransformImageCommand', 'Error fetching image', {
            error: fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error',
            stack: fetchErr instanceof Error ? fetchErr.stack : undefined,
          });

          // Rethrow to be handled by outer try/catch
          throw fetchErr;
        }

        // Calculate processing time
        diagnosticsInfo.processingTimeMs = Math.round(performance.now() - startTime);

        // Add processing mode
        diagnosticsInfo.processingMode = context.debugInfo?.deploymentMode || 'default';

        // Add debug headers if debug is enabled
        if (context.debugInfo?.isEnabled) {
          // Use the debug service from dependencies or import dynamically
          if (dependencies?.debugService && dependencies.debugService.addDebugHeaders) {
            return dependencies.debugService.addDebugHeaders(
              response,
              context.debugInfo,
              diagnosticsInfo
            );
          } else {
            // Use the centralized logger utils for debug headers (legacy approach)
            const { addDebugHeaders } = await import('../../utils/loggerUtils');

            // Debug log to show what headers will be added
            logDebug('TransformImageCommand', 'Adding debug headers', {
              diagnostics: Object.fromEntries(
                Object.entries(diagnosticsInfo).filter(([_, value]) => value !== undefined)
              ),
            });

            return addDebugHeaders(response, context.debugInfo, diagnosticsInfo);
          }
        }

        return response;
      } catch (err: unknown) {
        // Get logging functions
        const logError = dependencies?.logger?.error || error;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorStack = err instanceof Error ? err.stack : undefined;
        const errorType = err instanceof Error ? err.constructor.name : 'UnknownError';
        const statusCode = determineErrorStatusCode(err);

        logError('TransformImageCommand', 'Error transforming image', {
          error: errorMessage,
          stack: errorStack,
          errorType,
          statusCode,
          url: context.request.url,
        });

        // Add error to diagnostics
        if (!Array.isArray(diagnosticsInfo.errors)) {
          diagnosticsInfo.errors = [];
        }
        diagnosticsInfo.errors.push(errorMessage);

        // Calculate processing time
        diagnosticsInfo.processingTimeMs = Math.round(performance.now() - startTime);

        // Create enhanced error response with proper status code
        const errorResponse = new Response(`Error transforming image: ${errorMessage}`, {
          status: statusCode,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store, must-revalidate',
            'X-Error-Type': errorType,
          },
        });

        return errorResponse;
      }
    },
  };
}

/**
 * Command class for transforming image URLs
 * @deprecated Use the createTransformImageCommand factory function instead
 */
export class TransformImageCommand implements ITransformImageCommand {
  private context: ImageTransformContext;
  private dependencies?: TransformImageCommandDependencies;
  private commandImpl: ITransformImageCommand;

  constructor(context: ImageTransformContext, dependencies?: TransformImageCommandDependencies) {
    this.context = context;
    this.dependencies = dependencies;
    this.commandImpl = createTransformImageCommand(context, dependencies);
  }

  /**
   * Execute the image transformation
   * @returns A response with the transformed image
   */
  async execute(): Promise<Response> {
    // Delegate to the factory implementation
    return this.commandImpl.execute();
  }
}
