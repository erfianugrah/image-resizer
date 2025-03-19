# Domain-Specific Transformation Strategies

This document explains how image transformation strategies are selected and applied based on domain type (workers.dev vs. custom domains).

## Overview

The image-resizer worker needs to handle image transformations differently depending on the domain it's running on. This is because Cloudflare Image Resizing has different behavior and capabilities on workers.dev domains compared to custom domains.

## Domain Types

1. **workers.dev Domains**: Default development domains provided by Cloudflare (e.g., `my-worker.workers.dev`)
2. **Custom Domains**: Your own domains connected to Cloudflare (e.g., `images.mysite.com`)

## Strategy Types

The application supports several strategies for transforming images:

1. **WorkersDevStrategy**: Special strategy for workers.dev domains that bypasses Cloudflare's image resizing limitations
2. **InterceptorStrategy**: Uses the interceptor pattern with CF image resizing (works best on custom domains)
3. **DirectUrlStrategy**: Transforms images using direct URLs with CF image options
4. **CdnCgiStrategy**: Uses the `/cdn-cgi/image/` URL pattern
5. **RemoteFallbackStrategy**: Falls back to a remote server for transformations
6. **DirectServingStrategy**: Serves the original image without transformations (last resort)

## Strategy Selection Logic

The application selects which strategies to use based on the following:

1. **Domain Detection**: The `EnvironmentService` detects which type of domain the request is coming from
2. **Configuration-Driven Priorities**: Strategy priorities are defined in `wrangler.jsonc` configuration
3. **Fallback Mechanism**: If a higher-priority strategy fails, the system falls back to the next strategy
4. **Domain-Specific Disabling**: Certain strategies can be explicitly disabled for specific domains

## Configuration

Strategy selection is configured in `wrangler.jsonc` under two main sections:

### 1. STRATEGIES_CONFIG

General strategy configuration for the entire application:

```json
"STRATEGIES_CONFIG": {
  "priorityOrder": [
    "interceptor",
    "direct-url", 
    "cdn-cgi",
    "remote-fallback",
    "direct-serving"
  ],
  "disabled": [],
  "enabled": []
}
```

### 2. IMAGE_RESIZER_CONFIG

Domain-specific strategy configuration:

```json
"IMAGE_RESIZER_CONFIG": {
  "routes": [
    {
      "pattern": "*.workers.dev/*",
      "environment": "development",
      "strategies": {
        "priorityOrder": [
          "workers-dev",
          "direct-url",
          "cdn-cgi", 
          "remote-fallback",
          "direct-serving"
        ],
        "disabled": [
          "interceptor"
        ]
      }
    },
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
  ],
  "defaults": {
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
}
```

## Configuration Precedence

The system follows this precedence order when determining strategy configuration:

1. **Route-specific configuration** (`IMAGE_RESIZER_CONFIG.routes[].strategies`)
2. **Global strategy configuration** (`STRATEGIES_CONFIG`)
3. **Default strategy configuration** (`IMAGE_RESIZER_CONFIG.defaults.strategies`)
4. **Domain-specific defaults** (Hardcoded defaults based on domain type)
5. **Fallback defaults** (Used when no other configuration is available)

## Accessing Configuration

The application uses a centralized configuration approach through the `ConfigManager`:

```typescript
// Example of accessing configuration in EnvironmentService
const getStrategyPriorityOrderForUrl = (url: string | URL): string[] => {
  const domain = getDomain(url);
  const routeConfig = getRouteConfigForUrl(url);
  
  // First check route-specific configuration
  if (routeConfig.strategies?.priorityOrder) {
    logger.debug('Using route-specific strategy priority', {
      domain,
      priority: routeConfig.strategies.priorityOrder.join(',')
    });
    return routeConfig.strategies.priorityOrder;
  }
  
  // Use centralized config via configService
  try {
    // Get the app config from the centralized configuration manager
    const appConfig = configService.getConfig();
    
    // Check if we have strategy config
    if (appConfig.strategiesConfig?.priorityOrder) {
      logger.debug('Using STRATEGIES_CONFIG priority order', {
        domain,
        priority: appConfig.strategiesConfig.priorityOrder.join(',')
      });
      return appConfig.strategiesConfig.priorityOrder;
    }
    
    // Check defaults in image resizer config
    if (appConfig.imageResizerConfig?.defaults?.strategies?.priorityOrder) {
      logger.debug('Using IMAGE_RESIZER_CONFIG defaults priority order', {
        domain,
        priority: appConfig.imageResizerConfig.defaults.strategies.priorityOrder.join(',')
      });
      return appConfig.imageResizerConfig.defaults.strategies.priorityOrder;
    }
  } catch (error) {
    logger.warn('Error accessing centralized config', { error });
  }
  
  // Fall back to domain-specific defaults
  // ...
};
```

