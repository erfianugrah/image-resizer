/**
 * Image Resizer Worker
 *
 * This worker transforms image requests by using Cloudflare Image Resizing
 * to deliver optimized images with various transformations.
 *
 * - Run `npm run dev` to start a development server
 * - Run `npm run deploy` to publish your worker
 */

import { handleImageRequest } from './handlers/imageHandler';
import { initializeLogging } from './utils/loggingManager';
import { error, info, addDebugHeaders } from './utils/loggerUtils';
import { ConfigurationManager, createConfigManager } from './config/configManager';
import { createConfigValidator } from './config/configValidator';
import { ServiceRegistry, createServiceRegistry } from './core/serviceRegistry';
import { IServiceRegistry } from './types/core/serviceRegistry';
import { LoggerFactory, createLogger, createLoggerFactory } from './core/logger';
import { ILogger } from './types/core/logger';
import { IConfigManager } from './types/core/config';
import { createCacheManagementService } from './services/cacheManagementService';
import { createDebugService } from './services/debugService';
import { createImageOptionsService } from './handlers/imageOptionsService';
import { createImageTransformationService } from './services/imageTransformationService';
import { createImageProcessingService } from './services/imageProcessingService';
import { buildCacheKey, determineCacheControl, generateCacheTags } from './utils/cacheUtils';
import { hasClientHints } from './utils/clientHints';
import { hasCfDeviceType } from './utils/deviceUtils';
import { getDeviceTypeFromUserAgent } from './utils/userAgentUtils';
import { extractImageParams } from './utils/urlParamUtils';
import { snapToBreakpoint } from './utils/responsiveWidthUtils';
import { createImageOptionsFactory } from './utils/optionsFactory';
import { imageConfig } from './config/imageConfig';
// Import factory functions for utilities
import { createPathUtils } from './utils/pathUtils';
import { createUrlParamUtils } from './utils/urlParamUtils';
import { createUrlTransformUtils } from './utils/urlTransformUtils';
import { createClientDetectionUtils } from './utils/clientDetectionUtils';
import { createFormatUtils } from './utils/formatUtils';
import { createValidationUtils } from './utils/validationUtils';

// Flag to track if initialization is complete
let isInitialized = false;

/**
 * Initialize and register all services with the ServiceRegistry
 * @param env - Environment variables
 * @returns The initialized service registry
 */
