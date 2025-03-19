/**
 * Strategy Registry Service
 * Provides a central registry for transformation strategies with environment awareness
 */
import { ILogger } from '../types/core/logger';
// We'll define the interface here to avoid import issues
interface IConfigurationService {
  getStrategyConfig(): {
    priorityOrder: string[];
    enabled?: string[];
    disabled?: string[];
  };
  get(path: string, defaultValue?: any): any;
  initialize(env: Record<string, any>): void;
  // Add isStrategyEnabled if it's used in the file
  isStrategyEnabled?(strategyName: string): boolean;
}
import { 
  IImageTransformationStrategy, 
  TransformationStrategyParams 
} from '../types/services/streaming';

/**
 * Strategy Registry Dependencies
 */
export interface StrategyRegistryDependencies {
  logger: ILogger;
  configService: IConfigurationService;
}

/**
 * Strategy Registry Interface
 */
export interface IStrategyRegistry {
  /**
   * Register a strategy with the registry
   * @param strategy The strategy to register
   */
  registerStrategy(strategy: IImageTransformationStrategy): void;

  /**
   * Get all registered strategies
   * @returns Array of registered strategies
   */
  getStrategies(): IImageTransformationStrategy[];

  /**
   * Get strategies sorted by priority
   * @returns Array of strategies sorted by priority
   */
  getPrioritizedStrategies(): IImageTransformationStrategy[];

  /**
   * Get a strategy by name
   * @param name Strategy name
   * @returns The strategy or undefined if not found
   */
  getStrategyByName(name: string): IImageTransformationStrategy | undefined;

  /**
   * Find strategies that can handle the given parameters
   * @param params Strategy parameters
   * @returns Array of eligible strategies sorted by priority
   */
  findEligibleStrategies(params: TransformationStrategyParams): IImageTransformationStrategy[];

  /**
   * Create a strategy chain for fallback execution
   * @param params Strategy parameters
   * @returns A function that executes strategies in order until one succeeds
   */
  createStrategyChain(params: TransformationStrategyParams): 
    () => Promise<{ result: Response; strategy: string; attempts: string[] }>;
}

/**
 * Create a Strategy Registry
 * @param dependencies Registry dependencies
 * @returns A Strategy Registry instance
 */
