# Cloudflare Image Resizing Worker

A TypeScript-based Cloudflare Worker that provides dynamic image transformation using Cloudflare's Image Resizing service. Built with a service-oriented architecture and command pattern for maintainability and extensibility.

## Features

- **Dynamic image resizing** - Resize images on-the-fly with explicit dimensions or responsive sizing
- **Format optimization** - Serve AVIF, WebP, or other formats based on browser support
- **Device detection** - Optimize image sizes for mobile, tablet, and desktop devices
- **Client hints support** - Use browser-provided information for precise sizing
- **Predefined templates** - Configure standard image transformations (thumbnails, avatars, etc.)
- **Path-based processing** - Apply transformations based on URL patterns
- **Remote bucket support** - Process images from multiple origins
- **Flexible deployment modes** - Run directly on your zone or as a proxy
- **Cache optimization** - Fine-grained cache control with TTL configuration
- **Debug capabilities** - Detailed headers and logs for troubleshooting

## New Configuration System

This project now features an improved, user-friendly configuration management system:

- **Configuration Assistant** - Simplified interfaces and templates for common use cases
- **Configuration CLI** - Interactive command-line tool for creating and managing configurations
- **Predefined Templates** - Ready-to-use configurations for e-commerce, blogs, and basic use cases
- **Enhanced Validation** - Comprehensive validation with detailed error reporting
- **Accessibility Features** - Colorblind mode and machine-readable outputs
- **JSON/JSONC Support** - Configuration format conversion utilities (YAML available with optional package)
- **Migration Utilities** - Tools for upgrading from older configuration versions

```bash
# View available configuration templates
npm run config:list

# Show details for a specific template
npm run config -- show-template ecommerce

# Create a new configuration using the interactive wizard
npm run config:create

# Validate an existing configuration
npm run config:validate
```

For detailed documentation on the configuration system, see [CONFIG.md](docs/CONFIG.md).

## Step-by-Step Setup Guide

This section provides a detailed, comprehensive guide to setting up and configuring the image-resizer worker.

### Prerequisites

