/**
 * Configuration Service
 * 
 * Handles loading and validation of configuration 
 * from environment variables and wrangler.jsonc
 */

/**
 * Strategy configuration interface
 */
interface StrategyConfig {
  priorityOrder: string[];
  enabled?: string[];
  disabled?: string[];
}

/**
 * Configuration service dependencies
 */
interface ConfigurationServiceDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
  env?: Record<string, any>;
}

/**
 * Configuration service interface
 */
interface IConfigurationService {
  /**
   * Get the strategy configuration
   */
  getStrategyConfig(): StrategyConfig;
  
  /**
   * Get a configuration value by key path
   */
  get(path: string, defaultValue?: any): any;
  
  /**
   * Initialize the configuration service with environment variables
   */
  initialize(env: Record<string, any>): void;
}

/**
 * Create a configuration service
 */
export function createConfigurationService(
  dependencies: ConfigurationServiceDependencies
): IConfigurationService {
  const { logger, env = {} } = dependencies;
  
  // Default strategy configuration
  const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
    priorityOrder: ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback', 'direct-serving'],
    disabled: []
  };
  
  /**
   * Parse a string to JSON safely
   */
  const safeJsonParse = <T>(str: string, defaultValue: T): T => {
    try {
      return JSON.parse(str) as T;
    } catch (e) {
      logger.error('ConfigurationService', 'Failed to parse JSON', { 
        str: str.substring(0, 100), 
        error: e instanceof Error ? e.message : 'Unknown error' 
      });
      return defaultValue;
    }
  };
  
  /**
   * Get the strategy configuration
   */
  const getStrategyConfig = (): StrategyConfig => {
    // Check if STRATEGIES_CONFIG is defined in environment
    if (env.STRATEGIES_CONFIG) {
      // If it's already an object, use it directly
      if (typeof env.STRATEGIES_CONFIG === 'object' && env.STRATEGIES_CONFIG !== null) {
        const configObject = env.STRATEGIES_CONFIG as StrategyConfig;
        
        logger.debug('ConfigurationService', 'Loaded strategy config from environment (object)', {
          config: configObject
        });
        
        return {
          priorityOrder: configObject.priorityOrder || DEFAULT_STRATEGY_CONFIG.priorityOrder,
          disabled: configObject.disabled || [],
          enabled: configObject.enabled || []
        };
      }
      
      // If it's a string, try to parse it as JSON (for backward compatibility)
      if (typeof env.STRATEGIES_CONFIG === 'string') {
        const parsedConfig = safeJsonParse<StrategyConfig>(
          env.STRATEGIES_CONFIG,
          DEFAULT_STRATEGY_CONFIG
        );
        
        logger.debug('ConfigurationService', 'Loaded strategy config from environment (string)', {
          config: parsedConfig
        });
        
        return parsedConfig;
      }
    }
    
    // Fall back to default configuration
    logger.debug('ConfigurationService', 'Using default strategy config');
    return DEFAULT_STRATEGY_CONFIG;
  };
  
  /**
   * Get a configuration value by key path
   */
  const get = (path: string, defaultValue?: any): any => {
    // Split the path by dots
    const parts = path.split('.');
    let value: any = env;
    
    // Navigate through the path
    for (const part of parts) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      
      value = value[part];
    }
    
    // Return the value or default
    return value !== undefined ? value : defaultValue;
  };
  
  /**
   * Initialize the configuration service with environment variables
   */
  const initialize = (newEnv: Record<string, any>): void => {
    // Store the environment variables for later use
    Object.assign(env, newEnv || {});
    
    logger.debug('ConfigurationService', 'Initialized with environment variables', {
      envKeys: Object.keys(newEnv || {})
    });
  };

  // Return the public interface
  return {
    getStrategyConfig,
    get,
    initialize
  };
}