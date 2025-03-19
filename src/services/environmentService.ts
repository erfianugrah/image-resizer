/**
 * Environment Service
 * 
 * Provides domain-specific configuration and strategy selection
 */
import {
  IEnvironmentService,
  EnvironmentServiceDependencies,
  EnvironmentType,
  RouteConfig
} from '../types/services/environment';

/**
 * Create an environment service
 * @param dependencies Dependencies for the environment service
 * @returns Environment service instance
 */
export function createEnvironmentService(
  dependencies: EnvironmentServiceDependencies
): IEnvironmentService {
  const { logger, configService } = dependencies;
  
  // Define domain patterns
  const WORKERS_DEV_PATTERN = /^[a-z0-9-]+\.([a-z0-9-]+\.)?workers\.dev$/i;
  const ERFI_DEV_PATTERN = /^(.*\.)?erfi\.dev$/i;
  
  // Cache for route configurations
  const routeConfigCache = new Map<string, RouteConfig>();
  
  /**
   * Get domain from URL or string
   */
  const getDomain = (url: string | URL): string => {
    if (typeof url === 'string') {
      try {
        return new URL(url).hostname;
      } catch (e) {
        // If URL parsing fails, assume it's already a domain
        return url.includes('://') ? url.split('://')[1].split('/')[0] : url;
      }
    }
    return url.hostname;
  };
  
  /**
   * Check if a domain is a workers.dev domain
   */
  const isWorkersDevDomain = (domain: string): boolean => {
    return WORKERS_DEV_PATTERN.test(domain);
  };
  
  /**
   * Check if a domain is a custom domain (not workers.dev)
   */
  const isCustomDomain = (domain: string): boolean => {
    return !isWorkersDevDomain(domain) && domain.includes('.');
  };
  
  /**
   * Get environment type for a domain
   */
  const getEnvironmentForDomain = (domain: string): EnvironmentType => {
    // Check if it's a workers.dev domain
    if (isWorkersDevDomain(domain)) {
      return 'development';
    }
    
    // Check if it's staging
    if (domain.startsWith('staging.')) {
      return 'staging';
    }
    
    // Check if it's a test domain
    if (domain.startsWith('test.')) {
      return 'test';
    }
    
    // Default to production for custom domains
    return 'production';
  };
  
  /**
   * Load route configurations from centralized app config
   */
  const loadRouteConfigurations = (): RouteConfig[] => {
    try {
      // Use the configService to get the image resizer configuration
      const config = configService.getConfig();
      
      // Check for our new property first
      if (config.imageResizerConfig && (config.imageResizerConfig as any).routes) {
        return (config.imageResizerConfig as any).routes;
      }
      
      // For backward compatibility, try global config if needed
      // But this approach should be considered deprecated
      try {
        const globalConfig = (global as any).__WRANGLER_CONFIG__;
        
        // First check the "vars.IMAGE_RESIZER_CONFIG" location
        if (globalConfig?.vars?.IMAGE_RESIZER_CONFIG?.routes) {
          logger.warn('EnvironmentService', 'Using deprecated __WRANGLER_CONFIG__ direct access');
          return globalConfig.vars.IMAGE_RESIZER_CONFIG.routes;
        }
        
        // For backward compatibility, check the old location
        if (globalConfig?.imageResizer?.routes) {
          logger.warn('EnvironmentService', 'Using deprecated __WRANGLER_CONFIG__ direct access');
          return globalConfig.imageResizer.routes;
        }
      } catch (err) {
        // Ignore errors from global config access, it's a fallback approach
      }
      
      // If not available, log and return empty array
      logger.debug('EnvironmentService', 'No route configurations found');
      return [];
    } catch (error) {
      logger.error('EnvironmentService', 'Error loading route configurations', { error });
      return [];
    }
  };
  
  /**
   * Get route configuration for a URL
   */
  const getRouteConfigForUrl = (url: string | URL): RouteConfig => {
    const domain = getDomain(url);
    
    // Check if we have a cached config for this domain
    if (routeConfigCache.has(domain)) {
      return routeConfigCache.get(domain)!;
    }
    
    // Load route configurations if not already loaded
    const routes = loadRouteConfigurations();
    
    // Check each route pattern for a match
    for (const route of routes) {
      const pattern = route.pattern;
      
      // Simple wildcard matching (convert *.example.com/* to regex)
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      
      const regex = new RegExp(`^${regexPattern}$`);
      
      // If the domain matches the pattern, cache and return the config
      if (regex.test(domain) || regex.test(`${domain}/`)) {
        logger.debug('EnvironmentService', 'Found matching route config', { 
          domain, 
          pattern,
          config: route 
        });
        
        // Cache the result for next time
        routeConfigCache.set(domain, route);
        return route;
      }
    }
    
    // If no match found, return a default configuration
    const defaultConfig: RouteConfig = {
      pattern: '*',
      environment: getEnvironmentForDomain(domain)
    };
    
    // If configService is available, get strategy config from there
    if (configService) {
      try {
        const strategyConfig = configService.getStrategyConfig();
        defaultConfig.strategies = strategyConfig;
      } catch (error) {
        logger.error('EnvironmentService', 'Error getting strategy config', { error });
      }
    }
    
    // Cache and return the default config
    routeConfigCache.set(domain, defaultConfig);
    return defaultConfig;
  };
  
  /**
   * Get strategy priority order for a URL
   */
  const getStrategyPriorityOrderForUrl = (url: string | URL): string[] => {
    const domain = getDomain(url);
    const routeConfig = getRouteConfigForUrl(url);
    
    // If route has specified priority order, use it
    if (routeConfig.strategies?.priorityOrder && routeConfig.strategies.priorityOrder.length > 0) {
      logger.debug('EnvironmentService', 'Using route-specific strategy priority', {
        domain,
        priority: routeConfig.strategies.priorityOrder.join(',')
      });
      return routeConfig.strategies.priorityOrder;
    }
    
    // Use centralized config via configService
    // First try to get the config from our centralized configuration manager
    try {
      // Get the app config from the centralized config manager
      const appConfig = configService.getConfig();
      
      // First check our newly added strategiesConfig
      if (appConfig.strategiesConfig && (appConfig.strategiesConfig as any).priorityOrder) {
        const priorities = (appConfig.strategiesConfig as any).priorityOrder;
        logger.debug('EnvironmentService', 'Using STRATEGIES_CONFIG priority order', {
          domain,
          priority: priorities.join(',')
        });
        return priorities;
      }
      
      // Next check imageResizerConfig.defaults.strategies if available
      if (appConfig.imageResizerConfig && 
          (appConfig.imageResizerConfig as any).defaults?.strategies?.priorityOrder) {
        const priorities = (appConfig.imageResizerConfig as any).defaults.strategies.priorityOrder;
        logger.debug('EnvironmentService', 'Using IMAGE_RESIZER_CONFIG defaults priority order', {
          domain,
          priority: priorities.join(',')
        });
        return priorities;
      }
    } catch (error) {
      logger.warn('EnvironmentService', 'Error accessing centralized config', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Fall back to config service's getStrategyConfig method if available
    if (configService && typeof configService.getStrategyConfig === 'function') {
      try {
        const strategyConfig = configService.getStrategyConfig();
        if (strategyConfig?.priorityOrder) {
          logger.debug('EnvironmentService', 'Using configService.getStrategyConfig() priority order', {
            domain,
            priority: strategyConfig.priorityOrder.join(',')
          });
          return strategyConfig.priorityOrder;
        }
      } catch (error) {
        logger.debug('EnvironmentService', 'Error using configService.getStrategyConfig()', { error });
      }
    }
    
    // As a last resort, use domain-specific default priorities
    if (isWorkersDevDomain(domain)) {
      const workersPriority = ['direct-url', 'cdn-cgi', 'remote-fallback', 'direct-serving'];
      logger.debug('EnvironmentService', 'Using workers.dev default priority order', {
        domain,
        priority: workersPriority.join(',')
      });
      return workersPriority;
    }
    
    // Default priority order for all other domains
    const defaultPriority = ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'];
    logger.debug('EnvironmentService', 'Using default priority order (last resort)', {
      domain,
      priority: defaultPriority.join(',')
    });
    return defaultPriority;
  };
  
  /**
   * Check if a strategy is enabled for a URL
   */
  const isStrategyEnabledForUrl = (strategyName: string, url: string | URL): boolean => {
    const domain = getDomain(url);
    const routeConfig = getRouteConfigForUrl(url);
    
    // Check if strategy is explicitly disabled in route config
    if (routeConfig.strategies?.disabled && routeConfig.strategies.disabled.includes(strategyName)) {
      logger.debug('EnvironmentService', `Strategy ${strategyName} explicitly disabled in route config`, {
        domain,
        routePattern: routeConfig.pattern
      });
      return false;
    }
    
    // Check if only certain strategies are enabled in route config
    if (routeConfig.strategies?.enabled && routeConfig.strategies.enabled.length > 0) {
      const isEnabled = routeConfig.strategies.enabled.includes(strategyName);
      logger.debug('EnvironmentService', `Strategy ${strategyName} ${isEnabled ? 'enabled' : 'not enabled'} in route config's explicit enabled list`, {
        domain,
        routePattern: routeConfig.pattern,
        enabled: routeConfig.strategies.enabled
      });
      return isEnabled;
    }
    
    // Use centralized config via configService
    // First try to get the config from our centralized configuration manager
    try {
      // Get the app config from the centralized config manager
      const appConfig = configService.getConfig();
      
      // First check our newly added strategiesConfig
      if (appConfig.strategiesConfig) {
        // Check for disabled strategies
        if ((appConfig.strategiesConfig as any).disabled && 
            (appConfig.strategiesConfig as any).disabled.includes(strategyName)) {
          logger.debug('EnvironmentService', `Strategy ${strategyName} disabled in STRATEGIES_CONFIG`, {
            domain
          });
          return false;
        }
        
        // Check for enabled strategies
        if ((appConfig.strategiesConfig as any).enabled && 
            (appConfig.strategiesConfig as any).enabled.length > 0) {
          const isEnabled = (appConfig.strategiesConfig as any).enabled.includes(strategyName);
          logger.debug('EnvironmentService', `Strategy ${strategyName} ${isEnabled ? 'enabled' : 'not enabled'} in STRATEGIES_CONFIG's explicit enabled list`, {
            domain,
            enabled: (appConfig.strategiesConfig as any).enabled
          });
          return isEnabled;
        }
      }
      
      // Next check imageResizerConfig.defaults.strategies if available
      if (appConfig.imageResizerConfig && 
          (appConfig.imageResizerConfig as any).defaults?.strategies) {
        
        // Check for disabled strategies
        if ((appConfig.imageResizerConfig as any).defaults.strategies.disabled && 
            (appConfig.imageResizerConfig as any).defaults.strategies.disabled.includes(strategyName)) {
          logger.debug('EnvironmentService', `Strategy ${strategyName} disabled in IMAGE_RESIZER_CONFIG.defaults.strategies`, {
            domain
          });
          return false;
        }
        
        // Check for enabled strategies
        if ((appConfig.imageResizerConfig as any).defaults.strategies.enabled && 
            (appConfig.imageResizerConfig as any).defaults.strategies.enabled.length > 0) {
          const isEnabled = (appConfig.imageResizerConfig as any).defaults.strategies.enabled.includes(strategyName);
          logger.debug('EnvironmentService', `Strategy ${strategyName} ${isEnabled ? 'enabled' : 'not enabled'} in IMAGE_RESIZER_CONFIG.defaults.strategies explicit enabled list`, {
            domain,
            enabled: (appConfig.imageResizerConfig as any).defaults.strategies.enabled
          });
          return isEnabled;
        }
      }
    } catch (error) {
      logger.warn('EnvironmentService', 'Error accessing centralized config for strategy enabled check', { 
        error: error instanceof Error ? error.message : String(error),
        strategy: strategyName,
        domain
      });
    }
    
    // Fall back to config service's getStrategyConfig method if available
    if (configService && typeof configService.getStrategyConfig === 'function') {
      try {
        const strategyConfig = configService.getStrategyConfig();
        
        // Check for disabled strategies
        if (strategyConfig.disabled && strategyConfig.disabled.includes(strategyName)) {
          logger.debug('EnvironmentService', `Strategy ${strategyName} disabled in configService.getStrategyConfig()`, {
            domain
          });
          return false;
        }
        
        // Check for enabled strategies
        if (strategyConfig.enabled && strategyConfig.enabled.length > 0) {
          const isEnabled = strategyConfig.enabled.includes(strategyName);
          logger.debug('EnvironmentService', `Strategy ${strategyName} ${isEnabled ? 'enabled' : 'not enabled'} in configService.getStrategyConfig() explicit enabled list`, {
            domain,
            enabled: strategyConfig.enabled
          });
          return isEnabled;
        }
      } catch (error) {
        logger.debug('EnvironmentService', 'Error using configService.getStrategyConfig() for strategy enabled check', { 
          error: error instanceof Error ? error.message : String(error),
          strategy: strategyName,
          domain
        });
      }
    }
    
    // As a last resort, use domain-specific rules for certain strategies
    // This provides sensible defaults even when no explicit configuration exists
    if (isWorkersDevDomain(domain)) {
      // Special handling for workers.dev domains
      if (strategyName === 'interceptor') {
        logger.debug('EnvironmentService', `Strategy ${strategyName} disabled by default for workers.dev domains`, {
          domain
        });
        return false;
      }
    }
    
    // Default to enabled
    logger.debug('EnvironmentService', `Strategy ${strategyName} enabled by default (no explicit configuration found)`, {
      domain
    });
    return true;
  };
  
  /**
   * Get the current environment name
   */
  const getEnvironmentName = (): string => {
    try {
      // First try getting from centralized config
      if (configService) {
        // Try using the getConfig method first (preferred)
        try {
          const appConfig = configService.getConfig();
          if (appConfig && appConfig.environment) {
            logger.debug('EnvironmentService', 'Using environment from centralized config', {
              environment: appConfig.environment
            });
            return appConfig.environment;
          }
        } catch (err) {
          // Ignore errors, will try alternative methods
        }
        
        // Try using the get method if available (legacy approach)
        if (configService.get) {
          const env = configService.get('ENVIRONMENT', 'development');
          logger.debug('EnvironmentService', 'Using environment from configService.get()', {
            environment: env
          });
          return env;
        }
      }
    } catch (err) {
      logger.warn('EnvironmentService', 'Error getting environment name from configService', {
        error: err instanceof Error ? err.message : String(err)
      });
    }
    
    // Default to development
    logger.debug('EnvironmentService', 'Using default environment name', {
      environment: 'development'
    });
    return 'development';
  };
  
  /**
   * Check if the current environment is development
   */
  const isDevelopment = (): boolean => {
    const env = getEnvironmentName();
    return env === 'development';
  };
  
  /**
   * Check if the current environment is production
   */
  const isProduction = (): boolean => {
    const env = getEnvironmentName();
    return env === 'production';
  };

  // Return the public interface
  return {
    getDomain,
    isWorkersDevDomain,
    isCustomDomain,
    getEnvironmentForDomain,
    getRouteConfigForUrl,
    getStrategyPriorityOrderForUrl,
    isStrategyEnabledForUrl,
    getEnvironmentName,
    isDevelopment,
    isProduction
  };
}