export function createStrategyRegistry(
  dependencies: StrategyRegistryDependencies
): IStrategyRegistry {
  const { logger, configService } = dependencies;
  const strategies: Map<string, IImageTransformationStrategy> = new Map();

  /**
   * Helper to check if a strategy is enabled for the current environment
   */
  const isStrategyEnabled = (strategyName: string): boolean => {
    try {
      // Check if the method exists before calling it
      if (configService.isStrategyEnabled) {
        return configService.isStrategyEnabled(strategyName);
      }
      
      // Fallback to checking the strategy config
      const strategyConfig = configService.getStrategyConfig();
      
      // Check if strategy is explicitly disabled
      if (strategyConfig.disabled && strategyConfig.disabled.includes(strategyName)) {
        return false;
      }
      
      // Check if only certain strategies are enabled
      if (strategyConfig.enabled && strategyConfig.enabled.length > 0) {
        return strategyConfig.enabled.includes(strategyName);
      }
      
      // Default to enabled
      return true;
    } catch (error) {
      // Default to enabled if there's an issue with config service
      logger.warn('StrategyRegistry', `Error checking if strategy ${strategyName} is enabled`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return true;
    }
  };

  /**
   * Helper to get custom priority order from configuration
   */
  const getConfiguredPriorityOrder = (): string[] => {
    try {
      return configService.getStrategyConfig().priorityOrder;
    } catch (error) {
      // Default priority order if config service fails
      logger.warn('StrategyRegistry', 'Error getting strategy priority order from config', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return ['interceptor', 'cdn-cgi', 'direct-url', 'remote-fallback', 'direct-serving'];
    }
  };

  return {
    registerStrategy: (strategy: IImageTransformationStrategy): void => {
      if (!strategy.name) {
        logger.warn('StrategyRegistry', 'Attempted to register strategy with no name', {
          strategy: typeof strategy,
        });
        return;
      }
      
      strategies.set(strategy.name, strategy);
      logger.debug('StrategyRegistry', `Registered strategy: ${strategy.name}`, {
        priority: strategy.priority,
      });
    },

    getStrategies: (): IImageTransformationStrategy[] => {
      return Array.from(strategies.values());
    },

    getPrioritizedStrategies: (): IImageTransformationStrategy[] => {
      const configuredOrder = getConfiguredPriorityOrder();
      // Create a map of strategy name to its position in the configured order
      const orderMap = new Map<string, number>();
      configuredOrder.forEach((name, index) => {
        orderMap.set(name, index);
      });
      
      // Get all registered strategies
      const allStrategies = Array.from(strategies.values());
      
      // Filter by enabled status
      const enabledStrategies = allStrategies.filter(strategy => 
        isStrategyEnabled(strategy.name)
      );
      
      // Sort by configured order first, then by strategy's internal priority
      return enabledStrategies.sort((a, b) => {
        // Get positions in the configured order
        const posA = orderMap.has(a.name) ? orderMap.get(a.name)! : Number.MAX_SAFE_INTEGER;
        const posB = orderMap.has(b.name) ? orderMap.get(b.name)! : Number.MAX_SAFE_INTEGER;
        
        // First sort by configured order
        if (posA !== posB) {
          return posA - posB;
        }
        
        // If same position or not in configured order, sort by strategy priority
        return a.priority - b.priority;
      });
    },

    getStrategyByName: (name: string): IImageTransformationStrategy | undefined => {
      return strategies.get(name);
    },

    findEligibleStrategies: function(params: TransformationStrategyParams): IImageTransformationStrategy[] {
      // Get prioritized strategies
      const prioritizedStrategies = this.getPrioritizedStrategies();
      
      // Filter by those that can handle the params
      return prioritizedStrategies.filter((strategy: IImageTransformationStrategy) => {
        try {
          return strategy.canHandle(params);
        } catch (error) {
          logger.error('StrategyRegistry', `Error checking if strategy ${strategy.name} can handle params`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            strategy: strategy.name,
          });
          return false;
        }
      });
    },

    createStrategyChain: function(params: TransformationStrategyParams) {
      // Get eligible strategies
      const self = this;
      const eligibleStrategies = self.findEligibleStrategies(params);
      const attempts: string[] = [];
      
      return async (): Promise<{ result: Response; strategy: string; attempts: string[] }> => {
        let lastError: Error | null = null;
        
        // Try each strategy in order
        for (const strategy of eligibleStrategies) {
          try {
            attempts.push(strategy.name);
            logger.debug('StrategyRegistry', `Attempting strategy: ${strategy.name}`, {
              key: params.key,
            });
            
            const result = await strategy.execute(params);
            
            return { 
              result, 
              strategy: strategy.name,
              attempts 
            };
          } catch (error) {
            // Log the error and continue to the next strategy
            logger.debug('StrategyRegistry', `Strategy ${strategy.name} failed`, {
              error: error instanceof Error ? error.message : 'Unknown error',
              key: params.key,
            });
            
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }
        
        // If all strategies failed, throw the last error
        if (lastError) {
          logger.error('StrategyRegistry', 'All strategies failed', {
            attempts,
            lastError: lastError.message,
          });
          throw lastError;
        }
        
        // If no strategies were eligible (shouldn't happen if we got this far)
        logger.error('StrategyRegistry', 'No eligible strategies found', {
          params: {
            key: params.key,
            hasObject: !!params.object,
            hasBucket: !!params.bucket,
            hasFallbackUrl: !!params.fallbackUrl,
          },
        });
        
        throw new Error('No transformation strategies available for the request');
      };
    },
  };
}