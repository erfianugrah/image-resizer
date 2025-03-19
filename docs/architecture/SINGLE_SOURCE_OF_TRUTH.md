# Single Source of Truth in Configuration

This document explains how `wrangler.jsonc` serves as the single source of truth for all configuration in the Image Resizer application.

## Configuration Philosophy

We follow these principles:

1. **Single Source of Truth**: `wrangler.jsonc` is the definitive place for all configuration.
2. **Schema Validation**: All configuration is validated against a defined schema.
3. **Type Safety**: TypeScript types are generated from schema definitions.
4. **Default Values**: Sensible defaults are defined in the schema, not in code.
5. **Environment-Specific Settings**: Different environments use the same structure with different values.
6. **Domain-Specific Overrides**: Route-based configurations allow for domain-specific behavior.

## Configuration Structure

The `wrangler.jsonc` file contains:

1. **Global Settings**: Worker name, compatibility date, etc.
2. **Environment-Specific Settings**: Contained in the `env` section.
3. **Domain-Specific Settings**: Contained in the `imageResizer.routes` section.

## How Configuration Is Loaded

1. The Cloudflare Workers runtime loads `wrangler.jsonc` at deploy time
2. The configuration is made available via global variable `__WRANGLER_CONFIG__`
3. Our `ConfigurationService` accesses and validates this global configuration
4. `ServiceRegistry` registers other services with validated configuration

This pattern ensures:
- Runtime errors if configuration is invalid
- Type safety throughout the application
- Consistent configuration format

## Configuration Schema

The schema is defined in `src/config/configSchema.ts` and includes:

```typescript
export const wranglerConfigSchema = z.object({
  name: z.string(),
  compatibility_date: z.string(),
  main: z.string(),
  env: z.record(environmentConfigSchema),
  imageResizer: imageResizerConfigSchema.optional(),
});
```

This approach ensures:
- Structural validation of all configuration values
- Consistent types across the application
- Clear documentation of expected configuration format

## Domain-Specific Configuration

The `imageResizer.routes` section allows configuration to vary based on URL patterns:

```jsonc
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

This pattern allows:
- Consistent behavior within each domain/environment
- Clear, declarative configuration rather than imperative code
- Easy visualization of domain-specific behavior

## Configuration Validation

The `ConfigValidator` service ensures all configuration is valid according to the schema:

```typescript
const validateWranglerConfig = (config: unknown): WranglerConfig => {
  try {
    // Parse and validate the config
    const validConfig = wranglerConfigSchema.parse(config);
    
    logger.debug('ConfigValidator', 'Wrangler config validated successfully');
    
    return validConfig;
  } catch (error) {
    logger.error('ConfigValidator', 'Invalid wrangler config', { error });
    throw new Error('Invalid wrangler configuration');
  }
};
```

This pattern:
- Catches configuration errors at startup
- Provides detailed error messages for invalid configuration
- Ensures runtime type safety

## Avoiding Hardcoded Values

All configuration values should come from `wrangler.jsonc` through the configuration system, not hardcoded in the application code. Default values should be specified in the schema, not scattered throughout the codebase.

✅ Do:
```typescript
// Define default in schema
const cacheConfigSchema = z.object({
  ttl: ttlSchema.default({
    ok: 86400,
    redirects: 86400,
    clientError: 60,
    serverError: 10
  }),
});

// Use the configuration value
const ttl = config.CACHE_CONFIG.image.ttl.ok;
```

❌ Don't:
```typescript
// Hardcoded value
const ttl = 86400;
```

## Debugging Configuration

Enhanced debug headers provide insight into the active configuration:

- `x-debug-is-workers-dev`: Whether the domain is a workers.dev domain
- `x-debug-environment`: Environment type (development, production, etc.)
- `x-debug-strategy-order`: Configured priority order of strategies
- `x-debug-disabled-strategies`: Strategies disabled for this request

To enable debug headers, add `x-debug: true` to your request headers.

## Conclusion

By maintaining `wrangler.jsonc` as the single source of truth, we ensure:

1. **Consistency**: All configuration follows the same format and validation
2. **Clarity**: It's obvious what configuration values are available and their purpose
3. **Reliability**: Type safety reduces runtime errors due to misconfigurations
4. **Maintainability**: Changes to configuration are centralized and documented

This approach provides a solid foundation for the application's configurability and adaptability across different environments and domains.