# Cloudflare Image Resizing Worker

A powerful, configurable Cloudflare Worker for dynamic image resizing and optimization. This worker intelligently serves optimized images based on device type, client capabilities, and URL parameters.

## Features

- **Dynamic image resizing** - Resize images on-the-fly with specific dimensions or automatic responsive sizing
- **Format optimization** - Automatically serve AVIF/WebP to supported browsers
- **Device detection** - Serve appropriately sized images based on device type
- **Client hints support** - Use browser-supplied information for optimal sizing
- **Predefined templates** - Define common image transformations (thumbnails, headers, etc.)
- **Path-based processing** - Apply transformations based on URL patterns
- **Remote bucket support** - Process images from various origins
- **Flexible deployment modes** - Run directly on your assets or as a proxy

## Installation

### Prerequisites

- Cloudflare account with Workers and Image Resizing enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed

### Quick Start

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/image-resizer.git
   cd image-resizer
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Update `wrangler.toml` with your Cloudflare account details and configuration

4. Deploy
   ```bash
   wrangler deploy
   ```

## Configuration

### Deployment Modes

The worker supports two deployment modes:

- **Direct mode** - Worker runs directly on the zone containing your images
- **Remote mode** - Worker runs as a proxy, fetching images from remote origins

### Configuration in wrangler.toml

Key configuration sections:

```toml
[env.prod.vars]
# Deployment mode (direct or remote)
DEPLOYMENT_MODE = "remote"

# Predefined transformation templates
DERIVATIVE_TEMPLATES = '''
{
  "header": {
    "width": 1600,
    "height": 73,
    "quality": 80,
    "fit": "scale-down"
  },
  "thumbnail": {
    "width": 320,
    "height": 150,
    "quality": 85,
    "fit": "scale-down",
    "sharpen": 1
  }
}
'''

# Path-to-template mappings
PATH_TEMPLATES = '''
{
  "profile-pictures": "avatar",
  "hero-banners": "header",
  "header": "header",
  "thumbnail": "thumbnail"
}
'''

# Remote bucket configuration (for remote mode)
REMOTE_BUCKETS = '''
{
  "default": "https://cdn.example.com"
}
'''

# Path transformation rules (for remote mode)
PATH_TRANSFORMS = '''
{
  "images": {
    "prefix": "",
    "removePrefix": true
  }
}
'''
```

## Usage

### Basic Usage

```
# Original image
https://images.erfi.dev/Granna_1.JPG

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

For best results with responsive images:

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
| `width` | Image width in pixels | `width=800` |
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

### Configuration Modules

- **Image configuration (`src/config/imageConfig.js`)**:
  - Defines image transformations templates
  - Configures cache settings
  - Sets up responsive width breakpoints

- **Environment configuration (`src/config/environmentConfig.js`)**:
  - Loads runtime configuration from environment variables
  - Handles backward compatibility
  - Provides defaults for missing configuration

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

#### Original Image
![Original Image](https://images.erfi.dev/Granna_1.JPG)
```
https://images.erfi.dev/Granna_1.JPG
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

### Debug Headers

The worker adds debugging headers to each response:

- `debug-ir` - Image transformation options
- `debug-cache` - Cache configuration
- `x-size-source` - Source of size determination (explicit, client-hints, device-type, etc.)

Example debug header values:
```
x-size-source: explicit-width
debug-ir: {"width":800,"source":"explicit-width","format":"avif"}
```

### Common Issues

- **"Too many redirects"** - Check for request loops in your worker routes
- **"Unsupported image format"** - Ensure the source is a valid image format
- **Incorrect sizing** - Check debug headers to see how sizing decisions are made
- **Deployment warnings** - Ensure all environment variables are duplicated in each environment section
- **Deployment failures** - Check that your wrangler.toml doesn't contain unsupported fields

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
