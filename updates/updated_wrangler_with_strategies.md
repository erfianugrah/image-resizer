# Updated Wrangler Configuration with Strategies

Below is an updated wrangler.jsonc configuration that includes environment-specific strategy configurations.

```jsonc
{
  "name": "image-resizer",
  "compatibility_date": "2023-09-01",
  "main": "src/index.ts",
  "routes": [
    {
      "pattern": "images.example.com/*",
      "zone_name": "example.com"
    }
  ],
  "env": {
    "development": {
      "name": "dev-image-resizer",
      "vars": {
        "ENVIRONMENT": "development",
        "DEBUG": "true",
        "LOG_LEVEL": "DEBUG",
        "R2_BUCKET_NAME": "dev-images",
        "IMAGES_PREFIX": "images",
        "REMOTE_URL": "https://dev-assets.example.com",
        "STRATEGIES_CONFIG": {
          "priorityOrder": ["direct-url", "remote-fallback", "direct-serving"],
          "disabled": ["interceptor", "cdn-cgi"],
          "enabled": []
        }
      },
      "r2_buckets": [
        {
          "binding": "IMAGES",
          "bucket_name": "dev-images",
          "preview_bucket_name": "dev-images-preview"
        }
      ]
    },
    "production": {
      "name": "image-resizer",
      "vars": {
        "ENVIRONMENT": "production",
        "DEBUG": "false",
        "LOG_LEVEL": "INFO",
        "R2_BUCKET_NAME": "prod-images",
        "IMAGES_PREFIX": "images",
        "REMOTE_URL": "https://assets.example.com",
        "STRATEGIES_CONFIG": {
          "priorityOrder": ["interceptor", "direct-url", "remote-fallback", "direct-serving"],
          "disabled": ["cdn-cgi"],
          "enabled": []
        }
      },
      "r2_buckets": [
        {
          "binding": "IMAGES",
          "bucket_name": "prod-images"
        }
      ]
    }
  },
  // Route configuration with domain-specific strategy settings
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
    ],
    "defaults": {
      "strategies": {
        "priorityOrder": ["interceptor", "direct-url", "remote-fallback", "direct-serving"],
        "disabled": ["cdn-cgi"]
      }
    }
  }
}
```

## Key Changes

1. **Environment-Specific Strategy Configuration**:
   - Development environment disables the interceptor strategy and prioritizes direct-url
   - Production environment enables interceptor as primary strategy and disables cdn-cgi

2. **Domain-Specific Configuration in `imageResizer.routes`**:
   - workers.dev domains: Disables interceptor strategy and uses direct-url as primary
   - Custom domains (images.example.com): Uses interceptor as primary strategy and disables cdn-cgi

3. **STRATEGIES_CONFIG Environment Variable**:
   This configuration object allows setting strategy priorities and enabling/disabling strategies:
   ```js
   "STRATEGIES_CONFIG": {
     "priorityOrder": ["direct-url", "remote-fallback", "direct-serving"],
     "disabled": ["interceptor", "cdn-cgi"],
     "enabled": []
   }
   ```

## Usage

The `STRATEGIES_CONFIG` environment variable will be loaded by the ConfigurationService and used by the EnvironmentService to determine which strategies are enabled or disabled for a specific domain.

Additionally, the route-specific configuration in `imageResizer.routes` allows for more granular control based on URL patterns, overriding the environment variable when a specific route matches.

### Strategy Notes

Based on our testing:
- The Interceptor strategy works excellently on custom domains for transforming R2 images through cf.image with subrequests
- The Direct URL strategy works reliably on all domains (workers.dev and custom) and should be the primary fallback
- The CDN-CGI strategy is now deprecated and disabled as it's no longer needed with proper configuration

## Testing

To test different configurations:

1. **Development Testing**:
   ```bash
   wrangler dev --env development
   ```

2. **Production Testing**:
   ```bash
   wrangler dev --env production
   ```

The enhanced debug headers will display which strategies are enabled, disabled, and the order they'll be attempted for each request.