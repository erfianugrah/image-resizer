/**
 * Add this code to your index.ts file (at the beginning of the fetch handler)
 * to help debug configuration loading issues
 */

// Debug configuration loading
console.log('Environment variables:', {
  ENVIRONMENT: env.ENVIRONMENT,
  CACHE_METHOD: env.CACHE_METHOD,
  STRATEGIES_CONFIG: env.STRATEGIES_CONFIG, 
  DOMAIN_CONFIG: env.DOMAIN_CONFIG
});

try {
  // Get relevant services for debugging
  const registry = ServiceRegistry.getInstance();
  
  // Debug configuration service
  try {
    const configService = registry.resolve<any>('IConfigurationService');
    console.log('Configuration Service:', {
      environment: configService.getEnvironment(),
      strategyConfig: configService.getStrategyConfig(),
      cacheMethod: configService.getCacheMethod()
    });
  } catch (e) {
    console.error('Error accessing ConfigurationService:', e);
  }
  
  // Debug environment service
  try {
    const envService = registry.resolve<any>('IEnvironmentService');
    const url = new URL(request.url);
    console.log('Environment Service for URL:', url.toString(), {
      environment: envService.getEnvironmentName(),
      isDevelopment: envService.isDevelopment(),
      isProduction: envService.isProduction(),
      strategies: {
        interceptorEnabled: envService.isStrategyEnabledForUrl('interceptor', url.toString()),
        cdnCgiEnabled: envService.isStrategyEnabledForUrl('cdn-cgi', url.toString()),
        priorityOrder: envService.getStrategyPriorityOrderForUrl(url.toString())
      }
    });
  } catch (e) {
    console.error('Error accessing EnvironmentService:', e);
  }
  
  // Debug strategy registry
  try {
    const strategyRegistry = registry.resolve<any>('IStrategyRegistry');
    console.log('Strategy Registry:', {
      registeredStrategies: strategyRegistry.getStrategies().map(s => s.name),
      prioritizedStrategies: strategyRegistry.getPrioritizedStrategies().map(s => s.name)
    });
  } catch (e) {
    console.error('Error accessing StrategyRegistry:', e);
  }
} catch (debugError) {
  console.error('Error in debug code:', debugError);
}