- **Cloudflare Account**: Active account with Workers and Image Resizing enabled
- **Wrangler CLI**: [Install Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (v3.0.0 or later)
- **Node.js**: Version 18.0.0 or later
- **TypeScript**: Familiarity with TypeScript is helpful but not required

### 1. Installation

1. Clone the repository
   ```bash
   git clone https://github.com/erfianugrah/image-resizer.git
   cd image-resizer
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Verify the installation
   ```bash
   npm run typecheck
   npm test
   ```

### 2. Configuration Management

The worker offers two ways to manage configuration:

1. **Configuration CLI** - An interactive command-line tool for template-based configuration
2. **Manual Configuration** - Direct editing of the wrangler.jsonc file

#### Using the Configuration CLI

The configuration CLI provides an intuitive way to create and manage configurations:

```bash
# View available configuration templates
npm run config:list

# Show details for a specific template
npm run config -- show-template ecommerce

# Create a new configuration using the interactive wizard
npm run config:create

# Validate an existing configuration
npm run config:validate

# Convert between JSON and JSONC formats
npm run config:convert -- --input=config.json --output=wrangler.jsonc

# Migrate from older versions
npm run config:migrate -- --input=old-config.jsonc --output=new-config.jsonc --version=2.0
```

#### Manual wrangler.jsonc Configuration

The wrangler.jsonc file controls how your worker is deployed and configured. Let's break down each section:

#### Core Settings

```jsonc
{
  "name": "image-resizer",         // The name of your worker
  "main": "src/index.ts",          // Entry point TypeScript file
  "compatibility_date": "2025-01-01", // Cloudflare compatibility date
  "account_id": "YOUR_ACCOUNT_ID", // Your Cloudflare account ID
  
  // Resource limits to prevent unexpected billing
  "limits": {
    "cpu_ms": 50,                  // CPU time limit in milliseconds
    "memory_mb": 128               // Memory limit in megabytes
  },
  
  // Observability settings for monitoring
  "observability": {
    "enabled": true,               // Enable built-in monitoring
    "head_sampling_rate": 1        // Sampling rate for metrics
  },
  
  // Development server configuration
  "dev": {
    "port": 9001,                  // Local development port
    "local_protocol": "http",      // Protocol for local requests
    "upstream_protocol": "https"   // Protocol for upstream requests
  }
}
```

**Action required**: Update `account_id` with your Cloudflare account ID.

#### Shared Configuration Templates

The worker uses shared configuration templates to avoid duplication across environments:

```jsonc
"config_templates": {
  // Derivative templates define preset image transformations
  "derivative_templates": {
    "thumbnail": {
      "width": 320,                // Width in pixels
      "height": 150,               // Height in pixels
      "quality": 85,               // JPEG/WebP quality (1-100)
      "fit": "scale-down",         // Resize mode
      "metadata": "copyright",     // Metadata to preserve
      "sharpen": 1                 // Sharpening amount (0-10)
    },
    "avatar": {
      "width": 180,
      "height": 180,
      "quality": 90,
      "fit": "cover",              // Cover mode maintains aspect ratio by cropping
      "metadata": "none",          // Strip all metadata
      "gravity": "face"            // Focus on faces when cropping
    }
    // Add more templates as needed
  },
  
  // Path-to-template mappings for automatic transformations
  "path_templates": {
    "profile-pictures": "avatar",  // Apply avatar template to URLs containing "profile-pictures"
    "thumbnails": "thumbnail"      // Apply thumbnail template to URLs containing "thumbnails"
    // Add more mappings as needed
  },
  
  // Path transformations for remote mode
  "path_transforms": {
    "images": {
      "prefix": "",                // Prefix to add to the path
      "removePrefix": true         // Whether to remove the path segment from the URL
    },
    "assets": {
      "prefix": "img/",            // Add "img/" to paths containing "assets"
      "removePrefix": true
    }
    // Add more transforms as needed
  },
  
  // Standard responsive configuration for auto-sizing
  "responsive_config": {
    "availableWidths": [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840], // Available widths for resizing
    "breakpoints": [320, 768, 960, 1440, 1920], // CSS-like breakpoints
    "deviceWidths": {
      "mobile": 480,               // Default width for mobile devices
      "tablet": 768,               // Default width for tablets
      "desktop": 1440              // Default width for desktops
    },
    "quality": 85,                 // Default quality for responsive images
    "fit": "scale-down",           // Default fit mode
    "format": "auto"               // Automatically select best format
  },
  
  // Cache configuration by file type
  "cache_config": {
    "image": {
      "regex": "^.*\\.(jpe?g|png|gif|webp|svg)$", // Regex to match image files
      "ttl": {
        "ok": 31536000,            // 1 year cache for successful responses
        "redirects": 31536000,     // 1 year cache for redirects
        "clientError": 10,         // 10 second cache for 4xx errors
        "serverError": 1           // 1 second cache for 5xx errors
      },
      "cacheability": true,        // Whether to cache these files
      "mirage": false,             // Disables Cloudflare Mirage
      "imageCompression": "off"    // Disables additional compression
    }
  }
}
```

**Action required**: Customize these templates to match your image needs. Add/modify templates for different image types.

#### Environment Configurations

The worker supports multiple deployment environments:

```jsonc
"env": {
  // Development environment (direct mode)
  "direct": {
    "name": "direct-resizer",      // Worker name for this environment
    "vars": {
      "ENVIRONMENT": "development", // Environment name
      "DEPLOYMENT_MODE": "direct",  // Direct mode runs on your zone
      "VERSION": "1.1.0",           // Worker version
      
      // Logging configuration
      "LOGGING_CONFIG": {
        "level": "DEBUG",           // Log level (ERROR, WARN, INFO, DEBUG, TRACE)
        "includeTimestamp": true,   // Add timestamps to logs
        "enableStructuredLogs": true // Use JSON format for logs
      },
      
      // Debug headers for troubleshooting
      "DEBUG_HEADERS_CONFIG": {
        "enabled": true,            // Enable debug headers
        "prefix": "debug-",         // Prefix for debug headers
        "includeHeaders": ["ir", "cache", "mode", "client-hints"]
      },
      
      // Configuration references (use shared templates)
      "DERIVATIVE_TEMPLATES": "$config_templates.derivative_templates",
      "PATH_TEMPLATES": "$config_templates.path_templates",
      "CACHE_CONFIG": "$config_templates.cache_config",
      "RESPONSIVE_CONFIG": "$config_templates.responsive_config"
    },
    
    // Routes for this environment
    "routes": [
      {
        "pattern": "dev.images.example.com/*", // URL pattern to match
        "zone_id": "YOUR_ZONE_ID"              // Your zone ID
      }
    ]
  },
  
  // Remote mode (fetches from external origin)
  "remote": {
    "name": "remote-resizer",
    "vars": {
      "ENVIRONMENT": "development",
      "DEPLOYMENT_MODE": "remote",  // Remote mode fetches from another origin
      
      // Remote bucket configuration
      "REMOTE_BUCKETS": {
        "default": "https://cdn.example.com" // Default origin to fetch from
      },
      
      // Other settings similar to direct mode...
    }
  },
  
  // Production environment
  "prod": {
    "name": "prod-resizer",
    "vars": {
      "ENVIRONMENT": "production",
      "DEPLOYMENT_MODE": "remote",
      
      // Production-specific logging (minimal)
      "LOGGING_CONFIG": {
        "level": "WARN",            // Only log warnings and errors
        "includeTimestamp": true,
        "enableStructuredLogs": true
      },
      
      // Disable debug headers in production
      "DEBUG_HEADERS_CONFIG": {
        "enabled": false
      },
      
      // Production-specific overrides
      "RESPONSIVE_CONFIG": {
        "$extends": "$config_templates.responsive_config",
        "quality": 80              // Lower quality for production
      }
    }
  }
}
```

**Action required**:
1. Update all `zone_id` values with your Cloudflare zone IDs
2. Set appropriate route patterns for your domains
3. Configure `REMOTE_BUCKETS` to point to your image origins
4. Customize environment-specific settings

### 3. Deployment

1. Development deployment:
   ```bash
   wrangler dev --env direct
   # or
   npm run dev
   ```

2. Production deployment:
   ```bash
   wrangler deploy --env prod
   # or
   npm run deploy
   ```

3. Deploying to staging:
   ```bash
   wrangler deploy --env staging
   ```

## Deployment Modes

The worker supports two deployment modes:

### Direct Mode

In direct mode, the worker runs directly on the zone where your images are hosted.

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "direct"
}
```

This mode is optimal when:
- Your images are already on Cloudflare
- You want the simplest setup
- You need the best performance

### Remote Mode

In remote mode, the worker acts as a proxy, fetching images from remote origins.

```jsonc
"vars": {
  "DEPLOYMENT_MODE": "remote",
  "REMOTE_BUCKETS": {
    "default": "https://cdn.example.com",
    "marketing": "https://marketing-assets.example.com"
  }
}
```

This mode is optimal when:
- Your images are hosted on external services
- You need to transform images from multiple sources
- You want to use Cloudflare as a CDN/transformer without migrating assets

## Usage

### Basic Image Transformations

```
# Original image (uses automatic responsive sizing)
https://images.example.com/photo.jpg

# Explicit width
https://images.example.com/photo.jpg?width=800

# Width and height
https://images.example.com/photo.jpg?width=800&height=600

# Width and quality
https://images.example.com/photo.jpg?width=800&quality=90

# Force format
https://images.example.com/photo.jpg?format=webp

# Auto format (sends WebP/AVIF to supported browsers)
https://images.example.com/photo.jpg?format=auto

# Fit mode (cover, contain, scale-down, crop)
https://images.example.com/photo.jpg?width=800&height=600&fit=cover

# Metadata handling (keep, copyright, none)
https://images.example.com/photo.jpg?metadata=none

# DPR (device pixel ratio)
https://images.example.com/photo.jpg?width=800&dpr=2

# Gravity (auto, center, face, etc)
https://images.example.com/photo.jpg?width=800&height=800&fit=cover&gravity=face
```

### Using Templates

Apply predefined templates in two ways:

```
# Via path-based detection
https://images.example.com/thumbnails/photo.jpg

# Via explicit parameter
https://images.example.com/photo.jpg?derivative=thumbnail
```

### Responsive Images

The worker supports automatic responsive image sizing using:

1. **Client Hints** - Modern browsers can provide viewport and DPR information
2. **CF-Device-Type** - Uses Cloudflare's device detection
3. **User-Agent** - Fallback device detection

Enable responsive sizing:

```
# Explicit auto mode
https://images.example.com/photo.jpg?width=auto

# Default mode (when no width is specified)
https://images.example.com/photo.jpg
```

### HTML Implementation

For optimal responsive image implementation:

```html
<!-- Enable client hints -->
<meta http-equiv="Accept-CH" content="DPR, Width, Viewport-Width">
<meta http-equiv="Delegate-CH" content="Sec-CH-DPR https://images.example.com; Sec-CH-Width https://images.example.com; Sec-CH-Viewport-Width https://images.example.com">

<!-- Basic responsive image -->
<img 
  src="https://images.example.com/photo.jpg?width=800" 
  srcset="
    https://images.example.com/photo.jpg?width=320 320w,
    https://images.example.com/photo.jpg?width=768 768w,
    https://images.example.com/photo.jpg?width=1024 1024w,
    https://images.example.com/photo.jpg?width=1440 1440w
  "
  sizes="(max-width: 768px) 100vw, 800px"
  alt="Mountain landscape"
/>

<!-- Template-based image -->
<img 
  src="https://images.example.com/thumbnail/photo.jpg" 
  alt="Thumbnail mountain image"
/>

<!-- Automatic responsive sizing (no srcset needed) -->
<img 
  src="https://images.example.com/photo.jpg?width=auto" 
  alt="Auto-responsive mountain image"
/>
```

## Supported Parameters

| Parameter | Description | Values | Example |
|-----------|-------------|--------|---------|
| `width` | Image width in pixels (or "auto") | 10-8192, "auto" | `width=800` |
| `height` | Image height in pixels | 10-8192 | `height=600` |
| `fit` | Resize behavior | scale-down, contain, cover, crop, pad | `fit=cover` |
| `quality` | Compression quality | 1-100 | `quality=85` |
| `format` | Output format | auto, webp, avif, json, jpeg, png, gif | `format=webp` |
| `dpr` | Device pixel ratio | 1-5 | `dpr=2` |
| `metadata` | Metadata handling | keep, copyright, none | `metadata=none` |
| `gravity` | Focus area | auto, center, face, top, bottom, left, right | `gravity=face` |
| `sharpen` | Sharpen amount | 0-10 | `sharpen=1` |
| `brightness` | Brightness adjustment | -1 to 1 | `brightness=0.2` |
| `contrast` | Contrast adjustment | -1 to 1 | `contrast=0.1` |
| `derivative` | Template to apply | (configured templates) | `derivative=thumbnail` |

See [Cloudflare Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/url-format/) for a complete list.

## Advanced Features

### Security Configuration

```jsonc
"SECURITY_CONFIG": {
  "enableRateLimit": true,
  "requestsPerMinute": 300,
  "blockOverages": true,
  "allowedOrigins": [
    "https://cdn.example.com",
    "https://assets.example.com"
  ],
  "restrictReferrers": false,
  "allowedReferrers": [
    "https://example.com"
  ]
}
```

### Watermarking

```jsonc
"WATERMARK_CONFIG": {
  "enabled": true,
  "image": "https://example.com/watermark.png",
  "position": "center",  // center, bottom-right, top-left, etc.
  "opacity": 0.5,
  "scale": 0.2, // relative to image size
  "excludePaths": ["thumbnails", "avatars"]
}
```

### Resource Limits

```jsonc
"RESOURCE_LIMITS": {
  "maxWidth": 4000,
  "maxHeight": 4000,
  "maxPixels": 16000000, // 16MP
  "maxConcurrentRequests": 100,
  "timeoutMs": 15000
}
```

## Development

### Local Development

Start a local development server:

```bash
npm run dev
```

This starts a local server at http://localhost:9001 that simulates the Cloudflare Workers environment.

### Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage reporting:

```bash
npm run test:coverage
```

### TypeScript Validation

Check TypeScript correctness:

```bash
npm run typecheck
```

### Linting

Check code quality:

```bash
npm run lint
```

Automatically fix linting issues:

```bash
npm run lint:fix
```

### Configuration Validation

Validate configuration files:

```bash
npm run config:validate -- --file=wrangler.jsonc
```

### Configuration Tools

Create a new configuration:

```bash
npm run config:create
```

List available templates:

```bash
npm run config:list
```

Show template details:

```bash
npm run config -- show-template blog
```

## Project Architecture

The project uses a service-oriented architecture with domain-driven design principles:

### Directory Structure

```
├── docs/                         # Documentation
│   ├── CONFIG.md                 # Configuration guide
│   └── API.md                    # API documentation
├── src/
│   ├── index.ts                  # Main entry point
│   ├── config/                   # Configuration
│   │   ├── configManager.ts      # Configuration management
│   │   ├── configAssistant.ts    # User-friendly config assistance
│   │   ├── configValidator.ts    # Configuration validation
│   │   ├── environmentConfig.ts  # Environment settings
│   │   └── imageConfig.ts        # Image config schemas
│   ├── domain/                   # Domain model
│   │   └── commands/             # Command pattern implementations
│   │       └── TransformImageCommand.ts # Image transformation command
│   ├── handlers/                 # Request handlers
│   │   ├── imageHandler.ts       # Main request handler
│   │   ├── imageOptionsService.ts # Options determination
│   │   └── imageProcessingService.ts # Image processing
│   ├── services/                 # Services
│   │   ├── cacheManagementService.ts # Cache management
│   │   ├── debugService.ts       # Debug functionality
│   │   └── imageTransformationService.ts # Image transformation
│   ├── tools/                    # CLI tools and utilities
│   │   └── config-cli.ts         # Configuration CLI tool
│   └── utils/                    # Utilities
│       ├── cacheControlUtils.ts  # Cache control headers
│       ├── cacheUtils.ts         # Cache configuration
│       ├── clientHints.ts        # Client hints processing
│       ├── debugHeadersUtils.ts  # Debug headers
│       ├── deviceUtils.ts        # Device detection
│       ├── formatUtils.ts        # Format detection
│       ├── loggerUtils.ts        # Logging utilities
│       ├── loggingManager.ts     # Logging configuration
│       ├── optionsFactory.ts     # Image options factory
│       ├── pathUtils.ts          # Path processing
│       ├── responsiveWidthUtils.ts # Responsive sizing
│       ├── urlParamUtils.ts      # URL parameter handling
│       ├── urlTransformUtils.ts  # URL transformation
│       └── userAgentUtils.ts     # User-Agent parsing
```

For more details on the architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

## License

This project is licensed under the MIT License - see the LICENSE file for details.
