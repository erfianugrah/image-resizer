# Configuration System

This document outlines the configuration system for the Image Resizer application, which provides a flexible, environment-aware approach to image transformation.

## Configuration Components

The configuration system addresses three key concerns:

1. **Image Sources**: Where to find source images (R2, remote sources, fallbacks)
2. **Transformation Strategies**: How to transform images (different approaches for different environments)
3. **Debug & Logging**: Control of diagnostic information and logging behavior

## Storage Source Configuration

The `ORIGIN_CONFIG` variable controls image source priorities:

```jsonc
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

The system tries sources in the order specified in `default_priority`:
1. **R2 Storage**: Cloudflare R2 buckets (fastest, lowest cost)
2. **Remote Storage**: External HTTP sources
3. **Fallback Storage**: Backup sources for resilience

## Transformation Strategy Configuration

The `STRATEGIES_CONFIG` variable controls transformation approaches:

```jsonc
"STRATEGIES_CONFIG": {
  "priorityOrder": ["interceptor", "direct-url", "remote-fallback"],
  "disabled": ["cdn-cgi"],
  "enabled": []
}
```

Available transformation strategies include:
- **Interceptor Strategy**: Uses CF Worker subrequest interception (custom domains only)
- **Direct URL Strategy**: Uses URL with CF image options (all domains)
- **CDN-CGI Strategy**: Uses /cdn-cgi URL patterns (all domains)
- **Remote Fallback Strategy**: Uses external transformation services
- **Direct Serving Strategy**: Minimal transformation mode

## Domain-Specific Configuration

The `imageResizer.routes` section enables domain-specific behavior:

```jsonc
"imageResizer": {
  "routes": [
    {
      "pattern": "*.workers.dev/*",
      "strategies": {
        "priorityOrder": ["direct-url", "remote-fallback"],
        "disabled": ["interceptor"]
      }
    },
    {
      "pattern": "images.example.com/*",
      "strategies": {
        "priorityOrder": ["interceptor", "direct-url"],
        "disabled": []
      }
    }
  ]
}
```

This approach automatically adapts to different domain requirements.

## Debug Configuration

The `DEBUG_CONFIG` variable controls debug headers and logging:

```jsonc
"DEBUG_CONFIG": {
  "enabled": true,
  "allowedEnvironments": ["development", "staging"],
  "isVerbose": false,
  "includeHeaders": ["strategy", "cache", "domain"],
  "prefix": "debug-"
}
```

Key features:
- Environment-specific debug control
- Security through allowedEnvironments list
- Configurable header inclusion
- Header prefix customization

## Recommended Configurations

### For Development Environments

```jsonc
{
  "DEBUG_CONFIG": {
    "enabled": true
  },
  "STRATEGIES_CONFIG": {
    "priorityOrder": ["direct-url", "remote-fallback"],
    "disabled": ["interceptor"]
  }
}
```

### For Production Environments

```jsonc
{
  "DEBUG_CONFIG": {
    "enabled": false
  },
  "STRATEGIES_CONFIG": {
    "priorityOrder": ["interceptor", "direct-url", "remote-fallback"],
    "disabled": []
  }
}
```

## Configuration Precedence

The system follows this precedence model:
1. Route-specific configuration (for the matching domain/path)
2. Environment-specific configuration (dev, staging, prod)
3. Global configuration
4. Default values

## Related Documentation

- [Enhanced Debug Headers](./ENHANCED_DEBUG_HEADERS.md): Details on debug header functionality
- [Centralized Configuration](./SINGLE_SOURCE_OF_TRUTH.md): The Single Source of Truth model