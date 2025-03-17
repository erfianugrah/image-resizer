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
        const cacheUtils = dependencies?.cacheUtils || await import('../../utils/cacheUtils');
        const cacheConfig = await cacheUtils.determineCacheConfig(url.toString());

        // Get logging functions - either from dependencies or global imports
        const logDebug = dependencies?.logger?.debug || debug;
        const logError = dependencies?.logger?.error || error;

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
        
        // Force cache method to 'cf' in production - ensure consistency with actual behavior
        const actualCacheMethod = diagnosticsInfo.environment === 'production' 
          ? 'cf' 
          : (cacheConfig.method || 'default');
        
        // Also update the diagnostics info to show the correct cache method
        diagnosticsInfo.cachingMethod = actualCacheMethod;

        // Simplified logging for cache configuration
        logDebug('TransformImageCommand', 'Cache configuration', {
          url: url.toString(),
          method: actualCacheMethod,
          environment: diagnosticsInfo.environment as string
        });

        // Set up the image resizing options for Cloudflare
        const imageResizingOptions = prepareImageResizingOptions(options);

        // Fetch the image with resizing options - match main branch behavior
        let response;
        try {
          // Create request options for fetch
          const cfProperties: Record<string, unknown> = {
            image: imageResizingOptions,
          };

          // Use the cache config we loaded from the environment, not just context
          // Use the cache config we loaded from the environment
          if (cacheConfig) {
            // Force environment-specific settings in production
            if (diagnosticsInfo.environment === 'production') {
              // Cast config to access cache properties
              const cacheConfig = (context.config as Record<string, any>)?.cache || {};
              
              // Add CF-specific cache properties for production
              cfProperties.polish = cacheConfig.imageCompression || 'off';
              cfProperties.mirage = cacheConfig.mirage || false;
              cfProperties.cacheEverything = true;
              cfProperties.cacheTtl = cacheConfig.ttl?.ok || 31536000; // 1 year default
            } else {
              // Cast config to access cache properties
              const contextCache = (context.config as Record<string, any>)?.cache || {};
              
              // Use standard settings for non-production environments
              cfProperties.polish = contextCache.imageCompression || 'off';
              cfProperties.mirage = contextCache.mirage || false;
              cfProperties.cacheEverything = cacheConfig.cacheability || false;
              if (cacheConfig.ttl?.ok) {
                cfProperties.cacheTtl = cacheConfig.ttl.ok;
              }
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
            requestUrl: request.url
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
        } catch (fetchErr) {
          // Enhanced error handling matching the main branch
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
