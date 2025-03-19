# Centralized Configuration System

This document explains how `wrangler.jsonc` serves as the single source of truth for all configuration in the Image Resizer application.

## Configuration Philosophy

The application follows these key principles:

1. **Single Source of Truth**: `wrangler.jsonc` is the definitive location for all configuration
2. **Environment-Specific Settings**: Different environments use the same structure with different values
3. **Domain-Specific Behavior**: Route-based configuration enables domain-specific transformations
4. **Default Values**: Sensible defaults are defined in schema, not in code
5. **Type Safety**: TypeScript types ensure configuration correctness
6. **Schema Validation**: All configuration is validated against defined schemas

## Configuration Structure

The `wrangler.jsonc` file contains several key sections:

1. **Global Settings**: Worker name, compatibility date, resource limits, etc.
2. **Environment Settings**: Environment-specific configuration in the `env` section
3. **Domain Settings**: Domain-specific behavior in `imageResizer.routes`
4. **Debug Configuration**: Control of debug headers and logging

### Example Configuration

```jsonc
{
  "name": "image-resizer",
  "compatibility_date": "2023-12-01",
  
  "vars": {
    "DEBUG_CONFIG": {
      "enabled": true,
      "allowedEnvironments": ["development", "staging"],
      "isVerbose": false
    },
    "STRATEGIES_CONFIG": {
      "priorityOrder": ["interceptor", "direct-url", "cdn-cgi"],
      "disabled": [],
      "enabled": []
    }
  },
  
  "env": {
    "production": {
      "vars": {
        "DEBUG_CONFIG": {
          "enabled": false
        }
      }
    }
  },
  
  "imageResizer": {
    "routes": [
      {
        "pattern": "*.workers.dev/*",
        "strategies": {
          "disabled": ["interceptor"]
        }
      }
    ]
  }
}
```

## Domain-Specific Configuration

The `imageResizer.routes` section allows configuration to vary based on URL patterns:

```jsonc
"imageResizer": {
  "routes": [
    {
      "pattern": "*.workers.dev/*",
      "strategies": {
        "priorityOrder": ["direct-url", "cdn-cgi"],
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

This approach provides:
- Consistent behavior within each domain/environment
- Clear separation of configuration from code
- Adaptability to different domain requirements

## Debug Configuration

Debug headers and logging can be controlled via configuration:

```jsonc
"DEBUG_CONFIG": {
  "enabled": true,                // Master switch for debug
  "allowedEnvironments": [        // Only enable in these environments
    "development",
    "staging"
  ],
  "isVerbose": false,             // Detailed debug information
  "includeHeaders": [             // Specific header categories
    "strategy", 
    "cache", 
    "domain"
  ],
  "prefix": "debug-"              // Prefix for debug headers
}
```

Key features:
- Environment-specific debug control
- Granular header inclusion
- Configurable verbosity

## Configuration Best Practices

### Use Configuration Over Hardcoding

✅ Do:
```typescript
// Use the configuration value
const ttl = config.cache.ttl.ok;
```

❌ Don't:
```typescript
// Hardcoded value
const ttl = 86400;
```

### Leverage Configuration Precedence

The system follows a clear precedence model:
1. **Route-specific settings**: Highest priority (domain-specific)
2. **Environment-specific settings**: Next priority (env-specific)
3. **Global settings**: Baseline settings
4. **Default values**: When no configuration is provided

## Conclusion

The centralized configuration approach provides:

1. **Adaptability**: Easy changes across environments without code modifications
2. **Consistency**: Unified configuration structure across the application
3. **Reliability**: Type safety and validation prevent configuration errors
4. **Maintainability**: Changes are centralized and well-documented
5. **Security**: Environment-appropriate debug controls

This pattern forms the foundation for the application's flexibility and robustness across different deployment scenarios.