function initializeServiceRegistry(env: Record<string, unknown>): IServiceRegistry {
  // Get the service registry using the factory function
  // This will automatically set the global registry instance
  const registry = createServiceRegistry();

  // Also register it for backward compatibility
  registry.register('ServiceRegistry', {
    factory: () => ServiceRegistry.getInstance(),
    lifecycle: 'singleton',
  });

  // Create a logger factory using the factory function
  const loggerFactory = createLoggerFactory();

  // Register the logger factory using the factory pattern
  registry.register('ILoggerFactory', {
    factory: () => loggerFactory,
    lifecycle: 'singleton',
  });

  // Register the legacy logger factory for backward compatibility
  registry.register('LoggerFactory', {
    factory: () => LoggerFactory.getInstance(),
    lifecycle: 'singleton',
  });

  // Register the logger service
  registry.register('ILogger', {
    factory: (deps) => {
      const factory = deps.ILoggerFactory;
      return factory.createLogger('ImageResizer');
    },
    lifecycle: 'singleton',
    dependencies: ['ILoggerFactory'],
  });

  // Create a main logger instance directly (needed for bootstrapping)
  const mainLogger = createLogger('ImageResizer');

  // Register the old configuration manager for backward compatibility first
  // because other services might depend on it
  registry.register('ConfigurationManager', {
    factory: () => {
      const configManager = ConfigurationManager.getInstance();
      configManager.initialize(env);
      return configManager;
    },
    lifecycle: 'singleton',
  });

  // Register the configuration manager using the factory pattern
  registry.register('IConfigManager', {
    factory: () => {
      const configManager = createConfigManager({
        logger: mainLogger,
      });
      configManager.initialize(env);
      return configManager;
    },
    lifecycle: 'singleton',
  });

  // Register the configuration validator
  registry.register('IConfigValidator', {
    factory: () => createConfigValidator({ logger: mainLogger }),
    lifecycle: 'singleton',
  });

  // -------------------- Begin Path and URL Utils Registration --------------------

  // Register PathUtils
  registry.register('IPathUtils', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      return createPathUtils({
        logger: logger,
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger'],
  });

  // Register UrlParamUtils
  registry.register('IUrlParamUtils', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      return createUrlParamUtils({
        logger: logger,
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger'],
  });

  // Register UrlTransformUtils with dependencies on other utils
  registry.register('IUrlTransformUtils', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const pathUtils = deps.IPathUtils;
      const urlParamUtils = deps.IUrlParamUtils;

      return createUrlTransformUtils({
        logger: logger,
        pathUtils,
        urlParamUtils,
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IPathUtils', 'IUrlParamUtils'],
  });

  // Register ClientDetectionUtils
  registry.register('IClientDetectionUtils', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;

      return createClientDetectionUtils({
        logger: logger,
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger'],
  });

  // Register FormatUtils with dependency on ClientDetectionUtils
  registry.register('IFormatUtils', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const clientDetectionUtils = deps.IClientDetectionUtils;

      return createFormatUtils({
        logger: logger,
        clientDetectionUtils,
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IClientDetectionUtils'],
  });

  // Register ValidationUtils with dependency on configManager
  registry.register('IValidationUtils', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const configManager = deps.IConfigManager;

      return createValidationUtils({
        logger: logger,
        configProvider: {
          getConfig: () => configManager.getConfig(),
        },
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'IConfigManager'],
  });

  // -------------------- End Path and URL Utils Registration --------------------

  // Register the cache management service
  registry.register('ICacheManagementService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const configManager = deps.ConfigurationManager;

      // Use new configManager if available, fallback to old one
      const configManagerService = deps.IConfigManager || configManager;

      return createCacheManagementService({
        logger: {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
        },
        config: {
          getConfig: () => {
            const appConfig = configManagerService.getConfig();
            return {
              // Pass both properties for compatibility
              cache: appConfig.cache,
              caching: appConfig.cache, // Keep this for backward compatibility
              environment: appConfig.environment,
            };
          },
        },
        utils: {
          buildCacheKey,
          determineCacheControl,
          generateCacheTags,
        },
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'ConfigurationManager', 'IConfigManager'],
  });

  // Register the debug service
  registry.register('IDebugService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;

      return createDebugService({
        logger: {
          debug: (module, message, data) => logger.debug(module, message, data),
        },
      });
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger'],
  });

  // Register the image options service
  registry.register('IImageOptionsService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const configManager = deps.ConfigurationManager;
      const newConfigManager = deps.IConfigManager;
      const config = (newConfigManager || configManager).getConfig();
      // Use client detection utilities if registered
      const clientDetectionUtils = deps.IClientDetectionUtils;

      return createImageOptionsService({
        logger: {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
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
        clientDetection: clientDetectionUtils || {
          hasClientHints,
          getViewportWidth: (request: Request) => {
            // Simple implementation just for type compatibility
            const viewport = request.headers.get('viewport-width');
            return viewport ? parseInt(viewport, 10) : null;
          },
          getDevicePixelRatio: (request: Request) => {
            // Simple implementation just for type compatibility
            const dpr = request.headers.get('dpr');
            return dpr ? parseFloat(dpr) : null;
          },
          hasCfDeviceType,
          getDeviceInfo: (deviceType: string) => {
            // Simple implementation just for type compatibility
            return {
              type: deviceType,
              width: deviceType === 'mobile' ? 480 : deviceType === 'tablet' ? 768 : 1440,
            };
          },
          getDeviceTypeFromUserAgent,
        },
        urlUtils: {
          extractImageParams,
          snapToBreakpoint,
        },
        optionsFactory: {
          create: (factoryConfig) => {
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
    },
    lifecycle: 'scoped',
    // Make IClientDetectionUtils optional
    dependencies: ['ILogger', 'ConfigurationManager', 'IConfigManager'],
  });

  // Register the image transformation service
  registry.register('IImageTransformationService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const cacheService = deps.ICacheManagementService;
      const formatUtils = deps.IFormatUtils;
      const urlTransformUtils = deps.IUrlTransformUtils;

      return createImageTransformationService({
        logger: {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
          logResponse: (module, response) => logger.logResponse(module, response),
        },
        cache: {
          getCachedResponse: cacheService ? cacheService.getCachedResponse : async () => null,
          cacheResponse: cacheService ? cacheService.cacheResponse : async () => false,
          applyCacheHeaders: cacheService ? cacheService.applyCacheHeaders : (response) => response,
        },
        formatUtils,
        urlTransformUtils,
      });
    },
    lifecycle: 'scoped',
    // Only require ILogger as mandatory dependency
    dependencies: ['ILogger'],
  });

  // Register the image processing service
  registry.register('IImageProcessingService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const clientDetectionUtils = deps.IClientDetectionUtils;
      // These dependencies may be used in the future
      const _validationUtils = deps.IValidationUtils;
      const _pathUtils = deps.IPathUtils;

      return createImageProcessingService({
        logger: {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
          info: (module, message, data) => logger.info(module, message, data),
          logResponse: (module, response) => logger.logResponse(module, response),
        },
        debug: {
          addDebugHeaders,
        },
        cache: {
          generateCacheTags,
        },
        utils: {
          getResponsiveWidth: clientDetectionUtils
            ? (request: Request, breakpoints: number[]) => {
                const result = clientDetectionUtils.getResponsiveWidth(request, breakpoints);
                return { width: result.width, source: result.source };
              }
            : (request: Request, breakpoints: number[]) => {
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
              },
        },
        config: {
          getImageConfig: () => imageConfig,
        },
      });
    },
    lifecycle: 'scoped',
    // Only depend on logger to avoid circular dependencies
    dependencies: ['ILogger'],
  });

  // Return the initialized registry
  return registry;
}

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    _ctx: ExecutionContext
  ): Promise<Response> {
    try {
      // Initialize configuration and services if not already done
      if (!isInitialized) {
        try {
          // Initialize the service registry first
          initializeServiceRegistry(env);

          // Initialize logging using our centralized manager
          initializeLogging(env);

          // Get the config manager from the ServiceRegistry
          const registry = ServiceRegistry.getInstance();
          const configManager = registry.resolve<IConfigManager>('IConfigManager');
          const config = configManager.getConfig();

          const missingConfig = [];
          if (!config.cache?.method) missingConfig.push('CACHE_METHOD');
          if (!config.derivatives || Object.keys(config.derivatives).length === 0)
            missingConfig.push('DERIVATIVE_TEMPLATES');
          if (!config.responsive?.availableWidths?.length) missingConfig.push('RESPONSIVE_CONFIG');

          if (missingConfig.length > 0) {
            error(
              'Worker',
              `⚠️ WARNING: Missing critical environment configuration: ${missingConfig.join(', ')}. Check wrangler.jsonc`
            );
          }

          info(
            'Worker',
            `Initialized image-resizer v${config.version} in ${config.mode} mode with ${config.cache?.method || 'UNDEFINED'} caching`
          );

          // Only set initialized to true if all the steps completed without error
          isInitialized = true;
        } catch (initError) {
          error('Worker', 'Error during initialization', {
            error: initError instanceof Error ? initError.message : 'Unknown error',
            stack: initError instanceof Error ? initError.stack : undefined,
          });
          // Don't set isInitialized to true, so we'll try again next request
          throw initError;
        }
      }

      // Create a request scope
      const registry = ServiceRegistry.getInstance();
      const scope = registry.createScope();

      try {
        // Get dependencies from the registry
        const configManager = registry.resolve<IConfigManager>('IConfigManager');
        const config = configManager.getConfig();
        const logger = registry.resolve<ILogger>('ILogger');

        // Log incoming request at debug level
        logger.logRequest('Request', request);

        // Define patterns to skip resizing
        // We skip only if this is a request from another image-resizing worker (prevent infinite loops)
        const skipPatterns = [
          (headers: Headers) => /image-resizing/.test(headers.get('via') || ''),
        ];

        // Check if request has width=auto parameter - main branch forces these to be processed
        const url = new URL(request.url);
        const hasWidthAuto =
          url.searchParams.has('width') && url.searchParams.get('width') === 'auto';

        // Check if request has a known image extension
        const hasImageExtension = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(url.pathname);

        // Check if request Accept header indicates it's an image request
        const acceptHeader = request.headers.get('Accept') || '';
        const isImageRequest = acceptHeader.includes('image/');

        // We skip processing only if:
        // 1. This is a loop-prevention case (image-resizing in via header), AND
        // 2. It's not a width=auto request (which should always be processed)
        const isLoopRequest = skipPatterns.some((pattern) => pattern(request.headers));
        const shouldSkip = isLoopRequest && !hasWidthAuto;

        // Log more details about request and config for debugging
        logger.info('Worker', 'Processing request', {
          url: request.url,
          mode: config.mode,
          shouldSkip,
          hasWidthAuto,
          hasImageExtension,
          isImageRequest,
          isLoopRequest,
          headers: {
            accept: request.headers.get('Accept'),
            referer: request.headers.get('Referer'),
            userAgent: request.headers.get('User-Agent'),
            via: request.headers.get('Via'),
          },
        });

        // Process the request if it shouldn't be skipped
        if (!shouldSkip) {
          try {
            // Pass full config and environment to the handler
            return await handleImageRequest(request, config, env);
          } catch (handlerError) {
            logger.error('Worker', 'Error in image handler', {
              error: handlerError instanceof Error ? handlerError.message : 'Unknown error',
              stack: handlerError instanceof Error ? handlerError.stack : undefined,
            });
            // Rethrow to be caught by the outer try/catch
            throw handlerError;
          }
        }

        logger.info('Worker', 'Skipping image processing, passing through request');
        return fetch(request); // pass-through and continue
      } finally {
        // Dispose of the request scope
        registry.disposeScope(scope);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;

      error('Worker', 'Unexpected error in worker', {
        error: errorMessage,
        stack: errorStack,
      });

      return new Response('An unexpected error occurred', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  },
};
