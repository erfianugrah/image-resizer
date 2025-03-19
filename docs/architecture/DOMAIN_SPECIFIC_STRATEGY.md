# Domain-Specific Transformation Strategies

This document describes the domain-specific transformation strategy selection in the image-resizer project, which addresses differences in behavior between workers.dev domains and custom domains.

## Problem Statement

Cloudflare Workers provides two types of domain endpoints:
1. **workers.dev domains**: Default domains provided by Cloudflare (e.g., `my-worker.workers.dev`)
2. **Custom domains**: Custom domains configured with Cloudflare (e.g., `images.example.com`)

We discovered that there are differences in how these domains handle certain transformation strategies:

- The **interceptor strategy** (which uses CF image properties with subrequests) works optimally on custom domains but can fail on workers.dev domains.
- The **direct-url strategy** (which uses direct URLs with CF image properties) works on both domain types but with different performance characteristics.
- The **cdn-cgi strategy** (which uses /cdn-cgi/image/ URL pattern) is more reliable on workers.dev domains.

Without proper configuration, this inconsistency causes:
1. Failed transformations on workers.dev domains when using the interceptor strategy
2. Potential performance loss on custom domains when not using optimal strategies
3. Inconsistent user experience across different domain types

## Solution Architecture

Our solution uses a flexible, configuration-driven approach that:

1. Uses environment-specific configurations in wrangler.jsonc for each domain type
2. Allows per-domain strategy prioritization and enabling/disabling specific strategies
3. Dynamically selects the optimal transformation strategy for each request
4. Provides detailed diagnostics through enhanced debug headers
5. Falls back gracefully when a strategy fails

This approach avoids hardcoded domain detection logic and instead relies on configuration, making it more maintainable and adaptable to different deployment environments.

### Components

1. **EnvironmentService**: Detects domain type and loads configuration
2. **ConfigurationService**: Loads strategy configuration from wrangler.jsonc
3. **StreamingTransformationService**: Uses the environment information to select strategies
4. **Enhanced Debug Headers**: Provide diagnostic information about strategy selection

## Domain-Specific Configuration

The configuration in wrangler.jsonc provides domain-specific strategy settings:

### For workers.dev domains:
```json
{
  "pattern": "*.workers.dev/*",
  "environment": "development",
  "strategies": {
    "priorityOrder": ["direct-url", "remote-fallback", "direct-serving"],
    "disabled": ["interceptor", "cdn-cgi"]
  }
}
```

### For custom domains:
```json
{
  "pattern": "images.erfi.dev/*",
  "environment": "production",
  "strategies": {
    "priorityOrder": ["interceptor", "direct-url", "remote-fallback", "direct-serving"],
    "disabled": ["cdn-cgi"]
  }
}
```

## Strategy Selection Process

1. The `StreamingTransformationService` receives a request for image transformation
2. It uses the `EnvironmentService` to:
   - Determine configuration based on the request URL
   - Load domain-specific strategy configuration from wrangler.jsonc
   - Get the prioritized list of strategies for the domain
   - Check which strategies are enabled/disabled for the domain

3. When attempting transformations, it:
   - Skips strategies that are disabled in the configuration 
   - Tries strategies in the configured priority order
   - Runs each strategy's `canHandle` method to see if it can handle the request
   - Falls back to the next strategy if one fails
   - Collects diagnostic information about attempts and failures

4. Enhanced debug headers provide visibility into the selection process:
   - Shows the attempted strategies
   - Indicates which strategy was finally selected
   - Shows any errors encountered during the process
   - Provides domain and environment information

## Implementation Details

### Domain-Specific Configuration

The `wrangler.jsonc` file contains domain-specific configuration for each environment:

```json
{
  "pattern": "*.workers.dev/*",
  "environment": "development",
  "strategies": {
    "priorityOrder": [
      "direct-url",
      "cdn-cgi",
      "direct-serving",
      "remote-fallback"
    ],
    "disabled": []
  }
}
```

For custom domains, a different strategy order is used:

```json
{
  "pattern": "images.erfi.dev/*",
  "environment": "production",
  "strategies": {
    "priorityOrder": [
      "interceptor",
      "direct-url",
      "cdn-cgi",
      "remote-fallback",
      "direct-serving"
    ],
    "disabled": []
  }
}
```

### Strategy Enabling/Disabling Logic

The system uses a configuration-based approach to determine which strategies are enabled or disabled for each domain:

```typescript
const isStrategyEnabledForUrl = (strategyName: string, url: string | URL): boolean => {
  const routeConfig = getRouteConfigForUrl(url);
  
  // Check if explicitly disabled in route config
  if (routeConfig.strategies?.disabled?.includes(strategyName)) {
    return false;
  }
  
  // Check if only certain strategies are enabled in route config
  if (routeConfig.strategies?.enabled?.length > 0) {
    return routeConfig.strategies.enabled.includes(strategyName);
  }
  
  // Check global defaults from IMAGE_RESIZER_CONFIG or fallback configuration
  
  // Default to enabled if not explicitly disabled
  return true;
};
```

### Strategy Selection in the Transformation Service

```typescript
// Try each strategy in order of priority
for (const strategy of sortedStrategies()) {
  try {
    // Skip disabled strategies if environment service is available
    if (environmentService) {
      const isEnabled = environmentService.isStrategyEnabledForUrl(
        strategy.name, 
        request.url
      );
      
      if (!isEnabled) {
        logDebug(`Strategy ${strategy.name} is disabled for this domain, skipping`);
        continue;
      }
    }
    
    // Check if strategy can handle the request
    if (!strategy.canHandle(params)) {
      logDebug(`Strategy ${strategy.name} cannot handle this request, skipping`);
      continue;
    }

    // Execute strategy
    const response = await strategy.execute(params);
    
    // Success - return response
    return response;
  } catch (error) {
    // Record error and continue to next strategy
    logDebug(`${strategy.name} transformation failed, trying next method`);
  }
}
```

## Strategy Enhancements for Workers.dev Domains

The DirectUrlStrategy has been enhanced to be more permissive for workers.dev domains:

```typescript
// On workers.dev domains, this strategy should be more permissive
if (hasWorkersDevDomain && bucket && hasTransformations) {
  return true;
}
```

This ensures that workers.dev domains can successfully use the direct-url strategy even when some parameters might be missing.

## Testing Domain-Specific Behavior

To test domain-specific strategy selection:

1. Make a request to a workers.dev domain with debug headers:
```
curl -H "x-debug: true" https://dev-resizer.workers.dev/image.jpg
```

2. Make a request to a custom domain with debug headers:
```
curl -H "x-debug: true" https://images.erfi.dev/image.jpg
```

3. Compare the debug headers to verify that different strategies are selected:
   - Look for `x-debug-strategy-selected` header to see which strategy was used
   - Check `x-debug-attempted-strategies` to see the fallback chain
   - Verify that the correct transformations were applied based on content-type and content-length

## Benefits of Domain-Specific Configuration

This configuration-driven approach provides several advantages:

1. **Reliability**: Each domain type uses the most reliable strategies for its environment
2. **Performance**: Optimized strategy selection for each domain type and environment
3. **Flexibility**: Easy updates via configuration without code changes
4. **Fallback Resilience**: Multiple strategies provide reliable fallback options
5. **Diagnostics**: Enhanced debug headers show exactly what happened during transformation
6. **Adaptability**: The system can be configured for different environments without code changes