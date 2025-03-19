# Enhanced Debug Headers

The enhanced debug headers system provides detailed visibility into image transformation processes, helping diagnose issues across different environments.

## Overview

Debug headers offer insights into:

1. Which transformation strategies were attempted
2. Which strategy was selected for the transformation
3. Which strategies failed and why
4. Domain and environment information
5. Strategy configuration for the current request

These headers are particularly useful for diagnosing environment-specific issues, such as differences between workers.dev domains and custom domains.

## Configuration Control

Debug headers respect the configuration in `wrangler.jsonc` and can be controlled through:

```jsonc
"vars": {
  "DEBUG_CONFIG": {
    "enabled": true,                // Master switch for debug headers
    "allowedEnvironments": [        // Environments where debug is enabled
      "development", 
      "staging"
    ],
    "isVerbose": false,             // Whether to include detailed information
    "includeHeaders": [             // Specific headers to include
      "strategy", 
      "cache", 
      "domain"
    ],
    "prefix": "debug-"              // Prefix for debug headers
  }
}
```

The following settings determine whether debug headers appear:

1. **Global enable flag**: The `enabled` property in DEBUG_CONFIG
2. **Environment allowlist**: The `allowedEnvironments` list in DEBUG_CONFIG
3. **Request header override**: Adding `x-debug: true` to a request

## Strategy Selection and Domain Considerations

The application handles two key dimensions: storage source and transformation strategy.

### Storage Source Priorities
The storage priority controls where images are located:
- **R2 Storage**: Local Cloudflare R2 storage (highest priority when enabled)
- **Remote Storage**: External HTTP source (secondary priority) 
- **Fallback Storage**: Default source when others fail

### Transformation Strategy Priorities
Once an image is located, the transformation strategy determines how it's processed:

- **Interceptor Strategy**: Best performance on custom domains
- **Direct URL Strategy**: Works on all domains
- **CDN-CGI Strategy**: Alternative approach that works on all domains
- **Direct Serving Strategy**: Minimal transformation approach

## Header Format

The prefix for all headers is configurable (default: `debug-`). Common headers include:

| Header Name | Description | Example Value |
|-------------|-------------|---------------|
| `debug-strategy-attempts` | Strategies that were attempted | `interceptor,cdn-cgi,direct-url` |
| `debug-strategy-selected` | Successfully used strategy | `cdn-cgi` |
| `debug-strategy-failures` | Failed strategies with errors | `interceptor:404 Not Found` |
| `debug-domain-type` | Type of domain | `workers.dev` or `custom` |
| `debug-environment` | Environment name | `development` |
| `debug-strategy-order` | Strategy priority order | `direct-url,cdn-cgi,direct-serving` |
| `debug-disabled-strategies` | Disabled strategies | `interceptor` |
| `debug-enabled-strategies` | Explicitly enabled strategies | `cdn-cgi,direct-url` |
| `debug-route-config` | Route configuration details | `{"pattern":"*.workers.dev/*"}` |

## Enabling Debug Headers

Debug headers can be enabled in three ways:

1. **Configuration-based**: Enable in `wrangler.jsonc` with DEBUG_CONFIG (recommended for development environments)
2. **Request-based**: Pass `x-debug: true` header in your request (works in any environment if allowed)
3. **Verbose mode**: Pass `x-debug-verbose: true` for additional detail (useful for troubleshooting)

Request-based debugging allows temporary access to debug information without changing the configuration.

## Using Debug Headers

### Basic Testing

```bash
# Enable debug headers for a single request
curl -H "x-debug: true" https://images.example.com/test.jpg

# Enable verbose debug headers
curl -H "x-debug-verbose: true" https://images.example.com/test.jpg

# View only debug headers
curl -H "x-debug: true" https://images.example.com/test.jpg \
  -o /dev/null -v 2>&1 | grep -i "debug-"
```

### Troubleshooting Tips

When diagnosing issues:

1. Check `debug-strategy-selected` to see which transformation approach was used
2. Examine `debug-strategy-failures` to identify why certain strategies failed
3. Verify `debug-environment` matches your expected environment
4. Compare configuration details in `debug-route-config` with your expectations

## Security Considerations

Debug headers are controlled by:

1. The `DEBUG_CONFIG.enabled` flag in configuration
2. The `DEBUG_CONFIG.allowedEnvironments` list in configuration

For production environments, it's recommended to either:
- Set `enabled: false` in DEBUG_CONFIG
- Exclude "production" from `allowedEnvironments` in DEBUG_CONFIG

This ensures debug information is only available in appropriate environments.