# Image Resizer Configuration Guide

![Configuration Version](https://img.shields.io/badge/Config%20Version-2.0-blue)
![Last Updated](https://img.shields.io/badge/Updated-March%202025-green)

This document explains how to configure the Image Resizer worker effectively.

## Table of Contents

1. [Configuration Overview](#configuration-overview)
2. [Configuration Options](#configuration-options)
3. [Configuration Assistant](#configuration-assistant)
4. [Configuration CLI](#configuration-cli)
5. [Templates](#templates)
6. [Advanced Configuration](#advanced-configuration)
7. [Validation & Best Practices](#validation--best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Examples](#examples)

## Configuration Overview

The Image Resizer worker features a comprehensive, user-friendly configuration system that allows you to define:

- Image derivatives (presets like "thumbnail", "avatar", etc.)
- Responsive image settings
- Caching behavior
- URL pattern matching
- Debug options
- Security settings
- Resource limits
- And more

Configuration is stored in your `wrangler.jsonc` file, which includes environment-specific settings.

## What's New in Configuration System 2.0

Our latest configuration system includes several major improvements:

- **Configuration Assistant**: Simplified interfaces and templates for common use cases
- **Interactive CLI**: Command-line tool with colorblind mode and machine-readable outputs
- **Enhanced Templates**: Ready-to-use configs for e-commerce, blogs, and basic websites
- **Comprehensive Validation**: Schema and semantic validation with detailed error reporting
- **Conversion Utilities**: Tools for converting between JSON and JSONC formats
- **Migration Helpers**: Utilities to upgrade from older configuration versions
- **Schema Documentation**: Detailed type definitions and validation rules

## Configuration Options

### Core Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `ENVIRONMENT` | Environment name | `"production"` |
| `DEPLOYMENT_MODE` | Deployment mode (direct/remote) | `"remote"` |
| `VERSION` | Worker version | `"2.0.0"` |
| `FALLBACK_BUCKET` | Default fallback image source | `"https://cdn.example.com"` |

### Simplified Configuration Interface

The configuration assistant provides simplified interfaces for common settings:

#### Simple Derivative Configuration

```typescript
// Traditional complex derivative
const traditionalDerivative = {
  width: 320,
  height: 180,
  quality: 85,
  fit: "scale-down",
  metadata: "copyright",
  sharpen: 1
};

// New simplified derivative
const simpleDerivative = {
  name: "thumbnail",
  width: 320,
  height: 180,
  quality: 85,
  fit: "scale-down",
  preserveMetadata: true, // More intuitive than "metadata: copyright"
  sharpen: true           // Boolean instead of number
};
```

#### Simple Responsive Configuration

```typescript
// Traditional responsive config
const traditionalResponsive = {
  availableWidths: [320, 640, 768, 960, 1024, 1440, 1920],
  breakpoints: [320, 768, 960, 1440, 1920],
  deviceWidths: {
    mobile: 480,
    tablet: 768,
    desktop: 1440
  },
  quality: 85,
  fit: "scale-down",
  metadata: "copyright",
  format: "auto"
};

// New simplified responsive config
const simpleResponsive = {
  mobileWidth: 480,
  tabletWidth: 768,
  desktopWidth: 1440,
  quality: 85,
  autoFormat: true,
  preserveMetadata: true
};
```

#### Simple Cache Configuration

```typescript
// Traditional cache config
const traditionalCache = {
  method: "cache-api",
  debug: false,
  imageCompression: "lossy",
  mirage: true,
  ttl: {
    ok: 86400,
    redirects: 86400,
    clientError: 60,
    serverError: 0
  }
};

// New simplified cache config
const simpleCache = {
  enabled: true,
  ttl: 86400,
  cacheErrors: false,
  optimizeImages: true
};
```

### Derivative Templates

Derivative templates are predefined image transformation settings that can be applied by adding a `?derivative=name` parameter to the URL or via path matching.

```json
"DERIVATIVE_TEMPLATES": {
  "thumbnail": {
    "width": 320,
    "height": 180,
    "quality": 85,
    "fit": "scale-down",
    "metadata": "copyright",
    "sharpen": 1
  },
  "avatar": {
    "width": 100,
    "height": 100,
    "quality": 90,
    "fit": "cover",
    "metadata": "none",
    "gravity": "face"
  }
}
```

### Responsive Configuration

Controls how images are sized when no explicit dimensions are provided or when using `width=auto`.

```json
"RESPONSIVE_CONFIG": {
  "availableWidths": [320, 640, 768, 960, 1024, 1440, 1920, 2048],
  "breakpoints": [320, 768, 960, 1440, 1920, 2048],
  "deviceWidths": {
    "mobile": 480,
    "tablet": 768,
    "desktop": 1440
  },
  "quality": 85,
  "fit": "scale-down",
  "metadata": "copyright",
  "format": "auto"
}
```

### Cache Configuration

Controls how images are cached.

```json
"CACHE_CONFIG": {
  "image": {
    "regex": "^.*\\.(jpe?g|JPG|png|gif|webp|svg)$",
    "ttl": {
      "ok": 86400,
      "redirects": 86400,
      "clientError": 60,
      "serverError": 0
    },
    "cacheability": true,
    "mirage": false,
    "imageCompression": "off"
  }
}
```

### Debug Configuration

Controls debug headers and logging.

```json
"DEBUG_HEADERS_CONFIG": {
  "enabled": true,
  "prefix": "debug-",
  "includeHeaders": [
    "ir",
    "cache",
    "mode",
    "client-hints"
  ]
}
```

## Configuration Assistant

To simplify configuration management, we've created a Configuration Assistant that provides:

1. **Simplified Configuration Interface** - An easier way to define common settings
2. **Configuration Templates** - Predefined configuration setups for different use cases
3. **Configuration Validation** - Ensures your config is valid before deploying
4. **Configuration Summary** - Easy-to-read summaries of your configuration

### Using the Configuration Assistant

```typescript
import { 
  configTemplates, 
  applyConfigTemplate, 
  generateConfigSummary 
} from '../config/configAssistant';

// Apply an e-commerce template
const ecommerceConfig = applyConfigTemplate('ecommerce');

// Generate a readable summary
const summary = generateConfigSummary(ecommerceConfig);
console.log(summary);

// Get template descriptions
const templateDescriptions = getTemplateDescriptions();
console.log(templateDescriptions.ecommerce);
// Output: "Optimized for product images and catalogs"
```

### Configuration Templates

The system includes several pre-built templates:

```typescript
// Available templates
const templateNames = getTemplateNames();
// Returns: ["basic", "ecommerce", "blog"]

// Accessing a specific template
const blogTemplate = configTemplates.blog;
console.log(blogTemplate.description);
// Output: "Optimized for article images and content"
```

## Configuration CLI

The Configuration CLI provides a simple command-line interface for managing configurations.

### Installation

The CLI is included in the project - no separate installation required:

```bash
# Run with npm
npm run config:list

# Or directly
node src/tools/config-cli.ts list-templates
```

### Available Commands

| Command | Description |
|---------|-------------|
| `list-templates` | Lists available configuration templates |
| `show-template <name>` | Shows details for a specific template |
| `create` | Interactive wizard to create a configuration |
| `validate <file>` | Validates a configuration file |
| `convert` | Converts between formats (JSON/JSONC, YAML with optional package) |
| `migrate` | Upgrades from older configuration versions |
| `example` | Shows an example configuration |

### Command Examples

List available templates:
```bash
npm run config:list
```

Show template details:
```bash
npm run config -- show-template ecommerce
```

Create a new configuration using the wizard:
```bash
npm run config:create
```

Validate a configuration file:
```bash
npm run config:validate -- --file=wrangler.jsonc
```

Validate with different output formats:
```bash
# GitHub Actions format for CI/CD pipelines
npm run config:validate:ci

# JSON output for machine processing
npm run config:validate:all
```

Convert between JSON formats:
```bash
# Convert JSONC to standard JSON
npm run config:convert -- ./wrangler.jsonc ./config.json

# YAML conversion (requires optional yaml package)
npm install yaml  # Install the optional dependency first
npm run config:convert -- ./wrangler.jsonc ./config.yaml --format yaml
```

Accessibility features:
```bash
# Use colorblind-friendly colors
COLOR_MODE=colorblind npm run config:validate

# Disable colors completely
npm run config -- validate --no-color
```

## Templates

The Image Resizer includes several pre-defined templates for common use cases:

### Basic Template

Simple configuration with essential features, including basic thumbnails and responsive sizing.

**Derivatives:**
- Thumbnail (320×180px)
- Medium (800×450px)

**Responsive:**
- Mobile: 480px
- Tablet: 768px
- Desktop: 1440px

**Cache:**
- TTL: 1 day (86400 seconds)
- No error caching
- No additional optimization

### E-Commerce Template

Optimized for product images and catalogs, with templates for:
- Product thumbnails (200×200px, cover fit)
- Main product images (800×800px, contain fit)
- Zoom views (1600×1600px, high quality)
- Category banners (1200×400px, cover fit)

**Responsive:**
- Mobile: 480px
- Tablet: 768px
- Desktop: 1440px

**Cache:**
- TTL: 1 week (604800 seconds)
- Error caching enabled
- Image optimization enabled

### Blog/Content Template

Optimized for article images and content, with templates for:
- Article thumbnails (320×180px, crop fit)
- Featured images (1200×630px, social-optimized)
- Inline content images (800px width, scale-down)
- User avatars (100×100px, face detection)

**Responsive:**
- Mobile: 480px  
- Tablet: 768px
- Desktop: 1200px

**Cache:**
- TTL: 1 day (86400 seconds)
- Image optimization enabled

## Configuration Validation

The image resizer includes a robust validation system that checks:

1. **Schema Validation**: Ensures all config values have the correct types
2. **Semantic Validation**: Checks logical relationships between values
3. **Best Practices**: Warns about potentially problematic settings

The validation system now provides more detailed feedback:

```typescript
// Example validation result
{
  valid: false,
  errors: [
    "Derivative 'thumbnail' has width less than 10px (5)",
    "Path pattern 'images/(.*)' references unknown derivative 'nonexistent'"
  ],
  warnings: [
    "Cache TTL for server errors is set to more than 60 seconds (300), which may lead to prolonged outages",
    "Very large max-width (10000px) may cause performance issues"
  ]
}
```

Run validation to catch issues before deployment:

```bash
npm run config:validate
```

## Advanced Configuration

### Security Configuration

The image resizer supports additional security configurations:

```json
"SECURITY_CONFIG": {
  "cors": {
    "allowOrigins": ["https://example.com", "https://*.example.org"],
    "allowMethods": ["GET", "HEAD", "OPTIONS"],
    "allowHeaders": ["Content-Type", "If-Modified-Since"],
    "exposeHeaders": ["Content-Length", "Content-Type"],
    "maxAge": 86400,
    "credentials": false
  },
  "csp": {
    "enabled": true,
    "policy": {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "https://*.example.com"]
    }
  },
  "rateLimiting": {
    "enabled": true,
    "requestsPerMinute": 300,
    "blockOverages": false
  },
  "allowedReferrers": [
    "https://example.com",
    "https://*.example.org"
  ],
  "allowedIPs": [
    "203.0.113.0/24",
    "2001:db8::/32"
  ]
}
```

### Watermarking Configuration

Add automatic watermarking to images:

```json
"WATERMARK_CONFIG": {
  "enabled": true,
  "defaultWatermark": "logo",
  "position": "bottomright",
  "opacity": 0.7,
  "margin": 20,
  "minSize": 400,
  "watermarks": {
    "logo": {
      "imagePath": "/assets/watermark.png",
      "position": "bottomright",
      "opacity": 0.7,
      "margin": 20,
      "minSize": 400
    },
    "copyright": {
      "imagePath": "/assets/copyright.png",
      "position": "center",
      "opacity": 0.3
    }
  }
}
```

### Resource Limits

Prevent abuse with resource limitations:

```json
"LIMITS_CONFIG": {
  "maxSourceImageSize": 15728640, // 15MB
  "maxOutputImageSize": 5242880,  // 5MB
  "maxConcurrentRequests": 10,
  "timeoutMs": 15000,
  "maxTransformationsPerRequest": 5
}
```

## Best Practices

### Configuration Structure

1. **Use Templates as a Starting Point**:
   - Start with one of the provided templates
   - Customize based on your specific needs
   - Keep the structure consistent

2. **Environment-Specific Overrides**:
   - Use the base configuration for shared settings
   - Override only what's necessary in each environment
   - Keep production settings more conservative

3. **Derivatives Design**:
   - Design derivatives for specific UI components
   - Use descriptive names that indicate purpose
   - Keep dimensions aligned with common breakpoints

4. **Caching Strategy**:
   - Use shorter TTLs for development (e.g., 300 seconds)
   - Use longer TTLs for production (e.g., 86400 seconds / 1 day)
   - Avoid caching server errors for longer than 60 seconds

5. **Resource Limits**:
   - Set reasonable size limits (e.g., 15MB for source images)
   - Configure timeouts based on expected image sizes
   - Limit transformations per request to prevent abuse

6. **Security**:
   - Use strict CORS settings in production
   - Enable rate limiting for public-facing deployments
   - Configure allowed referrers to prevent hotlinking

## Troubleshooting

### Common Issues

1. **522 Errors with width=auto**:
   - Check that responsive configuration is correctly setup
   - Verify client hints integration is working correctly
   - Ensure `width=auto` parameter is being transformed properly

2. **Invalid Configuration Errors**:
   - Run `npm run config:validate` to identify specific issues
   - Check for typos in parameter names
   - Verify all required fields are present

3. **Derivative Not Applied**:
   - Verify the derivative name in URL matches the configuration
   - Check path templates for correct matching patterns
   - Confirm the derivative exists in the configuration

4. **Performance Issues**:
   - Adjust cache TTLs for better cache hit ratios
   - Check if limits are set too restrictively
   - Optimize derivative dimensions for common use cases

### Schema Errors vs. Semantic Errors

The validation system distinguishes between two types of errors:

1. **Schema Errors**: Type mismatches or missing required fields
   ```
   Schema error: DERIVATIVE_TEMPLATES.thumbnail.width must be a number
   ```

2. **Semantic Errors**: Logical problems with otherwise valid values
   ```
   Semantic error: Derivative 'thumbnail' has width less than the minimum (5px < 10px)
   ```

### Debug Mode

Enable debug mode to get detailed information:

```json
"DEBUG_HEADERS_CONFIG": {
  "enabled": true,
  "verbose": true,
  "includeHeaders": ["ir", "cache", "mode", "client-hints", "ua", "device"]
}
```

This adds the following debug headers to responses:

- `debug-ir`: Image resizing parameters 
- `debug-cache`: Cache configuration
- `debug-mode`: Processing mode information
- `debug-client-hints`: Client hints values
- `debug-ua`: User-Agent string
- `debug-device`: Device detection information

## Examples

### Complete Configuration Example

Here's a complete configuration example combining all the features:

```json
{
  "name": "image-resizer",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "account_id": "YOUR_ACCOUNT_ID",
  "limits": {
    "cpu_ms": 50,
    "memory_mb": 128
  },
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  },
  "dev": {
    "port": 9001,
    "local_protocol": "http",
    "upstream_protocol": "https"
  },
  "config_templates": {
    "derivative_templates": {
      "thumbnail": {
        "width": 320,
        "height": 180,
        "quality": 85,
        "fit": "scale-down",
        "metadata": "copyright",
        "sharpen": 1
      },
      "avatar": {
        "width": 100,
        "height": 100,
        "quality": 90,
        "fit": "cover",
        "metadata": "none",
        "gravity": "face"
      }
    },
    "responsive_config": {
      "availableWidths": [320, 640, 768, 960, 1024, 1440, 1920, 2048],
      "breakpoints": [320, 768, 960, 1440, 1920],
      "deviceWidths": {
        "mobile": 480,
        "tablet": 768,
        "desktop": 1440
      },
      "quality": 85,
      "fit": "scale-down",
      "format": "auto"
    },
    "cache_config": {
      "image": {
        "regex": "^.*\\.(jpe?g|png|gif|webp|svg)$",
        "ttl": {
          "ok": 86400,
          "redirects": 86400,
          "clientError": 60,
          "serverError": 0
        },
        "cacheability": true,
        "mirage": false,
        "imageCompression": "off"
      }
    }
  },
  "env": {
    "prod": {
      "name": "prod-resizer",
      "vars": {
        "ENVIRONMENT": "production",
        "DEPLOYMENT_MODE": "remote",
        "VERSION": "2.0.0",
        "DERIVATIVE_TEMPLATES": "$config_templates.derivative_templates",
        "RESPONSIVE_CONFIG": "$config_templates.responsive_config",
        "CACHE_CONFIG": "$config_templates.cache_config",
        "SECURITY_CONFIG": {
          "cors": {
            "allowOrigins": ["https://example.com"],
            "allowMethods": ["GET", "HEAD", "OPTIONS"],
            "maxAge": 86400
          },
          "rateLimiting": {
            "enabled": true,
            "requestsPerMinute": 300
          }
        },
        "DEBUG_HEADERS_CONFIG": {
          "enabled": false
        },
        "LOGGING_CONFIG": {
          "level": "WARN",
          "includeTimestamp": true,
          "enableStructuredLogs": true
        },
        "REMOTE_BUCKETS": {
          "default": "https://cdn.example.com"
        }
      },
      "routes": [
        {
          "pattern": "images.example.com/*",
          "zone_id": "YOUR_ZONE_ID"
        }
      ]
    }
  }
}
```

## Need Help?

If you have any questions or need assistance with your configuration, please:

1. Check the [GitHub repository](https://github.com/erfianugrah/image-resizer) for issues and discussions
2. Review the complete [API documentation](./API.md)
3. Run the configuration validation with verbose output: `npm run config:validate -- --verbose`
4. Contact us through the issue tracker
