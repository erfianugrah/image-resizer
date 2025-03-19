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
   * Load route configurations from wrangler.jsonc
   */
  const loadRouteConfigurations = (): RouteConfig[] => {
    try {
      // Try to get the configuration from the global object
      const globalConfig = (global as any).__WRANGLER_CONFIG__;
      
      // First check the new "vars.IMAGE_RESIZER_CONFIG" location
      if (globalConfig?.vars?.IMAGE_RESIZER_CONFIG?.routes) {
        return globalConfig.vars.IMAGE_RESIZER_CONFIG.routes;
      }
      
      // For backward compatibility, check the old location
      if (globalConfig?.imageResizer?.routes) {
        return globalConfig.imageResizer.routes;
      }
      
      // If not available, log and return empty array
      logger.debug('EnvironmentService', 'No route configurations found in wrangler.jsonc');
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
    const routeConfig = getRouteConfigForUrl(url);
    
    // If route has specified priority order, use it
    if (routeConfig.strategies?.priorityOrder && routeConfig.strategies.priorityOrder.length > 0) {
      return routeConfig.strategies.priorityOrder;
    }
    
    // Try to get the defaults from the IMAGE_RESIZER_CONFIG
    try {
      const globalConfig = (global as any).__WRANGLER_CONFIG__;
      
      // First check the new location for defaults
      if (globalConfig?.vars?.IMAGE_RESIZER_CONFIG?.defaults?.strategies?.priorityOrder) {
        return globalConfig.vars.IMAGE_RESIZER_CONFIG.defaults.strategies.priorityOrder;
      }
      
      // Then check the old location for defaults
      if (globalConfig?.imageResizer?.defaults?.strategies?.priorityOrder) {
        return globalConfig.imageResizer.defaults.strategies.priorityOrder;
      }
    } catch (error) {
      // If there's an error, continue with special handling and defaults
      logger.debug('EnvironmentService', 'Error getting default strategy config', { error });
    }
    
    // Fall back to config service if available
    if (configService) {
      return configService.getStrategyConfig().priorityOrder;
    }
    
    // Default priority depends on domain type (but only as last resort)
    const domain = getDomain(url);
    if (isWorkersDevDomain(domain)) {
      return ['direct-url', 'cdn-cgi', 'remote-fallback', 'direct-serving'];
    }
    
    // Default priority order
    return ['interceptor', 'direct-url', 'remote-fallback', 'direct-serving'];
  };
  
  /**
   * Check if a strategy is enabled for a URL
   */
  const isStrategyEnabledForUrl = (strategyName: string, url: string | URL): boolean => {
    const routeConfig = getRouteConfigForUrl(url);
    
    // Check if strategy is explicitly disabled in route config
    if (routeConfig.strategies?.disabled && routeConfig.strategies.disabled.includes(strategyName)) {
      return false;
    }
    
    // Check if only certain strategies are enabled in route config
    if (routeConfig.strategies?.enabled && routeConfig.strategies.enabled.length > 0) {
      return routeConfig.strategies.enabled.includes(strategyName);
    }
    
    // Look for global defaults if no route-specific settings
    try {
      const globalConfig = (global as any).__WRANGLER_CONFIG__;
      
      // Check disabled strategies in new defaults location
      if (globalConfig?.vars?.IMAGE_RESIZER_CONFIG?.defaults?.strategies?.disabled) {
        const disabled = globalConfig.vars.IMAGE_RESIZER_CONFIG.defaults.strategies.disabled;
        if (disabled.includes(strategyName)) {
          return false;
        }
      }
      
      // Check enabled strategies in new defaults location
      if (globalConfig?.vars?.IMAGE_RESIZER_CONFIG?.defaults?.strategies?.enabled) {
        const enabled = globalConfig.vars.IMAGE_RESIZER_CONFIG.defaults.strategies.enabled;
        if (enabled.length > 0) {
          return enabled.includes(strategyName);
        }
      }
      
      // Check disabled strategies in old defaults location
      if (globalConfig?.imageResizer?.defaults?.strategies?.disabled) {
        const disabled = globalConfig.imageResizer.defaults.strategies.disabled;
        if (disabled.includes(strategyName)) {
          return false;
        }
      }
      
      // Check enabled strategies in old defaults location
      if (globalConfig?.imageResizer?.defaults?.strategies?.enabled) {
        const enabled = globalConfig.imageResizer.defaults.strategies.enabled;
        if (enabled.length > 0) {
          return enabled.includes(strategyName);
        }
      }
    } catch (error) {
      // If there's an error, continue with special handling and defaults
      logger.debug('EnvironmentService', 'Error checking default strategy enabled/disabled', { error });
    }
    
    // Fall back to config service if available
    if (configService) {
      const strategyConfig = configService.getStrategyConfig();
      if (strategyConfig.disabled && strategyConfig.disabled.includes(strategyName)) {
        return false;
      }
      if (strategyConfig.enabled && strategyConfig.enabled.length > 0) {
        return strategyConfig.enabled.includes(strategyName);
      }
    }
    
    // Default to enabled
    return true;
  };
  
  /**
   * Get the current environment name
   */
  const getEnvironmentName = (): string => {
    // Use configService if available
    if (configService && configService.get) {
      return configService.get('ENVIRONMENT', 'development');
    }
    
    // Default to development
    return 'development';
  };
  
  /**
   * Check if the current environment is development
   */
  const isDevelopment = (): boolean => {
    return getEnvironmentName() === 'development';
  };
  
  /**
   * Check if the current environment is production
   */
  const isProduction = (): boolean => {
    return getEnvironmentName() === 'production';
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