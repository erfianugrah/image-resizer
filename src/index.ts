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

// Import new service interfaces - use dynamic imports to avoid build errors if files don't exist yet
// These will be properly imported when the services are registered
import { createConfigurationService } from './services/configurationService';
import { createEnvironmentService } from './services/environmentService';
let IContentTypeUtils: any;
let IStrategyRegistry: any;
let IErrorFactory: any;
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
import { createR2ImageProcessorService } from './services/r2ImageProcessorService';
import { createImageValidationService } from './services/imageValidationService';
import { createTransformationCacheService } from './services/transformationCacheService';
import { createResponseHeadersBuilder } from './utils/headersBuilder';
import { createStreamingTransformationService } from './services/streamingTransformationService';

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

  // Register the minimal logger service
  registry.register('IMinimalLogger', {
    factory: (deps, params) => {
      const factory = deps.ILoggerFactory;
      // Use the module name provided as a parameter, or default to 'Service'
      const moduleName = params?.moduleName || 'Service';
      return factory.createMinimalLogger(moduleName);
    },
    lifecycle: 'transient', // Create a new instance each time with different module name
    dependencies: ['ILoggerFactory'],
  });

  // Create a main logger instance directly (needed for bootstrapping)
  const mainLogger = createLogger('ImageResizer');

  // -------------------- Begin Configuration Services --------------------

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

  // Register the new ConfigurationService
  try {
    // Import the new configuration service
    const { createConfigurationService } = require('./services/configurationService');
    
    registry.register('IConfigurationService', {
      factory: (deps) => {
        const logger = deps.ILogger;
        const configService = createConfigurationService({ logger });
        configService.initialize(env);
        return configService;
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger'],
    });
  } catch (error) {
    mainLogger.warn('ServiceRegistry', 'Could not register ConfigurationService', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // -------------------- Begin Error Handling Services --------------------

  // Register the ErrorFactory service
  try {
    // Import the error factory
    const { createErrorFactory } = require('./errors/appErrors');
    
    registry.register('IErrorFactory', {
      factory: (deps) => {
        const logger = deps.ILogger;
        return createErrorFactory({ logger });
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger'],
    });
  } catch (error) {
    mainLogger.warn('ServiceRegistry', 'Could not register ErrorFactory', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // -------------------- Begin Environment Services --------------------

  // Register the EnvironmentService
  try {
    // Import the environment service
    const { createEnvironmentService } = require('./services/environmentService');
    
    registry.register('IEnvironmentService', {
      factory: (deps) => {
        const logger = deps.ILogger;
        // Use the new configuration service if available, fallback to legacy config
        const configService = deps.IConfigurationService || {
          getEnvironment: () => deps.IConfigManager.getConfig().environment,
          getStrategyConfig: () => ({ priorityOrder: ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback'] }),
          isStrategyEnabled: () => true,
          getDomainConfig: () => undefined,
        };
        
        return createEnvironmentService({ 
          logger,
          configService,
        });
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger', 'IConfigManager', 'IConfigurationService'],
      // IConfigurationService is required but will gracefully fallback if not available
    });
  } catch (error) {
    mainLogger.warn('ServiceRegistry', 'Could not register EnvironmentService', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // -------------------- Begin Utility Services --------------------

  // Register the ContentTypeUtils service
  try {
    // Import the content type utilities
    const { createContentTypeUtils } = require('./utils/contentTypeUtils');
    
    registry.register('IContentTypeUtils', {
      factory: (deps) => {
        const logger = deps.ILogger;
        return createContentTypeUtils({ logger });
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger'],
    });
  } catch (error) {
    mainLogger.warn('ServiceRegistry', 'Could not register ContentTypeUtils', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // -------------------- Begin Strategy Services --------------------

  // Register the StrategyRegistry
  try {
    // Import the strategy registry
    const { createStrategyRegistry } = require('./services/strategyRegistry');
    
    registry.register('IStrategyRegistry', {
      factory: (deps) => {
        const logger = deps.ILogger;
        
        // Use the environment service if available
        const configService = deps.IConfigurationService || deps.IEnvironmentService || {
          getEnvironment: () => deps.IConfigManager.getConfig().environment,
          getStrategyConfig: () => ({ priorityOrder: ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback'] }),
          isStrategyEnabled: () => true,
        };
        
        return createStrategyRegistry({ 
          logger,
          configService,
        });
      },
      lifecycle: 'singleton',
      dependencies: ['ILogger', 'IConfigManager', 'IConfigurationService', 'IEnvironmentService'],
      // These dependencies are marked as required but will gracefully fallback if not available
    });
  } catch (error) {
    mainLogger.warn('ServiceRegistry', 'Could not register StrategyRegistry', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

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

  // Register ImageValidationService
  registry.register('IImageValidationService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const errorFactory = deps.IErrorFactory;

      return createImageValidationService({
        logger: {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
        },
        errorFactory: errorFactory
          ? {
              createValidationError: errorFactory.createValidationError,
            }
          : undefined,
      });
    },
    lifecycle: 'singleton',
    // Make IErrorFactory optional
    dependencies: ['ILogger'],
  });

  // Register TransformationCacheService
  registry.register('ITransformationCacheService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const cacheService = deps.ICacheManagementService;

      // Get config for cache settings
      const configManager = deps.IConfigManager;
      const config = configManager.getConfig();

      // Extract cache configuration from config if available
      const cacheConfig = {
        maxSize: config.caching?.transformationCache?.maxSize || 200,
        ttl: config.caching?.transformationCache?.ttl || 60000, // 1 minute
        enabled: config.caching?.transformationCache?.enabled !== false, // Default to true
        maxHeadersCacheSize: config.caching?.transformationCache?.maxHeadersCacheSize || 100,
      };

      return createTransformationCacheService(
        {
          logger: {
            debug: (module, message, data) => logger.debug(module, message, data),
            error: (module, message, data) => logger.error(module, message, data),
          },
          cache: cacheService
            ? {
                determineCacheControl: (status, cacheConfig, source, derivative) => {
                  // Use the cache service to determine cache control
                  const response = new Response('');
                  const headeredResponse = cacheService.applyCacheHeaders(
                    response,
                    status,
                    cacheConfig as any,
                    source,
                    derivative || undefined
                  );
                  return headeredResponse.headers.get('Cache-Control') || '';
                },
                generateCacheTags: (source, derivative) => {
                  return cacheService.generateCacheTags(
                    source || undefined,
                    derivative || undefined
                  );
                },
              }
            : undefined,
        },
        cacheConfig
      );
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger', 'ICacheManagementService', 'IConfigManager'],
  });

  // Register ResponseHeadersBuilder factory
  registry.register('IResponseHeadersBuilder', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;

      // Create a function that returns a new builder instance
      return {
        create: () => {
          return createResponseHeadersBuilder({
            logger: {
              debug: (module, message, data) => logger.debug(module, message, data),
            },
          });
        },
      };
    },
    lifecycle: 'singleton',
    dependencies: ['ILogger'],
  });

  // Register R2 Image Processor Service
  registry.register('IR2ImageProcessorService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const cacheService = deps.ICacheManagementService;
      const formatUtils = deps.IFormatUtils;
      const errorFactory = deps.IErrorFactory;
      const transformationCache = deps.ITransformationCacheService;

      // Use minimal logger for simpler dependency
      const minimalLogger = deps.IMinimalLogger;

      return createR2ImageProcessorService({
        // Use the minimal logger if available, otherwise use the legacy logger pattern
        logger: minimalLogger || {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
          info: (module, message, data) => logger.info(module, message, data),
        },
        cache: {
          determineCacheControl: (status, cacheConfig) => {
            if (cacheService && cacheService.applyCacheHeaders) {
              // Use the cache service to determine cache control
              const response = new Response('');
              const headeredResponse = cacheService.applyCacheHeaders(
                response,
                status,
                cacheConfig
              );
              return headeredResponse.headers.get('Cache-Control') || '';
            }

            // Fallback cache control determination
            if (status >= 200 && status < 300 && cacheConfig?.cacheability) {
              return `public, max-age=${cacheConfig.ttl?.ok || 86400}`;
            }
            return 'no-store';
          },
        },
        formatUtils: formatUtils
          ? {
              getBestSupportedFormat: formatUtils.getBestSupportedFormat,
            }
          : undefined,
        errorFactory: errorFactory
          ? {
              createError: errorFactory.createError,
              createNotFoundError: errorFactory.createNotFoundError,
              createErrorResponse: errorFactory.createErrorResponse,
            }
          : undefined,
        // Add the transformation cache service if available
        transformationCache: transformationCache
          ? {
              getPreparedTransformation: transformationCache.getPreparedTransformation,
              getTransformationOptions: transformationCache.getTransformationOptions,
              createCacheHeaders: transformationCache.createCacheHeaders,
            }
          : undefined,
      });
    },
    lifecycle: 'singleton',
    // Make ITransformationCacheService optional by not including it in required dependencies
    dependencies: ['ILogger', 'ICacheManagementService', 'IFormatUtils'],
    // Resolve the minimal logger with the right module name
    parameters: { moduleName: 'R2ImageProcessor' },
  });

  // Register StreamingTransformationService
  registry.register('IStreamingTransformationService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const transformationCache = deps.ITransformationCacheService;
      const environmentService = deps.IEnvironmentService;

      // Use minimal logger for simpler dependency
      const minimalLogger = deps.IMinimalLogger;

      // Try to get the cache service
      const cache = deps.ICacheManagementService || {
        determineCacheControl: (status: number) => {
          return status === 200 ? 'public, max-age=86400' : 'no-store';
        },
      };

      return createStreamingTransformationService({
        // Use the minimal logger if available, otherwise use the legacy logger pattern
        logger: minimalLogger || {
          debug: (module, message, data) => logger.debug(module, message, data),
          error: (module, message, data) => logger.error(module, message, data),
        },
        // Add cache dependency
        cache,
        // Add the transformation cache service if available
        transformationCache: transformationCache
          ? {
              getTransformationOptions: transformationCache.getTransformationOptions,
              createCacheHeaders: transformationCache.createCacheHeaders,
            }
          : undefined,
        // Add the environment service if available
        environmentService: environmentService
          ? {
              isWorkersDevDomain: environmentService.isWorkersDevDomain,
              isCustomDomain: environmentService.isCustomDomain,
              getDomain: environmentService.getDomain,
              getEnvironmentForDomain: environmentService.getEnvironmentForDomain,
              getRouteConfigForUrl: environmentService.getRouteConfigForUrl,
              getStrategyPriorityOrderForUrl: environmentService.getStrategyPriorityOrderForUrl,
              isStrategyEnabledForUrl: environmentService.isStrategyEnabledForUrl,
            }
          : undefined,
      });
    },
    lifecycle: 'singleton',
    // Make optional dependencies not required in the dependencies array
    dependencies: ['ILogger', 'IEnvironmentService'],
    // Resolve the minimal logger with the right module name
    parameters: { moduleName: 'StreamingTransformation' },
  });

  // Register the image processing service
  registry.register('IImageProcessingService', {
    factory: (deps) => {
      const logger = deps.ILogger as ILogger;
      const clientDetectionUtils = deps.IClientDetectionUtils;
      const r2Processor = deps.IR2ImageProcessorService;
      const validationService = deps.IImageValidationService;
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
        // Pass the R2 processor service if available
        r2Processor,
      });
    },
    lifecycle: 'scoped',
    // Add dependency on R2 processor and validation service
    dependencies: [
      'ILogger',
      'IClientDetectionUtils',
      'IR2ImageProcessorService',
      'IImageValidationService',
    ],
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
        // We need to handle Cloudflare's image-resizing subrequests differently
        const isViaImageResizing = (headers: Headers) => /image-resizing/.test(headers.get('via') || '');
        
        // Check if request has width=auto parameter - main branch forces these to be processed
        const url = new URL(request.url);
        const hasWidthAuto =
          url.searchParams.has('width') && url.searchParams.get('width') === 'auto';

        // Check if request has a known image extension
        let hasImageExtension = false;
        
        // Try to use ContentTypeUtils if available
        try {
          const contentTypeUtils = registry.resolve<any>('IContentTypeUtils');
          if (contentTypeUtils && typeof contentTypeUtils.isImageFile === 'function') {
            hasImageExtension = contentTypeUtils.isImageFile(url.pathname);
          } else {
            // Fallback to regex approach
            hasImageExtension = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(url.pathname);
          }
        } catch (error) {
          // Fallback to regex approach
          hasImageExtension = /\.(jpe?g|png|gif|webp|avif|svg|bmp)$/i.test(url.pathname);
        }

        // Check if request Accept header indicates it's an image request
        const acceptHeader = request.headers.get('Accept') || '';
        const isImageRequest = acceptHeader.includes('image/');

        // Special handling for image-resizing subrequests
        // We DO NOT skip these because our interceptor strategy needs to handle them
        // But we'll use the via header to detect and handle them appropriately
        const isImageResizingSubrequest = isViaImageResizing(request.headers);
        
        // Use the EnvironmentService to determine domain-specific behavior if available
        let isEnvironmentSpecificSkip = false;
        try {
          const environmentService = registry.resolve<any>('IEnvironmentService');
          if (environmentService) {
            // For workers.dev domains in development, we might need special handling
            const isDevelopmentWorkersDomain = 
              environmentService.isDevelopment() && 
              url.hostname.includes('workers.dev');
            
            // For now, we don't need to skip anything
            isEnvironmentSpecificSkip = false;
            
            // Log domain-specific information
            logger.debug('Worker', 'Environment-specific request processing', {
              domain: url.hostname,
              isDevelopmentWorkersDomain,
              isImageResizingSubrequest,
            });
          }
        } catch (error) {
          // Unable to use environment service, fall back to basic logic
          logger.debug('Worker', 'Could not use EnvironmentService', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        
        // We skip processing only if:
        // 1. This is a loop-prevention case but NOT a Cloudflare image-resizing subrequest, OR
        // 2. We have specific environment rules that require skipping
        const isOtherLoopRequest = false; // Disable other loop detection for now to let interceptor work
        const shouldSkip = (isOtherLoopRequest && !hasWidthAuto) || isEnvironmentSpecificSkip;

        // Get domain-specific environment information
        let environmentInfo: Record<string, unknown> = {
          configured: config.environment || 'unknown',
        };
        
        try {
          const environmentService = registry.resolve<any>('IEnvironmentService');
          const strategyRegistry = registry.resolve<any>('IStrategyRegistry');
          
          if (environmentService) {
            // Get domain-specific environment
            const domainEnvironment = environmentService.getEnvironmentName();
            
            // Get strategy information
            const priorityOrder = environmentService.getStrategyPriorityOrderForUrl(url.toString());
            
            // Get enabled strategies if available
            const availableStrategies = strategyRegistry ? 
              strategyRegistry.getStrategies().map((s: { name: string }) => s.name) : [];
              
            const isInterceptorEnabled = environmentService.isStrategyEnabledForUrl('interceptor', url.toString());
            const isCdnCgiEnabled = environmentService.isStrategyEnabledForUrl('cdn-cgi', url.toString());
            
            // Add to environment info
            environmentInfo = {
              ...environmentInfo,
              detected: domainEnvironment,
              domain: url.hostname,
              isDevelopment: environmentService.isDevelopment(),
              isProduction: environmentService.isProduction(),
              strategyPriority: priorityOrder,
              availableStrategies,
              isInterceptorEnabled,
              isCdnCgiEnabled,
              isWorkersDev: url.hostname.includes('workers.dev'),
            };
          }
        } catch (error) {
          // Log if environment service isn't available
          logger.warn('Worker', 'Error getting environment details', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        
        // Log more details about request and config for debugging
        logger.info('Worker', 'Processing request', {
          url: request.url,
          mode: config.mode,
          shouldSkip,
          hasWidthAuto,
          hasImageExtension,
          isImageRequest,
          isImageResizingSubrequest,
          environment: environmentInfo,
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
