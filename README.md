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
   git clone https://github.com/yourusername/image-resizer.git
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

### 2. Configuring wrangler.jsonc

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

### 3. Customizing Core Settings

#### Account and Zone IDs

1. Find your Cloudflare account ID:
   - Log in to Cloudflare dashboard
   - Go to Workers & Pages
   - Your account ID is shown in the right sidebar

2. Find your zone ID:
   - Log in to Cloudflare dashboard
   - Select your domain
   - Zone ID is shown on the Overview page
   
3. Update wrangler.jsonc:
   ```jsonc
   "account_id": "your-account-id",
   // And in each environment's routes:
   "routes": [
     {
       "pattern": "your-domain.com/*",
       "zone_id": "your-zone-id" 
     }
   ]
   ```

#### Resource Limits

Adjust CPU and memory limits based on your needs:
```jsonc
"limits": {
  "cpu_ms": 50,    // Increase for more complex processing
  "memory_mb": 128 // Increase if handling very large images
}
```

### 4. Configuring Image Templates

Image templates define preset transformations:

1. Think about your common image use cases (thumbnails, headers, etc.)
2. Define dimensions, quality, and other parameters for each
3. Add to the `derivative_templates` section:

```jsonc
"large_banner": {
  "width": 1920,
  "height": 600,
  "quality": 85,
  "fit": "cover",
  "metadata": "none",
  "gravity": "auto"
}
```

4. Add path mappings in `path_templates`:
```jsonc
"banners": "large_banner"
```

### 5. Setting Up Remote Origins

If you're using remote mode to fetch images from external sources:

1. Configure your origins in `REMOTE_BUCKETS`:
```jsonc
"REMOTE_BUCKETS": {
  "default": "https://cdn.example.com",
  "marketing": "https://marketing-assets.example.com",
  "products": "https://product-images.example.com"
}
```

2. Set up path transformations if needed:
```jsonc
"PATH_TRANSFORMS": {
  "marketing": {
    "prefix": "campaign-images/",
    "removePrefix": true
  }
}
```

This would transform `/marketing/summer-sale.jpg` to fetch from `https://marketing-assets.example.com/campaign-images/summer-sale.jpg`.

### 6. DNS Configuration

1. Set up a DNS record to point to your worker:

```
# CNAME record (in your DNS provider or Cloudflare dashboard)
images.example.com.  IN  CNAME  your-worker.your-zone.workers.dev.
```

2. Configure route patterns in wrangler.jsonc:
```jsonc
"routes": [
  {
    "pattern": "images.example.com/*",
    "zone_id": "your-zone-id"
  }
]
```

3. For multiple domains:
```jsonc
"routes": [
  {
    "pattern": "images.example.com/*",
    "zone_id": "your-zone-id"
  },
  {
    "pattern": "media.example.org/*",
    "zone_id": "your-other-zone-id"
  }
]
```

### 7. Deployment

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

### 8. Testing Your Deployment

After deployment, verify functionality with these real-world examples:

