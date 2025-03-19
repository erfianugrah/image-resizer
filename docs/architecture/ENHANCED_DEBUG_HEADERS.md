# Enhanced Debug Headers

This document describes the enhanced debug headers system for the image resizer application, which helps diagnose strategy selection and transformation issues across different environments.

## Overview

The enhanced debug headers provide detailed visibility into:

1. Which transformation strategies were attempted
2. Which strategy was selected for the transformation
3. Which strategies failed and why
4. Domain and environment information
5. Strategy configuration for the current request

These headers are particularly useful for diagnosing environment-specific issues, such as workers.dev domains vs. custom domains.

## Strategy Selection, Storage & Domain Considerations

Our configuration addresses two important dimensions: storage source and transformation strategy.

### Storage Source Priorities (ORIGIN_CONFIG)
The storage priority controls where we look for images:
- **R2 Storage**: Local Cloudflare R2 storage (highest priority when enabled)
- **Remote Storage**: External HTTP source (secondary priority)
- **Fallback Storage**: Default source when others fail

### Transformation Strategy Priorities (STRATEGIES_CONFIG)
Once we locate an image, the transformation strategy determines how we process it:

#### For Custom Domains (images.erfi.dev)
- **Interceptor Strategy**: Primary approach with best performance on custom domains
- **Direct URL Strategy**: Fallback if interceptor fails
- **CDN-CGI Strategy**: Disabled as no longer needed

#### For Workers.dev Domains
- **Direct URL Strategy**: Primary approach for workers.dev domains
- **Interceptor Strategy**: Disabled on workers.dev domains
- **CDN-CGI Strategy**: Disabled across all domains

### Relationship Between Storage and Transformation
- When using **R2 Storage**:
  - Custom domains: Interceptor strategy provides optimal performance
  - Workers.dev domains: Direct URL strategy works reliably
  
- When using **Remote Storage**:
  - All domains: Direct URL strategy is the recommended approach

### Implementation Details
Our configuration automatically selects the optimal strategy based on:
1. The domain type (custom vs workers.dev)
2. The storage source (R2 vs remote)
3. Environmental factors (development vs production)

The environment and domain detection happens automatically through the EnvironmentService.

## Header Format

| Header Name | Description | Example Value |
|-------------|-------------|---------------|
| `x-debug-strategy-attempts` | Comma-separated list of strategies that were attempted | `interceptor,cdn-cgi,direct-url` |
| `x-debug-strategy-selected` | The strategy that was successfully used | `cdn-cgi` |
| `x-debug-strategy-failures` | Semicolon-separated list of failed strategies with errors | `interceptor:404 Not Found;direct-url:Error transforming image` |
| `x-debug-domain-type` | Type of domain (workers.dev, custom, other) | `workers.dev` |
| `x-debug-environment` | Environment type (development, production, etc.) | `development` |
| `x-debug-is-workers-dev` | Whether the domain is a workers.dev domain | `true` |
| `x-debug-is-custom-domain` | Whether the domain is a custom domain | `false` |
| `x-debug-strategy-order` | Configured priority order of strategies | `cdn-cgi,direct-url,remote-fallback,direct-serving` |
| `x-debug-disabled-strategies` | Strategies disabled for this request | `interceptor` |
| `x-debug-enabled-strategies` | Strategies enabled for this request | `cdn-cgi,direct-url,remote-fallback,direct-serving` |
| `x-debug-route-config` | Route configuration details from environment service | `{"pattern":"*.workers.dev/*","environment":"development","hasStrategies":true}` |
| `x-debug-route-strategy-order` | Strategy order from route configuration | `cdn-cgi,direct-url,remote-fallback,direct-serving` |

## Enabling Debug Headers

Debug headers are enabled by passing a special header in your request:

```
x-debug: true
```

For more detailed information, use:

```
x-debug-verbose: true
```

## Curl Examples

### Basic Testing with Debug Headers

```bash
# Test on a workers.dev domain
curl -H "x-debug: true" https://dev-resizer.workers.dev/images/test.jpg

# Test on a custom domain
curl -H "x-debug: true" https://images.example.com/test.jpg
```

### Comparing Workers.dev and Custom Domain Behavior

```bash
# Test with verbose debug on workers.dev domain
curl -H "x-debug-verbose: true" https://dev-resizer.workers.dev/images/test.jpg \
  -o /dev/null -v 2>&1 | grep -i "x-debug"

# Test with verbose debug on custom domain
curl -H "x-debug-verbose: true" https://images.example.com/test.jpg \
  -o /dev/null -v 2>&1 | grep -i "x-debug"
```

## Interpreting the Results

When diagnosing domain-specific issues:

1. Compare the `x-debug-strategy-selected` header between workers.dev and custom domains
2. Check `x-debug-strategy-failures` to see which strategies failed and why
3. Verify `x-debug-disabled-strategies` to confirm domain-specific configuration is working
4. Look at `x-debug-route-config` to see which route pattern matched

## Common Patterns

### Workers.dev Domains (Expected Behavior)

- `x-debug-is-workers-dev: true`
- `x-debug-strategy-selected: cdn-cgi`
- `x-debug-disabled-strategies: interceptor`

### Custom Domains (Expected Behavior)

- `x-debug-is-custom-domain: true`
- `x-debug-strategy-selected: interceptor`
- `x-debug-disabled-strategies: ` (empty or missing)

## Troubleshooting

If the strategy selection doesn't match the expected behavior:

1. Check if the domain is correctly detected as workers.dev or custom using `x-debug-domain-type`
2. Examine the route configuration in `x-debug-route-config` to ensure it's matching the right pattern
3. Verify that the environment service is correctly determining strategy priority via `x-debug-strategy-order`
4. Check which strategies are attempted in `x-debug-strategy-attempts` and their order