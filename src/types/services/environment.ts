/**
 * Environment service types
 * Provides domain-specific configuration and routing
 */

/**
 * Route configuration interface
 */
export interface RouteConfig {
  /**
   * Route pattern (can be a domain, path, or combined pattern)
   */
  pattern: string;

  /**
   * Environment type (development, production, staging, etc.)
   */
  environment?: string;

  /**
   * Strategy-specific configuration
   */
  strategies?: {
    /**
     * Ordered list of strategy names by priority
     */
    priorityOrder?: string[];

    /**
     * List of explicitly enabled strategies
     */
    enabled?: string[];

    /**
     * List of explicitly disabled strategies
     */
    disabled?: string[];
  };

  /**
   * Cache configuration
   */
  cache?: {
    /**
     * TTL in seconds
     */
    ttl?: number;

    /**
     * Whether caching is enabled
     */
    enabled?: boolean;
  };

  /**
   * Any additional configuration properties
   */
  [key: string]: unknown;
}

/**
 * Environment type - represents deployment context
 */
export type EnvironmentType = 'production' | 'development' | 'staging' | 'test';

/**
 * Environment service interface
 */
export interface IEnvironmentService {
  /**
   * Get the environment type for a domain
   * @param domain The domain to check
   */
  getEnvironmentForDomain(domain: string): EnvironmentType;

  /**
   * Check if a domain is a workers.dev domain
   * @param domain The domain to check
   */
  isWorkersDevDomain(domain: string): boolean;

  /**
   * Check if a domain is a custom domain (not workers.dev)
   * @param domain The domain to check
   */
  isCustomDomain(domain: string): boolean;

  /**
   * Get the domain from a URL or string
   * @param url The URL or string to extract the domain from
   */
  getDomain(url: string | URL): string;

  /**
   * Get the route configuration for a URL
   * @param url The URL to get the configuration for
   */
  getRouteConfigForUrl(url: string | URL): RouteConfig;

  /**
   * Get the priority order of strategies for a URL
   * @param url The URL to get the strategy priority for
   */
  getStrategyPriorityOrderForUrl(url: string | URL): string[];

  /**
   * Check if a strategy is enabled for a URL
   * @param strategyName The name of the strategy
   * @param url The URL to check
   */
  isStrategyEnabledForUrl(strategyName: string, url: string | URL): boolean;
  
  /**
   * Get the current environment name
   */
  getEnvironmentName(): string;
  
  /**
   * Check if the current environment is development
   */
  isDevelopment(): boolean;
  
  /**
   * Check if the current environment is production
   */
  isProduction(): boolean;
}

/**
 * Dependencies for the environment service
 */
export interface EnvironmentServiceDependencies {
  logger: {
    debug: (module: string, message: string, data?: Record<string, unknown>) => void;
    error: (module: string, message: string, data?: Record<string, unknown>) => void;
    warn: (module: string, message: string, data?: Record<string, unknown>) => void;
  };
  configService?: {
    getStrategyConfig: () => {
      priorityOrder: string[];
      enabled?: string[];
      disabled?: string[];
    };
    getConfig: () => any;
    get?: (path: string, defaultValue?: any) => any;
  };
}