1. Basic image request:
   ```
   https://images.erfi.dev/Granna_1.JPG
   ```
   ![Original Image](https://images.erfi.dev/Granna_1.JPG)

2. Resized image:
   ```
   https://images.erfi.dev/Granna_1.JPG?width=800&height=600
   ```
   ![Resized Image](https://images.erfi.dev/Granna_1.JPG?width=800&height=600)

3. Template-based transformation (thumbnail):
   ```
   https://images.erfi.dev/thumbnail/Granna_1.JPG
   ```
   ![Thumbnail](https://images.erfi.dev/thumbnail/Granna_1.JPG)

4. Responsive image:
   ```
   https://images.erfi.dev/Granna_1.JPG?width=auto
   ```
   ![Responsive Image](https://images.erfi.dev/Granna_1.JPG?width=auto)

5. Format conversion (WebP):
   ```
   https://images.erfi.dev/Granna_1.JPG?format=webp
   ```
   ![WebP Format](https://images.erfi.dev/Granna_1.JPG?format=webp)

6. Advanced transformation (fit cover + gravity):
   ```
   https://images.erfi.dev/Granna_1.JPG?width=800&height=400&fit=cover
   ```
   ![Advanced Transformation](https://images.erfi.dev/Granna_1.JPG?width=800&height=400&fit=cover)

If you receive errors, enable debug headers in your environment config and check the response headers for diagnostic information.

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

## Configuration Reference

### Environment Variables

All configuration is done through environment variables in wrangler.jsonc:

#### Core Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name (development, staging, production) | `"development"` |
| `DEPLOYMENT_MODE` | Deployment mode (direct, remote) | `"direct"` |
| `VERSION` | Worker version | `"1.0.0"` |
| `FALLBACK_BUCKET` | Default bucket for unmatched paths | - |

#### Image Transformation Templates

Define reusable sets of transformation parameters:

```jsonc
"DERIVATIVE_TEMPLATES": {
  "thumbnail": {
    "width": 320,
    "height": 150,
    "quality": 85,
    "fit": "scale-down",
    "metadata": "copyright",
    "sharpen": 1
  },
  "avatar": {
    "width": 180,
    "height": 180,
    "quality": 90,
    "fit": "cover",
    "metadata": "none",
    "gravity": "face"
  },
  "product": {
    "width": 800,
    "height": 800,
    "quality": 85,
    "fit": "contain",
    "background": "white"
  }
}
```

#### Path-based Template Mapping

Map URL path segments to templates:

```jsonc
"PATH_TEMPLATES": {
  "profile-pictures": "avatar",
  "hero-banners": "header",
  "thumbnails": "thumbnail", 
  "avatars": "avatar",
  "products": "product"
}
```

When the URL path contains one of these segments, the corresponding template is automatically applied.

#### Remote Bucket Configuration

For remote mode, define the origins to fetch from:

```jsonc
"REMOTE_BUCKETS": {
  "default": "https://cdn.example.com",
  "marketing": "https://marketing-assets.example.com",
  "products": "https://product-images.example.com"
}
```

#### Path Transformation Rules

Modify paths when fetching from remote buckets:

```jsonc
"PATH_TRANSFORMS": {
  "images": {
    "prefix": "",
    "removePrefix": true
  },
  "assets": {
    "prefix": "img/",
    "removePrefix": true
  },
  "content": {
    "prefix": "content-images/",
    "removePrefix": true
  }
}
```

#### Cache Configuration

Configure caching behavior by file type:

```jsonc
"CACHE_CONFIG": {
  "image": {
    "regex": "^.*\\.(jpe?g|JPG|png|gif|webp|svg)$",
    "ttl": {
      "ok": 31536000,        // 1 year for successful responses
      "redirects": 31536000, // 1 year for redirects
      "clientError": 60,     // 1 minute for client errors
      "serverError": 0       // No caching for server errors
    },
    "cacheability": true,
    "mirage": false,
    "imageCompression": "off"
  },
  "staticAssets": {
    "regex": "^.*\\.(css|js)$",
    "ttl": {
      "ok": 86400,           // 1 day
      "redirects": 86400,    // 1 day
      "clientError": 10,     // 10 seconds
      "serverError": 0       // No caching
    },
    "cacheability": true
  }
}
```

#### Responsive Configuration

Configure responsive sizing behavior:

```jsonc
"RESPONSIVE_CONFIG": {
  "availableWidths": [320, 640, 768, 960, 1024, 1440, 1920, 2048, 3840],
  "breakpoints": [320, 768, 960, 1440, 1920, 2048],
  "deviceWidths": {
    "mobile": 480,
    "tablet": 768,
    "desktop": 1440
  },
  "deviceMinWidthMap": {
    "mobile": 320,
    "tablet": 768,
    "large-desktop": 1920,
    "desktop": 960
  },
  "quality": 85,
  "fit": "scale-down",
  "metadata": "copyright",
  "format": "auto"
}
```

#### Debug Configuration

Configure debug headers:

```jsonc
"DEBUG_HEADERS_CONFIG": {
  "enabled": true,           // Set to false in production
  "prefix": "debug-",
  "includeHeaders": [
    "ir",                    // Image resizing parameters
    "cache",                 // Cache configuration
    "mode",                  // Deployment mode
    "client-hints",          // Client hints info
    "ua",                    // User-Agent info
    "device"                 // Device detection info
  ],
  "specialHeaders": {
    "x-processing-mode": true,
    "x-size-source": true,
    "x-actual-width": true,
    "x-responsive-sizing": true
  },
  "allowedEnvironments": [   // Restrict debugging to specific environments
    "development",
    "staging"
  ]
}
```

#### Logging Configuration

Configure logging behavior:

```jsonc
"LOGGING_CONFIG": {
  "level": "INFO",           // ERROR, WARN, INFO, DEBUG, TRACE
  "includeTimestamp": true,
  "enableStructuredLogs": true
}
```

### Security Configuration

#### CORS Configuration

```jsonc
"CORS_CONFIG": {
  "allowOrigins": ["https://example.com", "https://*.example.org"],
  "allowMethods": ["GET", "HEAD", "OPTIONS"],
  "allowHeaders": ["Content-Type", "If-Modified-Since"],
  "exposeHeaders": ["Content-Length", "Content-Type"],
  "maxAge": 86400,
  "credentials": false
}
```

#### Security Settings

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
<meta http-equiv="Delegate-CH" content="Sec-CH-DPR https://images.erfi.dev; Sec-CH-Width https://images.erfi.dev; Sec-CH-Viewport-Width https://images.erfi.dev">

<!-- Basic responsive image -->
<img 
  src="https://images.erfi.dev/Granna_1.JPG?width=800" 
  srcset="
    https://images.erfi.dev/Granna_1.JPG?width=320 320w,
    https://images.erfi.dev/Granna_1.JPG?width=768 768w,
    https://images.erfi.dev/Granna_1.JPG?width=1024 1024w,
    https://images.erfi.dev/Granna_1.JPG?width=1440 1440w
  "
  sizes="(max-width: 768px) 100vw, 800px"
  alt="Mountain landscape"
/>

<!-- Template-based image -->
<img 
  src="https://images.erfi.dev/thumbnail/Granna_1.JPG" 
  alt="Thumbnail mountain image"
/>

<!-- Automatic responsive sizing (no srcset needed) -->
<img 
  src="https://images.erfi.dev/Granna_1.JPG?width=auto" 
  alt="Auto-responsive mountain image"
/>
```

## Supported Parameters

The worker supports all Cloudflare Image Resizing parameters:

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

Additional parameters from Cloudflare are also supported. See [Cloudflare Image Resizing documentation](https://developers.cloudflare.com/images/image-resizing/url-format/) for a complete list.

## Response Headers

### Standard Headers

The worker sets the following headers on responses:

- `Content-Type` - Based on the image format
- `Cache-Control` - Based on cache configuration
- `CF-Cache-Status` - Cloudflare cache hit/miss status
- `CF-Polished` - If Cloudflare Polish was applied

### Client Hints Headers

To enable client hints in browsers:

- `Accept-CH` - Tells browsers which client hints are accepted
- `Critical-CH` - Marks critical client hints
- `Permissions-Policy` - Sets permissions for client hints

### Debug Headers

When debug mode is enabled:

- `debug-ir` - Image resizing parameters
- `debug-cache` - Cache configuration
- `debug-mode` - Processing mode information
- `debug-client-hints` - Client hints values
- `debug-ua` - User-Agent string
- `debug-device` - Device detection information

Special debug headers:

- `x-size-source` - How the size was determined
- `x-actual-width` - Actual width used
- `x-processing-mode` - Processing mode used
- `x-responsive-sizing` - Whether responsive sizing was used

## Troubleshooting

### Common Issues

| Issue | Description | Solution |
|-------|-------------|----------|
| 503 Service Unavailable | Image origin unreachable | Check that source images exist and are accessible |
| 400 Bad Request | Parameter validation error | Check parameter values against validation rules |
| 404 Not Found | Image not found | Verify image path and remote bucket configuration |
| 413 Payload Too Large | Source image too large | Ensure source image is within Cloudflare's size limits |
| Loop detection | Recursive request detected | Check for circular references in URL transformation |
| CORS errors | Cross-origin issues | Configure CORS_CONFIG with appropriate settings |
| Cache issues | Unexpected caching behavior | Check CACHE_CONFIG and Cache-Control headers |

### Debug Mode

Enable debug mode to get detailed information:

```
# Example debug header values
debug-ir: {"width":800,"height":600,"fit":"cover","format":"webp"}
debug-cache: {"cacheability":true,"ttl":{"ok":31536000}}
debug-mode: {"deploymentMode":"remote","transformedUrl":"..."}
debug-client-hints: {"sec-ch-viewport-width":"1024","sec-ch-dpr":"2"}
debug-device: {"type":"desktop","client-hints-available":true}
```

### Performance Optimization

1. **Cache Configuration**
   - Set appropriate TTLs for your content
   - Enable cacheability for static images
   - Configure appropriate client error caching (to avoid repeated bad requests)

2. **Format Optimization**
   - Use `format=auto` to serve modern formats to compatible browsers
   - Set quality around 80-85% for best size/quality balance
   - Use WebP or AVIF for best compression

3. **Responsive Sizing**
   - Implement client hints for precise sizing
   - Configure appropriate breakpoints for your site design
   - Use appropriate fit modes for your content

4. **Worker Configuration**
   - Disable debug headers in production
   - Optimize cache settings for your traffic patterns
   - Implement rate limiting for public-facing deployments

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

### Production Build

Build for production:

```bash
npm run build
```

### Deployment

Deploy to Cloudflare:

```bash
npm run deploy
```

Deploy to a specific environment:

```bash
npm run deploy:staging
# or
wrangler deploy --env staging
```

## Project Architecture

The project uses a service-oriented architecture with domain-driven design principles:

### Directory Structure

```
├── src/
│   ├── index.ts                  # Main entry point
│   ├── config/                   # Configuration
│   │   ├── configManager.ts      # Configuration management
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

### Key Components

- **Configuration Manager** - Centralized configuration management
- **Image Handler** - Main request processing coordination
- **Image Options Service** - Determines transformation parameters
- **Image Transformation Service** - Performs image transformations
- **Cache Management Service** - Handles caching operations
- **Debug Service** - Provides debug functionality
- **Command Pattern** - Encapsulates business logic in commands

### Request Flow

1. Request enters via `index.ts`
2. ConfigurationManager loads environment configuration
3. Request is checked for loops or bypass conditions
4. imageHandler coordinates processing:
   - Determines correct derivative/template
   - Processes URL parameters
   - Manages caching behavior
5. imageOptionsService determines transformation parameters
6. imageTransformationService transforms the image
7. Response is returned with appropriate headers and caching

## License

This project is licensed under the MIT License - see the LICENSE file for details.