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

## Setup and Deployment

### Prerequisites

- Cloudflare account with Workers and Image Resizing enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Node.js 18.0.0 or later

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/image-resizer.git
   cd image-resizer
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure wrangler.jsonc
   - Update `account_id` with your Cloudflare account ID
   - Update `zone_id` values in routes sections
   - Configure environment variables for your deployment

4. Deploy to Cloudflare
   ```bash
   npm run deploy
   ```

### DNS Configuration

Add a DNS record to point to your worker:

```
# Example CNAME record
images.example.com.  IN  CNAME  your-worker.your-zone.workers.dev.
```

For custom domains, set up a route in the Cloudflare dashboard or via wrangler:

```jsonc
"routes": [
  {
    "pattern": "images.example.com/*",
    "zone_id": "your-zone-id"
  }
]
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
  alt="Example photo"
/>

<!-- Template-based image -->
<img 
  src="https://images.example.com/thumbnail/photo.jpg" 
  alt="Thumbnail image"
/>

<!-- Automatic responsive sizing (no srcset needed) -->
<img 
  src="https://images.example.com/photo.jpg?width=auto" 
  alt="Auto-responsive image"
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