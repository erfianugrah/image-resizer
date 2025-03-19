# Configuration System

This document describes the comprehensive configuration system for the image resizer application, which handles both storage source priorities and transformation strategies.

## Configuration Overview

The configuration system addresses two primary concerns:

1. **Where to find the source image** (storage source)
2. **How to transform the image** (transformation strategy)

These two dimensions are handled by separate but coordinated configuration components.

## Storage Source Configuration (ORIGIN_CONFIG)

The `ORIGIN_CONFIG` environment variable controls where we look for source images:

```js
"ORIGIN_CONFIG": {
  "default_priority": [
    "r2",
    "remote",
    "fallback"
  ],
  "r2": {
    "enabled": true,
    "binding_name": "IMAGES_BUCKET"
  },
  "remote": {
    "enabled": true
  },
  "fallback": {
    "enabled": true,
    "url": "https://cdn.example.com"
  }
}
```

### Storage Source Priorities

Sources are tried in the order specified in `default_priority`:

1. **R2 Storage**: When enabled, we look in Cloudflare R2 storage first
2. **Remote Storage**: External HTTP source (used if R2 disabled or image not found in R2)
3. **Fallback Storage**: Final backup source if others fail

## Transformation Strategy Configuration (STRATEGIES_CONFIG)

The `STRATEGIES_CONFIG` environment variable controls how we transform images once found:

```js
"STRATEGIES_CONFIG": {
  "priorityOrder": ["interceptor", "direct-url", "remote-fallback", "direct-serving"],
  "disabled": ["cdn-cgi"],
  "enabled": []
}
```

### Transformation Strategies

Different strategies for transforming images have different behaviors and compatibility:

1. **Interceptor Strategy**: Uses cf.image with subrequests - highly performant but only works on custom domains
2. **Direct URL Strategy**: Uses direct URL with cf.image properties - works on all domains
3. **Remote Fallback Strategy**: Fall back to remote transformation - works on all domains
4. **Direct Serving Strategy**: Serves images without transformation - works on all domains
5. **CDN-CGI Strategy**: Uses /cdn-cgi URL patterns - deprecated and disabled by default

## Domain-Specific Configuration

The configuration system automatically adapts to the domain type using `imageResizer.routes` in wrangler.jsonc:

```js
"imageResizer": {
  "routes": [
    {
      "pattern": "*.workers.dev/*",
      "strategies": {
        "priorityOrder": ["direct-url", "remote-fallback", "direct-serving"],
        "disabled": ["interceptor", "cdn-cgi"]
      }
    },
    {
      "pattern": "images.example.com/*",
      "strategies": {
        "priorityOrder": ["interceptor", "direct-url", "remote-fallback", "direct-serving"],
        "disabled": ["cdn-cgi"]
      }
    }
  ]
}
```

## Optimized Configurations

Based on extensive testing, we recommend:

### For Development (workers.dev domains)

```js
"STRATEGIES_CONFIG": {
  "priorityOrder": ["direct-url", "remote-fallback", "direct-serving"],
  "disabled": ["interceptor", "cdn-cgi"]
}
```

### For Production (custom domains)

```js
"STRATEGIES_CONFIG": {
  "priorityOrder": ["interceptor", "direct-url", "remote-fallback", "direct-serving"],
  "disabled": ["cdn-cgi"]
}
```

## Debugging Configuration

You can diagnose configuration issues using the enhanced debug headers by adding `x-debug: true` to your request headers. This will provide comprehensive information about:

1. Which storage source was used
2. Which transformation strategies were attempted
3. Which strategy succeeded
4. Domain and environment information

See [ENHANCED_DEBUG_HEADERS.md](./ENHANCED_DEBUG_HEADERS.md) for more details.

## Implementation Details

The configuration is implemented through several service components:

1. **ConfigurationService**: Loads and parses environment variables
2. **EnvironmentService**: Detects domain types and environment-specific settings
3. **StreamingTransformationService**: Applies the transformation strategy chain based on configuration

These services work together to provide a seamless, environment-aware transformation pipeline.