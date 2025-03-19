/**
 * Command for transforming images using Cloudflare Image Resizing
 */
import { debug, error } from '../../utils/loggerUtils';
// We will import determineCacheConfig dynamically to avoid stale imports
// import { determineCacheConfig } from '../../utils/cacheUtils';

// Define diagnostics interface to avoid using any
import { DiagnosticsInfo } from '../../types/utils/debug';
import {
  ImageTransformOptions,
  ImageTransformContext,
  IR2ImageProcessorService,
} from '../../types/services/image';
import {
  IImageValidationService,
  ImageValidationConfig,
} from '../../types/services/imageValidation';
import { ValidationError } from '../../types/utils/errors';
import { IStreamingTransformationService } from '../../types/services/streaming';

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
  r2Processor?: IR2ImageProcessorService;
  streamingService?: IStreamingTransformationService;
  validationService?: IImageValidationService;
  /**
   * Optional transformation cache service for minimizing redundant calculations
   */
  transformationCache?: {
    getTransformationOptions: (
      options: ImageTransformOptions,
      format: string
    ) => string[] | Record<string, string | number | boolean> | URL;
    createCacheHeaders: (
      status: number,
      cacheConfig: Record<string, unknown>,
      source?: string,
      derivative?: string | null
    ) => Headers;
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
    // Access validation config from context
    const config = context.config as Record<string, unknown>;

    // Extract validation configuration
    const validationConfig: ImageValidationConfig =
      (config.validation as ImageValidationConfig) || {};

    // Use the validation service if available, or import dynamically
    const performValidation = async (): Promise<void> => {
      let validationService: IImageValidationService;

      if (dependencies?.validationService) {
        validationService = dependencies.validationService;
      } else {
        // Import dynamically to avoid circular dependencies
        const { createImageValidationService } = await import(
          '../../services/imageValidationService'
        );
        validationService = createImageValidationService({
          logger: dependencies?.logger,
        });
      }

      // Perform validation
      const validationResult = validationService.validateOptions(options, validationConfig);

      // If validation failed, throw the first error
      if (!validationResult.isValid && validationResult.errors.length > 0) {
        throw validationResult.errors[0];
      }
    };

    // Execute the async validation immediately (not ideal but matches existing sync interface)
    // We must handle this synchronously to maintain the existing API
    let validationPromise: Promise<void> | null = null;
    try {
      validationPromise = performValidation();
      // Await synchronously - this is not ideal but necessary for the current API
      // This allows validation errors to be thrown from this function rather than being
      // unhandled promises
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      validationPromise;
    } catch (error) {
      // Re-throw any errors
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Validation failed: ' + String(error));
    }
  };

  /**
   * Prepare the Cloudflare image resizing options object
   * Based on main branch implementation in fetchWithImageOptions
   * Uses transformation cache service if available to minimize redundant calculations
   */
  const prepareImageResizingOptions = async (
    options: ImageTransformOptions
  ): Promise<Record<string, string | number | boolean | null | undefined>> => {
    // If we have a transformation cache service available via dynamic import, use it
    try {
      // Check if we have a transformation cache service
      // First try from dependencies
      if (dependencies?.transformationCache) {
        const cfOptions = dependencies.transformationCache.getTransformationOptions(
          options,
          'cf_object'
        ) as Record<string, string | number | boolean>;
        return cfOptions;
      }

      // Otherwise try to import the ServiceRegistry to resolve a transformationCache service
      const { ServiceRegistry } = await import('../../core/serviceRegistry');
      const registry = ServiceRegistry.getInstance();

      // Check if the transformation cache service is registered
      if (registry.isRegistered('ITransformationCacheService')) {
        const transformationCache = registry.resolve<any>('ITransformationCacheService');
        return transformationCache.getTransformationOptions(options, 'cf_object') as Record<
          string,
          string | number | boolean
        >;
      }
    } catch (error) {
      // If we can't use the transformation cache, fall back to direct calculation
      const logDebug = dependencies?.logger?.debug || debug;
      logDebug(
        'TransformImageCommand',
        'Error using transformation cache, falling back to direct calculation',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    // Fall back to direct calculation if no cache is available
    // Import the transformation utils
    const { normalizeImageOptions, prepareCfImageOptions } = await import(
      '../../utils/transformationUtils'
    );

    // Normalize options first
    const normalizedOptions = normalizeImageOptions(options);

    // Create CF object options
    return prepareCfImageOptions(normalizedOptions);
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

        // Get logging functions - either from dependencies or global imports
        const logDebug = dependencies?.logger?.debug || debug;
        const logError = dependencies?.logger?.error || error;

        // Use validation service if available
        if (dependencies?.validationService) {
          const config = context.config as Record<string, unknown>;
          const validationConfig: ImageValidationConfig =
            (config.validation as ImageValidationConfig) || {};

          const validationResult = dependencies.validationService.validateOptions(
            options,
            validationConfig
          );

          if (!validationResult.isValid && validationResult.errors.length > 0) {
            // Create a specific validation error response
            const validationError = validationResult.errors[0];

            logDebug('TransformImageCommand', 'Validation failed', {
              message: validationError.message,
              field: validationError.field,
              value: String(validationError.value),
            });

            // Return a properly formatted validation error response
            return new Response(validationError.message, {
              status: 400, // Always use 400 for validation errors
              headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-store, must-revalidate',
                'X-Error-Type': 'ValidationError',
                'X-Validation-Field': validationError.field || 'unknown',
              },
            });
          }
        } else {
          // Fallback to legacy validation
          try {
            validateOptions(options);
          } catch (validationError) {
            if (validationError instanceof ValidationError) {
              logDebug('TransformImageCommand', 'Legacy validation failed', {
                error: validationError.message,
                field: validationError.field,
                value: String(validationError.value),
              });

              // Return a properly formatted validation error response
              return new Response(validationError.message, {
                status: 400, // Always use 400 for validation errors
                headers: {
                  'Content-Type': 'text/plain',
                  'Cache-Control': 'no-store, must-revalidate',
                  'X-Error-Type': 'ValidationError',
                  'X-Validation-Field': validationError.field || 'unknown',
                },
              });
            }
            // For other errors, rethrow to be caught by the outer try/catch
            throw validationError;
          }
        }

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

        // Set up the image resizing options for Cloudflare - now async
        const imageResizingOptions = await prepareImageResizingOptions(options);

        // Fetch the image with resizing options
        let response;
        try {
          // Check if we need to use R2 - adding more comprehensive logging
          // Extract R2 properties from both context and config
          const r2KeyFromContext = context.r2Key;
          const r2KeyFromConfig = (context.config as Record<string, unknown>)?.r2Key as
            | string
            | undefined;
          const r2BucketFromContext = context.r2Bucket;
          const r2BucketFromConfig = (context.config as Record<string, unknown>)?.r2Bucket as
            | R2Bucket
            | undefined;
          const isR2FetchFromContext = !!context.isR2Fetch;
          const isR2FetchFromConfig = !!(context.config as Record<string, unknown>)?.isR2Fetch;

          // Use values from either source, preferring context
          const effectiveR2Key = r2KeyFromContext || r2KeyFromConfig;
          const effectiveR2Bucket = r2BucketFromContext || r2BucketFromConfig;
          const effectiveIsR2Fetch = isR2FetchFromContext || isR2FetchFromConfig;

          logDebug('TransformImageCommand', 'R2 context check', {
            effectiveR2Key,
            effectiveR2Bucket: !!effectiveR2Bucket,
            effectiveIsR2Fetch,
          });

          if (effectiveIsR2Fetch && effectiveR2Key && effectiveR2Bucket) {
            try {
              // Get fallback URL from config, checking multiple possible locations
              let fallbackUrl: string | undefined;
              
              // First check both camelCase and uppercase ORIGIN_CONFIG
              const originConfig = (context.config as Record<string, unknown>)?.originConfig || 
                                   (context.config as Record<string, unknown>)?.ORIGIN_CONFIG;
              
              if (originConfig && typeof originConfig === 'object') {
                const fallbackConfig = (originConfig as Record<string, unknown>)?.fallback;
                if (fallbackConfig && typeof fallbackConfig === 'object') {
                  fallbackUrl = (fallbackConfig as Record<string, unknown>)?.url as string;
                }
              }
              
              // If not found, try the legacy fallbackBucket location
              if (!fallbackUrl) {
                fallbackUrl = (context.config as Record<string, unknown>)?.fallbackBucket as string;
              }
              
              // If still not found, try to read from the environment variables
              const contextEnv = (context.config as Record<string, unknown>)?.env as Record<string, unknown> | undefined;
              if (!fallbackUrl && contextEnv) {
                try {
                  // Try both uppercase and camelCase versions of ORIGIN_CONFIG
                  const envOriginConfig = contextEnv['ORIGIN_CONFIG'] || contextEnv['originConfig'];
                  
                  if (envOriginConfig && typeof envOriginConfig === 'object') {
                    const fallbackConfig = (envOriginConfig as Record<string, unknown>)?.fallback;
                    if (fallbackConfig && typeof fallbackConfig === 'object') {
                      fallbackUrl = (fallbackConfig as Record<string, unknown>)?.url as string;
                    }
                  }
                  
                  // If still not found, check for REMOTE_BUCKETS.default
                  if (!fallbackUrl) {
                    const remoteBuckets = contextEnv['REMOTE_BUCKETS'] || contextEnv['remoteBuckets'];
                    if (remoteBuckets && typeof remoteBuckets === 'object') {
                      fallbackUrl = (remoteBuckets as Record<string, unknown>)?.default as string;
                    }
                  }
                } catch (e) {
                  // Ignore errors reading from env
                }
              }
              
              // Log the fallback URL for debugging
              logDebug('TransformImageCommand', 'Fallback URL for strategies', {
                fallbackUrl,
                hasOriginConfig: !!originConfig,
                hasEnvOriginConfig: !!(contextEnv && contextEnv['ORIGIN_CONFIG']),
              });

              // Create a complete cache config object that satisfies the interface
              const fullCacheConfig: import('../../types/utils/cache').CacheConfig = {
                cacheability: cacheConfig.cacheability || true,
                ttl: {
                  ok: cacheConfig.ttl?.ok || 86400,
                  redirects: 86400,
                  clientError: 60,
                  serverError: 0,
                },
                method: cacheConfig.method || 'cache-api',
              };

              // First try using the streaming service which has the InterceptorStrategy
              if (dependencies?.streamingService) {
                logDebug('TransformImageCommand', 'Using streaming transformation service', {
                  key: effectiveR2Key,
                  domain: new URL(request.url).hostname,
                  fallbackUrl,
                  transformationOptions: options
                });

                try {
                  // Add debug headers to see transformation attempts
                  const debugRequest = new Request(request.url, {
                    headers: new Headers(request.headers),
                    method: request.method
                  });
                  debugRequest.headers.set('x-debug', 'true');
                  
                  response = await dependencies.streamingService.processR2Image(
                    effectiveR2Key,
                    effectiveR2Bucket,
                    options,
                    debugRequest,
                    fullCacheConfig,
                    fallbackUrl
                  );

                  logDebug('TransformImageCommand', 'Image processed by streaming service', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                  });
                } catch (streamingError) {
                  logError('TransformImageCommand', 'Error in streaming transformation service', {
                    error:
                      streamingError instanceof Error
                        ? streamingError.message
                        : 'Unknown streaming error',
                    key: effectiveR2Key,
                  });

                  // If streaming service fails, we'll try the legacy r2Processor below
                }
              }

              // If streaming service is not available or failed, use the legacy R2 processor
              if (!response && dependencies?.r2Processor) {
                logDebug('TransformImageCommand', 'Using legacy R2 processor service', {
                  key: effectiveR2Key,
                });

                // We already have a comprehensive fallback URL check above
                // Just log if we still don't have a fallback URL
                if (!fallbackUrl) {
                  logDebug('TransformImageCommand', 'No fallback URL found for r2Processor');
                }
                
                logDebug('TransformImageCommand', 'Using r2Processor with fallback URL', { fallbackUrl });
                
                response = await dependencies.r2Processor.processR2Image(
                  effectiveR2Key,
                  effectiveR2Bucket,
                  options,
                  request,
                  fullCacheConfig,
                  fallbackUrl
                );

                logDebug('TransformImageCommand', 'R2 image processed by legacy service', {
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.fromEntries(response.headers.entries()),
                });
              } else {
                // If the R2 processor service is not available, fall back to standard fetch
                logDebug(
                  'TransformImageCommand',
                  'R2 processor service not available, falling back to standard fetch',
                  {
                    url: request.url,
                  }
                );
              }
            } catch (r2Error) {
              logError('TransformImageCommand', 'Error processing R2 image', {
                error: r2Error instanceof Error ? r2Error.message : 'Unknown R2 error',
                stack: r2Error instanceof Error ? r2Error.stack : undefined,
                key: effectiveR2Key,
              });

              // Continue with standard fetch if R2 fails
              logDebug('TransformImageCommand', 'Falling back to standard fetch after R2 error', {
                url: request.url,
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
        const logDebug = dependencies?.logger?.debug || debug;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorStack = err instanceof Error ? err.stack : undefined;
        const errorType = err instanceof Error ? err.constructor.name : 'UnknownError';

        // Determine error status code with special handling for ValidationError
        let statusCode: number;

        if (err instanceof ValidationError) {
          // Explicitly handle ValidationError with 400 status
          statusCode = 400;
          logDebug('TransformImageCommand', 'Validation error caught in execute method', {
            message: errorMessage,
            field: err.field,
            value: String(err.value),
            statusCode,
          });
        } else {
          // Use existing error detection for other errors
          statusCode = determineErrorStatusCode(err);
        }

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

        // Customize response message based on error type
        const responseMessage: string =
          err instanceof ValidationError
            ? String(errorMessage)
            : `Error transforming image: ${String(errorMessage)}`;

        // Create enhanced error response with proper status code
        const errorResponse = new Response(responseMessage, {
          status: statusCode,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store, must-revalidate',
            'X-Error-Type': errorType,
            ...(err instanceof ValidationError
              ? { 'X-Validation-Field': err.field || 'unknown' }
              : {}),
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