## Strategy Implementation

Each strategy implements the `IImageTransformationStrategy` interface with two key methods:

1. **canHandle**: Determines if the strategy can handle a given request
2. **execute**: Performs the transformation and returns a response

The `StreamingTransformationService` manages strategy selection and execution:

```typescript
// In streamingTransformationService.ts
processR2Image() {
  // Get environment info if available
  let strategyDiagnostics: StrategyDiagnostics = {
    attemptedStrategies: []
  };
  
  // Get domain-specific info if environment service is available
  if (environmentService) {
    const domain = environmentService.getDomain(url);
    const isWorkersDevDomain = environmentService.isWorkersDevDomain(domain);
    const isCustomDomain = environmentService.isCustomDomain(domain);
    const environmentType = environmentService.getEnvironmentForDomain(domain);
    const priorityOrder = environmentService.getStrategyPriorityOrderForUrl(url);
    
    // Store domain and environment info for debug headers
    strategyDiagnostics = {
      domainType: isWorkersDevDomain ? 'workers.dev' : (isCustomDomain ? 'custom' : 'other'),
      environmentType,
      isWorkersDevDomain,
      isCustomDomain,
      priorityOrder
    };
  }

  // Try each strategy in order of priority
  for (const strategy of sortedStrategies()) {
    try {
      // Skip disabled strategies if environment service is available
      if (environmentService) {
        const isEnabled = environmentService.isStrategyEnabledForUrl(strategy.name, request.url);
        if (!isEnabled) {
          logger.debug(`Strategy ${strategy.name} is disabled for this domain, skipping`);
          continue;
        }
      }
      
      if (strategy.canHandle(params)) {
        transformationAttempts.push(strategy.name);
        const response = await strategy.execute(params);
        return response;
      }
    } catch (error) {
      // Record error and continue to next strategy
      errors[strategy.name] = errorMessage;
    }
  }
  
  // If all strategies fail, serve directly from R2
  // ...
}
```

## WorkersDevStrategy Implementation

The `WorkersDevStrategy` was created specifically to handle workers.dev domains where Cloudflare Image Resizing has limitations:

```typescript
export class WorkersDevStrategy extends BaseTransformationStrategy {
  name = 'workers-dev';
  priority = 0; // Highest priority for workers.dev domains

  canHandle(params: TransformationStrategyParams): boolean {
    const { request, bucket, options } = params;
    
    // Only handle workers.dev domains with transformations
    const isWorkersDevDomain = request.url.includes('workers.dev') || 
                              (request.headers.get('host') || '').includes('workers.dev');
    
    if (!isWorkersDevDomain || !bucket) return false;
    
    const hasTransformations = !!options.width || !!options.height || 
                              !!options.format || !!options.quality;
      
    return hasTransformations;
  }

  async execute(params: TransformationStrategyParams): Promise<Response> {
    // Implementation details...
    // Returns original image with transformation metadata headers
  }
}
```

## Debugging

The system adds debug headers to help troubleshoot strategy selection:

1. `x-debug-strategy-attempts`: Lists all strategies that were attempted
2. `x-debug-strategy-selected`: Shows which strategy was ultimately used
3. `x-debug-strategy-failures`: Shows which strategies failed and why
4. `x-debug-domain-type`: Indicates whether the domain is workers.dev or custom
5. `x-debug-is-workers-dev`: Boolean indicating if this is a workers.dev domain

## Conclusion

This domain-specific strategy approach allows the image-resizer to work optimally on both workers.dev and custom domains, adapting its behavior based on the capabilities available in each environment.