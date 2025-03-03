# Cloudflare Image Resizing Worker

## Features

- **Dynamic image resizing** - Resize images on-the-fly with specific dimensions or automatic responsive sizing
- **Format optimization** - Automatically serve AVIF/WebP to supported browsers
- **Device detection** - Serve appropriately sized images based on device type
- **Client hints support** - Use browser-supplied information for optimal sizing
- **Predefined templates** - Define common image transformations (thumbnails, headers, etc.)
- **Path-based processing** - Apply transformations based on URL patterns
- **Remote bucket support** - Process images from various origins
- **Flexible deployment modes** - Run directly on your assets or as a proxy
- **Comprehensive caching** - Efficient cache control with tag support
- **Debug headers** - Built-in diagnostics to troubleshoot transformations
- **Structured logging** - Configurable logging system with multiple log levels

## Installation

### Prerequisites

- Cloudflare account with Workers and Image Resizing enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

### Quick Start

1. Clone the repository
   ```bash
   git clone https://github.com/erfianugrah/image-resizer.git
   cd image-resizer
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Update `wrangler.jsonc` with your Cloudflare account details and configuration

4. Deploy
   ```bash
   wrangler deploy
   ```

## Configuration

### Deployment Modes

The worker supports two deployment modes:

- **Direct mode** - Worker runs directly on the zone containing your images
- **Remote mode** - Worker runs as a proxy, fetching images from remote origins

### Configuration in wrangler.jsonc

Key configuration sections:

```jsonc
"env": {
  "prod": {
    "vars": {
      // Deployment mode (direct or remote)
      "DEPLOYMENT_MODE": "remote",
      // Current version for tracking
      "VERSION": "1.1.0",
      // Fallback bucket when no match is found
      "FALLBACK_BUCKET": "https://cdn.erfianugrah.com"

      // Predefined transformation templates
      "DERIVATIVE_TEMPLATES": {
        "header": {
          "width": 1600,
          "height": 73,
          "quality": 80,
          "fit": "scale-down",
          "metadata": "copyright"
        },
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

      // Path-to-template mappings
      "PATH_TEMPLATES": {
        "profile-pictures": "avatar",
        "hero-banners": "header",
        "header": "header",
        "thumbnail": "thumbnail",
        "avatars": "avatar",
        "products": "product"
      }

      // Remote bucket configuration (for remote mode)
      "REMOTE_BUCKETS": {
        "default": "https://cdn.erfianugrah.com"
      }

      // Path transformation rules (for remote mode)
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

      // Cache configuration
      "CACHE_CONFIG": {
        "image": {
          "regex": "^.*\\.(jpe?g|JPG|png|gif|webp|svg)$",
          "ttl": {
            "ok": 31536000,
            "redirects": 31536000,
            "clientError": 10,
            "serverError": 1
          },
          "cacheability": true,
          "mirage": false,
          "imageCompression": "off"
        },
        "staticAssets": {
          "regex": "^.*\\.(css|js)$",
          "ttl": {
            "ok": 86400,
            "redirects": 86400,
            "clientError": 10,
            "serverError": 1
          },
          "cacheability": true,
          "mirage": false,
          "imageCompression": "off"
        }
      }

      // Responsive configuration
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

      // Logging configuration
      "LOGGING_CONFIG": {
        "level": "DEBUG",
        "includeTimestamp": true,
        "enableStructuredLogs": true
      }

      // Debug headers configuration
      "DEBUG_HEADERS_CONFIG": {
        "enabled": true,
        "prefix": "debug-",
        "includeHeaders": ["ir", "cache", "mode", "client-hints", "ua", "device"],
        "specialHeaders": {
          "x-processing-mode": true,
          "x-size-source": true,
          "x-actual-width": true,
          "x-responsive-sizing": true
        }
      }
    }
  }
}
```

## Usage

### Basic Usage

```
# Original image (uses automatic responsive sizing)
https://images.erfi.dev/Granna_1.JPG

# Explicitly request responsive sizing
https://images.erfi.dev/Granna_1.JPG?width=auto

# Resized to specific width
https://images.erfi.dev/Granna_1.JPG?width=800

# Resized with quality control
https://images.erfi.dev/Granna_1.JPG?width=800&quality=90

# Force specific format
https://images.erfi.dev/Granna_1.JPG?format=webp
```

### Using Templates

```
# Apply header template via path
https://images.erfi.dev/header/Granna_1.JPG

# Apply thumbnail template via parameter
https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail
```

### Responsive Images

The worker supports responsive image sizing based on device detection:

1. **Client Hints** - Modern browsers can provide viewport information
2. **CF-Device-Type** - Cloudflare's device detection
3. **User-Agent** - Fallback device detection

#### Automatic Responsive Sizing

You can enable automatic responsive sizing in two ways:

1. **Default behavior** - Simply request an image without specifying width:
   ```
   https://images.erfi.dev/Granna_1.JPG
   ```

2. **Explicit auto mode** - Use the `width=auto` parameter:
   ```
   https://images.erfi.dev/Granna_1.JPG?width=auto
   ```

In both cases, the worker will:
- Analyze client hints (viewport width, DPR)
- Check for Cloudflare device type information
- Fall back to user agent detection if needed
- Select the appropriate width based on the detected device characteristics
- Apply the responsive sizing automatically

This is ideal for scenarios where you don't want to manage srcset manually or when you need a simple way to deliver appropriately sized images.

#### Responsive Image Sizing Logic

The worker implements a sophisticated multi-layered approach for determining the optimal image size:

1. **Client Hints Detection**
   - Checks for `Sec-CH-Viewport-Width` and `Sec-CH-DPR` headers
   - Calculates optimal width based on viewport size and device pixel ratio
   - This is the most accurate method when browsers support client hints

2. **Cloudflare Device Type Detection**
   - Uses Cloudflare's `CF-Device-Type` header (mobile, tablet, desktop)
   - Maps device types to predefined widths from the configuration
   - More reliable than User-Agent detection but less precise than client hints

3. **User-Agent Detection**
   - Parses User-Agent string to identify device type
   - Applies width mapping based on device type 
   - Used as a fallback when other methods are unavailable

4. **Width Selection**
   - Selects width from configured breakpoints that best matches the detected device
   - For high-DPI devices, multiplies width by the device pixel ratio (when available)
   - Ensures width is within configured minimum and maximum limits

5. **Format Selection**
   - Automatically selects AVIF for browsers that support it
   - Falls back to WebP for browsers with WebP support
   - Uses original format as final fallback

You can track which method was used by examining the `x-size-source` response header.

#### Traditional Responsive Implementation

For maximum browser compatibility and control, you can also use the traditional srcset approach:

```html
<!-- In your HTML -->
<meta http-equiv="Delegate-CH" content="sec-ch-dpr https://images.erfi.dev; sec-ch-viewport-width https://images.erfi.dev"/>

<!-- Using srcset for optimal browser support -->
<img 
  src="/Granna_1.JPG?width=800" 
  srcset="
    /Granna_1.JPG?width=320 320w,
    /Granna_1.JPG?width=768 768w,
    /Granna_1.JPG?width=1024 1024w,
    /Granna_1.JPG?width=1600 1600w
  "
  sizes="(max-width: 768px) 100vw, 768px"
  alt="Description"
/>
```

## Supported Parameters

The worker supports all Cloudflare Image Resizing parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `width` | Image width in pixels or "auto" for responsive sizing | `width=800`, `width=auto` |
| `height` | Image height in pixels | `height=600` |
| `fit` | Resizing behavior | `fit=cover`, `fit=contain`, `fit=scale-down` |
| `quality` | Compression quality (1-100) | `quality=80` |
| `format` | Output format | `format=webp`, `format=avif` |
| `dpr` | Device pixel ratio | `dpr=2` |
| `metadata` | Metadata handling | `metadata=copyright`, `metadata=none` |
| `gravity` | Focus area | `gravity=auto`, `gravity=face` |
| `brightness`, `contrast`, etc. | Image adjustments | `brightness=10` |

See [Cloudflare docs](https://developers.cloudflare.com/images/image-resizing/url-format/) for the complete list.

## Architecture

The worker uses a modular architecture with clear separation of concerns:

```
├── src/
│   ├── index.js                  # Main entry point
│   ├── config/                   # Configuration
│   │   ├── environmentConfig.js  # Environment settings
│   │   └── imageConfig.js        # Image transformation config
│   ├── handlers/                 # Core handlers
│   │   ├── imageHandler.js       # Main image request handler
│   │   ├── imageOptionsService.js # Image transformation options
│   │   └── imageProcessingService.js # Image processing logic
│   └── utils/                    # Utility modules
│       ├── cacheControlUtils.js  # Cache control headers
│       ├── cacheUtils.js         # Cache configuration
│       ├── clientHints.js        # Client hints processing
│       ├── debugHeadersUtils.js  # Debug headers
│       ├── deviceUtils.js        # Device detection
│       ├── formatUtils.js        # Format detection
│       ├── loggerUtils.js        # Logging utilities
│       ├── loggingManager.js     # Logging configuration
│       ├── pathUtils.js          # Path processing
│       ├── responsiveWidthUtils.js # Responsive sizing
│       ├── urlParamUtils.js      # URL parameter handling
│       ├── urlTransformUtils.js  # URL transformation
│       └── userAgentUtils.js     # User-Agent parsing
```

### Core Components

- **Entry point (`src/index.js`)**: 
  - Handles initial request routing 
  - Maintains environment configuration
  - Implements request loop prevention logic
  - Determines when to apply image processing

- **Image handler (`src/handlers/imageHandler.js`)**: 
  - Orchestrates the overall image processing workflow
  - Extracts information from the request
  - Coordinates between different services
  - Handles request transformation for remote mode

- **Image options service (`src/handlers/imageOptionsService.js`)**: 
  - Determines the appropriate transformation options
  - Handles explicit parameters, templates, and auto-responsive modes
  - Applies parameter overrides and format detection

- **Image processing service (`src/handlers/imageProcessingService.js`)**:
  - Applies the transformations via Cloudflare's service
  - Manages cache settings and tags
  - Handles responses and error conditions
  - Sets debug and client hints headers

### Utility Modules

- **Format utilities (`src/utils/formatUtils.js`)**: 
  - Handles format detection and content type mapping
  - Determines optimal format based on Accept headers

- **Path utilities (`src/utils/pathUtils.js`)**:
  - Extracts derivatives from URL paths
  - Determines file types and extracts filenames

- **URL parameter utilities (`src/utils/urlParamUtils.js`)**:
  - Extracts and validates parameters
  - Handles width calculations and snapping

- **Client hints utilities (`src/utils/clientHints.js`)**:
  - Processes client hints headers for responsive images
  - Calculates optimal width based on viewport and DPR

- **Device detection utilities (`src/utils/deviceUtils.js` & `src/utils/userAgentUtils.js`)**:
  - Identifies device types from various sources
  - Determines appropriate image sizes for each device type

- **URL transformation utilities (`src/utils/urlTransformUtils.js`)**:
  - Handles remote bucket request transformations
  - Manages path prefixes and transformations
  - Preserves non-image-specific parameters

- **Cache control utilities (`src/utils/cacheUtils.js` & `src/utils/cacheControlUtils.js`)**:
  - Manages cache headers and TTLs
  - Generates appropriate cache tags
  - Determines cacheability based on file types

- **Responsive width utilities (`src/utils/responsiveWidthUtils.js`)**:
  - Handles automatic width determination
  - Coordinates between different detection methods
  - Calculates responsive heights based on aspect ratios

### Data Flow

1. Request comes in via `index.js`
2. Request is analyzed for loops and to determine eligibility for processing
3. `imageHandler.js` orchestrates the process:
   - Transforms URL for remote buckets if needed
   - Determines appropriate derivative/template
   - Gets cache configuration
4. `imageOptionsService.js` determines transformation options:
   - Prioritizes explicit parameters
   - Falls back to derivatives/templates when appropriate
   - Uses responsive sizing as a last resort
5. `imageProcessingService.js` applies transformations:
   - Sets up Cloudflare fetch options
   - Processes the image via Cloudflare's API
   - Handles response and adds debug headers
6. Response is returned to the client

## Demo

This section demonstrates the various image transformation capabilities of the Cloudflare Image Resizing Worker using a sample image.

### Basic Transformations

#### Original Image (Automatic Responsive Sizing)
![Original Image](https://images.erfi.dev/Granna_1.JPG)
```
https://images.erfi.dev/Granna_1.JPG
```

#### Explicit Responsive Sizing
![Responsive Sizing](https://images.erfi.dev/Granna_1.JPG?width=auto)
```
https://images.erfi.dev/Granna_1.JPG?width=auto
```

#### Specific Width (800px)
![Width 800px](https://images.erfi.dev/Granna_1.JPG?width=800)
```
https://images.erfi.dev/Granna_1.JPG?width=800
```

#### Custom Dimensions (800x600)
![Custom Dimensions](https://images.erfi.dev/Granna_1.JPG?width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?width=800&height=600
```

#### Custom Quality (90%)
![Custom Quality](https://images.erfi.dev/Granna_1.JPG?quality=90)
```
https://images.erfi.dev/Granna_1.JPG?quality=90
```

### Template-Based Transformations

#### Header Template via Path
![Header Derivative](https://images.erfi.dev/header/Granna_1.JPG)
```
https://images.erfi.dev/header/Granna_1.JPG
```

#### Thumbnail Template via Path
![Thumbnail Derivative](https://images.erfi.dev/thumbnail/Granna_1.JPG)
```
https://images.erfi.dev/thumbnail/Granna_1.JPG
```

#### Header Template via Parameter
![Header Parameter](https://images.erfi.dev/Granna_1.JPG?derivative=header)
```
https://images.erfi.dev/Granna_1.JPG?derivative=header
```

#### Thumbnail Template via Parameter
![Thumbnail Parameter](https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail)
```
https://images.erfi.dev/Granna_1.JPG?derivative=thumbnail
```

### Format Control

#### Force WebP Format
![WebP Format](https://images.erfi.dev/Granna_1.JPG?format=webp)
```
https://images.erfi.dev/Granna_1.JPG?format=webp
```

#### Force AVIF Format
![AVIF Format](https://images.erfi.dev/Granna_1.JPG?format=avif)
```
https://images.erfi.dev/Granna_1.JPG?format=avif
```

#### Auto Format Based on Browser Support
![Auto Format](https://images.erfi.dev/Granna_1.JPG?format=auto)
```
https://images.erfi.dev/Granna_1.JPG?format=auto
```

### Fit Modes

#### Resize Mode: Contain
![Fit Contain](https://images.erfi.dev/Granna_1.JPG?fit=contain&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=contain&width=800&height=600
```

#### Resize Mode: Cover
![Fit Cover](https://images.erfi.dev/Granna_1.JPG?fit=cover&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=cover&width=800&height=600
```

#### Resize Mode: Crop
![Fit Crop](https://images.erfi.dev/Granna_1.JPG?fit=crop&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=crop&width=800&height=600
```

#### Resize Mode: Scale-down
![Fit Scale-down](https://images.erfi.dev/Granna_1.JPG?fit=scale-down&width=800&height=600)
```
https://images.erfi.dev/Granna_1.JPG?fit=scale-down&width=800&height=600
```

### Metadata Control

#### Metadata Handling: None
![Metadata None](https://images.erfi.dev/Granna_1.JPG?metadata=none)
```
https://images.erfi.dev/Granna_1.JPG?metadata=none
```

#### Metadata Handling: Copyright
![Metadata Copyright](https://images.erfi.dev/Granna_1.JPG?metadata=copyright)
```
https://images.erfi.dev/Granna_1.JPG?metadata=copyright
```

#### Metadata Handling: Keep
![Metadata All](https://images.erfi.dev/Granna_1.JPG?metadata=keep)
```
https://images.erfi.dev/Granna_1.JPG?metadata=keep
```

### Image Adjustments

#### Brightness Adjustment (+20)
![Brightness Adjustment](https://images.erfi.dev/Granna_1.JPG?brightness=20)
```
https://images.erfi.dev/Granna_1.JPG?brightness=20
```

#### Contrast Adjustment (+30)
![Contrast Adjustment](https://images.erfi.dev/Granna_1.JPG?contrast=30)
```
https://images.erfi.dev/Granna_1.JPG?contrast=30
```

#### Sharpen Adjustment (5)
![Sharpen Adjustment](https://images.erfi.dev/Granna_1.JPG?sharpen=5)
```
https://images.erfi.dev/Granna_1.JPG?sharpen=5
```

### Combined Transformations

#### Thumbnail with WebP Format
![Thumbnail WebP](https://images.erfi.dev/thumbnail/Granna_1.JPG?format=webp)
```
https://images.erfi.dev/thumbnail/Granna_1.JPG?format=webp
```

#### Header with Custom Quality
![Header Custom Quality](https://images.erfi.dev/header/Granna_1.JPG?quality=95)
```
https://images.erfi.dev/header/Granna_1.JPG?quality=95
```

#### Custom Size with Specific Format and Fit
![Complex Transformation](https://images.erfi.dev/Granna_1.JPG?width=1200&height=675&format=webp&fit=cover&quality=85)
```
https://images.erfi.dev/Granna_1.JPG?width=1200&height=675&format=webp&fit=cover&quality=85
```

### HTML Implementation Example

For responsive images in HTML, use the following pattern:

```html
<img 
  src="https://images.erfi.dev/Granna_1.JPG?width=800" 
  srcset="
    https://images.erfi.dev/Granna_1.JPG?width=320 320w,
    https://images.erfi.dev/Granna_1.JPG?width=768 768w,
    https://images.erfi.dev/Granna_1.JPG?width=1024 1024w,
    https://images.erfi.dev/Granna_1.JPG?width=1600 1600w
  "
  sizes="(max-width: 768px) 100vw, 768px"
  alt="Granna landscape"
/>
```

## Troubleshooting

### Response Headers

#### Client Hints Headers

The worker always includes client hints headers in responses to enable responsive image functionality:

- `Accept-CH` - Tells browsers which client hints the server accepts
- `Critical-CH` - Marks critical client hints
- `Permissions-Policy` - Sets permissions for client hints

These headers are essential for the responsive image sizing functionality to work properly with browsers that support client hints:

```
Accept-CH: Sec-CH-DPR, Sec-CH-Viewport-Width, Width, Viewport-Width
Permissions-Policy: ch-dpr=(self), ch-viewport-width=(self)
Critical-CH: Sec-CH-DPR, Sec-CH-Viewport-Width
```

#### Debug Headers

The worker can also include optional debug headers (can be disabled in production):

- `debug-ir` - Image transformation options
- `debug-cache` - Cache configuration
- `debug-mode` - Processing mode and request transformation info
- `debug-client-hints` - Client hints values received from browser
- `debug-ua` - User-Agent string
- `debug-device` - Device detection information
- `x-size-source` - Source of size determination (explicit, client-hints, device-type, etc.)
- `x-actual-width` - The actual width used for the image
- `x-processing-mode` - Processing mode (explicit, responsive, or template)
- `x-responsive-sizing` - Whether responsive sizing was used

Example debug header values:
```
# Regular explicit width
x-size-source: explicit-width
debug-ir: {"width":800,"source":"explicit-width","format":"avif"}

# Auto width (with responsive sizing fallback)
x-size-source: explicit-params-fallback
debug-ir: {"width":1024,"metadata":"copyright","format":"avif","source":"explicit-params-fallback"}

# Complete debug headers example
debug-ir: {"width":1200,"quality":85,"fit":"scale-down","metadata":"copyright","format":"avif","source":"ua-desktop"}
debug-cache: {"cacheability":true,"imageCompression":"off","mirage":false,"ttl":{"ok":31536000,"redirects":31536000,"clientError":10,"serverError":1}}
debug-mode: {"deploymentMode":"remote","isRemoteFetch":true,"originalUrl":"https://images.example.com/photo.jpg","transformedUrl":"https://cdn.example.com/photo.jpg","bucketName":"default"}
debug-client-hints: {"sec-ch-viewport-width":null,"sec-ch-dpr":null,"width":null,"viewport-width":null,"cf-device-type":"desktop"}
debug-ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
debug-device: {"cf-device-type":"desktop","client-hints-available":false,"device-detection-method":"ua-desktop"}
```

When using `width=auto`, you'll see "explicit-params-fallback" as the source in the debug headers, indicating that the responsive sizing system automatically determined the width based on device characteristics.

### Common Issues

- **"Too many redirects"** - Check for request loops in your worker routes
- **"Unsupported image format"** - Ensure the source is a valid image format
- **Incorrect sizing** - Check debug headers to see how sizing decisions are made
- **Deployment warnings** - Ensure all environment variables are duplicated in each environment section
- **Deployment failures** - Check that your wrangler.toml doesn't contain unsupported fields

### Logging System

The worker includes a comprehensive logging system with multiple log levels:

- **ERROR** - Critical errors that prevent proper functioning
- **WARN** - Warning conditions that don't prevent operation
- **INFO** - Important operational information
- **DEBUG** - Detailed information for debugging
- **TRACE** - Very detailed tracing information

You can configure the logging level and format in the `LOGGING_CONFIG` environment variable:

```toml
LOGGING_CONFIG = '''
{
  "level": "INFO",          # Set log level (ERROR, WARN, INFO, DEBUG, TRACE)
  "includeTimestamp": true, # Include ISO timestamp in logs
  "enableStructuredLogs": true # Use structured format for logs
}
'''
```

In production environments, it's recommended to set the level to "WARN" or "INFO" to reduce log volume.

### Performance Optimization

For optimal performance in production:

1. **Disable Debug Headers**: Set `"enabled": false` in DEBUG_HEADERS_CONFIG
2. **Adjust Cache TTLs**: Set longer TTLs for production images in CACHE_CONFIG
3. **Format Optimization**: Let the worker automatically serve AVIF/WebP based on browser support
4. **Configure Responsive Breakpoints**: Define breakpoints that match your website's design
5. **Set Appropriate Quality Levels**: Balance quality and file size (80-85% is often a good compromise)
6. **Enable Polish**: For formats that support it, enable Cloudflare's Polish optimization

Example production configuration:

```toml
DEBUG_HEADERS_CONFIG = '''{"enabled": false}'''
LOGGING_CONFIG = '''{"level": "WARN"}'''
CACHE_CONFIG = '''{"image": {"ttl": {"ok": 31536000}}}'''
RESPONSIVE_CONFIG = '''{"quality": 82}'''
```

## Extending the Worker

### Adding New Derivatives

To add new image transformation templates:

1. Update the `DERIVATIVE_TEMPLATES` configuration in your wrangler.toml:
   ```toml
   DERIVATIVE_TEMPLATES = '''
   {
     "banner": {
       "width": 2000,
       "height": 800,
       "quality": 85,
       "fit": "cover",
       "gravity": "auto"
     }
   }
   '''
   ```

2. Add a matching entry in `PATH_TEMPLATES` if you want path-based activation:
   ```toml
   PATH_TEMPLATES = '''
   {
     "banners": "banner"
   }
   '''
   ```

### Adding Remote Buckets

To configure additional remote origins:

1. Update the `REMOTE_BUCKETS` configuration:
   ```toml
   REMOTE_BUCKETS = '''
   {
     "default": "https://cdn.example.com",
     "marketing": "https://marketing-assets.example.com",
     "products": "https://product-images.example.com"
   }
   '''
   ```

2. Add corresponding path transformations if needed:
   ```toml
   PATH_TRANSFORMS = '''
   {
     "marketing": {
       "prefix": "campaign-assets/",
       "removePrefix": true
     }
   }
   '''
   ```

### URL Parameter Processing

The worker processes URL parameters in this order of precedence:

1. Explicit parameters in the URL query string
2. Derivative template specified by the `derivative` parameter
3. Path-based derivative detection
4. Responsive sizing fallback

This allows you to override template settings with specific parameters while maintaining the convenience of templates.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
